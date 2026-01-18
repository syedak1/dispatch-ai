import { useState, useCallback, useRef } from 'react';
import { useCameraSocket } from '../hooks/useWebSocket';
import { useOvershoot } from '../hooks/useOvershoot';

interface CameraFeedProps {
  cameraId: string;
  cameraName: string;
  isFullscreen?: boolean;
}

// Demo descriptions as fallback
const INCIDENT_DESCRIPTIONS = [
  "⚠️ COLLISION: Two-vehicle accident. Sedan and SUV. Visible damage. Smoke from sedan engine. One person exiting vehicle.",
  "⚠️ MEDICAL: Person collapsed on sidewalk. Not moving. Three bystanders gathering. One person on phone.",
  "⚠️ FIRE: Heavy smoke from second-floor window. Dark gray smoke. No visible flames yet. People evacuating.",
];

export default function CameraFeed({ cameraId, cameraName, isFullscreen = false }: CameraFeedProps) {
  const [lastDescription, setLastDescription] = useState('Initializing...');
  const [useOvershootMode] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<'camera' | 'video'>('camera');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { connected, sendDescription } = useCameraSocket(cameraId);

  // Handle Overshoot descriptions
  const handleOvershootDescription = useCallback((description: string, timestamp: string) => {
    console.log('📹 Overshoot:', description);
    setLastDescription(description);
    if (connected) {
      sendDescription(description, timestamp);
    }
  }, [connected, sendDescription]);

  const handleOvershootError = useCallback((error: Error) => {
    console.error('Overshoot error:', error);
    setLastDescription(`Error: ${error.message}`);
  }, []);

  // Handle video file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setSourceType('video');
      console.log('📹 Video file selected:', file.name);
    }
  }, []);

  // Initialize Overshoot
  // Initialize Overshoot
// Initialize Overshoot
const overshootConfig = {
  onDescription: handleOvershootDescription,
  onError: handleOvershootError,
  enabled: useOvershootMode && connected,
  sourceType,
  ...(videoFile && { videoFile }),
};

const { isActive } = useOvershoot(overshootConfig);

  // Manual incident trigger for testing
  const triggerIncident = useCallback(() => {
    const incident = INCIDENT_DESCRIPTIONS[Math.floor(Math.random() * INCIDENT_DESCRIPTIONS.length)];
    setLastDescription(incident);
    sendDescription(incident);

    setTimeout(() => sendDescription(incident + " Situation ongoing."), 1000);
    setTimeout(() => sendDescription(incident + " Emergency services may be needed."), 2000);
  }, [sendDescription]);

  return (
    <div className={`relative bg-[#141414] border border-[#2a2a2a] rounded overflow-hidden ${
      isFullscreen ? 'h-full' : 'h-full min-h-[200px]'
    }`}>
      {/* Overshoot handles the camera internally, so we show a placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2 opacity-20">📹</div>
          <div className="text-xs text-[#737373]">
            {isActive ? (sourceType === 'video' ? 'Analyzing Video' : 'Overshoot Active') : 'Initializing...'}
          </div>
          {videoFile && (
            <div className="text-xs text-blue-400 mt-1">{videoFile.name}</div>
          )}
        </div>
      </div>

      {/* Camera ID */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span className="text-xs font-mono text-[#737373] uppercase tracking-wider">
          {cameraId}
        </span>
        {isActive && (
          <span className="text-xs text-blue-500 font-mono">
            {sourceType === 'video' ? 'VIDEO' : 'OVERSHOOT'}
          </span>
        )}
      </div>

      {/* Recording indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="text-xs text-red-500 font-mono flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
          REC
        </span>
      </div>

      {/* Control buttons */}
      <div className="absolute top-3 right-16 flex items-center gap-2">
        {/* Upload Video button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 bg-blue-600/80 text-white text-xs rounded hover:bg-blue-600"
        >
          📁 Upload Video
        </button>

        {/* Switch to Camera button (if video is selected) */}
        {videoFile && (
          <button
            onClick={() => {
              setVideoFile(null);
              setSourceType('camera');
            }}
            className="px-2 py-1 bg-gray-600/80 text-white text-xs rounded hover:bg-gray-600"
          >
            📷 Use Camera
          </button>
        )}

        {/* Test Alert button */}
        <button
          onClick={triggerIncident}
          className="px-2 py-1 bg-red-600/80 text-white text-xs rounded hover:bg-red-600"
        >
          Test Alert
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
        <p className="text-xs text-white font-medium">{cameraName}</p>
        <p className="text-xs text-[#737373] mt-1 line-clamp-2">{lastDescription}</p>
      </div>
    </div>
  );
}