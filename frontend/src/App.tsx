import { useState, useCallback } from 'react';
import { useDispatcherSocket } from './hooks/useWebSocket';
import CameraFeed from './components/CameraFeed';
import AlertPanel from './components/AlertPanel';
import AlertModal from './components/AlertModal';
import MobileCameraView from './components/MobileCameraView';
import type { Alert, Camera } from './types';

const DEFAULT_CAMERAS: Camera[] = [
  { id: 'CAM_001', name: 'Main Entrance', status: 'active' },
  { id: 'CAM_002', name: 'Parking Lot', status: 'active' },
];

function App() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [cameras, setCameras] = useState<Camera[]>(DEFAULT_CAMERAS);
  const [cameraFrames, setCameraFrames] = useState<Record<string, string>>({});
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [newCameraId, setNewCameraId] = useState('');
  const [fullscreenCam, setFullscreenCam] = useState<string | null>(null);

  // Check if phone camera mode
  const params = new URLSearchParams(window.location.search);
  const camMode = params.get('camera') || params.get('c');
  if (camMode) return <MobileCameraView cameraId={camMode} />;

  // Handle new alerts
  const handleAlert = useCallback((alert: Alert) => {
    console.log('New alert:', alert.id);
    setAlerts(prev => [alert, ...prev]);
    
    // Play sound
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = alert.classification.severity === 'CRITICAL' ? 880 : 440;
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 300);
    } catch {}
  }, []);

  // Handle video frames from phones
  const handleFrame = useCallback((cameraId: string, frame: string) => {
    setCameraFrames(prev => ({ ...prev, [cameraId]: frame }));
  }, []);

  const { connected, sendDecision, wsUrl } = useDispatcherSocket(handleAlert, handleFrame);

  const handleConfirm = (id: string) => {
    sendDecision(id, 'confirm');
    setAlerts(prev => prev.filter(a => a.id !== id));
    setSelectedAlert(null);
  };

  const handleReject = (id: string, reason: string) => {
    sendDecision(id, 'reject', reason);
    setAlerts(prev => prev.filter(a => a.id !== id));
    setSelectedAlert(null);
  };

  const addCamera = () => {
    if (!newCameraId.trim()) return;
    const id = newCameraId.trim().toUpperCase().replace(/\s+/g, '_');
    if (!cameras.find(c => c.id === id)) {
      setCameras(prev => [...prev, { id, name: id, status: 'active' }]);
    }
    setNewCameraId('');
    setShowAddCamera(false);
  };

  const removeCamera = (id: string) => {
    setCameras(prev => prev.filter(c => c.id !== id));
    if (fullscreenCam === id) setFullscreenCam(null);
  };

  const pending = alerts.filter(a => a.status === 'PENDING_REVIEW');

  return (
    <div className="h-screen flex bg-zinc-950 text-white">
      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 px-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold tracking-tight">
              DISPATCH<span className="text-zinc-600">AI</span>
            </h1>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={`text-sm ${connected ? 'text-green-500' : 'text-red-500'}`}>
                {connected ? 'Online' : 'Offline'}
              </span>
              <span className="text-xs text-zinc-600 ml-2">{wsUrl}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">{cameras.length} cameras</span>
            <button
              onClick={() => setShowAddCamera(true)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-medium transition-colors"
            >
              + Add Camera
            </button>
          </div>
        </header>

        {/* Warning if disconnected */}
        {!connected && (
          <div className="px-6 py-3 bg-red-950/50 border-b border-red-900/50">
            <p className="text-sm text-red-400">
              Not connected. Check that backend is running and VITE_WS_URL is set correctly.
            </p>
          </div>
        )}

        {/* Camera Grid */}
        <div className="flex-1 p-4 overflow-auto">
          {fullscreenCam ? (
            <div className="h-full cursor-pointer" onClick={() => setFullscreenCam(null)}>
              <CameraFeed
                cameraId={fullscreenCam}
                cameraName={cameras.find(c => c.id === fullscreenCam)?.name || fullscreenCam}
                lastFrame={cameraFrames[fullscreenCam]}
                isFullscreen
                onRemove={() => removeCamera(fullscreenCam)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 h-full auto-rows-fr">
              {cameras.map(cam => (
                <div key={cam.id} className="cursor-pointer" onClick={() => setFullscreenCam(cam.id)}>
                  <CameraFeed
                    cameraId={cam.id}
                    cameraName={cam.name}
                    lastFrame={cameraFrames[cam.id]}
                    onRemove={() => removeCamera(cam.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts Sidebar */}
      <aside className="w-[380px] border-l border-zinc-800">
        <AlertPanel alerts={pending} {...({ onSelect: setSelectedAlert } as any)} />
      </aside>

      {/* Alert Modal */}
      {selectedAlert && (
        <AlertModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onConfirm={() => handleConfirm(selectedAlert.id)}
          onReject={(r) => handleReject(selectedAlert.id, r)}
        />
      )}

      {/* Add Camera Modal */}
      {showAddCamera && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-zinc-800">
              <h2 className="text-lg font-semibold">Add Camera</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Camera ID</label>
                <input
                  type="text"
                  value={newCameraId}
                  onChange={e => setNewCameraId(e.target.value)}
                  placeholder="e.g., PHONE1"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && addCamera()}
                />
              </div>
              <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                <p className="text-sm font-medium mb-2">Phone Camera URL</p>
                <p className="text-xs text-zinc-400 mb-2">Open this on your phone:</p>
                <code className="block p-2 bg-zinc-900 rounded text-xs text-blue-400 break-all select-all">
                  {window.location.origin}?camera={newCameraId || 'PHONE1'}
                </code>
              </div>
            </div>
            <div className="p-5 border-t border-zinc-800 flex gap-3 justify-end">
              <button
                onClick={() => setShowAddCamera(false)}
                className="px-4 py-2 text-sm hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addCamera}
                disabled={!newCameraId.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
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