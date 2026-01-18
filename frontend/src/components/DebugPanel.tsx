import { useState, useEffect, useRef } from 'react';

interface DebugPanelProps {
  wsUrl: string;
}

export default function DebugPanel({ wsUrl }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [cameraConnected, setCameraConnected] = useState(false);
  const [dispatcherConnected, setDispatcherConnected] = useState(false);
  const [lastAlert, setLastAlert] = useState<any>(null);
  
  const cameraWsRef = useRef<WebSocket | null>(null);
  const dispatcherWsRef = useRef<WebSocket | null>(null);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 50)]);
    console.log(`[DEBUG] ${msg}`);
  };

  // Test camera WebSocket
  const testCameraConnection = () => {
    addLog(`Connecting camera to ${wsUrl}/ws/camera/DEBUG_CAM...`);
    
    try {
      const ws = new WebSocket(`${wsUrl}/ws/camera/DEBUG_CAM`);
      
      ws.onopen = () => {
        addLog('✅ Camera WebSocket CONNECTED');
        setCameraConnected(true);
        cameraWsRef.current = ws;
      };
      
      ws.onclose = () => {
        addLog('❌ Camera WebSocket CLOSED');
        setCameraConnected(false);
      };
      
      ws.onerror = (e) => {
        addLog(`❌ Camera WebSocket ERROR: ${e}`);
        setCameraConnected(false);
      };
      
      ws.onmessage = (e) => {
        addLog(`📥 Camera received: ${e.data}`);
      };
    } catch (e) {
      addLog(`❌ Camera connection failed: ${e}`);
    }
  };

  // Test dispatcher WebSocket
  const testDispatcherConnection = () => {
    addLog(`Connecting dispatcher to ${wsUrl}/ws/dispatcher...`);
    
    try {
      const ws = new WebSocket(`${wsUrl}/ws/dispatcher`);
      
      ws.onopen = () => {
        addLog('✅ Dispatcher WebSocket CONNECTED');
        setDispatcherConnected(true);
        dispatcherWsRef.current = ws;
      };
      
      ws.onclose = () => {
        addLog('❌ Dispatcher WebSocket CLOSED');
        setDispatcherConnected(false);
      };
      
      ws.onerror = (e) => {
        addLog(`❌ Dispatcher WebSocket ERROR`);
        setDispatcherConnected(false);
      };
      
      ws.onmessage = (e) => {
        addLog(`📥 Dispatcher received: ${e.data.substring(0, 100)}...`);
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'alert') {
            setLastAlert(data.data);
            addLog(`🚨 ALERT RECEIVED: ${data.data.classification?.incident_type}`);
          }
        } catch {}
      };
    } catch (e) {
      addLog(`❌ Dispatcher connection failed: ${e}`);
    }
  };

  // Send test incident through camera WebSocket
  const sendTestIncident = () => {
    if (!cameraWsRef.current || cameraWsRef.current.readyState !== WebSocket.OPEN) {
      addLog('❌ Camera not connected! Connect first.');
      return;
    }

    const incident = '⚠️ MEDICAL EMERGENCY: Person collapsed on sidewalk, appears unconscious. Not moving. Bystanders gathering around.';
    
    addLog(`📤 Sending incident: ${incident.substring(0, 50)}...`);
    
    // Send multiple times to fill buffer faster
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        cameraWsRef.current?.send(JSON.stringify({
          type: 'overshoot_result',
          description: incident + ` (message ${i + 1}/5)`,
          timestamp: new Date().toISOString()
        }));
        addLog(`📤 Sent message ${i + 1}/5`);
      }, i * 1000);
    }

    // Force process after sending
    setTimeout(() => {
      addLog('📤 Sending force_process command...');
      cameraWsRef.current?.send(JSON.stringify({
        type: 'force_process'
      }));
    }, 6000);
  };

  // Test backend HTTP endpoint
  const testBackendHealth = async () => {
    const httpUrl = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    addLog(`Testing backend at ${httpUrl}...`);
    
    try {
      const response = await fetch(`${httpUrl}/health`);
      const data = await response.json();
      addLog(`✅ Backend healthy: ${JSON.stringify(data)}`);
    } catch (e) {
      addLog(`❌ Backend unreachable: ${e}`);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      cameraWsRef.current?.close();
      dispatcherWsRef.current?.close();
    };
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 px-4 py-2 bg-purple-600 text-white rounded-lg shadow-lg z-50"
      >
        🔧 Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl z-50 max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-[#333] flex items-center justify-between">
        <h3 className="font-bold text-purple-400">🔧 Debug Panel</h3>
        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">✕</button>
      </div>

      {/* Status */}
      <div className="p-3 border-b border-[#333] space-y-2">
        <div className="text-xs text-gray-400">WebSocket URL: <code className="text-blue-400">{wsUrl}</code></div>
        <div className="flex gap-4 text-sm">
          <span className={cameraConnected ? 'text-green-400' : 'text-red-400'}>
            Camera: {cameraConnected ? '✅' : '❌'}
          </span>
          <span className={dispatcherConnected ? 'text-green-400' : 'text-red-400'}>
            Dispatcher: {dispatcherConnected ? '✅' : '❌'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 border-b border-[#333] grid grid-cols-2 gap-2">
        <button
          onClick={testBackendHealth}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium"
        >
          1. Test Backend
        </button>
        <button
          onClick={testDispatcherConnection}
          className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-xs font-medium"
        >
          2. Connect Dispatcher
        </button>
        <button
          onClick={testCameraConnection}
          className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 rounded text-xs font-medium"
        >
          3. Connect Camera
        </button>
        <button
          onClick={sendTestIncident}
          className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-xs font-medium"
        >
          4. Send Incident
        </button>
      </div>

      {/* Last Alert */}
      {lastAlert && (
        <div className="p-3 border-b border-[#333] bg-red-900/20">
          <div className="text-xs text-red-400 font-bold mb-1">🚨 Last Alert Received:</div>
          <div className="text-xs text-white">
            Type: {lastAlert.classification?.incident_type} | 
            Severity: {lastAlert.classification?.severity}
          </div>
          <div className="text-xs text-gray-400 mt-1">{lastAlert.summary?.substring(0, 100)}</div>
        </div>
      )}

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-3 min-h-[150px]">
        <div className="text-xs text-gray-400 mb-2">Logs:</div>
        <div className="space-y-1 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-gray-500">Click buttons above to test...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`${
                log.includes('✅') ? 'text-green-400' :
                log.includes('❌') ? 'text-red-400' :
                log.includes('🚨') ? 'text-yellow-400' :
                'text-gray-400'
              }`}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-3 border-t border-[#333] bg-[#111] text-xs text-gray-500">
        <strong>Test Order:</strong> 1→2→3→4. If step 1 fails, backend isn't running.
      </div>
    </div>
  );
}