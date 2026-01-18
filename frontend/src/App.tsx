import { useState, useCallback } from 'react';
import { useDispatcherSocket } from './hooks/useWebSocket';
import CameraFeed from './components/CameraFeed';
import AlertPanel from './components/AlertPanel';
import AlertModal from './components/AlertModal';
import MobileCameraView from './components/MobileCameraView';
import DebugPanel from './components/DebugPanel';
import type { Alert, Camera } from './types';
import { isMobileDevice } from './hooks/useOvershoot';

// WebSocket URL - CHANGE THIS FOR PRODUCTION
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

// Default cameras
const DEFAULT_CAMERAS: Camera[] = [
  { id: 'CAM_A1', name: 'Camera 1 - Main', status: 'active' },
  { id: 'CAM_B2', name: 'Camera 2 - Side', status: 'active' },
];

function App() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [fullscreenCamera, setFullscreenCamera] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Camera[]>(DEFAULT_CAMERAS);
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [newCameraName, setNewCameraName] = useState('');
  const [showDebug, setShowDebug] = useState(true); // Show debug by default for testing

  // Check URL params for mobile camera mode
  const urlParams = new URLSearchParams(window.location.search);
  const cameraMode = urlParams.get('camera') || urlParams.get('c');
  const isMobile = isMobileDevice();

  // If on mobile with camera param, show camera-only view
  if (cameraMode) {
    return <MobileCameraView cameraId={cameraMode} />;
  }

  // Handle new alerts from WebSocket
  const handleNewAlert = useCallback((alert: Alert) => {
    console.log('🚨 NEW ALERT RECEIVED:', alert);
    setAlerts(prev => [alert, ...prev]);
    playAlertSound(alert.classification.severity);
  }, []);

  const { connected, sendDecision } = useDispatcherSocket(handleNewAlert);

  const playAlertSound = (severity: string) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = severity === 'CRITICAL' ? 880 : 440;
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 300);
    } catch (e) {}
  };

  const handleConfirm = (alertId: string) => {
    sendDecision(alertId, 'confirm');
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    setSelectedAlert(null);
  };

  const handleReject = (alertId: string, reason: string) => {
    sendDecision(alertId, 'reject', reason);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    setSelectedAlert(null);
  };

  const addCamera = useCallback(() => {
    if (!newCameraName.trim()) return;
    const id = `CAM_${Date.now().toString(36).toUpperCase()}`;
    setCameras(prev => [...prev, { id, name: newCameraName.trim(), status: 'active' }]);
    setNewCameraName('');
    setShowAddCamera(false);
  }, [newCameraName]);

  const removeCamera = useCallback((cameraId: string) => {
    setCameras(prev => prev.filter(c => c.id !== cameraId));
    if (fullscreenCamera === cameraId) setFullscreenCamera(null);
  }, [fullscreenCamera]);

  const pendingAlerts = alerts.filter(a => a.status === 'PENDING_REVIEW');

  return (
    <div className="h-screen flex bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Main camera area */}
      <div className="flex-1 p-4 flex flex-col">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              DISPATCH<span className="text-[#737373]">AI</span>
            </h1>
            <p className="text-xs text-[#737373] mt-1">
              WS: {WS_URL} | {connected ? '🟢 Connected' : '🔴 Disconnected'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDebug(prev => !prev)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                showDebug ? 'bg-purple-600' : 'bg-gray-700'
              }`}
            >
              🔧 Debug
            </button>
            <button
              onClick={() => setShowAddCamera(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium"
            >
              + Add Camera
            </button>
            <span className="text-sm text-[#737373]">{cameras.length} cameras</span>
          </div>
        </header>

        {/* Camera Grid */}
        {fullscreenCamera ? (
          <div className="flex-1 cursor-pointer" onClick={() => setFullscreenCamera(null)}>
            <CameraFeed
              cameraId={fullscreenCamera}
              cameraName={cameras.find(c => c.id === fullscreenCamera)?.name || fullscreenCamera}
              isFullscreen
              onRemove={() => removeCamera(fullscreenCamera)}
            />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 gap-3 auto-rows-fr">
            {cameras.map((camera) => (
              <div
                key={camera.id}
                className="cursor-pointer min-h-[200px]"
                onClick={() => setFullscreenCamera(camera.id)}
              >
                <CameraFeed
                  cameraId={camera.id}
                  cameraName={camera.name}
                  onRemove={() => removeCamera(camera.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alert Panel - Right Side */}
      <div className="w-96 border-l border-[#2a2a2a] bg-[#141414]">
        <AlertPanel alerts={pendingAlerts} onSelectAlert={setSelectedAlert} />
      </div>

      {/* Alert Modal */}
      {selectedAlert && (
        <AlertModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onConfirm={() => handleConfirm(selectedAlert.id)}
          onReject={(reason) => handleReject(selectedAlert.id, reason)}
        />
      )}

      {/* Add Camera Modal */}
      {showAddCamera && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg w-full max-w-md p-6">
            <h2 className="text-lg font-medium mb-4">Add Camera</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#737373] uppercase mb-2">Camera Name</label>
                <input
                  type="text"
                  value={newCameraName}
                  onChange={(e) => setNewCameraName(e.target.value)}
                  placeholder="e.g., Front Door"
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && addCamera()}
                />
              </div>

              <div className="p-4 bg-[#0a0a0a] rounded border border-[#2a2a2a]">
                <p className="text-sm font-medium mb-2">📱 Connect Phone Camera:</p>
                <p className="text-xs text-[#737373] mb-2">
                  Open this URL on your phone:
                </p>
                <code className="block p-2 bg-[#1a1a1a] rounded text-xs text-blue-400 break-all">
                  {window.location.origin}?camera=PHONE1
                </code>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowAddCamera(false)}
                className="px-4 py-2 border border-[#2a2a2a] rounded text-sm hover:bg-[#2a2a2a]"
              >
                Cancel
              </button>
              <button
                onClick={addCamera}
                disabled={!newCameraName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel */}
      {showDebug && <DebugPanel wsUrl={WS_URL} />}
    </div>
  );
}

export default App;