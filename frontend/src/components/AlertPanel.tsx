import type { Alert } from '../types';

interface AlertPanelProps {
  alerts: Alert[];
  onSelectAlert: (alert: Alert) => void;
}

export default function AlertPanel({ alerts, onSelectAlert }: AlertPanelProps) {
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'border-red-600 bg-red-600/10';
      case 'HIGH': return 'border-amber-500 bg-amber-500/10';
      default: return 'border-[#2a2a2a]';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'FIRE': return '🔥';
      case 'EMS': return '🚑';
      case 'POLICE': return '🚔';
      case 'MULTI': return '⚠️';
      default: return '❓';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[#2a2a2a]">
        <h2 className="text-sm font-medium uppercase tracking-wider">Alerts</h2>
        <p className="text-xs text-[#737373] mt-1">
          {alerts.length} pending review
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-[#737373] text-sm">
            <div className="text-3xl mb-2 opacity-30">✓</div>
            No active alerts
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {alerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => onSelectAlert(alert)}
                className={`w-full p-3 rounded border text-left transition-all hover:scale-[1.02] ${getSeverityStyle(alert.classification.severity)}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{getTypeIcon(alert.classification.incident_type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-[#737373]">
                        {alert.camera_id}
                      </span>
                      <span className="text-xs text-[#737373]">
                        {formatTime(alert.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm mt-1 line-clamp-2">
                      {alert.summary}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        alert.classification.severity === 'CRITICAL' ? 'bg-red-600 text-white' :
                        alert.classification.severity === 'HIGH' ? 'bg-amber-500 text-black' :
                        'bg-[#2a2a2a] text-[#737373]'
                      }`}>
                        {alert.classification.severity}
                      </span>
                      <span className="text-xs text-[#737373]">
                        {Math.round(alert.classification.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}