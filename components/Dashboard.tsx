import React from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, YAxis } from 'recharts';
import { ProjectStats, Agent, AgentStatus } from '../types';
import { Activity, ShieldCheck, AlertTriangle, FileCheck, ArrowUpRight, MoreHorizontal, LayoutDashboard, Microscope } from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardProps {
  stats: ProjectStats;
  agents: Agent[];
  isEmpty?: boolean;
}

const data = [
  { name: 'M', value: 400 },
  { name: 'T', value: 300 },
  { name: 'W', value: 980 },
  { name: 'T', value: 390 },
  { name: 'F', value: 480 },
  { name: 'S', value: 380 },
  { name: 'S', value: 430 },
];

const MoleculeVisualizer = () => {
  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      {/* Central Atom */}
      <div className="w-6 h-6 bg-brand-600 rounded-full shadow-[0_0_15px_rgba(13,145,125,0.6)] z-10 relative">
        <div className="absolute inset-0 bg-white opacity-20 rounded-full"></div>
      </div>
      
      {/* Orbits */}
      {[0, 60, 120].map((rot, i) => (
        <motion.div
          key={i}
          className="absolute w-24 h-8 border border-slate-300 rounded-full"
          style={{ rotate: rot }}
          animate={{ rotate: [rot, rot + 360] }}
          transition={{ duration: 8 - i, repeat: Infinity, ease: "linear" }}
        >
           <div className="w-2 h-2 bg-slate-400 rounded-full absolute -top-1 left-1/2 -translate-x-1/2 shadow-sm"></div>
        </motion.div>
      ))}
      
      <div className="absolute -bottom-6 text-[10px] font-mono text-slate-400">
        C₂₂H₂₃ClN₂O₂
      </div>
    </div>
  );
};

const PhaseTimeline = () => {
  const steps = ['Discovery', 'Preclinical', 'Phase I', 'Phase II', 'Phase III', 'NDA/BLA'];
  const current = 4; // Phase III

  return (
    <div className="flex items-center justify-between w-full mt-2 relative">
       {/* Line */}
       <div className="absolute top-2 left-0 right-0 h-0.5 bg-gray-200 -z-0"></div>
       
       {steps.map((step, i) => {
         const isDone = i <= current;
         const isCurrent = i === current;
         return (
           <div key={step} className="flex flex-col items-center gap-2 z-10 relative">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white
                  ${isDone ? 'border-brand-600' : 'border-gray-300'}
                  ${isCurrent ? 'ring-4 ring-brand-50' : ''}
              `}>
                 {isDone && <div className="w-2 h-2 rounded-full bg-brand-600"></div>}
              </div>
              <span className={`text-[10px] font-medium ${isCurrent ? 'text-brand-700' : 'text-slate-400'}`}>{step}</span>
           </div>
         );
       })}
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ stats, agents, isEmpty = false }) => {
  if (isEmpty) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-12">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <LayoutDashboard className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">No Analysis Data Available</h3>
        <p className="text-slate-500 max-w-md">
          The project dashboard will populate once you have uploaded source documents and run the agent workflow.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* Top Pharma Context Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white rounded-lg border border-gray-200 p-5 shadow-sm flex flex-col justify-center">
             <div className="flex items-center gap-2 mb-4">
                <Microscope className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Development Lifecycle</h3>
             </div>
             <PhaseTimeline />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm flex items-center justify-between relative overflow-hidden">
             <div className="z-10">
                <h3 className="text-lg font-bold text-slate-900">RGX-2049</h3>
                <p className="text-xs text-slate-500 mb-2">Small Molecule • Oncology</p>
                <span className="inline-block bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded border border-green-100">
                   ACTIVE SUBSTANCE
                </span>
             </div>
             <MoleculeVisualizer />
          </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
               <div className="p-2 bg-brand-50 rounded-md border border-brand-100">
                  <Activity className="w-5 h-5 text-brand-600" />
               </div>
               <span className="text-green-600 text-xs font-medium bg-green-50 px-2 py-0.5 rounded border border-green-100 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> 12%
               </span>
            </div>
            <div>
               <p className="text-slate-500 text-sm font-medium">Total Claims</p>
               <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.totalClaims.toLocaleString()}</h3>
            </div>
         </div>

         <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
               <div className="p-2 bg-green-50 rounded-md border border-green-100">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
               </div>
            </div>
            <div>
               <p className="text-slate-500 text-sm font-medium">High Confidence</p>
               <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.verifiedHighConfidence.toLocaleString()}</h3>
            </div>
         </div>

         <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
               <div className="p-2 bg-amber-50 rounded-md border border-amber-100">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
               </div>
            </div>
            <div>
               <p className="text-slate-500 text-sm font-medium">Requires Review</p>
               <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.flaggedForReview}</h3>
            </div>
         </div>

         <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
               <div className="p-2 bg-purple-50 rounded-md border border-purple-100">
                  <FileCheck className="w-5 h-5 text-purple-600" />
               </div>
            </div>
            <div>
               <p className="text-slate-500 text-sm font-medium">Auto-Corrected</p>
               <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.autoCorrected}</h3>
            </div>
         </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         
         {/* Main Chart */}
         <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
               <h3 className="font-semibold text-slate-900">Verification Volume</h3>
               <button className="text-slate-400 hover:text-slate-600">
                  <MoreHorizontal className="w-5 h-5" />
               </button>
            </div>
            <div className="h-72 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#0d917d" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="#0d917d" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                     <Tooltip 
                        contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                        itemStyle={{color: '#1e293b'}}
                     />
                     <Area type="monotone" dataKey="value" stroke="#0d917d" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Quality Score Card */}
         <div className="bg-slate-900 rounded-lg p-6 shadow-sm text-white flex flex-col relative overflow-hidden">
             {/* Subtle mesh gradient background */}
             <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black opacity-50"></div>
             
             <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center">
                <div className="w-32 h-32 relative flex items-center justify-center mb-6">
                   <svg className="w-full h-full -rotate-90">
                      <circle cx="64" cy="64" r="56" fill="none" stroke="#334155" strokeWidth="8" />
                      <circle cx="64" cy="64" r="56" fill="none" stroke="#22c55e" strokeWidth="8" strokeDasharray="351.86" strokeDashoffset="10" strokeLinecap="round" />
                   </svg>
                   <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold tracking-tight">97.2%</span>
                      <span className="text-xs text-slate-400 uppercase tracking-widest mt-1">Accuracy</span>
                   </div>
                </div>
                
                <h4 className="text-lg font-medium mb-1">Excellent Quality</h4>
                <p className="text-sm text-slate-400">Your submission readiness is well above the recommended 95% threshold.</p>
             </div>

             <div className="relative z-10 pt-6 mt-6 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                <span>Last checked: 2m ago</span>
                <span>Target: 95.0%</span>
             </div>
         </div>
      </div>
    </div>
  );
};