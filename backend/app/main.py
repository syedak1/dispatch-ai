import os
import json
import asyncio
from datetime import datetime
from typing import Dict, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# Import services
from app.services.orchestrator import classify_incident
from app.agents.fire_agent import run_fire_agent
from app.agents.ems_agent import run_ems_agent
from app.agents.police_agent import run_police_agent

try:
    from app.services.compression import compress_text
    HAS_COMPRESSION = True
except:
    HAS_COMPRESSION = False
    async def compress_text(t, a=0.5): return t

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting DispatchAI Backend...")
    print(f"GEMINI_API_KEY: {'Set' if os.getenv('GEMINI_API_KEY') else 'Missing'}")
    yield
    print("Shutting down...")

app = FastAPI(title="DispatchAI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.cameras: Dict[str, WebSocket] = {}
        self.dispatchers: List[WebSocket] = []
        self.buffers: Dict[str, List[dict]] = {}
        self.buffer_times: Dict[str, datetime] = {}
        self.last_snapshots: Dict[str, str] = {}
    
    async def connect_camera(self, ws: WebSocket, cam_id: str):
        await ws.accept()
        self.cameras[cam_id] = ws
        self.buffers[cam_id] = []
        self.buffer_times[cam_id] = datetime.now()
        print(f"Camera {cam_id} connected")
        await self.broadcast_dispatchers({"type": "camera_connected", "camera_id": cam_id})
    
    async def connect_dispatcher(self, ws: WebSocket):
        await ws.accept()
        self.dispatchers.append(ws)
        print(f"Dispatcher connected (total: {len(self.dispatchers)})")
        await ws.send_json({"type": "camera_list", "cameras": list(self.cameras.keys())})
    
    def disconnect_camera(self, cam_id: str):
        self.cameras.pop(cam_id, None)
        self.buffers.pop(cam_id, None)
        self.buffer_times.pop(cam_id, None)
        print(f"Camera {cam_id} disconnected")
    
    def disconnect_dispatcher(self, ws: WebSocket):
        if ws in self.dispatchers:
            self.dispatchers.remove(ws)
        print(f"Dispatcher disconnected (total: {len(self.dispatchers)})")
    
    async def broadcast_dispatchers(self, msg: dict):
        dead = []
        for ws in self.dispatchers:
            try:
                await ws.send_json(msg)
            except:
                dead.append(ws)
        for ws in dead:
            self.disconnect_dispatcher(ws)
    
    async def forward_frame(self, cam_id: str, frame: str):
        await self.broadcast_dispatchers({
            "type": "video_frame",
            "camera_id": cam_id,
            "frame": frame
        })
        self.last_snapshots[cam_id] = frame

mgr = ConnectionManager()
BUFFER_SECONDS = int(os.getenv("BUFFER_DURATION_SECONDS", "10"))

@app.get("/")
async def root():
    return {"status": "running", "cameras": len(mgr.cameras), "dispatchers": len(mgr.dispatchers)}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.websocket("/ws/camera/{cam_id}")
async def camera_ws(ws: WebSocket, cam_id: str):
    await mgr.connect_camera(ws, cam_id)
    try:
        while True:
            data = await ws.receive_json()
            
            if data.get("type") == "video_frame":
                await mgr.forward_frame(cam_id, data.get("frame", ""))
            
            elif data.get("type") == "overshoot_result":
                desc = data.get("description", "")
                snapshot = data.get("snapshot")
                if snapshot:
                    mgr.last_snapshots[cam_id] = snapshot
                
                mgr.buffers[cam_id].append({
                    "text": desc,
                    "timestamp": data.get("timestamp", datetime.now().isoformat()),
                    "snapshot": snapshot
                })
                
                elapsed = (datetime.now() - mgr.buffer_times[cam_id]).total_seconds()
                if elapsed >= BUFFER_SECONDS:
                    asyncio.create_task(process_buffer(cam_id))
            
            elif data.get("type") == "force_process":
                asyncio.create_task(process_buffer(cam_id))
                
    except WebSocketDisconnect:
        mgr.disconnect_camera(cam_id)

@app.websocket("/ws/dispatcher")
async def dispatcher_ws(ws: WebSocket):
    await mgr.connect_dispatcher(ws)
    try:
        while True:
            data = await ws.receive_json()
            if data.get("type") in ["confirm", "reject"]:
                print(f"Decision: {data.get('type')} for {data.get('incident_id')}")
    except WebSocketDisconnect:
        mgr.disconnect_dispatcher(ws)

async def process_buffer(cam_id: str):
    buf = mgr.buffers.get(cam_id, [])
    if not buf:
        return
    
    mgr.buffers[cam_id] = []
    mgr.buffer_times[cam_id] = datetime.now()
    
    raw = "\n".join([b["text"] for b in buf])
    snapshot = mgr.last_snapshots.get(cam_id) or (buf[-1].get("snapshot") if buf else None)
    
    print(f"[{cam_id}] Processing {len(buf)} descriptions...")
    
    # Compress
    compressed = await compress_text(raw) if HAS_COMPRESSION else raw
    
    # Classify
    classification = await classify_incident(compressed)
    
    if classification.get("incident_type") == "NONE":
        print(f"[{cam_id}] No emergency")
        return
    
    print(f"[{cam_id}] EMERGENCY: {classification.get('incident_type')}")
    
    # Run agents
    agents = classification.get("activate_agents", [])
    reports = {}
    
    for agent in agents:
        try:
            if agent == "FIRE":
                reports["fire"] = {"activated": True, **(await run_fire_agent(compressed))}
            elif agent == "EMS":
                reports["ems"] = {"activated": True, **(await run_ems_agent(compressed))}
            elif agent == "POLICE":
                reports["police"] = {"activated": True, **(await run_police_agent(compressed))}
        except Exception as e:
            reports[agent.lower()] = {"activated": True, "error": str(e)}
    
    for a in ["fire", "ems", "police"]:
        if a not in reports:
            reports[a] = {"activated": False}
    
    # Build alert
    inc_id = f"INC_{cam_id}_{int(datetime.now().timestamp())}"
    
    alert = {
        "id": inc_id,
        "timestamp": datetime.now().isoformat(),
        "camera_id": cam_id,
        "classification": {
            "incident_type": classification.get("incident_type", "UNKNOWN"),
            "severity": classification.get("severity", "MEDIUM"),
            "urgency": classification.get("urgency", "SOON"),
            "confidence": classification.get("confidence", 0.5)
        },
        "summary": classification.get("reasoning", "Incident detected"),
        "agents_activated": agents,
        "agent_reports": reports,
        "clip": {"start_time": None, "end_time": None, "url": None},
        "status": "PENDING_REVIEW",
        "raw_context": compressed[:500],
        "snapshot": snapshot
    }
    
    print(f"[{cam_id}] Sending alert: {inc_id}")
    await mgr.broadcast_dispatchers({"type": "alert", "data": alert})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)))