export interface Classification {
  incident_type: 'FIRE' | 'POLICE' | 'EMS' | 'MULTI' | 'NONE' | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  urgency: 'ROUTINE' | 'SOON' | 'IMMEDIATE';
  confidence: number;
}

export interface AgentReport {
  activated: boolean;
  key_facts?: string[];
  hazards?: string[];
  equipment?: string[];
  unknowns?: string[];
  reason?: string;
  error?: string;
}

export interface Clip {
  start_time: string | null;
  end_time: string | null;
  url: string | null;
}

export interface Alert {
  id: string;
  timestamp: string;
  camera_id: string;
  classification: Classification;
  summary: string;
  agents_activated: string[];
  agent_reports: {
    fire: AgentReport;
    ems: AgentReport;
    police: AgentReport;
  };
  clip: Clip;
  status: 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED';
  raw_context?: string;
}

export interface Camera {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
}