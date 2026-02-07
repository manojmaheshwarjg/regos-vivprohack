
export type Severity = 'critical' | 'warning' | 'administrative';

export enum AgentStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface AgentLog {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  progress: number;
  logs: AgentLog[];
  iconName: string; 
}

export interface Discrepancy {
  id: string;
  severity: Severity;
  agentId: string; // Which agent generated the content
  sourceDoc: string; // "Protocol v4.2", "CSR Table 14.3"
  generatedText: string;
  sourceText: string;
  explanation: string;
  status: 'open' | 'resolved' | 'ignored';
  confidence: number;
  resolvedBy?: string;
  resolvedAt?: Date;
}

export interface ProjectStats {
  totalClaims: number;
  verifiedHighConfidence: number;
  flaggedForReview: number;
  autoCorrected: number;
}

export type ECTDModule = 'm1' | 'm2' | 'm3' | 'm4' | 'm5';

export interface SourceDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  status: 'ready' | 'processing' | 'analyzed';
  uploadDate: Date;
  module: ECTDModule;
}

export type ProjectStatus = 'draft' | 'analyzing' | 'analyzed';

// --- New Types for Search ---

export interface ClinicalTrial {
  nctId: string;
  title: string;
  phase: string;
  status: string;
  enrollment: number;
  sponsor: string;
  conditions: string[];
  intervention: string;
  startDate: string;
  completionDate: string;
  locations: { city: string; state: string; country: string }[];
  description: string;
  // Dynamic fields for search results
  relevanceScore?: number;
  matchReasons?: string[];
  matchDetails?: {
    keywordScore: number;
    semanticScore: number;
    filterBoost: number;
  };
}

export interface QueryAnalysis {
  condition: string | null;
  phase: string | null;
  status: string | null;
  location: string | null;
  sponsor: string | null;
  intervention: string | null;
  ageGroup: string | null;
  enrollment_size: string | null;
  keywords: string[];
}

// --- Chat Types ---

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  citations?: string[];  // NCT IDs referenced in the message
}

export interface ChatSession {
  id: string;
  title: string;  // Auto-generated from first question
  messages: Message[];
  contextTrials: ClinicalTrial[];  // Only cited trials from original search
  createdAt: number;
  updatedAt: number;
}
