import { useState, useCallback, useEffect, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

// Test incidents that will trigger alerts
const TEST_INCIDENTS = [
  '⚠️ MEDICAL: Person collapsed on ground, not moving. Bystanders gathering.',
  '⚠️ FIRE: Smoke visible from building window. People evacuating.',
  '⚠️ ACCIDENT: Vehicle collision, airbags deployed. Driver exiting car.',
];

interface MobileCameraViewProps {
  cameraId: string;
}

export default function MobileCameraView({ cameraId }: MobileCameraViewProps) {
  const [status, setStatus] = useState('Connecting...');
  const [connected, setConnected] = useState(false);
  const [messagesSent, setMessagesSent] = useState(0);
  const [lastMessage, setLastMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const streamIntervalRef = useRef<number | null>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev.slice(0, 20)]);
  };

  // Connect to WebSocket
  useEffect(() => {
    const wsUrl = `${WS_URL}/ws/camera/${cameraId}`;
    addLog(`Connecting to ${wsUrl}...`);
    setStatus('Connecting...');

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      addLog('✅ Connected!');
      setStatus('Connected');
      setConnected(true);
    };

    ws.onclose = () => {
      addLog('❌ Disconnected');
      setStatus('Disconnected');
      setConnected(false);
    };

    ws.onerror = () => {
      addLog('❌ Connection error');
      setStatus('Error');
      setConnected(false);
    };

    ws.onmessage = (e) => {
      addLog(`📥 Received: ${e.data.substring(0, 50)}`);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, [cameraId]);

  // Send a message
  const sendMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('❌ Not connected');
      return;
    }

    const msg = {
      type: 'overshoot_result',
      description: text,
      timestamp: new Date().toISOString()
    };

    wsRef.current.send(JSON.stringify(msg));
    setMessagesSent(prev => prev + 1);
    setLastMessage(text.substring(0, 50) + '...');
    addLog(`📤 Sent: ${text.substring(0, 40)}...`);
  }, []);

  // Send test incident (fills buffer and triggers processing)
  const sendTestIncident = useCallback(() => {
    if (!connected) {
      addLog('❌ Not connected!');
      return;
    }

    const incident = TEST_INCIDENTS[Math.floor(Math.random() * TEST_INCIDENTS.length)];
    addLog(`🚨 Sending test incident...`);

    // Send multiple messages to fill buffer
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        sendMessage(`${incident} (${i + 1}/5)`);
      }, i * 500);
    }

    // Force processing after messages
    setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'force_process' }));
        addLog('📤 Force process sent');
      }
    }, 3000);
  }, [connected, sendMessage]);

  // Start/stop auto-streaming normal messages
  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
      setIsStreaming(false);
      addLog('⏹️ Stopped streaming');
    } else {
      setIsStreaming(true);
      addLog('▶️ Started streaming');
      streamIntervalRef.current = window.setInterval(() => {
        sendMessage('Normal scene. No incidents detected. Pedestrians walking. Light traffic.');
      }, 2000);
    }
  }, [isStreaming, sendMessage]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a] bg-[#141414]">
        <h1 className="text-xl font-bold">📱 DispatchAI Camera</h1>
        <p className="text-sm text-gray-400 mt-1">ID: {cameraId}</p>
      </div>

      {/* Status */}
      <div className="p-4 bg-[#1a1a1a] border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 mb-2">
          <span className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="font-medium">{status}</span>
          <span className="text-gray-500 text-sm">({messagesSent} sent)</span>
        </div>
        <p className="text-xs text-gray-500">Server: {WS_URL}</p>
      </div>

      {/* Action Buttons */}
      <div className="p-4 space-y-3">
        {/* Primary: Test Incident */}
        <button
          onClick={sendTestIncident}
          disabled={!connected}
          className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-lg font-bold"
        >
          🚨 SEND TEST INCIDENT
        </button>

        {/* Secondary: Stream Toggle */}
        <button
          onClick={toggleStreaming}
          disabled={!connected}
          className={`w-full py-3 rounded-lg font-medium ${
            isStreaming 
              ? 'bg-yellow-600 hover:bg-yellow-500' 
              : 'bg-blue-600 hover:bg-blue-500'
          } disabled:bg-gray-700 disabled:cursor-not-allowed`}
        >
          {isStreaming ? '⏹️ Stop Streaming' : '▶️ Start Auto-Stream'}
        </button>

        {/* Info */}
        <div className="p-3 bg-[#1a1a1a] rounded-lg text-sm">
          <p className="text-gray-400 mb-2">
            <strong>Test Incident:</strong> Sends emergency description that will trigger an alert on the dashboard.
          </p>
          <p className="text-gray-400">
            <strong>Auto-Stream:</strong> Sends normal descriptions every 2 seconds (simulates Overshoot).
          </p>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 p-4 overflow-auto">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Activity Log:</h3>
        <div className="space-y-1 font-mono text-xs">
          {logs.map((log, i) => (
            <div key={i} className={`${
              log.includes('✅') ? 'text-green-400' :
              log.includes('❌') ? 'text-red-400' :
              log.includes('🚨') ? 'text-yellow-400' :
              'text-gray-500'
            }`}>
              {log}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-gray-600">Waiting for connection...</div>
          )}
        </div>
      </div>

      {/* Last Message */}
      {lastMessage && (
        <div className="p-4 border-t border-[#2a2a2a] bg-[#141414]">
          <p className="text-xs text-gray-400">Last sent:</p>
          <p className="text-sm text-gray-300">{lastMessage}</p>
        </div>
      )}
    </div>
  );
}