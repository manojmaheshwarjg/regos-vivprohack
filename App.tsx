
import React, { useState } from 'react';
import { Zap, UploadCloud, Settings, Bell, Search, Command, Globe, Radio, LayoutGrid, ChevronDown } from 'lucide-react';
import { AgentWorkflow } from './components/AgentWorkflow';
import { TruthLayer } from './components/TruthLayer';
import { DocumentsView } from './components/DocumentsView';
import { ClinicalSearch } from './components/ClinicalSearch';
import { INITIAL_AGENTS, MOCK_DISCREPANCIES } from './constants';
import { Agent, AgentStatus, Discrepancy, SourceDocument, ProjectStatus, ECTDModule } from './types';
import { generateAgentLog } from './services/geminiService';

enum View {
  DOCUMENTS = 'DOCUMENTS',
  AGENTS = 'AGENTS',
  TRUTHLAYER = 'TRUTHLAYER',
  SEARCH = 'SEARCH'
}

// Inline Logo Component from regos-logo.svg
const RegOSLogo = () => (
  <svg viewBox="0 0 341 84" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
    <path d="M71.7144 83.9793C70.8308 83.9793 70.05 83.3178 69.4952 82.739C66.1252 79.5347 62.7141 76.3718 59.3441 73.1882C58.6454 72.5267 57.8029 72.0513 56.8782 71.8032C50.2615 69.8186 43.0078 67.3999 38.5899 61.7356C37.0487 59.5444 37.2336 58.18 39.1652 56.2367C43.4805 51.8748 47.8162 47.5336 52.1315 43.1717C53.2822 42.014 54.0014 40.6703 54.1658 38.9751C54.3918 36.4324 57.207 33.931 59.6729 33.9517C62.2826 33.9724 65.2005 36.5978 65.4676 39.2646C65.6731 41.2698 64.4607 44.7221 61.214 45.3216C58.8509 45.7764 56.981 46.8927 55.3576 48.6292C52.6658 51.5234 49.8917 54.3142 47.2203 57.2084C45.6175 58.9448 45.597 59.317 47.5902 60.4539C55.1522 65.0433 65.3032 69.4052 73.1323 62.9346C75.8242 60.9914 80.386 57.4564 83.0985 51.5854C87.537 40.2982 81.9683 26.5096 68.3445 27.2331C65.6731 27.4605 64.1114 23.2433 66.3512 22.003C68.4883 20.99 67.6252 19.5843 67.0499 18.4266C65.3649 14.995 63.1867 11.8321 59.8373 9.8061C52.337 5.2995 41.7749 6.2091 35.8158 12.8037C32.4869 16.1526 29.3018 21.9409 32.2403 26.4889C34.1924 29.7138 32.2608 34.2411 28.6032 34.9233C24.0208 35.6882 20.1165 30.7681 22.1509 27.0471C23.3427 24.5043 24.0619 25.3933 25.0277 19.8323C25.2537 18.5506 24.5756 17.6824 23.3427 17.8271C4.82825 19.9977 -0.082901 45.549 16.8904 53.7767C18.3288 54.3762 19.4179 53.818 20.3015 52.9498C29.6922 43.6058 39.0625 34.2411 48.1861 24.6491C49.0286 23.7808 49.193 22.6852 49.3779 21.6515C50.015 18.0545 52.3575 16.8141 54.8645 16.5247C57.207 16.256 60.351 19.1708 60.762 21.6929C61.2346 24.587 58.6249 27.7086 55.1933 28.2047C53.9809 28.3701 53.0151 28.8663 52.1726 29.6725C42.2475 39.0992 32.7335 48.9393 23.2194 58.8001C19.8699 62.2731 19.5823 62.0871 15.3492 60.1645C6.92423 56.3814 1.91033 49.7042 0.369169 40.5049C-2.38436 25.5793 10.6847 10.9018 25.603 11.5013C27.6785 11.5013 29.0141 11.0052 30.3909 9.5167C33.9047 5.6716 38.3022 2.77747 43.2955 1.35106C47.0148 0.110711 50.2616 -0.488799 54.248 0.482811C64.1114 2.01258 71.5295 9.6614 74.2625 19.0468C74.6735 20.4318 75.2694 21.1967 76.6461 21.6722C86.1808 24.5664 91.4618 34.0964 90.9892 43.6678C91.8111 56.6295 82.893 66.1596 72.8035 70.8316C71.3035 71.4311 70.276 71.9686 71.098 72.9402C72.9679 75.1315 74.9201 77.2607 76.9133 79.3487L78.5161 81.0232C79.5846 82.1395 78.8038 84 77.2626 84H71.7144V83.9793Z" fill="url(#paint0_linear_logo)"/>
    <path d="M151.963 22.3488V34.4956H141.042V21.4622C141.042 19.9845 141.397 18.7432 142.107 17.7384C142.818 16.6744 143.824 15.6991 145.126 14.8125C146.902 13.7485 149.152 12.8619 151.875 12.1526C154.598 11.4433 157.528 11.0887 160.665 11.0887C166.23 11.0887 169.012 12.8028 169.012 16.2311C169.012 17.0586 168.893 17.827 168.657 18.5363C168.42 19.1865 168.124 19.7776 167.769 20.3096C167.177 20.1914 166.437 20.1027 165.549 20.0436C164.661 19.9254 163.714 19.8663 162.707 19.8663C160.576 19.8663 158.564 20.1027 156.67 20.5756C154.834 20.9893 153.266 21.5804 151.963 22.3488ZM141.042 30.8605L151.963 31.3924V54.0901C151.49 54.2674 150.809 54.4152 149.921 54.5334C149.033 54.7108 148.057 54.7994 146.991 54.7994C144.978 54.7994 143.469 54.4448 142.463 53.7355C141.515 52.9671 141.042 51.6371 141.042 49.7456V30.8605Z" fill="#0D917D"/>
    <path d="M176.276 38.8401L175.832 31.2151L199.629 27.6686C199.451 25.4225 198.593 23.4719 197.054 21.8169C195.515 20.1618 193.265 19.3343 190.306 19.3343C187.287 19.3343 184.771 20.3983 182.758 22.5262C180.745 24.595 179.71 27.5799 179.65 31.4811L179.917 36.0916C180.45 39.8745 181.9 42.6526 184.268 44.4259C186.695 46.1991 189.743 47.0858 193.413 47.0858C195.9 47.0858 198.208 46.7311 200.339 46.0218C202.47 45.2534 204.157 44.4259 205.4 43.5392C206.229 44.0712 206.88 44.751 207.354 45.5785C207.887 46.3469 208.153 47.204 208.153 48.1497C208.153 49.6865 207.472 51.0165 206.111 52.1395C204.749 53.2035 202.914 54.031 200.606 54.6221C198.297 55.2132 195.663 55.5087 192.703 55.5087C188.145 55.5087 184.09 54.6812 180.538 53.0262C177.046 51.312 174.293 48.7704 172.281 45.4012C170.327 42.032 169.35 37.8353 169.35 32.811C169.35 29.2054 169.913 26.0431 171.037 23.3241C172.162 20.6051 173.672 18.359 175.566 16.5858C177.519 14.7534 179.769 13.3939 182.314 12.5073C184.86 11.5615 187.523 11.0887 190.306 11.0887C194.212 11.0887 197.616 11.8866 200.517 13.4826C203.477 15.0194 205.785 17.1768 207.443 19.9549C209.159 22.733 210.018 25.9249 210.018 29.5305C210.018 31.1856 209.574 32.4268 208.686 33.2544C207.857 34.0228 206.673 34.4956 205.134 34.673L176.276 38.8401Z" fill="#0D917D"/>
    <path d="M232.678 52.7602C229.186 52.7602 225.959 52.11 223 50.8096C220.04 49.4501 217.672 47.2335 215.896 44.1599C214.12 41.0862 213.232 37.0373 213.232 32.0131C213.232 27.4026 214.12 23.5606 215.896 20.4869C217.731 17.3542 220.277 15.0194 223.532 13.4826C226.847 11.8866 230.636 11.0887 234.898 11.0887C237.917 11.0887 240.699 11.4729 243.245 12.2413C245.849 13.0097 247.921 13.8963 249.46 14.9012C250.466 15.5514 251.266 16.3493 251.857 17.2951C252.509 18.1817 252.834 19.2752 252.834 20.5756V48.2384H242.179V21.5509C241.409 21.078 240.462 20.6642 239.338 20.3096C238.213 19.9549 236.822 19.7776 235.164 19.7776C231.909 19.7776 229.245 20.7825 227.173 22.7922C225.16 24.8018 224.154 27.8755 224.154 32.0131C224.154 36.5644 225.131 39.7563 227.084 41.5887C229.097 43.421 231.553 44.3372 234.454 44.3372C236.703 44.3372 238.509 43.953 239.87 43.1846C241.291 42.4162 242.475 41.5887 243.422 40.702L243.777 49.5683C242.712 50.3958 241.232 51.1347 239.338 51.7849C237.503 52.4351 235.283 52.7602 232.678 52.7602ZM242.357 54.5334V45.8445H252.834V54.8881C252.834 58.9075 251.917 62.1584 250.082 64.641C248.247 67.1827 245.731 69.0446 242.534 70.2267C239.397 71.4089 235.875 72 231.968 72C228.89 72 226.196 71.7045 223.888 71.1134C221.638 70.5223 219.981 69.9016 218.915 69.2515C216.962 68.0693 215.985 66.4438 215.985 64.375C215.985 63.311 216.222 62.3653 216.695 61.5378C217.169 60.7103 217.731 60.0896 218.382 59.6759C219.862 60.6216 221.697 61.4491 223.888 62.1584C226.137 62.8677 228.505 63.2224 230.991 63.2224C234.543 63.2224 237.325 62.5131 239.338 61.0945C241.35 59.735 242.357 57.548 242.357 54.5334Z" fill="#0D917D"/>
    <rect width="2" height="60" transform="translate(115.042 12)" fill="#DEDEDE"/>
    <defs>
      <linearGradient id="paint0_linear_logo" x1="92.5536" y1="40.9261" x2="-7.93104" y2="42.7486" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00B893"/>
        <stop offset="1" stopColor="#4C8FF2"/>
      </linearGradient>
    </defs>
  </svg>
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
  const [currentView, setCurrentView] = useState<View>(View.DOCUMENTS);
  const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false);
  
  // Data State
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('draft');
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>(MOCK_DISCREPANCIES);

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
      d.id === id ? { ...d, status: 'resolved', resolvedBy: 'Sarah Chen', resolvedAt: new Date() } : d
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
          <div className="flex items-center gap-2">
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
                           ${currentView === View.SEARCH ? 'bg-brand-50' : 'hover:bg-slate-50'}
                       `}
                    >
                       <div className={`p-2 rounded-md ${currentView === View.SEARCH ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500 group-hover:text-slate-700'}`}>
                           <Globe className="w-4 h-4" />
                       </div>
                       <div>
                          <div className={`text-sm font-semibold ${currentView === View.SEARCH ? 'text-brand-900' : 'text-slate-900'}`}>Discovery</div>
                          <div className="text-xs text-slate-500 mt-0.5">Clinical Intelligence Search</div>
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
             <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="font-bold text-slate-900">Clinical Intelligence</span>
                <span className="text-slate-300">/</span>
                <span>Trial Search</span>
             </div>
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
                <p className="text-xs font-semibold text-slate-700">Sarah Chen</p>
                <p className="text-[10px] text-slate-500">Lead Regulatory Affairs</p>
             </div>
             <div className="w-8 h-8 rounded bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white text-xs font-bold border border-white shadow-sm ring-1 ring-gray-100">
                SC
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

        <div className="flex-1 overflow-auto p-6 relative z-10">
          <div className="max-w-[1600px] mx-auto h-full flex flex-col">
            
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
              <ClinicalSearch />
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
