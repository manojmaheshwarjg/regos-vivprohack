
import { Agent, AgentStatus, Discrepancy, ClinicalTrial } from './types';

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'intelligence',
    name: 'Intelligence Agent',
    role: 'Regulatory Monitor',
    description: 'Monitors FDA/EMA guidance and updates internal rule sets.',
    status: AgentStatus.IDLE,
    progress: 0,
    logs: [],
    iconName: 'Globe'
  },
  {
    id: 'protocol',
    name: 'Protocol Agent',
    role: 'Study Design Analyzer',
    description: 'Generates Module 2.5.4 from clinical trial protocols.',
    status: AgentStatus.IDLE,
    progress: 0,
    logs: [],
    iconName: 'FileText'
  },
  {
    id: 'safety',
    name: 'Safety Agent',
    role: 'Pharmacovigilance',
    description: 'Analyzes ICSRs and generates Module 2.7.4 safety summaries.',
    status: AgentStatus.IDLE,
    progress: 0,
    logs: [],
    iconName: 'ShieldAlert'
  },
  {
    id: 'statistics',
    name: 'Statistics Agent',
    role: 'Biometrics Validator',
    description: 'Validates SAP results and generates Module 2.7.3.',
    status: AgentStatus.IDLE,
    progress: 0,
    logs: [],
    iconName: 'BarChart'
  },
  {
    id: 'cmc',
    name: 'CMC Agent',
    role: 'Quality Control',
    description: 'Compiles Module 3 (Chemistry, Manufacturing & Controls).',
    status: AgentStatus.IDLE,
    progress: 0,
    logs: [],
    iconName: 'FlaskConical'
  },
  {
    id: 'document',
    name: 'Document Agent',
    role: 'eCTD Compiler',
    description: 'Assembles XML backbone and validates technical structure.',
    status: AgentStatus.IDLE,
    progress: 0,
    logs: [],
    iconName: 'Files'
  },
];

export const MOCK_DISCREPANCIES: Discrepancy[] = [
  {
    id: 'd1',
    severity: 'critical',
    agentId: 'safety',
    sourceDoc: 'CSR Table 14.3.1 (Adverse Events)',
    generatedText: 'There were no deaths reported during the double-blind phase of the study.',
    sourceText: 'One subject (PID 102-004) expired on Day 42 due to myocardial infarction.',
    explanation: 'Hallucination detected. Source document confirms one fatality. The generated text incorrectly claims zero deaths. This is a critical safety misrepresentation.',
    status: 'open',
    confidence: 99
  },
  {
    id: 'd2',
    severity: 'warning',
    agentId: 'statistics',
    sourceDoc: 'Statistical Analysis Plan (SAP) v2.0',
    generatedText: 'The primary efficacy endpoint was significant with a p-value of 0.045.',
    sourceText: 'The primary endpoint showed a trend toward significance (p=0.045) but did not meet the adjusted alpha of 0.025 for interim analysis.',
    explanation: 'Contextual mismatch. While the p-value matches numerically, the interpretation of "significant" is incorrect based on the adjusted alpha level defined in the SAP.',
    status: 'open',
    confidence: 85
  },
  {
    id: 'd3',
    severity: 'administrative',
    agentId: 'document',
    sourceDoc: 'Module 1.3.1',
    generatedText: 'Reference is made to section 2.5.4.',
    sourceText: 'See Section 2.5.4 Clinical Study Design.',
    explanation: 'Hyperlink formatting inconsistency. RegOS standard requires full section titles in cross-references.',
    status: 'open',
    confidence: 95
  },
];

// --- Clinical Search Data & Logic ---

export const DOMAIN_KNOWLEDGE: Record<string, string[]> = {
  // Medical Conditions
  "heart attack": ["myocardial infarction", "MI", "STEMI", "NSTEMI"],
  "stroke": ["cerebrovascular accident", "CVA", "ischemic stroke"],
  "diabetes": ["diabetes mellitus", "T1D", "T2D", "type 1", "type 2"],
  "high blood pressure": ["hypertension", "HTN"],
  "cancer": ["carcinoma", "malignancy", "tumor", "neoplasm", "oncology"],
  "kidney disease": ["renal failure", "nephropathy", "CKD"],
  
  // Interventions
  "gene therapy": ["genetic", "CRISPR", "AAV", "lentiviral", "editing"],
  "immunotherapy": ["checkpoint inhibitor", "monoclonal antibody", "mab", "car-t"],
  
  // Status
  "open": ["recruiting", "enrolling"],
  "closed": ["completed", "terminated", "withdrawn"],
  "active": ["recruiting", "active, not recruiting", "enrolling by invitation"],
  
  // Phases
  "late stage": ["PHASE3", "PHASE4"],
  "early stage": ["PHASE1", "PHASE2"],
  "p3": ["PHASE3"],
  "p2": ["PHASE2"],
  "p1": ["PHASE1"]
};

export const MOCK_TRIALS: ClinicalTrial[] = [
  // --- Diabetes & Metabolic ---
  {
    nctId: 'NCT05678901',
    title: 'Phase 3 Study of Semaglutide in Early Type 2 Diabetes',
    phase: 'PHASE3',
    status: 'Recruiting',
    enrollment: 500,
    sponsor: 'Novo Nordisk',
    conditions: ['Type 2 Diabetes', 'T2D', 'Diabetes Mellitus'],
    intervention: 'Semaglutide 2.4mg',
    startDate: '2024-01-15',
    completionDate: '2026-12-01',
    locations: [
      { city: 'Boston', state: 'MA', country: 'USA' },
      { city: 'New York', state: 'NY', country: 'USA' }
    ],
    description: 'A multicenter, double-blind, randomized phase 3 study to evaluate efficacy of semaglutide.'
  },
  {
    nctId: 'NCT05544332',
    title: 'Oral Insulin for Prevention of Type 1 Diabetes in Relatives',
    phase: 'PHASE2',
    status: 'Recruiting',
    enrollment: 150,
    sponsor: 'TrialNet',
    conditions: ['Type 1 Diabetes', 'T1D', 'Diabetes Mellitus'],
    intervention: 'Oral Insulin',
    startDate: '2023-11-20',
    completionDate: '2025-08-30',
    locations: [
      { city: 'Seattle', state: 'WA', country: 'USA' },
      { city: 'Denver', state: 'CO', country: 'USA' }
    ],
    description: 'Prevention study for at-risk relatives using oral insulin formulation.'
  },

  // --- Oncology ---
  {
    nctId: 'NCT04567890',
    title: 'Keytruda (Pembrolizumab) Plus Chemotherapy in Non-Small Cell Lung Cancer',
    phase: 'PHASE3',
    status: 'Recruiting',
    enrollment: 1200,
    sponsor: 'Merck Sharp & Dohme',
    conditions: ['Non-small Cell Lung Cancer', 'NSCLC', 'Lung Cancer', 'Carcinoma'],
    intervention: 'Pembrolizumab',
    startDate: '2023-06-01',
    completionDate: '2027-05-30',
    locations: [
      { city: 'Boston', state: 'MA', country: 'USA' },
      { city: 'Houston', state: 'TX', country: 'USA' }
    ],
    description: 'Efficacy study of combination therapy for Stage IV NSCLC.'
  },
  {
    nctId: 'NCT08877665',
    title: 'Study of Nivolumab in Advanced Melanoma',
    phase: 'PHASE4',
    status: 'Active, not recruiting',
    enrollment: 800,
    sponsor: 'Bristol-Myers Squibb',
    conditions: ['Melanoma', 'Skin Cancer'],
    intervention: 'Nivolumab',
    startDate: '2021-03-15',
    completionDate: '2025-03-15',
    locations: [
      { city: 'Miami', state: 'FL', country: 'USA' }
    ],
    description: 'Post-marketing surveillance of long term survival in metastatic melanoma.'
  },
  {
    nctId: 'NCT09988776',
    title: 'Novel CAR-T Therapy for Relapsed Multiple Myeloma',
    phase: 'PHASE1',
    status: 'Recruiting',
    enrollment: 20,
    sponsor: 'Novartis',
    conditions: ['Multiple Myeloma', 'Blood Cancer'],
    intervention: 'CAR-T Cells',
    startDate: '2024-08-01',
    completionDate: '2026-02-01',
    locations: [
      { city: 'Boston', state: 'MA', country: 'USA' }
    ],
    description: 'Dose escalation study of new CAR-T construct targeting BCMA.'
  },

  // --- Rare Disease & Gene Therapy ---
  {
    nctId: 'NCT06789123',
    title: 'Phase 1/2 Study of CRISPR-Cas9 Gene Editing in Sickle Cell Disease',
    phase: 'PHASE1',
    status: 'Recruiting',
    enrollment: 45,
    sponsor: 'Vertex Pharmaceuticals',
    conditions: ['Sickle Cell Disease', 'Anemia', 'Blood Disorder'],
    intervention: 'CTX001',
    startDate: '2024-02-10',
    completionDate: '2028-01-01',
    locations: [
      { city: 'Philadelphia', state: 'PA', country: 'USA' },
      { city: 'London', state: 'N/A', country: 'UK' }
    ],
    description: 'Gene editing therapy for severe sickle cell disease using ex-vivo CRISPR modification.'
  },
  {
    nctId: 'NCT07712345',
    title: 'AAV Gene Transfer for Hemophilia A',
    phase: 'PHASE3',
    status: 'Active, not recruiting',
    enrollment: 130,
    sponsor: 'BioMarin',
    conditions: ['Hemophilia A', 'Blood Disorder'],
    intervention: 'Valoctocogene Roxaparvovec',
    startDate: '2022-01-01',
    completionDate: '2026-06-30',
    locations: [
      { city: 'Los Angeles', state: 'CA', country: 'USA' },
      { city: 'Paris', state: 'N/A', country: 'France' }
    ],
    description: 'Long-term efficacy of single dose AAV5-FVIII gene transfer.'
  },

  // --- Cardiovascular ---
  {
    nctId: 'NCT02233445',
    title: 'Secondary Prevention of Myocardial Infarction with Colchicine',
    phase: 'PHASE3',
    status: 'Completed',
    enrollment: 5500,
    sponsor: 'Montreal Heart Institute',
    conditions: ['Myocardial Infarction', 'Heart Attack', 'Coronary Artery Disease'],
    intervention: 'Colchicine 0.5mg',
    startDate: '2019-05-15',
    completionDate: '2023-11-01',
    locations: [
      { city: 'Montreal', state: 'QC', country: 'Canada' },
      { city: 'Chicago', state: 'IL', country: 'USA' }
    ],
    description: 'Large scale outcomes trial for anti-inflammatory therapy post-MI.'
  },
  {
    nctId: 'NCT03344556',
    title: 'Safety and Efficacy of mRNA-1273 Vaccine for COVID-19',
    phase: 'PHASE3',
    status: 'Completed',
    enrollment: 30000,
    sponsor: 'ModernaTX, Inc.',
    conditions: ['COVID-19', 'SARS-CoV-2'],
    intervention: 'mRNA-1273',
    startDate: '2020-07-27',
    completionDate: '2022-10-01',
    locations: [
      { city: 'Cambridge', state: 'MA', country: 'USA' },
      { city: 'Atlanta', state: 'GA', country: 'USA' }
    ],
    description: 'Large scale efficacy study of mRNA vaccine.'
  }
];
