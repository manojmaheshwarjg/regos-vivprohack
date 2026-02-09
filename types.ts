
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
  // Extended fields from Elasticsearch
  detailed_description?: string;
  brief_summaries_description?: string;
  official_title?: string;
  gender?: string;
  minimum_age?: string;
  maximum_age?: string;
  study_type?: string;
  design_outcomes?: any[];
  facilities?: any[];
  sponsors?: any[];
  interventions?: any[];
  keywords?: string[];
  primary_completion_date?: string;
  quality_score?: number;
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

// --- Match Explanation Types ---

export interface FieldMatch {
  field: string;
  matchedTerms: string[];
  snippets: string[];
}

export interface ScoreBreakdown {
  bm25Score: number;
  semanticScore: number;
  boostFactors: {
    name: string;
    multiplier: number;
    reason: string;
  }[];
  totalScore: number;
}

export interface MatchExplanation {
  narrative: string;
  fieldMatches: FieldMatch[];
  scoreBreakdown: ScoreBreakdown;
  rankingFactors: string[];
  generatedAt: number;
}

export interface SearchContext {
  query: string;
  mode: 'keyword' | 'semantic' | 'hybrid';
  queryAnalysis?: QueryAnalysis | null;
  filters?: any;
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

// --- Regulatory News Types ---

export type NewsCompany = 'Pfizer' | 'Johnson & Johnson' | 'Merck' | 'AbbVie' | 'AstraZeneca';
export type NewsCategory =
  | 'FDA Approval'
  | 'Clinical Trial'
  | 'Partnership'
  | 'Financial'
  | 'R&D'
  | 'Policy Update'
  | 'Safety Alert'
  | 'General News';

export interface RegulatoryNewsItem {
  id: string;
  title: string;
  company: NewsCompany;
  category: NewsCategory;
  summary: string;
  publishedDate: string;
  url: string;
  tags: string[];
  relevanceScore?: number;
}

export interface NewsFilter {
  companies: Set<NewsCompany>;
  categories: Set<NewsCategory>;
  dateRange?: { from: string; to: string };
  searchQuery?: string;
}

export interface NewsResponse {
  count: number;
  items: RegulatoryNewsItem[];
}

export interface NewsAggregations {
  total: number;
  byCompany: Record<string, number>;
  byCategory: Record<string, number>;
}
