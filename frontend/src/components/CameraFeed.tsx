import { useState, useCallback, useRef } from 'react';
import { useCameraSocket } from '../hooks/useWebSocket';
import { useOvershoot, isMobileDevice } from '../hooks/useOvershoot';

interface CameraFeedProps {
  cameraId: string;
  cameraName: string;
  isFullscreen?: boolean;
  onRemove?: () => void;
}

/**
 * INCIDENT DESCRIPTIONS - These WILL trigger alerts!
 * 
 * The backend classifies these as emergencies because they mention:
 * - Injuries, unconscious people (EMS)
 * - Smoke, fire (FIRE)
 * - Accidents, collisions (POLICE/EMS)
 */
const TEST_INCIDENTS = [
  {
    type: 'EMS',
    descriptions: [
      '⚠️ MEDICAL EMERGENCY: Person collapsed on sidewalk, appears unconscious. Not moving. Two bystanders nearby looking concerned.',
      'Person still on ground, not moving. One bystander kneeling beside them. Another person appears to be on phone.',
      'Situation unchanged. Person remains unresponsive on ground. Small crowd gathering.',
    ]
  },
  {
    type: 'FIRE', 
    descriptions: [
      '⚠️ FIRE DETECTED: Heavy dark smoke visible from second floor window. Smoke is thick and gray.',
      'Smoke continuing from building. People visible exiting through front door. No flames visible yet.',
      'Evacuation in progress. More smoke visible. Several people gathered outside building.',
    ]
  },
  {
    type: 'ACCIDENT',
    descriptions: [
      '⚠️ VEHICLE COLLISION: Two cars involved in accident. Sedan with front damage, SUV with side damage.',
      'Airbags deployed in sedan. Steam or smoke from engine compartment. One person exiting vehicle.',
      'Driver appears to be holding arm. Second vehicle occupants checking on first driver.',
    ]
  }
];

export default function CameraFeed({ cameraId, cameraName, isFullscreen = false, onRemove }: CameraFeedProps) {
  const [lastDescription, setLastDescription] = useState('Waiting for connection...');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<'camera' | 'video'>('camera');
  const [descriptionCount, setDescriptionCount] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { connected, sendDescription } = useCameraSocket(cameraId);

  // Handle Overshoot/mock descriptions
  const handleDescription = useCallback((description: string, timestamp: string) => {
    setLastDescription(description);
    setDescriptionCount(prev => prev + 1);
    if (connected) {
      sendDescription(description, timestamp);
    }
  }, [connected, sendDescription]);

  const handleError = useCallback((error: Error) => {
    console.error(`[${cameraId}] Error:`, error);
    setLastDescription(`Error: ${error.message}`);
  }, [cameraId]);

  // Initialize Overshoot/mock mode
  const { isActive, hasPermission, mode } = useOvershoot({
    onDescription: handleDescription,
    onError: handleError,
    enabled: connected,
    sourceType,
    ...(videoFile && { videoFile }),
  });

  // Handle video file upload
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setSourceType('video');
    }
  }, []);

  /**
   * TRIGGER TEST INCIDENT
   * 
   * This sends incident descriptions that WILL trigger an alert.
   * Use this to demo the system to judges!
   */
  const triggerTestIncident = useCallback(() => {
    if (isTesting) return;
    
    setIsTesting(true);
    const incident = TEST_INCIDENTS[Math.floor(Math.random() * TEST_INCIDENTS.length)];
    
    console.log(`🚨 [${cameraId}] Triggering ${incident.type} incident...`);
    
    // Send each description with a delay to simulate real video analysis
    incident.descriptions.forEach((desc, index) => {
      setTimeout(() => {
        setLastDescription(desc);
        sendDescription(desc, new Date().toISOString());
        console.log(`  📝 Sent: ${desc.substring(0, 50)}...`);
        
        if (index === incident.descriptions.length - 1) {
          setIsTesting(false);
        }
      }, index * 2000); // 2 seconds apart
    });
  }, [cameraId, sendDescription, isTesting]);

  const isMobile = isMobileDevice();

  return (
    <div className={`relative bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden ${
      isFullscreen ? 'h-full' : 'h-full min-h-[200px]'
    }`}>
      {/* Camera placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 opacity-30">{isMobile ? '📱' : '📹'}</div>
          <div className="text-sm text-[#737373]">
            {!connected ? 'Connecting...' : 
             mode === 'overshoot' ? 'Overshoot Active' : 
             'Mock Mode (Demo)'}
          </div>
        </div>
      </div>

      {/* Status bar - top left */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
        <span className={`w-2.5 h-2.5 rounded-full ${
          connected ? (isActive ? 'bg-green-500 animate-pulse' : 'bg-green-500') : 'bg-red-500'
        }`} />
        <span className="text-xs font-mono text-white bg-black/50 px-2 py-1 rounded">
          {cameraId}
        </span>
        {descriptionCount > 0 && (
          <span className="text-xs font-mono text-green-400 bg-black/50 px-2 py-1 rounded">
            #{descriptionCount}
          </span>
        )}
      </div>

      {/* Recording indicator */}
      {isActive && (
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <span className="text-xs text-red-500 font-mono flex items-center gap-1 bg-black/50 px-2 py-1 rounded">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {mode === 'overshoot' ? 'LIVE' : 'MOCK'}
          </span>
        </div>
      )}

      {/* Control buttons - right side */}
      <div className="absolute top-12 right-3 flex flex-col gap-2 z-10">
        {/* TEST INCIDENT BUTTON - Most important for demos! */}
        <button
          onClick={triggerTestIncident}
          disabled={!connected || isTesting}
          className={`px-3 py-2 text-white text-xs rounded font-bold transition-all ${
            isTesting 
              ? 'bg-yellow-600 animate-pulse' 
              : 'bg-red-600 hover:bg-red-500 hover:scale-105'
          } disabled:opacity-50`}
          title="Send test incident to trigger alert"
        >
          {isTesting ? '⏳ Sending...' : '🚨 TEST ALERT'}
        </button>

        {/* Upload Video */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 bg-blue-600/80 text-white text-xs rounded hover:bg-blue-600"
        >
          📁 Video
        </button>

        {/* Switch to Camera */}
        {videoFile && (
          <button
            onClick={() => { setVideoFile(null); setSourceType('camera'); }}
            className="px-3 py-1.5 bg-gray-600/80 text-white text-xs rounded hover:bg-gray-600"
          >
            📷 Camera
          </button>
        )}

        {/* Remove Camera */}
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="px-3 py-1.5 bg-gray-800/80 text-white text-xs rounded hover:bg-gray-700"
          >
            ✕
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Info bar - bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent z-10">
        <p className="text-sm text-white font-medium">{cameraName}</p>
        <p className="text-xs text-[#a0a0a0] mt-1 line-clamp-2">{lastDescription}</p>
      </div>

      {/* Camera permission denied overlay */}
      {hasPermission === false && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20">
          <div className="text-center p-6">
            <div className="text-4xl mb-3">🚫</div>
            <p className="text-white mb-2">Camera access denied</p>
            <p className="text-xs text-[#737373] mb-4">
              Allow camera access in browser settings
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}