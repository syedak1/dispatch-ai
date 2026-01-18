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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'FIRE': return 'text-orange-500';
      case 'EMS': return 'text-red-500';
      case 'POLICE': return 'text-blue-500';
      default: return 'text-purple-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Incident Review</h2>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                alert.classification.severity === 'CRITICAL' ? 'bg-red-600 text-white' :
                alert.classification.severity === 'HIGH' ? 'bg-amber-500 text-black' :
                'bg-[#27272a] text-[#a1a1aa]'
              }`}>
                {alert.classification.severity}
              </span>
            </div>
            <p className="text-sm text-[#71717a] mt-1 font-mono">{alert.id}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#27272a] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Classification Card */}
              <div className="p-4 bg-[#09090b] rounded-lg border border-[#27272a]">
                <h3 className="text-sm font-semibold text-[#a1a1aa] uppercase tracking-wide mb-4">Classification</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-[#71717a] mb-1">Type</p>
                    <p className={`text-lg font-bold ${getTypeColor(alert.classification.incident_type)}`}>
                      {alert.classification.incident_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#71717a] mb-1">Urgency</p>
                    <p className="text-lg font-bold">{alert.classification.urgency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#71717a] mb-1">Confidence</p>
                    <p className="text-lg font-bold">{Math.round(alert.classification.confidence * 100)}%</p>
                  </div>
                </div>
              </div>

              {/* Summary Card */}
              <div className="p-4 bg-[#09090b] rounded-lg border border-[#27272a]">
                <h3 className="text-sm font-semibold text-[#a1a1aa] uppercase tracking-wide mb-2">AI Summary</h3>
                <p className="text-sm leading-relaxed">{alert.summary}</p>
              </div>

              {/* Raw Context */}
              {alert.raw_context && (
                <div className="p-4 bg-[#09090b] rounded-lg border border-[#27272a]">
                  <h3 className="text-sm font-semibold text-[#a1a1aa] uppercase tracking-wide mb-2">Raw Context</h3>
                  <p className="text-xs text-[#71717a] leading-relaxed">{alert.raw_context}</p>
                </div>
              )}
            </div>

            {/* Right Column - Agent Reports */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#a1a1aa] uppercase tracking-wide">Agent Reports</h3>
              
              {alert.agents_activated.length === 0 ? (
                <div className="p-4 bg-[#09090b] rounded-lg border border-[#27272a] text-center text-[#71717a]">
                  No agents activated
                </div>
              ) : (
                alert.agents_activated.map((agentType) => {
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
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#27272a] bg-[#0c0c0e]">
          {showRejectInput ? (
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="flex-1 px-4 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                autoFocus
              />
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Confirm Reject
              </button>
              <button
                onClick={() => setShowRejectInput(false)}
                className="px-4 py-2 border border-[#27272a] hover:bg-[#27272a] rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleReject}
                className="px-6 py-2.5 border border-[#27272a] hover:bg-[#27272a] rounded-lg text-sm font-medium transition-colors"
              >
                Reject
              </button>
              <button
                onClick={onConfirm}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
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
  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'FIRE': return 'F';
      case 'EMS': return 'M';
      case 'POLICE': return 'P';
      default: return '?';
    }
  };

  const getTypeColor = (t: string) => {
    switch (t) {
      case 'FIRE': return 'bg-orange-500';
      case 'EMS': return 'bg-red-500';
      case 'POLICE': return 'bg-blue-500';
      default: return 'bg-purple-500';
    }
  };

  return (
    <div className="p-4 bg-[#09090b] rounded-lg border border-[#27272a]">
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-8 h-8 rounded-lg ${getTypeColor(type)} flex items-center justify-center text-white font-bold text-sm`}>
          {getTypeIcon(type)}
        </span>
        <h4 className="text-sm font-semibold uppercase">{type} Report</h4>
      </div>

      {report.error ? (
        <p className="text-sm text-red-400">{report.error}</p>
      ) : (
        <div className="space-y-3 text-sm">
          {report.key_facts && report.key_facts.length > 0 && (
            <div>
              <p className="text-xs text-[#71717a] uppercase tracking-wide mb-1">Key Facts</p>
              <ul className="space-y-1">
                {report.key_facts.map((fact, i) => (
                  <li key={i} className="text-[#e4e4e7]">• {fact}</li>
                ))}
              </ul>
            </div>
          )}

          {report.hazards && report.hazards.length > 0 && (
            <div>
              <p className="text-xs text-amber-500 uppercase tracking-wide mb-1">Hazards</p>
              <ul className="space-y-1">
                {report.hazards.map((hazard, i) => (
                  <li key={i} className="text-[#e4e4e7]">• {hazard}</li>
                ))}
              </ul>
            </div>
          )}

          {report.equipment && report.equipment.length > 0 && (
            <div>
              <p className="text-xs text-[#71717a] uppercase tracking-wide mb-1">Equipment</p>
              <ul className="space-y-1">
                {report.equipment.map((item, i) => (
                  <li key={i} className="text-[#e4e4e7]">• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}