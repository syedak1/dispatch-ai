import type { Alert } from '../types';

interface AlertPanelProps {
  alerts: Alert[];
  onSelectAlert: (alert: Alert) => void;
}

export default function AlertPanel({ alerts, onSelectAlert }: AlertPanelProps) {
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': 
        return 'border-red-500 bg-red-500/20 shadow-lg shadow-red-500/20 animate-pulse';
      case 'HIGH': 
        return 'border-amber-500 bg-amber-500/15 shadow-lg shadow-amber-500/20';
      default: 
        return 'border-[#3a3a3a] bg-[#1a1a1a]';
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

  const getTimeSince = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold uppercase tracking-wider">🚨 Alerts</h2>
          {alerts.length > 0 && (
            <span className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full animate-pulse">
              {alerts.length}
            </span>
          )}
        </div>
        <p className="text-sm text-[#737373] mt-1">
          {alerts.length === 0 ? 'No active alerts' : `${alerts.length} pending review`}
        </p>
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-[#737373]">
            <div className="text-6xl mb-4 opacity-30">✓</div>
            <p className="text-lg">All Clear</p>
            <p className="text-sm mt-2">No incidents requiring attention</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {alerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => onSelectAlert(alert)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${getSeverityStyle(alert.classification.severity)}`}
              >
                {/* Top Row: Icon + Type + Time */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{getTypeIcon(alert.classification.incident_type)}</span>
                    <div>
                      <span className="text-lg font-bold uppercase">
                        {alert.classification.incident_type}
                      </span>
                      <p className="text-xs text-[#737373] font-mono">{alert.camera_id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold px-2 py-1 rounded ${
                      alert.classification.severity === 'CRITICAL' ? 'bg-red-600 text-white' :
                      alert.classification.severity === 'HIGH' ? 'bg-amber-500 text-black' :
                      'bg-[#2a2a2a] text-[#737373]'
                    }`}>
                      {alert.classification.severity}
                    </span>
                    <p className="text-xs text-[#737373] mt-1">{getTimeSince(alert.timestamp)}</p>
                  </div>
                </div>

                {/* Summary */}
                <p className="text-sm leading-relaxed mb-3">
                  {alert.summary}
                </p>

                {/* Bottom Row: Confidence + Agents */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[#737373]">Confidence:</span>
                    <div className="w-20 h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          alert.classification.confidence > 0.8 ? 'bg-green-500' :
                          alert.classification.confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${alert.classification.confidence * 100}%` }}
                      />
                    </div>
                    <span className="font-mono">
                      {Math.round(alert.classification.confidence * 100)}%
                    </span>
                  </div>
                  
                  <div className="flex gap-1">
                    {alert.agents_activated.map(agent => (
                      <span key={agent} className="px-2 py-0.5 bg-[#2a2a2a] rounded text-[#a0a0a0]">
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Click hint */}
                <div className="mt-3 pt-3 border-t border-[#3a3a3a] text-center">
                  <span className="text-xs text-blue-400 font-medium">
                    TAP TO REVIEW →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer with instructions */}
      {alerts.length > 0 && (
        <div className="p-3 border-t border-[#2a2a2a] bg-[#0a0a0a]">
          <p className="text-xs text-[#737373] text-center">
            Review each alert and confirm or reject dispatch
          </p>
        </div>
      )}
    </div>
  );
}