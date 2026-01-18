import { useState, useCallback } from 'react';
import { useDispatcherSocket } from './hooks/useWebSocket';
import CameraFeed from './components/CameraFeed';
import AlertPanel from './components/AlertPanel';
import AlertModal from './components/AlertModal';
import MobileCameraView from './components/MobileCameraView';
import type { Alert, Camera } from './types';

// IMPORTANT: Set VITE_WS_URL in Vercel Environment Variables
// Example: wss://your-railway-app.railway.app
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

const DEFAULT_CAMERAS: Camera[] = [
  { id: 'CAM_001', name: 'Main Entrance', status: 'active' },
  { id: 'CAM_002', name: 'Parking Lot', status: 'active' },
];

function App() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [fullscreenCamera, setFullscreenCamera] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Camera[]>(DEFAULT_CAMERAS);
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [newCameraName, setNewCameraName] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const cameraMode = urlParams.get('camera') || urlParams.get('c');

  if (cameraMode) {
    return <MobileCameraView cameraId={cameraMode} />;
  }

  const handleNewAlert = useCallback((alert: Alert) => {
    console.log('New alert received:', alert);
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
    <div className="h-screen flex bg-[#09090b] text-[#fafafa]">
      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 px-6 border-b border-[#27272a] flex items-center justify-between bg-[#09090b]">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold tracking-tight">
              DISPATCH<span className="text-[#52525b]">AI</span>
            </h1>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className={`text-sm ${connected ? 'text-emerald-500' : 'text-red-500'}`}>
                {connected ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#71717a]">{cameras.length} cameras</span>
            <button
              onClick={() => setShowAddCamera(true)}
              className="px-4 py-2 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] rounded-md text-sm font-medium transition-colors"
            >
              Add Camera
            </button>
          </div>
        </header>

        {/* Connection Warning */}
        {!connected && (
          <div className="px-6 py-3 bg-red-950/50 border-b border-red-900/50">
            <p className="text-sm text-red-400">
              Backend not connected. Set <code className="bg-red-950 px-1 rounded">VITE_WS_URL</code> in Vercel to your Railway URL (wss://your-app.railway.app)
            </p>
          </div>
        )}

        {/* Camera Grid */}
        <div className="flex-1 p-4 overflow-auto">
          {fullscreenCamera ? (
            <div className="h-full" onClick={() => setFullscreenCamera(null)}>
              <CameraFeed
                cameraId={fullscreenCamera}
                cameraName={cameras.find(c => c.id === fullscreenCamera)?.name || ''}
                isFullscreen
                onRemove={() => removeCamera(fullscreenCamera)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 h-full auto-rows-fr">
              {cameras.map((camera) => (
                <div key={camera.id} onClick={() => setFullscreenCamera(camera.id)}>
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
      </div>

      {/* Alerts Sidebar */}
      <aside className="w-[380px] border-l border-[#27272a] bg-[#0c0c0e] flex flex-col">
        <AlertPanel alerts={pendingAlerts} onSelectAlert={setSelectedAlert} />
      </aside>

      {/* Modals */}
      {selectedAlert && (
        <AlertModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onConfirm={() => handleConfirm(selectedAlert.id)}
          onReject={(reason) => handleReject(selectedAlert.id, reason)}
        />
      )}

      {showAddCamera && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-[#27272a]">
              <h2 className="text-lg font-semibold">Add Camera</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-[#a1a1aa] mb-2">Camera Name</label>
                <input
                  type="text"
                  value={newCameraName}
                  onChange={(e) => setNewCameraName(e.target.value)}
                  placeholder="e.g., Front Entrance"
                  className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && addCamera()}
                />
              </div>
              <div className="p-4 bg-[#09090b] rounded-md border border-[#27272a]">
                <p className="text-sm font-medium mb-2">Phone Camera URL</p>
                <code className="block p-2 bg-[#18181b] rounded text-xs text-blue-400 break-all">
                  {window.location.origin}?camera=PHONE1
                </code>
              </div>
            </div>
            <div className="p-5 border-t border-[#27272a] flex gap-3 justify-end">
              <button
                onClick={() => setShowAddCamera(false)}
                className="px-4 py-2 text-sm hover:bg-[#27272a] rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addCamera}
                disabled={!newCameraName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;