import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, Trash2, Play, File, Loader2, Database, FolderOpen, Layers, Plus } from 'lucide-react';
import { SourceDocument, ProjectStatus, ECTDModule } from '../types';

interface DocumentsViewProps {
  documents: SourceDocument[];
  onUpload: (files: File[]) => void;
  onLoadSamples: () => void;
  onDelete: (id: string) => void;
  onStartAnalysis: () => void;
  projectStatus: ProjectStatus;
}

const ECTD_MODULES: { id: ECTDModule; name: string; desc: string }[] = [
  { id: 'm1', name: 'Module 1', desc: 'Admin Info' },
  { id: 'm2', name: 'Module 2', desc: 'Summaries' },
  { id: 'm3', name: 'Module 3', desc: 'Quality' },
  { id: 'm4', name: 'Module 4', desc: 'Nonclinical' },
  { id: 'm5', name: 'Module 5', desc: 'Clinical' },
];

export const DocumentsView: React.FC<DocumentsViewProps> = ({ 
  documents, 
  onUpload, 
  onLoadSamples,
  onDelete, 
  onStartAnalysis,
  projectStatus 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(Array.from(e.dataTransfer.files));
    }
  };

  const getDocumentsByModule = (moduleId: ECTDModule) => {
    return documents.filter(d => d.module === moduleId);
  };

  return (
    <div className="max-w-[1600px] mx-auto h-full flex flex-col animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">eCTD Structure Assembly</h2>
          <p className="text-slate-500 mt-1">Populate the Common Technical Document modules to begin analysis.</p>
        </div>
        
        {/* Global Upload Button */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 bg-white border border-gray-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium"
        >
          <UploadCloud className="w-4 h-4" />
          Upload Document
        </button>
        <input 
           type="file" 
           ref={fileInputRef} 
           className="hidden" 
           multiple 
           accept=".pdf,.docx,.xml,.xlsx"
           onChange={(e) => e.target.files && onUpload(Array.from(e.target.files))}
         />
      </div>

      {/* Main eCTD Grid */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-x-auto pb-4">
        
        {/* Render columns for M1-M5 */}
        {ECTD_MODULES.map((module) => {
          const moduleDocs = getDocumentsByModule(module.id);
          const hasDocs = moduleDocs.length > 0;

          return (
            <div key={module.id} className="flex-1 min-w-[220px] max-w-[300px] flex flex-col">
              {/* Module Header */}
              <div className={`p-3 rounded-t-lg border-t border-x border-slate-200 bg-white shadow-sm flex items-center justify-between
                  ${module.id === 'm5' ? 'border-t-4 border-t-brand-600' : 'border-t-4 border-t-slate-300'}
              `}>
                 <div>
                   <h3 className="text-sm font-bold text-slate-800">{module.name}</h3>
                   <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">{module.desc}</p>
                 </div>
                 <div className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                   {moduleDocs.length}
                 </div>
              </div>

              {/* Drop Zone / List */}
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`flex-1 bg-slate-100/50 border-x border-b border-slate-200 rounded-b-lg p-2 space-y-2 overflow-y-auto custom-scrollbar relative transition-colors duration-300
                  ${isDragging ? 'bg-brand-50/50 border-brand-300' : ''}
                `}
              >
                {/* Empty State within Column */}
                {!hasDocs && (
                  <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-center p-4">
                    <FolderOpen className="w-6 h-6 text-slate-300 mb-2" />
                    <span className="text-[10px] text-slate-400">Drag & Drop {module.name} files</span>
                  </div>
                )}

                {/* Document Cards */}
                {moduleDocs.map(doc => (
                  <div key={doc.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm group hover:border-brand-300 transition-all cursor-default relative">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center mt-0.5
                           ${doc.type === 'pdf' ? 'bg-red-50 text-red-600' : 
                             doc.type === 'xlsx' ? 'bg-green-50 text-green-600' : 
                             'bg-brand-50 text-brand-600'}
                      `}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate leading-tight mb-1" title={doc.name}>{doc.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                           <span>{doc.size}</span>
                           {doc.status === 'analyzed' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                        </div>
                      </div>
                    </div>
                    
                    {/* Hover Actions */}
                    {projectStatus === 'draft' && (
                        <button 
                          onClick={() => onDelete(doc.id)}
                          className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Action Bar */}
      <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between shrink-0">
         <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <Layers className="w-4 h-4 text-slate-500" />
                <div className="flex flex-col">
                   <span className="text-[10px] text-slate-400 font-bold uppercase">Total Files</span>
                   <span className="text-sm font-bold text-slate-700 leading-none">{documents.length}</span>
                </div>
             </div>
             
             {projectStatus === 'draft' && (
                <button 
                  onClick={onLoadSamples}
                  className="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1"
                >
                  <Database className="w-3 h-3" />
                  Load Demo Data (Phase III)
                </button>
             )}
         </div>

         <button
            onClick={onStartAnalysis}
            disabled={documents.length === 0 || projectStatus === 'analyzing'}
            className={`
              py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 font-medium transition-all shadow-lg text-sm
              ${documents.length === 0 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                : projectStatus === 'analyzing'
                  ? 'bg-slate-800 text-slate-400 cursor-wait'
                  : 'bg-brand-600 hover:bg-brand-700 text-white hover:shadow-brand-500/25'
              }
            `}
          >
            {projectStatus === 'analyzing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating eCTD Structure...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Initiate RegOS Analysis
              </>
            )}
          </button>
      </div>

    </div>
  );
};