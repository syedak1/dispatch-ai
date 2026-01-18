import { useEffect, useRef, useState, useCallback } from 'react';
import { useCameraSocket } from '../hooks/useWebSocket';

interface CameraFeedProps {
  cameraId: string;
  cameraName: string;
  isFullscreen?: boolean;
}

// Simulated Overshoot-like prompts for demo
const DEMO_DESCRIPTIONS = [
  "Normal scene. Street visible with parked cars. No people in frame.",
  "Two pedestrians walking on sidewalk. Clear weather. No incidents.",
  "Light traffic. Three vehicles passing through intersection.",
  "Empty parking lot. Street lights on. No activity.",
];

const INCIDENT_DESCRIPTIONS = [
  "⚠️ Vehicle collision detected. Two cars involved. Smoke visible from engine. One person exiting vehicle, appears uninjured. Second person still in car.",
  "⚠️ Person lying on ground near bus stop. Not moving. Three bystanders gathering. One person on phone, possibly calling for help.",
  "⚠️ Smoke visible from third floor window of building. No flames visible yet. People gathering outside on street.",
];

export default function CameraFeed({ cameraId, cameraName, isFullscreen = false }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [lastDescription, setLastDescription] = useState('Initializing...');
  const [isSimulating, setIsSimulating] = useState(false);
  const { connected, sendDescription } = useCameraSocket(cameraId);

  // Try to get real camera
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasCamera(true);
        }
      } catch (err) {
        console.log('No camera access, using demo mode');
        setHasCamera(false);
      }
    }

    setupCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Simulate Overshoot descriptions (for demo without real Overshoot)
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(() => {
      // 90% chance of normal, 10% chance of incident
      const descriptions = Math.random() > 0.9 ? INCIDENT_DESCRIPTIONS : DEMO_DESCRIPTIONS;
      const description = descriptions[Math.floor(Math.random() * descriptions.length)];
      
      setLastDescription(description);
      sendDescription(description);
    }, 3000); // Send every 3 seconds

    return () => clearInterval(interval);
  }, [connected, sendDescription]);

  // Manual incident trigger for testing
  const triggerIncident = useCallback(() => {
    const incident = INCIDENT_DESCRIPTIONS[Math.floor(Math.random() * INCIDENT_DESCRIPTIONS.length)];
    setLastDescription(incident);
    sendDescription(incident);
    
    // Send a few more to fill the buffer
    setTimeout(() => sendDescription(incident + " Situation ongoing."), 1000);
    setTimeout(() => sendDescription(incident + " Emergency services may be needed."), 2000);
  }, [sendDescription]);

  return (
    <div className={`relative bg-[#141414] border border-[#2a2a2a] rounded overflow-hidden ${
      isFullscreen ? 'h-full' : 'h-full min-h-[200px]'
    }`}>
      {/* Video or placeholder */}
      {hasCamera ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2 opacity-20">📹</div>
            <div className="text-xs text-[#737373]">Demo Mode</div>
          </div>
        </div>
      )}

      {/* Camera ID */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span className="text-xs font-mono text-[#737373] uppercase tracking-wider">
          {cameraId}
        </span>
      </div>

      {/* Recording indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="text-xs text-red-500 font-mono flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
          REC
        </span>
      </div>

      {/* Test button */}
      <button
        onClick={triggerIncident}
        className="absolute top-3 right-16 px-2 py-1 bg-red-600/80 text-white text-xs rounded hover:bg-red-600"
      >
        Test Alert
      </button>

      {/* Info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
        <p className="text-xs text-white font-medium">{cameraName}</p>
        <p className="text-xs text-[#737373] mt-1 line-clamp-2">{lastDescription}</p>
      </div>
    </div>
  );
}