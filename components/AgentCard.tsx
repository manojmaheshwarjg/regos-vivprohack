import React from 'react';
import { Agent, AgentStatus } from '../types';
import { Globe, FileText, ShieldAlert, BarChart, FlaskConical, Files } from 'lucide-react';

interface AgentCardProps {
  agent: Agent;
}

const getIcon = (name: string) => {
  switch (name) {
    case 'Globe': return <Globe className="w-5 h-5" />;
    case 'FileText': return <FileText className="w-5 h-5" />;
    case 'ShieldAlert': return <ShieldAlert className="w-5 h-5" />;
    case 'BarChart': return <BarChart className="w-5 h-5" />;
    case 'FlaskConical': return <FlaskConical className="w-5 h-5" />;
    case 'Files': return <Files className="w-5 h-5" />;
    default: return <FileText className="w-5 h-5" />;
  }
};

export const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  const isRunning = agent.status === AgentStatus.ANALYZING || agent.status === AgentStatus.GENERATING;
  const isCompleted = agent.status === AgentStatus.COMPLETED;

  return (
    <div className={`
      relative overflow-hidden rounded-xl border p-5 transition-all duration-300
      ${isRunning ? 'border-brand-400 shadow-md bg-white' : ''}
      ${isCompleted ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'}
      ${agent.status === AgentStatus.IDLE ? 'opacity-70 grayscale' : ''}
    `}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${isCompleted ? 'bg-green-100 text-green-700' : isRunning ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
          {getIcon(agent.iconName)}
        </div>
        <div className="flex items-center gap-2">
            {isRunning && <span className="text-xs font-mono text-brand-600 animate-pulse">ACTIVE</span>}
            {isCompleted && <span className="text-xs font-mono text-green-600">DONE</span>}
        </div>
      </div>

      <h3 className="font-semibold text-slate-800">{agent.name}</h3>
      <p className="text-xs text-slate-500 mb-4">{agent.role}</p>

      {/* Progress Bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4 overflow-hidden">
        <div 
          className={`h-1.5 rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-brand-500'}`}
          style={{ width: `${agent.progress}%` }}
        ></div>
      </div>

      {/* Terminal / Log Output */}
      <div className="bg-slate-900 rounded-md p-3 h-24 overflow-hidden flex flex-col-reverse text-[10px] font-mono leading-relaxed shadow-inner">
        {agent.logs.length === 0 ? (
          <span className="text-slate-600 italic">Waiting for start signal...</span>
        ) : (
          agent.logs.map((log) => (
            <div key={log.id} className="text-green-400/90 truncate">
              <span className="text-slate-500 mr-2">[{log.timestamp.toLocaleTimeString().split(' ')[0]}]</span>
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
};