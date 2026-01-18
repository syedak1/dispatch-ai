import { useState, useCallback, useRef, useEffect } from 'react';
import { useCameraSocket } from '../hooks/useWebSocket';

interface CameraFeedProps {
  cameraId: string;
  cameraName: string;
  isFullscreen?: boolean;
  onRemove?: () => void;
}

// Test incidents that will trigger alerts
const TEST_INCIDENTS = [
  {
    type: 'MEDICAL',
    descriptions: [
      'MEDICAL EMERGENCY: Person collapsed on sidewalk, appears unconscious. Not moving.',
      'Person still on ground, not responsive. One bystander kneeling beside them.',
      'Situation unchanged. Person remains unresponsive. Small crowd gathering.',
      'Multiple bystanders now present. One person appears to be on phone.',
      'Emergency situation ongoing. Person has not moved. Awaiting response.',
    ]
  },
  {
    type: 'FIRE',
    descriptions: [
      'FIRE ALERT: Heavy dark smoke visible from second floor window of building.',
      'Smoke continuing from building. People visible exiting through front door.',
      'Evacuation in progress. More smoke visible. Several people gathered outside.',
      'Smoke intensifying. No visible flames yet. Building appears to be commercial.',
      'Situation ongoing. Smoke still emanating from window. Crowd at safe distance.',
    ]
  },
  {
    type: 'ACCIDENT',
    descriptions: [
      'VEHICLE COLLISION: Two cars involved in accident at intersection.',
      'Sedan with front-end damage, SUV with side damage. Airbags deployed in sedan.',
      'Steam or smoke from sedan engine compartment. One person exiting vehicle.',
      'Driver appears to be holding arm. Second vehicle occupants checking on first driver.',
      'Both vehicles stationary. Debris on roadway. Traffic backing up.',
    ]
  }
];

// Normal activity descriptions (won't trigger alerts)
const NORMAL_DESCRIPTIONS = [
  'Street scene with pedestrians walking on sidewalk. Light vehicle traffic.',
  'Parking lot view. Several parked cars. One person walking toward building.',
  'Intersection with traffic light. Cars waiting at red light. Normal activity.',
  'Office building entrance. People entering and exiting. No incidents.',
  'Residential street. Parked cars. Person walking dog on sidewalk.',
];

export default function CameraFeed({ cameraId, cameraName, isFullscreen = false, onRemove }: CameraFeedProps) {
  const [lastDescription, setLastDescription] = useState('Awaiting connection...');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<'camera' | 'video'>('camera');
  const [descriptionCount, setDescriptionCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamIntervalRef = useRef<number | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  
  const { connected, sendDescription, forceProcess } = useCameraSocket(cameraId);

  // Handle video file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setSourceType('video');
      setLastDescription(`Video loaded: ${file.name}`);
    }
  }, []);

  // Switch back to camera mode
  const switchToCamera = useCallback(() => {
    setVideoFile(null);
    setSourceType('camera');
    setLastDescription('Switched to camera mode');
  }, []);

  // Send a single description
  const sendSingleDescription = useCallback((text: string) => {
    if (!connected) return false;
    const sent = sendDescription(text, new Date().toISOString());
    if (sent) {
      setLastDescription(text);
      setDescriptionCount(prev => prev + 1);
    }
    return sent;
  }, [connected, sendDescription]);

  // Send test incident (triggers alert)
  const sendTestIncident = useCallback(() => {
    if (!connected || isSending) return;
    
    setIsSending(true);
    const incident = TEST_INCIDENTS[Math.floor(Math.random() * TEST_INCIDENTS.length)];
    
    console.log(`[${cameraId}] Sending ${incident.type} test incident...`);
    
    // Send each description with delay
    incident.descriptions.forEach((desc, index) => {
      setTimeout(() => {
        sendSingleDescription(desc);
        
        if (index === incident.descriptions.length - 1) {
          // Force process after all messages sent
          setTimeout(() => {
            forceProcess();
            setIsSending(false);
            console.log(`[${cameraId}] Test incident sent, buffer processing triggered`);
          }, 500);
        }
      }, index * 500);
    });
  }, [cameraId, connected, isSending, sendSingleDescription, forceProcess]);

  // Toggle auto-streaming (simulates continuous feed)
  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      // Stop streaming
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
      setIsStreaming(false);
      setLastDescription('Streaming stopped');
      console.log(`[${cameraId}] Streaming stopped`);
    } else {
      // Start streaming normal descriptions
      setIsStreaming(true);
      setLastDescription('Streaming started...');
      console.log(`[${cameraId}] Streaming started`);
      
      let index = 0;
      streamIntervalRef.current = window.setInterval(() => {
        const desc = NORMAL_DESCRIPTIONS[index % NORMAL_DESCRIPTIONS.length];
        sendSingleDescription(desc);
        index++;
      }, 2000);
    }
  }, [cameraId, isStreaming, sendSingleDescription]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, []);

  // Update video preview when file changes
  useEffect(() => {
    if (videoFile && videoPreviewRef.current) {
      const url = URL.createObjectURL(videoFile);
      videoPreviewRef.current.src = url;
      return () => URL.revokeObjectURL(url);
    }
  }, [videoFile]);

  const getStatusText = () => {
    if (!connected) return 'Disconnected';
    if (isStreaming) return 'Streaming';
    if (isSending) return 'Sending...';
    if (videoFile) return 'Video loaded';
    return 'Connected';
  };

  const getStatusColor = () => {
    if (!connected) return 'bg-red-500/20 text-red-400';
    if (isStreaming || isSending) return 'bg-amber-500/20 text-amber-400';
    return 'bg-emerald-500/20 text-emerald-400';
  };

  return (
    <div className={`relative bg-[#18181b] border border-[#27272a] rounded-lg overflow-hidden cursor-pointer hover:border-[#3f3f46] transition-colors ${
      isFullscreen ? 'h-full' : 'h-full min-h-[240px]'
    }`}>
      {/* Video/Camera placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#18181b] to-[#09090b]">
        {videoFile ? (
          <video
            ref={videoPreviewRef}
            className="w-full h-full object-cover opacity-60"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-20 h-20 text-[#27272a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Top status bar */}
      <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            connected ? (isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500') : 'bg-red-500'
          }`} />
          <span className="text-xs font-mono text-[#a1a1aa] bg-black/60 px-2 py-0.5 rounded">
            {cameraId}
          </span>
          {descriptionCount > 0 && (
            <span className="text-xs font-mono text-emerald-400 bg-black/60 px-2 py-0.5 rounded">
              {descriptionCount} sent
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {sourceType === 'video' && (
            <span className="text-xs text-blue-400 bg-black/60 px-2 py-0.5 rounded">
              VIDEO
            </span>
          )}
          {(connected && (isStreaming || isSending)) && (
            <span className="text-xs text-red-500 font-medium bg-black/60 px-2 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {isStreaming ? 'LIVE' : 'SEND'}
            </span>
          )}
        </div>
      </div>

      {/* Right side controls */}
      <div className="absolute top-14 right-3 flex flex-col gap-2 z-10" onClick={(e) => e.stopPropagation()}>
        {/* Test Alert - Primary action */}
        <button
          onClick={sendTestIncident}
          disabled={!connected || isSending}
          className={`px-3 py-2 rounded text-xs font-semibold transition-all ${
            isSending 
              ? 'bg-amber-600 text-white' 
              : 'bg-red-600 hover:bg-red-500 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSending ? 'Sending...' : 'Test Alert'}
        </button>

        {/* Stream toggle */}
        <button
          onClick={toggleStreaming}
          disabled={!connected}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            isStreaming 
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
              : 'bg-[#27272a] hover:bg-[#3f3f46] text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isStreaming ? 'Stop Stream' : 'Start Stream'}
        </button>
        
        {/* Upload Video */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] rounded text-xs font-medium transition-colors"
        >
          Upload Video
        </button>

        {/* Switch to Camera (if video loaded) */}
        {videoFile && (
          <button
            onClick={switchToCamera}
            className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] rounded text-xs font-medium transition-colors"
          >
            Use Camera
          </button>
        )}

        {/* Remove Camera */}
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="px-3 py-1.5 bg-[#27272a] hover:bg-red-600 rounded text-xs font-medium transition-colors"
          >
            Remove
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

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-10">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-white">{cameraName}</p>
          <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        <p className="text-xs text-[#a1a1aa] line-clamp-2">{lastDescription}</p>
        {videoFile && (
          <p className="text-xs text-blue-400 mt-1 truncate">{videoFile.name}</p>
        )}
      </div>
    </div>
  );
}