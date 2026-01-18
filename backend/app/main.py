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

# Load environment variables from .env file
# Load environment variables from .env file
from pathlib import Path
env_path = Path(__file__).parent.parent.parent / ".env"  # Three levels up: main.py -> app -> backend -> nexhacks
load_dotenv(dotenv_path=env_path)
print(f"📂 Loading .env from: {env_path}")
print(f"📂 .env exists: {env_path.exists()}")
print(f"🔑 GEMINI_API_KEY loaded: {os.getenv('GEMINI_API_KEY')[:20]}... (length: {len(os.getenv('GEMINI_API_KEY', ''))})")

# Import our services
from app.services.compression import compress_text
from app.services.orchestrator import classify_incident
from app.agents.fire_agent import run_fire_agent
from app.agents.ems_agent import run_ems_agent
from app.agents.police_agent import run_police_agent
from app.services.pheonix_tracer import init_phoenix, log_trace

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🚀 Starting DispatchAI Backend...")
    init_phoenix()
    yield
    print("👋 Shutting down...")


app = FastAPI(
    title="DispatchAI Backend",
    lifespan=lifespan
)

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve video clips as static files
os.makedirs("clips", exist_ok=True)
app.mount("/clips", StaticFiles(directory="clips"), name="clips")


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
        print(f"📷 Camera {camera_id} connected")
    
    async def connect_dispatcher(self, websocket: WebSocket):
        await websocket.accept()
        self.dispatcher_connections.append(websocket)
        print(f"👤 Dispatcher connected. Total: {len(self.dispatcher_connections)}")
    
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
        print(f"👤 Dispatcher disconnected. Total: {len(self.dispatcher_connections)}")
    
    async def broadcast_to_dispatchers(self, message: dict):
        """Send message to all connected dispatchers."""
        disconnected = []
        for ws in self.dispatcher_connections:
            try:
                await ws.send_json(message)
            except:
                disconnected.append(ws)
        
        # Clean up disconnected
        for ws in disconnected:
            self.disconnect_dispatcher(ws)


manager = ConnectionManager()

# Configuration
BUFFER_DURATION_SECONDS = 30  # Collect 30 seconds before processing


@app.get("/")
async def root():
    return {
        "status": "running",
        "service": "DispatchAI Backend",
        "cameras_connected": len(manager.camera_connections),
        "dispatchers_connected": len(manager.dispatcher_connections)
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
                # Store the description
                description = data.get("description", "")
                timestamp = data.get("timestamp", datetime.now().isoformat())
                
                manager.text_buffers[camera_id].append({
                    "text": description,
                    "timestamp": timestamp
                })
                
                print(f"📝 [{camera_id}] {description[:50]}...")
                
                # Check if we should process the buffer
                elapsed = (datetime.now() - manager.buffer_start_times[camera_id]).total_seconds()
                
                if elapsed >= BUFFER_DURATION_SECONDS:
                    print(f"⏰ [{camera_id}] Buffer full ({elapsed:.0f}s), processing...")
                    await process_buffer(camera_id)
            
            elif data.get("type") == "clip_ready":
                # Frontend has saved a clip
                clip_url = data.get("url")
                incident_id = data.get("incident_id")
                print(f"🎬 [{camera_id}] Clip ready for {incident_id}: {clip_url}")
                
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
                print(f"❌ Incident {incident_id} REJECTED by {dispatcher_id}: {reason}")
                
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
    1. Combine all text
    2. Compress with Token Company
    3. Classify with Orchestrator
    4. Run relevant agents
    5. Generate and send alert
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
    print(f"📄 [{camera_id}] Combined text: {len(raw_text)} characters")
    
    # Step 1: COMPRESS
    print(f"🗜️ [{camera_id}] Compressing...")
    compressed_text = await compress_text(raw_text)
    
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
    
    print(f"🚨 [{camera_id}] Emergency detected: {classification.get('incident_type')}")
    
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
            print(f"  ✓ {agent_name} agent complete")
        except Exception as e:
            print(f"  ✗ {agent_name} agent error: {e}")
            agent_reports[agent_name] = {"activated": True, "error": str(e)}
    
    # Mark non-activated agents
    for agent in ["fire", "ems", "police"]:
        if agent not in agent_reports:
            agent_reports[agent] = {
                "activated": False,
                "reason": f"Not needed for {classification.get('incident_type')} incident"
            }
    
    # Step 4: BUILD REPORT
    incident_id = f"inc_{camera_id}_{int(datetime.now().timestamp())}"
    
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
            "url": None  # Will be set when frontend provides clip
        },
        "status": "PENDING_REVIEW",
        "raw_context": compressed_text[:500]  # First 500 chars for reference
    }
    
    log_trace("report_generated", {
        "incident_id": incident_id,
        "camera_id": camera_id,
        "classification": report["classification"],
        "agents_activated": agents_to_run
    })
    
    # Step 5: SEND ALERT TO DISPATCHERS
    print(f"📢 [{camera_id}] Sending alert to dispatchers...")
    await manager.broadcast_to_dispatchers({
        "type": "alert",
        "data": report
    })
    
    # Also tell the camera frontend to prepare a clip
    if camera_id in manager.camera_connections:
        try:
            await manager.camera_connections[camera_id].send_json({
                "type": "request_clip",
                "incident_id": incident_id,
                "duration_seconds": 15
            })
        except:
            pass
    
    print(f"✅ [{camera_id}] Alert sent: {incident_id}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # Auto-reload on code changes
    )