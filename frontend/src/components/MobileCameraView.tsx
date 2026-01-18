import { useState, useCallback, useEffect, useRef } from 'react';
import { useCameraSocket } from '../hooks/useWebSocket';
import { useOvershoot } from '../hooks/useOvershoot';

interface MobileCameraViewProps {
  cameraId: string;
}

export default function MobileCameraView({ cameraId }: MobileCameraViewProps) {
  const [lastDescription, setLastDescription] = useState('Initializing camera...');
  const [descriptionCount, setDescriptionCount] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { connected, sendDescription } = useCameraSocket(cameraId);

  // Handle Overshoot descriptions
  const handleOvershootDescription = useCallback((description: string, timestamp: string) => {
    setLastDescription(description);
    setDescriptionCount(prev => prev + 1);
    if (connected) {
      sendDescription(description, timestamp);
    }
  }, [connected, sendDescription]);

  const handleOvershootError = useCallback((error: Error) => {
    console.error('Overshoot error:', error);
    setError(error.message);
  }, []);

  // Initialize Overshoot
  
  // Start camera preview
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Camera access failed';
      setError(errorMessage);
      console.error('Camera error:', err);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Format connection status
  const getStatusColor = () => {
    if (!connected) return 'bg-red-500';
    if (!isStreaming) return 'bg-yellow-500';
    if (isActive) return 'bg-green-500';
    return 'bg-yellow-500';
  };

  const getStatusText = () => {
    if (!connected) return 'Disconnected from server';
    if (!isStreaming) return 'Camera not started';
    if (isActive) return 'Streaming to DispatchAI';
    return 'Connecting...';
  };

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            DISPATCH<span className="text-[#737373]">AI</span>
          </h1>
          <p className="text-xs text-[#737373] font-mono mt-1">{cameraId}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span className="text-xs text-[#737373]">{getStatusText()}</span>
        </div>
      </header>

      {/* Camera view */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Overlay when not streaming */}
        {!isStreaming && (
          <div className="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center">
            <div className="text-center p-8">
              {error ? (
                <>
                  <div className="text-5xl mb-4">🚫</div>
                  <p className="text-red-400 mb-2">{error}</p>
                  <p className="text-xs text-[#737373] mb-6">
                    Please allow camera access and try again
                  </p>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-4">📱</div>
                  <p className="text-lg mb-2">Mobile Camera</p>
                  <p className="text-xs text-[#737373] mb-6">
                    This device will stream video to DispatchAI
                  </p>
                </>
              )}
              
              <button
                onClick={startCamera}
                disabled={!connected}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium"
              >
                {connected ? 'Start Camera' : 'Connecting to server...'}
              </button>
            </div>
          </div>
        )}

        {/* Recording indicator */}
        {isStreaming && isActive && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-mono">LIVE</span>
          </div>
        )}

        {/* Description counter */}
        {isStreaming && (
          <div className="absolute top-4 right-4 bg-black/50 px-3 py-1.5 rounded-full">
            <span className="text-xs font-mono text-green-400">
              #{descriptionCount} sent
            </span>
          </div>
        )}
      </div>

      {/* Footer with controls and status */}
      <div className="p-4 border-t border-[#2a2a2a] bg-[#141414]">
        {/* Last description */}
        <div className="mb-4">
          <p className="text-xs text-[#737373] uppercase tracking-wider mb-1">
            Last Analysis
          </p>
          <p className="text-xs line-clamp-2">{lastDescription}</p>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          {isStreaming ? (
            <button
              onClick={stopCamera}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium"
            >
              Stop Camera
            </button>
          ) : (
            <button
              onClick={startCamera}
              disabled={!connected}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-sm font-medium"
            >
              Start Camera
            </button>
          )}
        </div>

        {/* Connection info */}
        <div className="mt-4 p-3 bg-[#0a0a0a] rounded border border-[#2a2a2a]">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-[#737373]">Server</p>
              <p className={connected ? 'text-green-400' : 'text-red-400'}>
                {connected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
            <div>
              <p className="text-[#737373]">Overshoot</p>
              <p className={isActive ? 'text-green-400' : 'text-yellow-400'}>
                {isActive ? 'Active' : 'Standby'}
              </p>
            </div>
            <div>
              <p className="text-[#737373]">Camera ID</p>
              <p className="font-mono">{cameraId}</p>
            </div>
            <div>
              <p className="text-[#737373]">Frames Sent</p>
              <p className="font-mono">{descriptionCount}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}