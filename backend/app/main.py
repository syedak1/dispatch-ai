import os
import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import our services
from app.services.orchestrator import classify_incident
from app.agents.fire_agent import run_fire_agent
from app.agents.ems_agent import run_ems_agent
from app.agents.police_agent import run_police_agent

# Try to import optional services
try:
    from app.services.compression import compress_text
    HAS_COMPRESSION = True
except ImportError:
    HAS_COMPRESSION = False
    async def compress_text(text: str, aggressiveness: float = 0.5) -> str:
        return text

try:
    from app.services.phoenix_tracer import init_phoenix, log_trace
    HAS_PHOENIX = True
except ImportError:
    HAS_PHOENIX = False
    def init_phoenix(): pass
    def log_trace(event_name: str, data: dict): 
        print(f"📊 [TRACE:{event_name}] {data}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🚀 Starting DispatchAI Backend...")
    print(f"   GEMINI_API_KEY: {'✓ Set' if os.getenv('GEMINI_API_KEY') else '✗ Missing'}")
    print(f"   Compression: {'✓ Enabled' if HAS_COMPRESSION else '✗ Disabled'}")
    print(f"   Phoenix: {'✓ Enabled' if HAS_PHOENIX else '✗ Disabled'}")
    if HAS_PHOENIX:
        init_phoenix()
    yield
    print("👋 Shutting down...")


app = FastAPI(
    title="DispatchAI Backend",
    lifespan=lifespan
)

# CORS - Allow your Vercel frontend
# UPDATE THESE WITH YOUR ACTUAL DOMAINS
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    # Add your Vercel URLs here:
    # "https://your-app.vercel.app",
    # "https://dispatchai.vercel.app",
]

# Also allow any vercel.app subdomain for preview deployments
import re
def is_allowed_origin(origin: str) -> bool:
    if origin in ALLOWED_ORIGINS:
        return True
    if origin and re.match(r"https://.*\.vercel\.app$", origin):
        return True
    return False

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, use specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    """Manages WebSocket connections and text buffers."""
    
    def __init__(self):
        self.camera_connections: Dict[str, WebSocket] = {}
        self.dispatcher_connections: List[WebSocket] = []
        self.text_buffers: Dict[str, List[dict]] = {}
        self.buffer_start_times: Dict[str, datetime] = {}
    
    async def connect_camera(self, websocket: WebSocket, camera_id: str):
        await websocket.accept()
        self.camera_connections[camera_id] = websocket
        self.text_buffers[camera_id] = []
        self.buffer_start_times[camera_id] = datetime.now()
        print(f"📷 Camera {camera_id} connected (total: {len(self.camera_connections)})")
        
        # Notify dispatchers
        await self.broadcast_to_dispatchers({
            "type": "camera_connected",
            "camera_id": camera_id
        })
    
    async def connect_dispatcher(self, websocket: WebSocket):
        await websocket.accept()
        self.dispatcher_connections.append(websocket)
        print(f"👤 Dispatcher connected (total: {len(self.dispatcher_connections)})")
        
        # Send current camera list
        await websocket.send_json({
            "type": "camera_list",
            "cameras": list(self.camera_connections.keys())
        })
    
    def disconnect_camera(self, camera_id: str):
        if camera_id in self.camera_connections:
            del self.camera_connections[camera_id]
        if camera_id in self.text_buffers:
            del self.text_buffers[camera_id]
        if camera_id in self.buffer_start_times:
            del self.buffer_start_times[camera_id]
        print(f"📷 Camera {camera_id} disconnected")
    
    def disconnect_dispatcher(self, websocket: WebSocket):
        if websocket in self.dispatcher_connections:
            self.dispatcher_connections.remove(websocket)
        print(f"👤 Dispatcher disconnected (total: {len(self.dispatcher_connections)})")
    
    async def broadcast_to_dispatchers(self, message: dict):
        """Send message to all connected dispatchers."""
        disconnected = []
        for ws in self.dispatcher_connections:
            try:
                await ws.send_json(message)
            except:
                disconnected.append(ws)
        
        for ws in disconnected:
            self.disconnect_dispatcher(ws)


manager = ConnectionManager()

# Configuration - CHANGE THIS TO ADJUST BUFFER TIME
BUFFER_DURATION_SECONDS = int(os.getenv("BUFFER_DURATION_SECONDS", "15"))  # Reduced to 15s for faster demos


@app.get("/")
async def root():
    return {
        "status": "running",
        "service": "DispatchAI Backend",
        "cameras_connected": len(manager.camera_connections),
        "dispatchers_connected": len(manager.dispatcher_connections),
        "buffer_duration": BUFFER_DURATION_SECONDS
    }


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.websocket("/ws/camera/{camera_id}")
async def camera_websocket(websocket: WebSocket, camera_id: str):
    """
    WebSocket endpoint for cameras.
    Receives Overshoot descriptions from frontend.
    """
    await manager.connect_camera(websocket, camera_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "overshoot_result":
                description = data.get("description", "")
                timestamp = data.get("timestamp", datetime.now().isoformat())
                
                manager.text_buffers[camera_id].append({
                    "text": description,
                    "timestamp": timestamp
                })
                
                print(f"📝 [{camera_id}] {description[:60]}...")
                
                # Check if we should process the buffer
                elapsed = (datetime.now() - manager.buffer_start_times[camera_id]).total_seconds()
                
                if elapsed >= BUFFER_DURATION_SECONDS:
                    print(f"⏰ [{camera_id}] Buffer full ({elapsed:.0f}s), processing...")
                    asyncio.create_task(process_buffer(camera_id))
            
            elif data.get("type") == "force_process":
                # Allow manual trigger for testing
                print(f"🔧 [{camera_id}] Force processing buffer...")
                asyncio.create_task(process_buffer(camera_id))
                
    except WebSocketDisconnect:
        manager.disconnect_camera(camera_id)
    except Exception as e:
        print(f"❌ Camera WebSocket error: {e}")
        manager.disconnect_camera(camera_id)


@app.websocket("/ws/dispatcher")
async def dispatcher_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for dispatcher dashboard.
    Sends alerts and receives confirm/reject decisions.
    """
    await manager.connect_dispatcher(websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "confirm":
                incident_id = data.get("incident_id")
                dispatcher_id = data.get("dispatcher_id", "unknown")
                print(f"✅ Incident {incident_id} CONFIRMED by {dispatcher_id}")
                
                log_trace("dispatcher_decision", {
                    "incident_id": incident_id,
                    "decision": "CONFIRMED",
                    "dispatcher_id": dispatcher_id,
                    "timestamp": datetime.now().isoformat()
                })
                
            elif data.get("type") == "reject":
                incident_id = data.get("incident_id")
                reason = data.get("reason", "No reason provided")
                dispatcher_id = data.get("dispatcher_id", "unknown")
                print(f"❌ Incident {incident_id} REJECTED: {reason}")
                
                log_trace("dispatcher_decision", {
                    "incident_id": incident_id,
                    "decision": "REJECTED",
                    "reason": reason,
                    "dispatcher_id": dispatcher_id,
                    "timestamp": datetime.now().isoformat()
                })
                
    except WebSocketDisconnect:
        manager.disconnect_dispatcher(websocket)
    except Exception as e:
        print(f"❌ Dispatcher WebSocket error: {e}")
        manager.disconnect_dispatcher(websocket)


async def process_buffer(camera_id: str):
    """
    Process the accumulated text buffer for a camera.
    """
    buffer = manager.text_buffers.get(camera_id, [])
    
    if not buffer:
        print(f"⚠️ [{camera_id}] Empty buffer, skipping")
        return
    
    # Reset buffer for next cycle
    manager.text_buffers[camera_id] = []
    manager.buffer_start_times[camera_id] = datetime.now()
    
    # Combine all descriptions
    raw_text = "\n".join([item["text"] for item in buffer])
    print(f"📄 [{camera_id}] Processing {len(buffer)} descriptions ({len(raw_text)} chars)")
    
    # Step 1: COMPRESS (if available)
    if HAS_COMPRESSION:
        print(f"🗜️ [{camera_id}] Compressing...")
        compressed_text = await compress_text(raw_text)
    else:
        compressed_text = raw_text
    
    # Step 2: CLASSIFY
    print(f"🧠 [{camera_id}] Classifying...")
    classification = await classify_incident(compressed_text)
    
    log_trace("classification", {
        "camera_id": camera_id,
        "input_length": len(compressed_text),
        "classification": classification
    })
    
    # Check if this is actually an emergency
    if classification.get("incident_type") == "NONE":
        print(f"✨ [{camera_id}] No emergency detected")
        return
    
    print(f"🚨 [{camera_id}] EMERGENCY: {classification.get('incident_type')} - {classification.get('severity')}")
    
    # Step 3: RUN AGENTS
    agents_to_run = classification.get("activate_agents", [])
    agent_reports = {}
    
    # Run agents in parallel
    tasks = []
    
    if "FIRE" in agents_to_run:
        tasks.append(("fire", run_fire_agent(compressed_text)))
    if "EMS" in agents_to_run:
        tasks.append(("ems", run_ems_agent(compressed_text)))
    if "POLICE" in agents_to_run:
        tasks.append(("police", run_police_agent(compressed_text)))
    
    print(f"🤖 [{camera_id}] Running agents: {[t[0] for t in tasks]}")
    
    for agent_name, coro in tasks:
        try:
            result = await coro
            agent_reports[agent_name] = {"activated": True, **result}
            print(f"  ✓ {agent_name} complete")
        except Exception as e:
            print(f"  ✗ {agent_name} error: {e}")
            agent_reports[agent_name] = {"activated": True, "error": str(e)}
    
    # Mark non-activated agents
    for agent in ["fire", "ems", "police"]:
        if agent not in agent_reports:
            agent_reports[agent] = {
                "activated": False,
                "reason": f"Not needed for {classification.get('incident_type')} incident"
            }
    
    # Step 4: BUILD REPORT
    incident_id = f"INC_{camera_id}_{int(datetime.now().timestamp())}"
    
    report = {
        "id": incident_id,
        "timestamp": datetime.now().isoformat(),
        "camera_id": camera_id,
        "classification": {
            "incident_type": classification.get("incident_type", "UNKNOWN"),
            "severity": classification.get("severity", "MEDIUM"),
            "urgency": classification.get("urgency", "SOON"),
            "confidence": classification.get("confidence", 0.5)
        },
        "summary": classification.get("reasoning", "Incident detected"),
        "agents_activated": agents_to_run,
        "agent_reports": agent_reports,
        "clip": {
            "start_time": buffer[0]["timestamp"] if buffer else None,
            "end_time": buffer[-1]["timestamp"] if buffer else None,
            "url": None
        },
        "status": "PENDING_REVIEW",
        "raw_context": compressed_text[:500]
    }
    
    log_trace("report_generated", {
        "incident_id": incident_id,
        "camera_id": camera_id,
        "classification": report["classification"],
        "agents_activated": agents_to_run
    })
    
    # Step 5: SEND ALERT TO DISPATCHERS
    print(f"📢 [{camera_id}] Sending alert: {incident_id}")
    await manager.broadcast_to_dispatchers({
        "type": "alert",
        "data": report
    })
    
    print(f"✅ [{camera_id}] Alert sent!")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )