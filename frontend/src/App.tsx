import { useState, useCallback } from 'react';
import { useDispatcherSocket } from './hooks/useWebSocket';
import CameraFeed from './components/CameraFeed';
import AlertPanel from './components/AlertPanel';
import AlertModal from './components/AlertModal';
import type { Alert, Camera } from '../src/types';

// Demo cameras
const CAMERAS: Camera[] = [
  { id: 'CAM_A1', name: 'Highway 101 - Mile 23', status: 'active' },
  { id: 'CAM_B2', name: 'Downtown - 5th & Main', status: 'active' },
  { id: 'CAM_C3', name: 'Industrial Park', status: 'active' },
  { id: 'CAM_D4', name: 'School Zone - Lincoln', status: 'active' },
];

function App() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [fullscreenCamera, setFullscreenCamera] = useState<string | null>(null);

  const handleNewAlert = useCallback((alert: Alert) => {
    console.log('🚨 New alert:', alert.id);
    setAlerts(prev => [alert, ...prev]);
    
    // Play alert sound
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
      gain.gain.value = 0.1;

      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 200);
    } catch (e) {
      console.log('Could not play sound');
    }
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

  const pendingAlerts = alerts.filter(a => a.status === 'PENDING_REVIEW');

  return (
    <div className="h-screen flex bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Main camera area */}
      <div className="flex-1 p-4 flex flex-col">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            DISPATCH<span className="text-[#737373]">AI</span>
          </h1>
          <div className="flex items-center gap-4 text-sm text-[#737373]">
            <span>{CAMERAS.length} cameras</span>
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </header>

        {/* Camera Grid */}
        {fullscreenCamera ? (
          <div
            className="flex-1 cursor-pointer"
            onClick={() => setFullscreenCamera(null)}
          >
            <CameraFeed
              cameraId={fullscreenCamera}
              cameraName={CAMERAS.find(c => c.id === fullscreenCamera)?.name || fullscreenCamera}
              isFullscreen
            />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 gap-3">
            {CAMERAS.map((camera) => (
              <div
                key={camera.id}
                className="cursor-pointer"
                onClick={() => setFullscreenCamera(camera.id)}
              >
                <CameraFeed
                  cameraId={camera.id}
                  cameraName={camera.name}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alert Panel */}
      <div className="w-96 border-l border-[#2a2a2a] bg-[#141414]">
        <AlertPanel
          alerts={pendingAlerts}
          onSelectAlert={setSelectedAlert}
        />
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
    </div>
  );
}

export default App;