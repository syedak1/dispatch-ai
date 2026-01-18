import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

const TEST_INCIDENTS = [
  { type: 'MEDICAL', text: 'MEDICAL EMERGENCY: Person collapsed, appears unconscious, not moving.' },
  { type: 'FIRE', text: 'FIRE ALERT: Heavy smoke visible from building, people evacuating.' },
  { type: 'ACCIDENT', text: 'VEHICLE COLLISION: Two-car accident, airbags deployed, possible injuries.' },
];

interface Props {
  cameraId: string;
}

export default function MobileCameraView({ cameraId }: Props) {
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msgCount, setMsgCount] = useState(0);
  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  // Connect WebSocket
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`${WS_URL}/ws/camera/${cameraId}`);
      
      ws.onopen = () => {
        console.log('Connected');
        setConnected(true);
        setError(null);
      };
      
      ws.onclose = () => {
        console.log('Disconnected');
        setConnected(false);
        setTimeout(connect, 3000);
      };
      
      ws.onerror = () => {
        setError('Connection failed');
        setConnected(false);
      };
      
      wsRef.current = ws;
    };

    connect();
    return () => wsRef.current?.close();
  }, [cameraId]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setError(null);
    } catch (e) {
      setError('Camera access denied');
      console.error(e);
    }
  }, []);

  // Capture frame from video
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  }, []);

  // Start streaming frames
  const startStreaming = useCallback(() => {
    if (!connected || !cameraReady) return;
    
    setStreaming(true);
    frameIntervalRef.current = window.setInterval(() => {
      const frame = captureFrame();
      if (frame && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'video_frame',
          frame,
          timestamp: new Date().toISOString()
        }));
        setMsgCount(c => c + 1);
        setLastSnapshot(frame);
      }
    }, 500); // 2 FPS
  }, [connected, cameraReady, captureFrame]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setStreaming(false);
  }, []);

  // Send alert with current frame
  const sendAlert = useCallback((type: string) => {
    if (!connected) return;
    
    const frame = captureFrame();
    const incident = TEST_INCIDENTS.find(i => i.type === type) || TEST_INCIDENTS[0];
    
    // Send multiple descriptions to trigger processing
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        wsRef.current?.send(JSON.stringify({
          type: 'overshoot_result',
          description: `${incident.text} [Frame ${i + 1}/5]`,
          timestamp: new Date().toISOString(),
          snapshot: frame
        }));
      }, i * 300);
    }

    // Force process
    setTimeout(() => {
      wsRef.current?.send(JSON.stringify({ type: 'force_process' }));
    }, 2000);

    setLastSnapshot(frame);
  }, [connected, captureFrame]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopStreaming();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [stopStreaming]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="p-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">DispatchAI</h1>
            <p className="text-sm text-zinc-400">Camera: {cameraId}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm">{connected ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* Video Preview */}
      <div className="relative bg-black aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <button
              onClick={startCamera}
              className="px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-lg font-semibold"
            >
              Enable Camera
            </button>
          </div>
        )}

        {streaming && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium">LIVE</span>
          </div>
        )}

        {cameraReady && (
          <div className="absolute bottom-4 left-4 text-xs bg-black/70 px-2 py-1 rounded">
            {msgCount} frames sent
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex-1 p-4 space-y-4">
        {/* Stream Toggle */}
        {cameraReady && (
          <button
            onClick={streaming ? stopStreaming : startStreaming}
            disabled={!connected}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              streaming 
                ? 'bg-amber-600 hover:bg-amber-500' 
                : 'bg-green-600 hover:bg-green-500'
            } disabled:opacity-50`}
          >
            {streaming ? 'Stop Streaming' : 'Start Live Stream'}
          </button>
        )}

        {/* Alert Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => sendAlert('MEDICAL')}
            disabled={!connected || !cameraReady}
            className="py-4 bg-red-600 hover:bg-red-500 rounded-xl font-semibold disabled:opacity-50"
          >
            Medical
          </button>
          <button
            onClick={() => sendAlert('FIRE')}
            disabled={!connected || !cameraReady}
            className="py-4 bg-orange-600 hover:bg-orange-500 rounded-xl font-semibold disabled:opacity-50"
          >
            Fire
          </button>
          <button
            onClick={() => sendAlert('ACCIDENT')}
            disabled={!connected || !cameraReady}
            className="py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold disabled:opacity-50"
          >
            Accident
          </button>
        </div>

        {/* Last Snapshot */}
        {lastSnapshot && (
          <div className="p-3 bg-zinc-900 rounded-xl">
            <p className="text-xs text-zinc-400 mb-2">Last Captured Frame</p>
            <img src={lastSnapshot} alt="Last frame" className="w-full rounded-lg" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl">
            <p className="text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="p-4 bg-zinc-900 border-t border-zinc-800 text-xs text-zinc-500">
        Server: {WS_URL}
      </footer>
    </div>
  );
}