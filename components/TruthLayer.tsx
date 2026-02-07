import React, { useState, useEffect } from 'react';
import { Discrepancy } from '../types';
import { Check, X, AlertOctagon, AlertTriangle, Info, FileText, ChevronRight, Edit2, ShieldCheck, Search, Filter, Brain, ArrowLeft, PenTool, Lock } from 'lucide-react';

interface TruthLayerProps {
  discrepancies: Discrepancy[];
  onResolve: (id: string, action: 'approve' | 'reject') => void;
}

export const TruthLayer: React.FC<TruthLayerProps> = ({ discrepancies, onResolve }) => {
  const openDiscrepancies = discrepancies.filter(d => d.status === 'open');
  const [selectedId, setSelectedId] = useState<string | null>(openDiscrepancies[0]?.id || null);

  useEffect(() => {
    if (selectedId && !openDiscrepancies.find(d => d.id === selectedId)) {
      setSelectedId(openDiscrepancies[0]?.id || null);
    } else if (!selectedId && openDiscrepancies.length > 0) {
      setSelectedId(openDiscrepancies[0].id);
    }
  }, [discrepancies, selectedId, openDiscrepancies]);

  const selectedDisc = discrepancies.find(d => d.id === selectedId);

  // Helper to show resolved state if selected item disappears from "open" list but we still want to see it momentarily, 
  // OR if we implement a "Show All" toggle later. For now, we mainly focus on open.

  return (
    <div className="flex h-full rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm animate-in fade-in duration-500">
      
      {/* Master List (Left Pane) */}
      <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-gray-200 px-4 flex items-center justify-between shrink-0 bg-white">
           <span className="font-semibold text-sm text-slate-800">Discrepancies</span>
           <span className="bg-gray-100 text-slate-600 text-xs px-2 py-0.5 rounded-full border border-gray-200 font-medium">
             {openDiscrepancies.length}
           </span>
        </div>

        {/* Filter/Search */}
        <div className="p-3 border-b border-gray-200 bg-white">
           <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Filter items..." 
                className="w-full bg-gray-50 rounded-md pl-8 pr-3 py-1.5 text-xs border border-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all"
              />
           </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {openDiscrepancies.map(disc => (
            <button 
              key={disc.id}
              onClick={() => setSelectedId(disc.id)}
              className={`
                w-full text-left p-3 rounded-md border transition-all duration-200
                ${selectedId === disc.id 
                  ? 'bg-white border-brand-200 shadow-sm ring-1 ring-brand-100' 
                  : 'bg-transparent border-transparent hover:bg-white hover:border-gray-200'}
              `}
            >
              <div className="flex justify-between items-start mb-1.5">
                 <div className="flex items-center gap-1.5">
                    {disc.severity === 'critical' && <AlertOctagon className="w-3.5 h-3.5 text-red-600" />}
                    {disc.severity === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                    {disc.severity === 'administrative' && <Info className="w-3.5 h-3.5 text-brand-600" />}
                    <span className={`text-xs font-semibold capitalize ${
                       disc.severity === 'critical' ? 'text-red-700' : 
                       disc.severity === 'warning' ? 'text-amber-700' : 'text-brand-700'
                    }`}>
                      {disc.severity}
                    </span>
                 </div>
              </div>
              <h4 className="text-xs font-medium text-slate-900 line-clamp-1 mb-0.5">
                 {disc.sourceDoc}
              </h4>
              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                 {disc.explanation}
              </p>
            </button>
          ))}
          
          {openDiscrepancies.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-center p-4">
               <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center mb-2 border border-green-100">
                  <Check className="w-4 h-4 text-green-600" />
               </div>
               <p className="text-xs font-medium text-slate-900">All Clear</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail View (Right Pane) */}
      <div className="flex-1 bg-white flex flex-col h-full min-w-0">
        {selectedDisc ? (
          <>
            {/* Toolbar */}
            <div className="h-14 border-b border-gray-200 flex items-center justify-between px-6 shrink-0 bg-white">
               <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900 truncate">Verification Item #{selectedDisc.id.toUpperCase()}</span>
                    <span className="text-xs text-slate-500 truncate">{selectedDisc.sourceDoc}</span>
                  </div>
               </div>
               <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => onResolve(selectedDisc.id, 'reject')}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Reject
                  </button>
                  <button 
                    onClick={() => onResolve(selectedDisc.id, 'approve')}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <PenTool className="w-3 h-3" />
                    Resolve & Sign
                  </button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
               <div className="max-w-4xl mx-auto space-y-6">
                  
                  {/* Analysis Banner */}
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 flex gap-3">
                     <Brain className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                     <div>
                       <h3 className="text-sm font-bold text-amber-900 mb-1">
                          TruthLayer Analysis
                       </h3>
                       <p className="text-amber-800 text-sm leading-relaxed">
                          {selectedDisc.explanation}
                       </p>
                     </div>
                  </div>

                  {/* Comparison Grid */}
                  <div className="grid grid-cols-2 gap-8 mt-6">
                     <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Generated Output</span>
                           <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">FLAGGED</span>
                        </div>
                        <div className="p-4 bg-red-50/30 rounded-lg border border-red-100 text-sm font-serif text-slate-800 leading-relaxed">
                           {selectedDisc.generatedText}
                        </div>
                     </div>

                     <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Source Truth</span>
                           <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">VERIFIED</span>
                        </div>
                        <div className="p-4 bg-green-50/30 rounded-lg border border-green-100 text-sm font-serif text-slate-800 leading-relaxed">
                           {selectedDisc.sourceText}
                        </div>
                     </div>
                  </div>
                  
                  {/* Source Context */}
                  <div className="mt-8 pt-8 border-t border-gray-100">
                     <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Context from Source Document</h4>
                     <div className="bg-slate-50 rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center gap-2 mb-2 text-xs text-brand-600 font-medium">
                           <FileText className="w-3.5 h-3.5" />
                           {selectedDisc.sourceDoc}
                        </div>
                        <p className="text-xs text-slate-600 font-mono leading-relaxed">
                           ...analysis of the safety population (N=305). The overall incidence of treatment-emergent adverse events (TEAEs) was similar between groups.
                           <span className="bg-yellow-100 text-slate-900 px-1">Regarding serious adverse events, {selectedDisc.sourceText.toLowerCase()}</span> The event was considered unrelated to study drug by the investigator but related by the sponsor due to temporal plausibility.
                           No other significant safety signals were identified in the laboratory parameters or vital signs...
                        </p>
                     </div>
                  </div>

               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50/50">
             {/* Resolved State / Empty State */}
             {discrepancies.some(d => d.status === 'resolved') ? (
                 <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600">
                        <Lock className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Record Verified</h3>
                    <div className="text-xs text-slate-500 font-mono bg-slate-100 p-3 rounded text-left space-y-1 mb-4">
                        <div className="flex justify-between"><span>STATUS:</span> <span className="text-green-600 font-bold">LOCKED</span></div>
                        <div className="flex justify-between"><span>SIGNER:</span> <span>Sarah Chen (Lead RA)</span></div>
                        <div className="flex justify-between"><span>TIMESTAMP:</span> <span>{new Date().toISOString()}</span></div>
                        <div className="flex justify-between"><span>21 CFR 11:</span> <span>COMPLIANT</span></div>
                    </div>
                    <p className="text-sm text-slate-400">Digital signature applied. No further open items.</p>
                 </div>
             ) : (
                <>
                  <ShieldCheck className="w-16 h-16 mb-4 opacity-10" />
                  <p className="text-sm font-medium text-slate-400">Select an item from the list to review</p>
                </>
             )}
          </div>
        )}
      </div>

    </div>
  );
};