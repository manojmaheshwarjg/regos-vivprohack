
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

// --- Verification Types ---

export type VerificationSeverity = 'critical' | 'warning' | 'info';
export type VerificationStatus = 'not-verified' | 'verifying' | 'verified' | 'issues-found';

export interface SearchVerificationIssue {
  id: string;
  severity: VerificationSeverity;
  claim: string;  // What the AI claimed
  sourceData: string;  // What the actual data shows
  explanation: string;  // Why this is an issue
  field?: string;  // Which field was checked (e.g., 'enrollment', 'phase')
  trialId?: string;  // NCT ID if issue is trial-specific
  startIndex?: number;  // Where in the text the claim appears
  endIndex?: number;  // End position for highlighting
  isOverridden?: boolean;  // User acknowledged this issue
}

export interface VerificationResult {
  issues: SearchVerificationIssue[];
  validCitations: string[];  // NCT IDs that exist in results
  invalidCitations: string[];  // NCT IDs that don't exist (fabricated)
  statisticalChecks: {
    totalTrials: number;
    phaseDistribution: Record<string, number>;
    statusDistribution: Record<string, number>;
    claimsVerified: number;
    claimsFailed: number;
  };
  verifiedAt: number;  // Timestamp
}
