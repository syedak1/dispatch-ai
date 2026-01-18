import { useState } from 'react';
import type { Alert, AgentReport } from '../types';

interface AlertModalProps {
  alert: Alert;
  onClose: () => void;
  onConfirm: () => void;
  onReject: (reason: string) => void;
}

export default function AlertModal({ alert, onClose, onConfirm, onReject }: AlertModalProps) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = () => {
    if (showRejectInput) {
      onReject(rejectReason || 'No reason provided');
    } else {
      setShowRejectInput(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Incident Review</h2>
            <p className="text-xs text-[#737373] font-mono mt-1">{alert.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#737373] hover:text-white p-2 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Classification & Context */}
            <div className="space-y-4">
              {/* Video placeholder */}
              <div className="aspect-video bg-[#0a0a0a] rounded border border-[#2a2a2a] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl mb-2 opacity-30">▶️</div>
                  <span className="text-[#737373] text-sm">Incident Clip</span>
                </div>
              </div>

              {/* Classification */}
              <div className="p-3 bg-[#0a0a0a] rounded border border-[#2a2a2a]">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-[#737373] uppercase">Type</p>
                    <p className="text-sm font-medium">{alert.classification.incident_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#737373] uppercase">Severity</p>
                    <p className={`text-sm font-medium ${
                      alert.classification.severity === 'CRITICAL' ? 'text-red-500' :
                      alert.classification.severity === 'HIGH' ? 'text-amber-500' : ''
                    }`}>
                      {alert.classification.severity}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#737373] uppercase">Confidence</p>
                    <p className="text-sm font-medium">
                      {Math.round(alert.classification.confidence * 100)}%
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                  <p className="text-xs text-[#737373] uppercase mb-1">AI Summary</p>
                  <p className="text-sm">{alert.summary}</p>
                </div>

                {alert.raw_context && (
                  <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                    <p className="text-xs text-[#737373] uppercase mb-1">Raw Context</p>
                    <p className="text-xs text-[#737373] italic">{alert.raw_context}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Agent Reports */}
            <div className="space-y-3">
              {alert.agents_activated.map((agentType) => {
                const key = agentType.toLowerCase() as keyof typeof alert.agent_reports;
                const report = alert.agent_reports[key];
                if (!report?.activated) return null;

                return (
                  <AgentReportCard
                    key={agentType}
                    type={agentType}
                    report={report}
                  />
                );
              })}

              {alert.agents_activated.length === 0 && (
                <div className="p-4 bg-[#0a0a0a] rounded border border-[#2a2a2a] text-center text-[#737373]">
                  No agents activated
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2a2a2a]">
          {showRejectInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-sm focus:outline-none focus:border-[#3a3a3a]"
                autoFocus
              />
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
              >
                Confirm Reject
              </button>
              <button
                onClick={() => setShowRejectInput(false)}
                className="px-4 py-2 border border-[#2a2a2a] rounded text-sm hover:bg-[#2a2a2a]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleReject}
                className="px-6 py-2 border border-[#2a2a2a] rounded text-sm font-medium hover:bg-[#2a2a2a] transition-colors"
              >
                Reject
              </button>
              <button
                onClick={onConfirm}
                className="px-6 py-2 bg-white text-black rounded text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Confirm Dispatch
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentReportCard({ type, report }: { type: string; report: AgentReport }) {
  const icons: Record<string, string> = {
    FIRE: '🔥',
    EMS: '🚑',
    POLICE: '🚔'
  };

  return (
    <div className="p-3 bg-[#0a0a0a] rounded border border-[#2a2a2a]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icons[type] || '📋'}</span>
        <h3 className="text-sm font-medium uppercase">{type} Report</h3>
      </div>

      {report.error ? (
        <p className="text-xs text-red-400">{report.error}</p>
      ) : (
        <div className="space-y-3 text-xs">
          {report.key_facts && report.key_facts.length > 0 && (
            <div>
              <p className="text-[#737373] uppercase tracking-wider mb-1">Facts</p>
              <ul className="space-y-0.5">
                {report.key_facts.map((fact, i) => (
                  <li key={i}>• {fact}</li>
                ))}
              </ul>
            </div>
          )}

          {report.hazards && report.hazards.length > 0 && (
            <div>
              <p className="text-amber-500 uppercase tracking-wider mb-1">Hazards</p>
              <ul className="space-y-0.5">
                {report.hazards.map((hazard, i) => (
                  <li key={i}>• {hazard}</li>
                ))}
              </ul>
            </div>
          )}

          {report.equipment && report.equipment.length > 0 && (
            <div>
              <p className="text-[#737373] uppercase tracking-wider mb-1">Equipment</p>
              <ul className="space-y-0.5">
                {report.equipment.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          )}

          {report.unknowns && report.unknowns.length > 0 && (
            <div>
              <p className="text-[#737373] uppercase tracking-wider mb-1">Unknown</p>
              <ul className="space-y-0.5 text-[#737373] italic">
                {report.unknowns.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}