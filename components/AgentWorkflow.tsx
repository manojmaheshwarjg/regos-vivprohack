import React, { useEffect, useState, useRef } from 'react';
import { Agent, AgentStatus } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, FileText, ShieldAlert, BarChart, FlaskConical, Files, 
  CheckCircle2, AlertOctagon, Server, Zap, Activity, Terminal
} from 'lucide-react';

interface AgentWorkflowProps {
  agents: Agent[];
}

// --- Icons & Assets ---

const AgentIcon: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
  switch (name) {
    case 'Globe': return <Globe className={className} />;
    case 'FileText': return <FileText className={className} />;
    case 'ShieldAlert': return <ShieldAlert className={className} />;
    case 'BarChart': return <BarChart className={className} />;
    case 'FlaskConical': return <FlaskConical className={className} />;
    case 'Files': return <Files className={className} />;
    default: return <Server className={className} />;
  }
};

// --- Mock Live Metrics Generator ---
const useLiveCounter = (isActive: boolean, min: number, max: number, label: string) => {
  const [count, setCount] = useState(min);
  
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setCount(prev => {
        const next = prev + Math.floor(Math.random() * 50);
        return next > max ? max : next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isActive, max]);

  return { count, label };
};

// --- Sub-Components ---

const DataStream: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  if (!isActive) return null;
  return (
    <div className="absolute top-[80%] left-1/2 -translate-x-1/2 w-px h-16 overflow-hidden z-0 opacity-50">
      <motion.div
        className="w-full h-full bg-gradient-to-b from-brand-400 to-transparent"
        animate={{ y: [-64, 64] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
};

const Station: React.FC<{ 
  agent: Agent; 
  index: number; 
  isActive: boolean; 
  isCompleted: boolean;
  isTruthLayer?: boolean;
}> = ({ agent, isActive, isCompleted, isTruthLayer }) => {
  
  // Custom metrics based on agent role
  const getMetrics = () => {
    switch(agent.id) {
      case 'intelligence': return { min: 0, max: 142, label: 'Sources Scanned' };
      case 'protocol': return { min: 0, max: 28, label: 'Endpoints Checks' };
      case 'safety': return { min: 0, max: 1247, label: 'AEs Processed' };
      case 'statistics': return { min: 0, max: 450, label: 'Models Run' };
      case 'cmc': return { min: 0, max: 89, label: 'Batches Validated' };
      case 'document': return { min: 0, max: 2400, label: 'Pages Compiled' };
      default: return { min: 0, max: 100, label: 'Items' };
    }
  };
  
  const metricConfig = getMetrics();
  const { count, label } = useLiveCounter(isActive, metricConfig.min, metricConfig.max, metricConfig.label);

  return (
    <div className={`relative flex flex-col items-center justify-end h-72 w-48 shrink-0 mx-2 transition-all duration-500 group`}>
      
      {/* Floating Metrics (Glass Card) */}
      <AnimatePresence>
        {isActive && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute -top-12 z-30 bg-white/80 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-lg shadow-apple text-center min-w-[130px]"
          >
            <div className="flex items-center justify-center gap-2 mb-1">
               <Activity className="w-3 h-3 text-brand-500 animate-pulse" />
               <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">LIVE</span>
            </div>
            <div className="text-2xl font-sans font-bold text-slate-900 tabular-nums tracking-tight">{count.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 font-medium">{label}</div>
            
            {/* Triangular pointer */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white/80"></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Line to Ceiling (Visual Anchor) */}
      <div className="absolute -top-32 left-1/2 w-px h-32 bg-gradient-to-b from-slate-200 to-transparent"></div>

      {/* The Machine Visual */}
      <div className={`
        relative w-36 h-36 bg-white rounded-2xl border transition-all duration-500 z-10 flex flex-col items-center justify-center
        ${isActive 
           ? 'border-brand-400 shadow-[0_0_40px_-10px_rgba(13,145,125,0.3)] scale-105' 
           : isCompleted 
             ? 'border-green-200 shadow-sm' 
             : 'border-slate-200 shadow-sm grayscale opacity-80'}
      `}>
        {/* Subtle texture on machine face */}
        <div className="absolute inset-0 bg-slate-50 rounded-2xl opacity-50" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '12px 12px' }}></div>
        
        {/* Machine Top Plate */}
        <div className="absolute -top-1 w-24 h-1 bg-slate-200 rounded-t-lg"></div>

        {/* Status Ring */}
        <div className={`
           relative p-4 rounded-full mb-3 transition-colors duration-500
           ${isActive ? 'bg-brand-50 ring-2 ring-brand-100' : isCompleted ? 'bg-green-50 ring-2 ring-green-100' : 'bg-slate-100'}
        `}>
           <AgentIcon 
             name={agent.iconName} 
             className={`w-8 h-8 transition-colors duration-500 ${isActive ? 'text-brand-600' : isCompleted ? 'text-green-600' : 'text-slate-400'}`} 
           />
           
           {/* Spinner Ring when active */}
           {isActive && (
              <motion.div 
                 className="absolute inset-0 rounded-full border-2 border-brand-500 border-t-transparent"
                 animate={{ rotate: 360 }}
                 transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
           )}
        </div>
        
        <div className="relative z-10 text-xs font-bold uppercase tracking-wider text-slate-600 text-center px-2">
          {agent.name.replace(' Agent', '')}
        </div>

        {/* Status Indicator Dot */}
        <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${isActive ? 'bg-brand-500 shadow-[0_0_8px_rgba(13,145,125,0.6)]' : isCompleted ? 'bg-green-500' : 'bg-slate-300'}`}></div>

        {/* Robotic Arm Animation */}
        {isActive && !isTruthLayer && (
           <motion.div 
             className="absolute -right-10 top-1/2 w-14 h-3 bg-slate-700 origin-left rounded-r-full shadow-lg flex items-center justify-end pr-1"
             initial={{ rotate: 0 }}
             animate={{ rotate: [0, 10, -5, 0] }}
             transition={{ repeat: Infinity, duration: 0.8 }}
           >
              <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse shadow-[0_0_5px_rgba(91,182,171,1)]"></div>
              {/* Joint */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-600"></div>
           </motion.div>
        )}
      </div>

      {/* Data Stream to Belt */}
      <DataStream isActive={isActive} />

      {/* Floor Shadow */}
      <div className="absolute bottom-10 w-32 h-2 bg-black/10 blur-md rounded-[100%]"></div>
      
      {/* Platform Stand */}
      <div className="w-16 h-12 bg-gradient-to-b from-slate-200 to-slate-300 mx-auto rounded-b-lg relative z-0">
          <div className="absolute top-2 left-2 right-2 h-px bg-slate-400/30"></div>
      </div>

    </div>
  );
};

const TruthLayerGate: React.FC<{ isActive: boolean; status: 'idle' | 'scanning' | 'error' | 'verified' }> = ({ isActive, status }) => {
  return (
    <div className="relative flex flex-col items-center justify-end h-72 w-64 shrink-0 mx-2">
      
      {/* Large Archway */}
      <div className={`
         relative z-10 w-56 h-64 border-x-[6px] border-t-[6px] border-slate-200 rounded-t-[3rem] flex flex-col items-center justify-start pt-6 overflow-hidden bg-white/40 backdrop-blur-sm transition-colors duration-500
         ${status === 'error' ? 'border-red-200 bg-red-50/20' : status === 'verified' ? 'border-green-200 bg-green-50/20' : ''}
      `}>
        
        {/* Branding */}
        <div className="flex items-center gap-2 text-slate-500 mb-6 px-4 py-1.5 bg-white/80 backdrop-blur rounded-full border border-slate-200 shadow-sm">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold tracking-widest text-slate-700">TRUTHLAYER QC</span>
        </div>

        {/* Laser Scanner */}
        {(status === 'scanning' || status === 'error') && (
           <motion.div 
             className={`w-full h-0.5 shadow-[0_0_20px_2px_rgba(0,0,0,0.5)] ${status === 'error' ? 'bg-red-500 shadow-red-500' : 'bg-brand-500 shadow-brand-500'}`}
             animate={{ y: [0, 200, 0] }}
             transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
           />
        )}

        {/* Status Screen */}
        <div className="mt-8 text-center px-4">
            {status === 'idle' && <span className="text-xs text-slate-400 font-mono tracking-wider">WAITING FOR INPUT...</span>}
            {status === 'scanning' && <span className="text-xs text-brand-600 font-mono font-bold animate-pulse tracking-wider">VERIFYING CONTENTS...</span>}
            {status === 'error' && (
              <motion.div 
                initial={{ scale: 0.8 }} animate={{ scale: 1.1 }} 
                className="flex flex-col items-center bg-white/90 p-3 rounded-xl shadow-lg border border-red-100"
              >
                <AlertOctagon className="w-8 h-8 text-red-500 mb-2" />
                <span className="text-xs text-red-600 font-bold font-mono">HALLUCINATION DETECTED</span>
                <span className="text-[10px] text-red-400 font-medium mt-1">Cross-reference failed</span>
              </motion.div>
            )}
            {status === 'verified' && (
               <motion.div 
               initial={{ scale: 0.8 }} animate={{ scale: 1.1 }} 
               className="flex flex-col items-center bg-white/90 p-3 rounded-xl shadow-lg border border-green-100"
             >
               <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
               <span className="text-xs text-green-600 font-bold font-mono">VERIFICATION PASSED</span>
               <span className="text-[10px] text-green-400 font-medium mt-1">99.9% Confidence</span>
             </motion.div>
            )}
        </div>
      </div>
      
      {/* Base pillars */}
      <div className="absolute bottom-0 w-72 flex justify-between px-4">
         <div className="w-8 h-12 bg-gradient-to-r from-slate-300 to-slate-200 rounded-t-lg shadow-lg"></div>
         <div className="w-8 h-12 bg-gradient-to-l from-slate-300 to-slate-200 rounded-t-lg shadow-lg"></div>
      </div>
    </div>
  );
};

// --- Main Workflow Component ---

export const AgentWorkflow: React.FC<AgentWorkflowProps> = ({ agents }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Logic State
  const activeAgentIndex = agents.findIndex(a => a.status === AgentStatus.ANALYZING || a.status === AgentStatus.GENERATING);
  const lastCompletedIndex = agents.map(a => a.status).lastIndexOf(AgentStatus.COMPLETED);
  const isAllComplete = agents.every(a => a.status === AgentStatus.COMPLETED);
  const activeAgent = agents[activeAgentIndex];
  
  // TruthLayer Logic State
  const [tlStatus, setTlStatus] = useState<'idle' | 'scanning' | 'error' | 'verified'>('idle');

  // Determine visual position
  let packagePosition = 0;
  if (isAllComplete) {
      packagePosition = 6;
  } else {
      if (activeAgentIndex !== -1) {
          packagePosition = activeAgentIndex;
      } else {
          packagePosition = lastCompletedIndex + 1;
      }
  }

  useEffect(() => {
    if (activeAgentIndex !== -1 && containerRef.current) {
      const scrollPos = activeAgentIndex * 220; 
      containerRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
    } else if (isAllComplete && containerRef.current) {
        containerRef.current.scrollTo({ left: 2000, behavior: 'smooth' });
    }
  }, [activeAgentIndex, isAllComplete]);

  // Handle TruthLayer Sequence
  useEffect(() => {
    if (isAllComplete && tlStatus === 'idle') {
      setTimeout(() => setTlStatus('scanning'), 500);
      setTimeout(() => setTlStatus('error'), 3000); // Wait a bit longer to build suspense
      setTimeout(() => setTlStatus('scanning'), 5500); // Fix
      setTimeout(() => setTlStatus('verified'), 7000); // Done
    }
  }, [isAllComplete, tlStatus]);


  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm relative select-none">
        
        {/* Floor Pattern Background */}
        <div className="absolute inset-0 z-0 pointer-events-none" 
             style={{ 
               backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(to right, #e2e8f0 1px, transparent 1px)', 
               backgroundSize: '80px 80px',
               opacity: 0.3,
               transform: 'perspective(1200px) rotateX(25deg) scale(1.5) translateY(-50px)',
               transformOrigin: 'top center',
               maskImage: 'radial-gradient(circle at 50% 50%, black 30%, transparent 100%)'
             }}>
        </div>

        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 p-6 z-30 pointer-events-none flex justify-between items-start">
           <div>
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Server className="w-5 h-5 text-brand-600" />
                Submission Factory Floor
             </h2>
             <p className="text-slate-500 text-sm mt-1 font-medium">Autonomous eCTD Assembly Line • Live Monitor</p>
           </div>

           {/* Live Legend */}
           <div className="flex gap-4 bg-white/80 backdrop-blur px-4 py-2 rounded-full border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                 <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></div> Active
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                 <div className="w-2 h-2 rounded-full bg-green-500"></div> Complete
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                 <div className="w-2 h-2 rounded-full bg-red-500"></div> QC Alert
              </div>
           </div>
        </div>

        {/* Main Scrolling Canvas */}
        <div 
           ref={containerRef}
           className="flex-1 overflow-x-auto overflow-y-hidden relative flex items-center px-16 pb-20 pt-32 custom-scrollbar z-10"
           style={{ scrollBehavior: 'smooth' }}
        >
            
            {/* The Conveyor Belt (Background) */}
            <div className="absolute top-[65%] left-0 w-[2400px] h-32 -translate-y-1/2 flex items-center overflow-hidden z-0">
                {/* Metallic Track */}
                <div className="w-full h-12 bg-gradient-to-b from-slate-200 to-slate-300 border-y border-slate-300 relative shadow-inner">
                    {/* Moving Chevrons */}
                    <motion.div 
                      className="absolute inset-0 flex"
                      animate={{ x: [-100, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                       {Array.from({ length: 50 }).map((_, i) => (
                          <div key={i} className="w-12 h-full border-r border-slate-400/20 skew-x-[-45deg]"></div>
                       ))}
                    </motion.div>
                </div>
            </div>

            {/* Stations */}
            <div className="relative z-10 flex gap-16 min-w-max px-12">
               {agents.map((agent, i) => (
                  <Station 
                    key={agent.id} 
                    agent={agent} 
                    index={i} 
                    isActive={agent.status === AgentStatus.ANALYZING || agent.status === AgentStatus.GENERATING}
                    isCompleted={agent.status === AgentStatus.COMPLETED}
                  />
               ))}
               
               {/* Separator */}
               <div className="w-24"></div>

               {/* TruthLayer Gate */}
               <TruthLayerGate isActive={isAllComplete} status={tlStatus} />
            </div>

            {/* The Moving Product (Document) */}
            <motion.div 
               className="absolute top-[65%] z-50"
               initial={{ x: 60 }}
               animate={{ 
                  x: isAllComplete ? 1880 : 100 + (packagePosition * 260), // Adjusted for new spacing
               }}
               transition={{ type: "spring", stiffness: 50, damping: 15 }}
               style={{ y: '-50%' }}
            >
               <div className="relative group">
                  {/* The Document Visual */}
                  <div className={`
                    w-14 bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-slate-200 transition-all duration-500
                    ${isAllComplete ? 'h-20 shadow-brand-500/20' : 'h-16'}
                  `}>
                     {/* Dynamic Layers (Pages) */}
                     <div className="absolute inset-1.5 flex flex-col justify-end gap-[1px] overflow-hidden rounded bg-slate-50 border border-slate-100 p-0.5">
                        {agents.map((_, i) => (
                           <motion.div 
                              key={i}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ 
                                height: i < packagePosition ? 2.5 : 0,
                                opacity: i < packagePosition ? 1 : 0
                              }}
                              className={`w-full rounded-[1px] ${i % 2 === 0 ? 'bg-brand-400' : 'bg-brand-300'}`}
                           />
                        ))}
                     </div>
                     
                     {/* Cover Header */}
                     <div className="absolute top-2 left-2 right-2 h-0.5 bg-slate-100 rounded-full"></div>
                  </div>

                  {/* Reflection on Floor */}
                  <div className="absolute -bottom-8 left-0 right-0 h-10 bg-white scale-y-[-0.3] opacity-20 blur-sm rounded-lg mask-image-gradient"></div>

                  {/* Error Overlay (during TruthLayer check) */}
                  <AnimatePresence>
                    {tlStatus === 'error' && (
                        <motion.div 
                            initial={{ scale: 0, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute -top-8 -right-12 bg-red-500 text-white text-[9px] font-bold px-2 py-1 rounded-full shadow-lg z-50 whitespace-nowrap flex items-center gap-1"
                        >
                            <AlertOctagon className="w-2.5 h-2.5" />
                            ERROR
                        </motion.div>
                    )}
                  </AnimatePresence>
               </div>
            </motion.div>

        </div>

        {/* Live System Log Ticker (New Element) */}
        <div className="h-10 bg-white border-t border-slate-200 shrink-0 flex items-center px-4 gap-4 overflow-hidden">
           <div className="flex items-center gap-2 text-slate-400 shrink-0 border-r border-slate-100 pr-4">
              <Terminal className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono uppercase tracking-widest font-semibold">System Log</span>
           </div>
           
           <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="wait">
                 {activeAgent && activeAgent.logs.length > 0 ? (
                    <motion.div 
                       key={activeAgent.logs[activeAgent.logs.length - 1].id}
                       initial={{ y: 20, opacity: 0 }}
                       animate={{ y: 0, opacity: 1 }}
                       exit={{ y: -20, opacity: 0 }}
                       className="text-xs font-mono text-slate-600 truncate flex items-center gap-2"
                    >
                       <span className="text-brand-500 font-bold">[{activeAgent.name.toUpperCase()}]</span>
                       {activeAgent.logs[activeAgent.logs.length - 1].message}
                    </motion.div>
                 ) : (
                    <motion.div 
                       initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                       className="text-xs font-mono text-slate-400 italic"
                    >
                       System standby. Ready for document ingestion...
                    </motion.div>
                 )}
              </AnimatePresence>
           </div>
           
           <div className="text-[10px] text-slate-400 font-mono shrink-0">
              RegOS v2.4.1 stable
           </div>
        </div>

    </div>
  );
};