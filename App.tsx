
import React, { useState, useEffect } from 'react';
import { Zap, UploadCloud, Settings, Bell, Search, Command, Globe, Radio, LayoutGrid, ChevronDown, MessageSquare } from 'lucide-react';
import { AgentWorkflow } from './components/AgentWorkflow';
import { TruthLayer } from './components/TruthLayer';
import { DocumentsView } from './components/DocumentsView';
import { ClinicalSearch } from './components/ClinicalSearch';
import { Chat } from './components/Chat';
import { INITIAL_AGENTS, MOCK_DISCREPANCIES } from './constants';
import { Agent, AgentStatus, Discrepancy, SourceDocument, ProjectStatus, ECTDModule, ChatSession } from './types';
import { generateAgentLog } from './services/geminiService';

enum View {
  DOCUMENTS = 'DOCUMENTS',
  AGENTS = 'AGENTS',
  TRUTHLAYER = 'TRUTHLAYER',
  SEARCH = 'SEARCH',
  CHAT = 'CHAT'
}

// Logo Component using PNG
const RegOSLogo = () => (
  <img src="/regos-logo-png.png" alt="RegOS" className="h-7 w-auto" />
);

// Regulatory Ticker Component
const RegulatoryTicker: React.FC = () => {
  return (
    <div className="bg-slate-900 text-white h-8 overflow-hidden flex items-center relative z-40 border-t border-slate-700">
      <div className="bg-brand-600 px-3 h-full flex items-center gap-2 text-[10px] font-bold tracking-wider z-10 shrink-0">
        <Radio className="w-3 h-3 animate-pulse" />
        REG. INTELLIGENCE
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="whitespace-nowrap animate-ticker inline-block text-[11px] font-mono text-slate-300 py-1">
          <span className="mx-8">•</span>
          <span className="text-white">FDA:</span> Draft Guidance Issued on RWE in Clinical Trials
          <span className="mx-8">•</span>
          <span className="text-white">EMA:</span> CTR Transition Period Updates
          <span className="mx-8">•</span>
          <span className="text-white">ICH:</span> M11 CeSHarP Protocol Template Consultation Open
          <span className="mx-8">•</span>
          <span className="text-white">PMDA:</span> New Electronic Study Data Submission Requirements
          <span className="mx-8">•</span>
          <span className="text-white">Health Canada:</span> Notice of Compliance with Conditions (NOC/c) Policy Update
          <span className="mx-8">•</span>
        </div>
      </div>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  // Navigation State
  const [currentView, setCurrentView] = useState<View>(View.SEARCH);
  const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false);

  // Data State
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('draft');
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>(MOCK_DISCREPANCIES);

  // Chat State
  const [pendingChatSession, setPendingChatSession] = useState<ChatSession | null>(null);
  const [hasChatSessions, setHasChatSessions] = useState(false);

  // Check if user has any chat sessions
  useEffect(() => {
    try {
      const stored = localStorage.getItem('regosChatSessions');
      if (stored) {
        const parsed = JSON.parse(stored);
        setHasChatSessions(parsed.length > 0);
      }
    } catch (error) {
      setHasChatSessions(false);
    }
  }, [currentView]); // Re-check when view changes

  const pendingDiscrepancies = discrepancies.filter(d => d.status === 'open').length;

  const isSubmissionApp = [View.DOCUMENTS, View.AGENTS, View.TRUTHLAYER].includes(currentView);

  // --- Actions ---

  const determineModule = (filename: string): ECTDModule => {
    const lower = filename.toLowerCase();
    if (lower.includes('admin') || lower.includes('cover') || lower.includes('form')) return 'm1';
    if (lower.includes('summary') || lower.includes('overview') || lower.includes('introduction')) return 'm2';
    if (lower.includes('quality') || lower.includes('cmc') || lower.includes('spec')) return 'm3';
    if (lower.includes('nonclinical') || lower.includes('tox') || lower.includes('animal')) return 'm4';
    if (lower.includes('clinical') || lower.includes('protocol') || lower.includes('sap') || lower.includes('csr') || lower.includes('ib')) return 'm5';
    return 'm1'; // Default
  };

  const handleUpload = (files: File[]) => {
    const newDocs: SourceDocument[] = files.map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      name: f.name,
      type: f.name.split('.').pop() || 'file',
      size: (f.size / 1024 / 1024).toFixed(2) + ' MB',
      status: 'ready',
      uploadDate: new Date(),
      module: determineModule(f.name)
    }));
    setDocuments(prev => [...prev, ...newDocs]);
  };

  const handleLoadSamples = () => {
    const sampleDocs: SourceDocument[] = [
      {
        id: 'sample-1',
        name: 'Protocol_v4.2_Phase3.pdf',
        type: 'pdf',
        size: '2.4 MB',
        status: 'ready',
        uploadDate: new Date(),
        module: 'm5'
      },
      {
        id: 'sample-2',
        name: 'CSR_14.3_Safety_Tables.xlsx',
        type: 'xlsx',
        size: '4.1 MB',
        status: 'ready',
        uploadDate: new Date(),
        module: 'm5'
      },
      {
        id: 'sample-3',
        name: 'Statistical_Analysis_Plan_Final.docx',
        type: 'docx',
        size: '1.8 MB',
        status: 'ready',
        uploadDate: new Date(),
        module: 'm5'
      },
      {
        id: 'sample-4',
        name: 'Investigator_Brochure_v5.pdf',
        type: 'pdf',
        size: '8.2 MB',
        status: 'ready',
        uploadDate: new Date(),
        module: 'm5'
      },
      {
        id: 'sample-5',
        name: 'M2.5_Clinical_Overview.docx',
        type: 'docx',
        size: '1.2 MB',
        status: 'ready',
        uploadDate: new Date(),
        module: 'm2'
      },
      {
        id: 'sample-6',
        name: 'M3.2.S_Drug_Substance.pdf',
        type: 'pdf',
        size: '5.5 MB',
        status: 'ready',
        uploadDate: new Date(),
        module: 'm3'
      },
      {
        id: 'sample-7',
        name: 'Cover_Letter_FDA.pdf',
        type: 'pdf',
        size: '0.2 MB',
        status: 'ready',
        uploadDate: new Date(),
        module: 'm1'
      }
    ];
    setDocuments(prev => {
      // Prevent duplicates by checking if ID already exists
      const existingIds = new Set(prev.map(d => d.id));
      const newSamples = sampleDocs.filter(d => !existingIds.has(d.id));
      return [...prev, ...newSamples];
    });
  };

  const handleDeleteDoc = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  // --- Parallel Orchestration Logic ---
  const startAnalysis = async () => {
    if (documents.length === 0) return;

    setProjectStatus('analyzing');
    setCurrentView(View.AGENTS);
    
    // Reset Agents
    setAgents(prev => prev.map(a => ({ ...a, status: AgentStatus.IDLE, progress: 0, logs: [] })));

    // Helper: Run a single agent for X steps
    const runAgent = async (agentId: string, steps: number = 4) => {
        // Set to Active
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: AgentStatus.ANALYZING } : a));
        
        // Find Agent Static Info
        const agentStatic = INITIAL_AGENTS.find(a => a.id === agentId);
        if (!agentStatic) return;

        for (let i = 1; i <= steps; i++) {
            const delay = Math.random() * 2000 + 1500; 
            await new Promise(r => setTimeout(r, delay));
            
            const logMsg = await generateAgentLog(agentStatic.name, agentStatic.role);
            
            setAgents(prev => prev.map(a => {
                if (a.id === agentId) {
                    return {
                        ...a,
                        progress: (i / steps) * 100,
                        logs: [...a.logs, { id: Date.now().toString() + Math.random(), timestamp: new Date(), message: logMsg, type: 'info' }]
                    };
                }
                return a;
            }));
        }

        // Set to Completed
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: AgentStatus.COMPLETED, progress: 100 } : a));
    };

    // --- PHASE 1: Intelligence (Monitoring) ---
    await runAgent('intelligence', 3);

    // --- PHASE 2: Protocol (Design) ---
    await runAgent('protocol', 4);

    // --- PHASE 3: PARALLEL EXECUTION (Specialists) ---
    await Promise.all([
        runAgent('safety', 5),
        runAgent('statistics', 4),
        runAgent('cmc', 5)
    ]);

    // --- PHASE 4: Document (Assembly) ---
    await runAgent('document', 3);

    // --- FINISH ---
    setProjectStatus('analyzed');
    setDocuments(prev => prev.map(d => ({ ...d, status: 'analyzed' })));
    
    setTimeout(() => {
      setCurrentView(View.TRUTHLAYER);
    }, 7500);
  };

  const handleResolveDiscrepancy = (id: string, action: 'approve' | 'reject') => {
    setDiscrepancies(prev => prev.map(d =>
      d.id === id ? { ...d, status: 'resolved', resolvedBy: 'Manoj Maheshwar', resolvedAt: new Date() } : d
    ));
  };

  // --- Components ---

  const NavLink = ({ view, label, disabled = false }: { view: View, label: string, disabled?: boolean }) => (
    <button 
      onClick={() => !disabled && setCurrentView(view)}
      disabled={disabled}
      className={`relative h-14 px-3 flex items-center text-sm font-medium transition-colors
        ${currentView === view ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {label}
      {currentView === view && (
        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-900 rounded-t-sm"></span>
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans">
      
      {/* Enterprise Top Navigation */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm shrink-0">
        
        {/* Left: Brand & Main Nav */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <RegOSLogo />
          </div>

          {/* Explore / Apps Menu */}
          <div className="relative">
              <button 
                onClick={() => setIsAppsMenuOpen(!isAppsMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 text-sm font-medium"
              >
                 <LayoutGrid className="w-4 h-4" />
                 Explore
                 <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
              
              {isAppsMenuOpen && (
                 <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        RegOS Apps
                    </div>
                    
                    <button 
                       onClick={() => {
                           setCurrentView(View.DOCUMENTS);
                           setIsAppsMenuOpen(false);
                       }}
                       className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left group
                           ${isSubmissionApp ? 'bg-brand-50' : 'hover:bg-slate-50'}
                       `}
                    >
                       <div className={`p-2 rounded-md ${isSubmissionApp ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500 group-hover:text-slate-700'}`}>
                           <Zap className="w-4 h-4" />
                       </div>
                       <div>
                          <div className={`text-sm font-semibold ${isSubmissionApp ? 'text-brand-900' : 'text-slate-900'}`}>SubmissionOS</div>
                          <div className="text-xs text-slate-500 mt-0.5">eCTD Assembly & Verification</div>
                       </div>
                    </button>

                    <button
                       onClick={() => {
                           setCurrentView(View.SEARCH);
                           setIsAppsMenuOpen(false);
                       }}
                       className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left group mt-1
                           ${[View.SEARCH, View.CHAT].includes(currentView) ? 'bg-brand-50' : 'hover:bg-slate-50'}
                       `}
                    >
                       <div className={`p-2 rounded-md ${[View.SEARCH, View.CHAT].includes(currentView) ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500 group-hover:text-slate-700'}`}>
                           <Globe className="w-4 h-4" />
                       </div>
                       <div>
                          <div className={`text-sm font-semibold ${[View.SEARCH, View.CHAT].includes(currentView) ? 'text-brand-900' : 'text-slate-900'}`}>Discovery</div>
                          <div className="text-xs text-slate-500 mt-0.5">Clinical Intelligence Search & Chat</div>
                       </div>
                    </button>
                 </div>
              )}
          </div>

          <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block"></div>
          
          {/* Contextual Navigation based on Active App */}
          {isSubmissionApp ? (
            <>
              {/* Pharma Context Header */}
              <div className="hidden lg:flex flex-col">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Candidate</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">RGX-2049</span>
                    <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 rounded border border-brand-100 font-medium">Oncology</span>
                </div>
              </div>

              <div className="h-6 w-px bg-gray-200 mx-2 hidden lg:block"></div>

              <nav className="flex items-center gap-1">
                <NavLink view={View.DOCUMENTS} label="1. eCTD Assembly" />
                <div className="h-px w-4 bg-gray-300 mx-1"></div>
                <NavLink view={View.AGENTS} label="2. Agent Workflow" disabled={projectStatus === 'draft'} />
                <div className="h-px w-4 bg-gray-300 mx-1"></div>
                <div className="relative">
                  <NavLink view={View.TRUTHLAYER} label="3. Verification" disabled={projectStatus === 'draft'} />
                  {pendingDiscrepancies > 0 && projectStatus === 'analyzed' && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white">
                      {pendingDiscrepancies}
                    </span>
                  )}
                </div>
              </nav>
            </>
          ) : (
             <nav className="flex items-center gap-1">
                <NavLink view={View.SEARCH} label="Search" />
                {hasChatSessions && (
                  <>
                    <div className="h-px w-4 bg-gray-300 mx-1"></div>
                    <NavLink view={View.CHAT} label="Chat" />
                  </>
                )}
             </nav>
          )}
        </div>

        {/* Right: Global Actions & User */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors">
              <UploadCloud className="w-5 h-5" />
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
             <div className="text-right hidden md:block">
                <p className="text-xs font-semibold text-slate-700">Manoj Maheshwar</p>
                <p className="text-[10px] text-slate-500">Future Developer, VivPro</p>
             </div>
             <div className="w-8 h-8 rounded bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white text-xs font-bold border border-white shadow-sm ring-1 ring-gray-100">
                JG
             </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden bg-slate-50 relative flex flex-col">
        {/* Global Dotted Background Pattern */}
        <div className="absolute inset-0 z-0 pointer-events-none" 
             style={{ 
               backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)', 
               backgroundSize: '24px 24px',
               opacity: 0.6
             }}>
        </div>

        <div className={`flex-1 overflow-auto relative z-10 ${currentView === View.CHAT ? '' : 'p-6'}`}>
          <div className={`h-full flex flex-col ${currentView === View.CHAT ? '' : 'max-w-[1600px] mx-auto'}`}>

            {currentView === View.DOCUMENTS && (
              <DocumentsView 
                documents={documents}
                onUpload={handleUpload}
                onLoadSamples={handleLoadSamples}
                onDelete={handleDeleteDoc}
                onStartAnalysis={startAnalysis}
                projectStatus={projectStatus}
              />
            )}

            {currentView === View.AGENTS && (
               <AgentWorkflow agents={agents} />
            )}

            {currentView === View.TRUTHLAYER && (
              <TruthLayer 
                discrepancies={projectStatus === 'analyzed' ? discrepancies : []} 
                onResolve={handleResolveDiscrepancy}
              />
            )}

            {currentView === View.SEARCH && (
              <ClinicalSearch
                onCreateChat={(session) => {
                  setPendingChatSession(session);
                  setHasChatSessions(true);
                  setCurrentView(View.CHAT);
                }}
              />
            )}

            {currentView === View.CHAT && (
              <Chat
                initialSession={pendingChatSession}
                onSessionsChange={(hasAnySessions) => {
                  setHasChatSessions(hasAnySessions);
                  // If no sessions left, redirect to Search
                  if (!hasAnySessions) {
                    setCurrentView(View.SEARCH);
                  }
                }}
              />
            )}
          </div>
        </div>
        
        {/* Footer Ticker */}
        <RegulatoryTicker />
      </main>
    </div>
  );
};

export default App;
