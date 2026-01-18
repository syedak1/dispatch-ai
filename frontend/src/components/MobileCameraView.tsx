import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

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

const NORMAL_DESCRIPTIONS = [
  'Street scene with pedestrians walking on sidewalk. Light vehicle traffic.',
  'Parking lot view. Several parked cars. One person walking toward building.',
  'Intersection with traffic light. Cars waiting at red light. Normal activity.',
  'Office building entrance. People entering and exiting. No incidents.',
  'Residential street. Parked cars. Person walking dog on sidewalk.',
];

interface MobileCameraViewProps {
  cameraId: string;
}

export default function MobileCameraView({ cameraId }: MobileCameraViewProps) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Connecting...');
  const [messagesSent, setMessagesSent] = useState(0);
  const [lastMessage, setLastMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const streamIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 30)]);
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    const connect = () => {
      const wsUrl = `${WS_URL}/ws/camera/${cameraId}`;
      addLog(`Connecting to ${wsUrl}`);
      setStatus('Connecting...');

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        addLog('Connected successfully');
        setStatus('Connected');
        setConnected(true);
      };

      ws.onclose = (event) => {
        addLog(`Disconnected (code: ${event.code})`);
        setStatus('Disconnected');
        setConnected(false);
        setIsStreaming(false);
        
        // Stop streaming if active
        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;
        }
        
        // Reconnect after delay
        reconnectTimeoutRef.current = window.setTimeout(() => {
          addLog('Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        addLog('Connection error');
        setStatus('Error');
        setConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`Received: ${data.type}`);
        } catch (e) {
          addLog(`Received: ${event.data.substring(0, 50)}`);
        }
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
      wsRef.current?.close();
    };
  }, [cameraId, addLog]);

  // Send message helper
  const sendMessage = useCallback((text: string, type: string = 'overshoot_result') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('Cannot send: not connected');
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type,
      description: text,
      timestamp: new Date().toISOString()
    }));
    
    setMessagesSent(prev => prev + 1);
    setLastMessage(text.substring(0, 80) + (text.length > 80 ? '...' : ''));
    return true;
  }, [addLog]);

  // Force process buffer
  const forceProcess = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'force_process' }));
    addLog('Buffer process triggered');
  }, [addLog]);

  // Send test incident
  const sendTestIncident = useCallback(() => {
    if (!connected || isSending) return;

    setIsSending(true);
    const incident = TEST_INCIDENTS[Math.floor(Math.random() * TEST_INCIDENTS.length)];
    addLog(`Sending ${incident.type} test incident...`);

    incident.descriptions.forEach((desc, index) => {
      setTimeout(() => {
        sendMessage(desc);
        addLog(`Sent ${index + 1}/${incident.descriptions.length}`);
        
        if (index === incident.descriptions.length - 1) {
          setTimeout(() => {
            forceProcess();
            setIsSending(false);
            addLog('Test incident complete');
          }, 500);
        }
      }, index * 500);
    });
  }, [connected, isSending, sendMessage, forceProcess, addLog]);

  // Toggle streaming
  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
      setIsStreaming(false);
      addLog('Streaming stopped');
    } else {
      setIsStreaming(true);
      addLog('Streaming started');
      
      let index = 0;
      streamIntervalRef.current = window.setInterval(() => {
        const desc = NORMAL_DESCRIPTIONS[index % NORMAL_DESCRIPTIONS.length];
        if (sendMessage(desc)) {
          index++;
        }
      }, 2000);
    }
  }, [isStreaming, sendMessage, addLog]);

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 border-b border-[#27272a] bg-[#18181b]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">DispatchAI Camera</h1>
            <p className="text-sm text-[#71717a] mt-1">ID: {cameraId}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className={`text-sm font-medium ${connected ? 'text-emerald-500' : 'text-red-500'}`}>
              {status}
            </span>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="px-4 py-3 bg-[#0f0f0f] border-b border-[#27272a] grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold">{messagesSent}</p>
          <p className="text-xs text-[#71717a]">Messages Sent</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{isStreaming ? 'ON' : 'OFF'}</p>
          <p className="text-xs text-[#71717a]">Auto Stream</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{connected ? 'YES' : 'NO'}</p>
          <p className="text-xs text-[#71717a]">Connected</p>
        </div>
      </div>

      {/* Main Actions */}
      <div className="p-4 space-y-3">
        {/* Test Alert Button */}
        <button
          onClick={sendTestIncident}
          disabled={!connected || isSending}
          className={`w-full py-5 rounded-xl text-lg font-bold transition-all ${
            isSending 
              ? 'bg-amber-600 text-white' 
              : connected 
                ? 'bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white' 
                : 'bg-[#27272a] text-[#52525b] cursor-not-allowed'
          }`}
        >
          {isSending ? 'Sending Test Incident...' : 'Send Test Alert'}
        </button>

        {/* Stream Toggle */}
        <button
          onClick={toggleStreaming}
          disabled={!connected}
          className={`w-full py-4 rounded-xl font-semibold transition-all ${
            isStreaming 
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
              : connected
                ? 'bg-[#27272a] hover:bg-[#3f3f46] text-white'
                : 'bg-[#27272a] text-[#52525b] cursor-not-allowed'
          }`}
        >
          {isStreaming ? 'Stop Auto-Stream' : 'Start Auto-Stream'}
        </button>
      </div>

      {/* Last Message */}
      {lastMessage && (
        <div className="mx-4 p-3 bg-[#18181b] rounded-lg border border-[#27272a]">
          <p className="text-xs text-[#71717a] mb-1">Last message sent:</p>
          <p className="text-sm">{lastMessage}</p>
        </div>
      )}

      {/* Activity Log */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        <h3 className="text-sm font-semibold text-[#71717a] mb-2">Activity Log</h3>
        <div className="flex-1 overflow-y-auto bg-[#0f0f0f] rounded-lg border border-[#27272a] p-3">
          <div className="space-y-1 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-[#52525b]">Waiting for activity...</p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className={`${
                  log.includes('Connected') ? 'text-emerald-400' :
                  log.includes('error') || log.includes('Error') ? 'text-red-400' :
                  log.includes('Sending') || log.includes('triggered') ? 'text-amber-400' :
                  'text-[#71717a]'
                }`}>
                  {log}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Connection Info */}
      <div className="p-4 border-t border-[#27272a] bg-[#18181b]">
        <p className="text-xs text-[#52525b]">
          Server: {WS_URL}
        </p>
      </div>

      {/* Connection Error Help */}
      {!connected && status === 'Error' && (
        <div className="mx-4 mb-4 p-4 bg-red-950/30 rounded-lg border border-red-900/50">
          <p className="text-sm text-red-400 font-medium mb-2">Connection Failed</p>
          <ul className="text-xs text-red-400/80 space-y-1">
            <li>- Check if backend is running</li>
            <li>- Verify VITE_WS_URL is correct</li>
            <li>- Use wss:// for production (not ws://)</li>
          </ul>
        </div>
      )}
    </div>
  );
}