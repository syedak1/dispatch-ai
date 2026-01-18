import { useState, useCallback, useRef, useEffect } from 'react';
import { useCameraSocket } from '../hooks/useWebSocket';

interface Props {
  cameraId: string;
  cameraName: string;
  lastFrame?: string;
  isFullscreen?: boolean;
  onRemove?: () => void;
}

const TEST_INCIDENTS = [
  'MEDICAL EMERGENCY: Person collapsed on ground, appears unconscious, not responding.',
  'FIRE ALERT: Smoke visible from building window, people evacuating the area.',
  'VEHICLE ACCIDENT: Two-car collision at intersection, airbags deployed.',
];

export default function CameraFeed({ cameraId, cameraName, lastFrame, isFullscreen, onRemove }: Props) {
  const [status, setStatus] = useState('Connecting...');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  
  const intervalRef = useRef<number | null>(null);
  const { connected, sendDescription, forceProcess } = useCameraSocket(cameraId);

  useEffect(() => {
    setStatus(connected ? 'Connected' : 'Disconnected');
  }, [connected]);

  // Send test alert
  const sendTestAlert = useCallback(() => {
    if (!connected || sending) return;
    setSending(true);
    
    const incident = TEST_INCIDENTS[Math.floor(Math.random() * TEST_INCIDENTS.length)];
    
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        sendDescription(`${incident} [Update ${i + 1}/5]`);
        setMsgCount(c => c + 1);
        if (i === 4) {
          setTimeout(() => {
            forceProcess();
            setSending(false);
          }, 500);
        }
      }, i * 400);
    }
  }, [connected, sending, sendDescription, forceProcess]);

  // Toggle auto stream
  const toggleStream = useCallback(() => {
    if (streaming) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setStreaming(false);
    } else {
      setStreaming(true);
      let idx = 0;
      const normals = [
        'Normal activity. Pedestrians on sidewalk. Light traffic.',
        'Parking lot. Several cars. No incidents detected.',
        'Street view. Normal operations. All clear.',
      ];
      intervalRef.current = window.setInterval(() => {
        sendDescription(normals[idx % normals.length]);
        setMsgCount(c => c + 1);
        idx++;
      }, 2000);
    }
  }, [streaming, sendDescription]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className={`relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden ${
      isFullscreen ? 'h-full' : 'h-full min-h-[200px]'
    }`}>
      {/* Video Display */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950">
        {lastFrame ? (
          <img src={lastFrame} alt="Live feed" className="w-full h-full object-cover opacity-90" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-16 h-16 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs font-mono bg-black/60 px-2 py-0.5 rounded text-zinc-300">
            {cameraId}
          </span>
          {msgCount > 0 && (
            <span className="text-xs bg-black/60 px-2 py-0.5 rounded text-green-400">
              {msgCount}
            </span>
          )}
        </div>
        {(streaming || lastFrame) && (
          <span className="flex items-center gap-1.5 text-xs font-medium bg-black/60 px-2 py-0.5 rounded text-red-500">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="absolute top-12 right-3 flex flex-col gap-2 z-10" onClick={e => e.stopPropagation()}>
        <button
          onClick={sendTestAlert}
          disabled={!connected || sending}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
            sending ? 'bg-amber-600' : 'bg-red-600 hover:bg-red-500'
          } disabled:opacity-50`}
        >
          {sending ? 'Sending...' : 'Test Alert'}
        </button>
        
        <button
          onClick={toggleStream}
          disabled={!connected}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            streaming ? 'bg-green-600' : 'bg-zinc-700 hover:bg-zinc-600'
          } disabled:opacity-50`}
        >
          {streaming ? 'Stop' : 'Stream'}
        </button>

        {onRemove && (
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="px-3 py-1.5 bg-zinc-700 hover:bg-red-600 rounded-lg text-xs font-medium transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent z-10">
        <div className="flex items-center justify-between mb-1">
          <p className="font-medium">{cameraName}</p>
          <span className={`text-xs px-2 py-0.5 rounded ${
            connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {status}
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          {lastFrame ? 'Receiving live video' : 'Waiting for phone connection...'}
        </p>
      </div>
    </div>
  );
}