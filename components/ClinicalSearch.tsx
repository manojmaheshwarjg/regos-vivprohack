

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Sparkles, Filter, MapPin, Building2, Users, Calendar, ArrowRight, Brain, X, Check, Activity, Microscope, FlaskConical, Dna } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeClinicalQuery } from '../services/geminiService';
import { MOCK_TRIALS, DOMAIN_KNOWLEDGE } from '../constants';
import { ClinicalTrial, QueryAnalysis } from '../types';

// Helper: Domain Knowledge Expansion
const expandSearchTerms = (analysis: QueryAnalysis | null, rawQuery: string): string[] => {
  const terms = new Set<string>();
  
  // Add raw terms
  terms.add(rawQuery.toLowerCase());
  
  // Add analysis terms
  if (analysis) {
    if (analysis.condition) terms.add(analysis.condition.toLowerCase());
    if (analysis.intervention) terms.add(analysis.intervention.toLowerCase());
  }

  // Domain Expansion (Synonyms)
  Object.entries(DOMAIN_KNOWLEDGE).forEach(([key, synonyms]) => {
    // If query contains key, add synonyms
    if (rawQuery.toLowerCase().includes(key)) {
      synonyms.forEach(s => terms.add(s.toLowerCase()));
    }
    // If query contains a synonym, add the key
    synonyms.forEach(s => {
      if (rawQuery.toLowerCase().includes(s.toLowerCase())) {
        terms.add(key);
      }
    });
  });

  return Array.from(terms);
};

export const ClinicalSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<QueryAnalysis | null>(null);
  const [results, setResults] = useState<ClinicalTrial[]>([]);
  const [searched, setSearched] = useState(false);
  
  // Model Switcher State
  const [searchMode, setSearchMode] = useState<'hybrid' | 'semantic' | 'keyword'>('hybrid');
  
  // Autocomplete State
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Filters State
  const [activeFilters, setActiveFilters] = useState({
    phases: new Set<string>(),
    statuses: new Set<string>(),
    sponsors: new Set<string>()
  });

  // Suggestion Chips Data
  const SUGGESTION_CHIPS = [
    { label: "Phase 3 Diabetes", icon: <Activity className="w-3.5 h-3.5" /> },
    { label: "Recruiting Oncology", icon: <Microscope className="w-3.5 h-3.5" /> },
    { label: "Gene Therapy", icon: <Dna className="w-3.5 h-3.5" /> },
    { label: "Moderna Vaccines", icon: <FlaskConical className="w-3.5 h-3.5" /> },
    { label: "Pediatric Studies", icon: <Users className="w-3.5 h-3.5" /> }
  ];

  // Autocomplete Logic
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    
    const lowerQ = query.toLowerCase();
    const uniqueSuggestions = new Set<string>();

    // 1. Check Trials
    MOCK_TRIALS.forEach(t => {
      if (t.title.toLowerCase().includes(lowerQ)) uniqueSuggestions.add(t.title);
      t.conditions.forEach(c => {
         if (c.toLowerCase().includes(lowerQ)) uniqueSuggestions.add(c + " trials");
      });
    });

    // 2. Check Domain Knowledge keys
    Object.keys(DOMAIN_KNOWLEDGE).forEach(k => {
      if (k.includes(lowerQ)) uniqueSuggestions.add(k + " trials");
    });

    setSuggestions(Array.from(uniqueSuggestions).slice(0, 5));
  }, [query]);

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = overrideQuery || query;
    if (!searchQuery.trim()) return;

    if (overrideQuery) setQuery(overrideQuery);
    setShowSuggestions(false);
    setIsAnalyzing(true);
    setSearched(true);
    setResults([]);
    setAnalysis(null);
    setActiveFilters({ phases: new Set(), statuses: new Set(), sponsors: new Set() }); // Reset filters on new search

    try {
      // 1. Intelligent Parsing
      const parsed = await analyzeClinicalQuery(searchQuery);
      setAnalysis(parsed);

      // 2. Expand Terms (Domain Knowledge)
      const expandedTerms = expandSearchTerms(parsed, searchQuery);

      // 3. Hybrid Scoring Engine
      const scoredResults = MOCK_TRIALS.map(trial => {
        let keywordScore = 0;
        let semanticScore = 0; 
        let filterBoost = 0;
        const reasons: string[] = [];

        // A. Semantic/Keyword Match (Mocked)
        expandedTerms.forEach(term => {
          if (trial.conditions.some(c => c.toLowerCase().includes(term))) {
             semanticScore += 40;
             if (!reasons.includes('Condition Match')) reasons.push('Condition Match');
          }
          if (trial.intervention.toLowerCase().includes(term)) {
             semanticScore += 30;
             if (!reasons.includes('Intervention Match')) reasons.push('Intervention Match');
          }
          if (trial.title.toLowerCase().includes(term)) {
             keywordScore += 20;
          }
        });

        // B. Filter Boosting (Structured Data)
        if (parsed.phase && trial.phase === parsed.phase) {
          filterBoost += 20;
          reasons.push('Exact Phase Match');
        }
        
        if (parsed.status) {
           const statusKey = parsed.status.toLowerCase();
           const trialStatusLower = trial.status.toLowerCase();
           if (trialStatusLower.includes(statusKey) || 
               (DOMAIN_KNOWLEDGE[statusKey] && DOMAIN_KNOWLEDGE[statusKey].some(s => trialStatusLower.includes(s)))
           ) {
              filterBoost += 15;
              reasons.push('Status Match');
           }
        }

        if (parsed.sponsor && trial.sponsor.toLowerCase().includes(parsed.sponsor.toLowerCase())) {
          filterBoost += 15;
          reasons.push('Sponsor Match');
        }

        if (parsed.location) {
            const locMatch = trial.locations.some(l => 
                l.city.toLowerCase().includes(parsed.location!.toLowerCase()) || 
                l.state.toLowerCase().includes(parsed.location!.toLowerCase())
            );
            if (locMatch) {
                filterBoost += 10;
                reasons.push('Location Match');
            }
        }

        // Adjust scores based on search mode
        if (searchMode === 'keyword') {
            semanticScore = 0;
        } else if (searchMode === 'semantic') {
            keywordScore = keywordScore * 0.5;
        }

        // Calculate Final Score
        const totalScore = Math.min(100, keywordScore + semanticScore + filterBoost);

        return { 
          ...trial, 
          relevanceScore: totalScore, 
          matchReasons: reasons,
          matchDetails: { keywordScore, semanticScore, filterBoost }
        };
      });

      // Filter and Sort
      const filtered = scoredResults
        .filter(t => t.relevanceScore && t.relevanceScore > 10) // Threshold
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      setResults(filtered);

    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filter Logic
  const toggleFilter = (category: 'phases' | 'statuses' | 'sponsors', value: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev[category]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [category]: next };
    });
  };

  // Apply filters to display results
  const displayedResults = useMemo(() => {
    return results.filter(t => {
      if (activeFilters.phases.size > 0 && !activeFilters.phases.has(t.phase)) return false;
      if (activeFilters.statuses.size > 0 && !activeFilters.statuses.has(t.status)) return false;
      if (activeFilters.sponsors.size > 0 && !activeFilters.sponsors.has(t.sponsor)) return false;
      return true;
    });
  }, [results, activeFilters]);

  const uniqueSponsors = Array.from(new Set(results.map(r => r.sponsor)));

  return (
    <div className={`max-w-[1400px] mx-auto w-full min-h-full flex flex-col relative animate-in fade-in duration-500 transition-all px-4 ${!searched ? 'pb-24' : 'pb-12'}`}>
      
      {/* Search Header / Hero */}
      {/* Changed py-20 md:py-32 to py-10 md:py-16 to reduce gap */}
      <div className={`text-center max-w-4xl mx-auto w-full relative z-20 transition-all duration-700 ease-in-out ${!searched ? 'my-auto py-10 md:py-16 scale-100' : 'mt-2 mb-8 scale-95 origin-top'}`}>
        
        {!searched && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-[10px] font-bold uppercase tracking-wider mb-6 shadow-sm">
                    <Sparkles className="w-3 h-3 text-brand-500" />
                    Powered by RegOS Intelligence
                </div>

                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 tracking-tighter leading-tight">
                    Unlock Global <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-700 to-brand-500">Clinical Intelligence</span>
                </h2>
                
                <p className="text-slate-500 mb-10 text-sm md:text-base max-w-xl mx-auto leading-relaxed font-normal tracking-tight">
                    Analyze 400,000+ protocols instantly. Ask complex questions about study design, enrollment criteria, and competitive landscapes.
                </p>
            </motion.div>
        )}

        <div className="relative group text-left max-w-2xl mx-auto">
            {/* Input Card Container */}
            <form onSubmit={(e) => handleSearch(e)} className="relative z-20 bg-white rounded-2xl shadow-xl shadow-brand-900/5 border border-slate-200 flex flex-col p-5 transition-all duration-300 focus-within:shadow-2xl focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-500/10">
                
                <div className="flex items-start gap-3 mb-2">
                    <div className="mt-3 text-slate-400 shrink-0">
                        {isAnalyzing ? (
                            <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
                        ) : (
                            <Search className="w-5 h-5 text-brand-600" />
                        )}
                    </div>
                    
                    <textarea 
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setShowSuggestions(true);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSearch();
                            }
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="Describe condition, phase, intervention..."
                        className="flex-1 min-h-[100px] bg-transparent text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium resize-none py-2 tracking-tight"
                        autoComplete="off"
                    />

                    {query && (
                        <button 
                            type="button" 
                            onClick={() => setQuery('')}
                            className="mt-3 p-1 text-slate-300 hover:text-slate-500 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    {/* Model Switcher */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg">
                        {(['hybrid', 'semantic', 'keyword'] as const).map((mode) => (
                            <button 
                                key={mode}
                                type="button"
                                onClick={() => setSearchMode(mode)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${
                                    searchMode === mode 
                                    ? 'bg-white text-brand-700 shadow-sm ring-1 ring-black/5' 
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>

                    <button 
                        type="submit"
                        disabled={!query.trim()}
                        className={`h-9 px-5 rounded-lg flex items-center gap-2 justify-center transition-all text-xs font-bold uppercase tracking-wide
                            ${query.trim() 
                                ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-500/20' 
                                : 'bg-slate-100 text-slate-300 cursor-not-allowed'}
                        `}
                    >
                        Analyze <ArrowRight className="w-3 h-3" />
                    </button>
                </div>
            </form>

            {/* Smart Autocomplete Dropdown */}
            <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 8, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                        className="absolute top-full left-0 right-0 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden z-30"
                    >
                        <div className="px-5 py-2.5 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                            Suggested Queries
                        </div>
                        {suggestions.map((s, i) => (
                            <button 
                                key={i}
                                onClick={() => handleSearch(undefined, s)}
                                className="w-full text-left px-5 py-3 text-sm text-slate-700 hover:bg-brand-50/50 hover:text-brand-700 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0"
                            >
                                <Search className="w-3.5 h-3.5 opacity-40" />
                                {s}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Suggestion Chips (Bottom) */}
            {!searched && (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide mr-1">Trending:</span>
                    {SUGGESTION_CHIPS.map((chip, idx) => (
                        <button 
                            key={idx}
                            onClick={() => handleSearch(undefined, chip.label + " trials")}
                            className="group pl-3 pr-4 py-1.5 bg-white border border-slate-200 hover:border-brand-300 rounded-full text-xs font-medium text-slate-600 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                        >
                            {/* Uniform color for all icons */}
                            <span className="opacity-50 text-slate-400 group-hover:text-brand-600 transition-colors">{chip.icon}</span>
                            {chip.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Main Content Area (Results) */}
      {searched && (
          <div className="flex gap-8 items-start px-4 flex-1">
              
              {/* Interactive Sidebar Filters */}
              <div className="w-64 shrink-0 hidden lg:block space-y-4">
                 <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm sticky top-6">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-slate-800 font-semibold">
                            <Filter className="w-4 h-4" /> Filters
                        </div>
                        {(activeFilters.phases.size > 0 || activeFilters.statuses.size > 0 || activeFilters.sponsors.size > 0) && (
                            <button 
                                onClick={() => setActiveFilters({ phases: new Set(), statuses: new Set(), sponsors: new Set() })}
                                className="text-[10px] text-red-500 hover:underline"
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                    
                    <div className="space-y-6">
                        {/* Phase Filter */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Phase</label>
                            <div className="space-y-2">
                                {['PHASE1', 'PHASE2', 'PHASE3', 'PHASE4'].map(p => (
                                    <label key={p} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
                                        <input 
                                            type="checkbox" 
                                            checked={activeFilters.phases.has(p)}
                                            onChange={() => toggleFilter('phases', p)}
                                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" 
                                        />
                                        {p.replace('PHASE', 'Phase ')}
                                        <span className="ml-auto text-xs text-slate-400">
                                            {results.filter(r => r.phase === p).length}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Status</label>
                            <div className="space-y-2">
                                {['Recruiting', 'Active, not recruiting', 'Completed'].map(s => (
                                    <label key={s} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
                                        <input 
                                            type="checkbox" 
                                            checked={activeFilters.statuses.has(s)}
                                            onChange={() => toggleFilter('statuses', s)}
                                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" 
                                        />
                                        <span className="truncate">{s}</span>
                                        <span className="ml-auto text-xs text-slate-400">
                                            {results.filter(r => r.status === s).length}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Sponsor Filter */}
                        {uniqueSponsors.length > 0 && (
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Sponsor</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                    {uniqueSponsors.map(s => (
                                        <label key={s} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
                                            <input 
                                                type="checkbox" 
                                                checked={activeFilters.sponsors.has(s)}
                                                onChange={() => toggleFilter('sponsors', s)}
                                                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" 
                                            />
                                            <span className="truncate">{s}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                 </div>
              </div>

              {/* Results Column */}
              <div className="flex-1 space-y-6">
                  
                  {/* Intelligent Interpretation Block */}
                  <AnimatePresence>
                    {analysis && !isAnalyzing && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-900 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-white shadow-lg relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-800 via-slate-900 to-black opacity-50 pointer-events-none"></div>
                            
                            <div className="relative z-10 flex items-start gap-4">
                                <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-sm border border-white/10">
                                    <Brain className="w-6 h-6 text-brand-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-brand-100 mb-1 uppercase tracking-wider">Analysis Complete</h4>
                                    <div className="flex flex-wrap gap-2 text-sm text-slate-300">
                                        Searching for
                                        {analysis.phase && <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded">{analysis.phase}</span>}
                                        {analysis.condition && <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded">{analysis.condition}</span>}
                                        {analysis.intervention && <span>involving <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded">{analysis.intervention}</span></span>}
                                        {analysis.location && <span>in <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded">{analysis.location}</span></span>}
                                    </div>
                                </div>
                            </div>

                            <div className="relative z-10 text-right">
                                <div className="text-2xl font-bold text-white">{displayedResults.length}</div>
                                <div className="text-xs text-slate-400 uppercase tracking-wider">Trials Found</div>
                            </div>
                        </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Results List */}
                  {isAnalyzing ? (
                      <div className="space-y-4">
                          {[1, 2, 3].map(i => (
                              <div key={i} className="h-48 bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
                                  <div className="h-6 bg-slate-100 rounded w-3/4 mb-4"></div>
                                  <div className="flex gap-2 mb-6">
                                      <div className="h-5 bg-slate-100 rounded w-20"></div>
                                      <div className="h-5 bg-slate-100 rounded w-20"></div>
                                  </div>
                                  <div className="h-4 bg-slate-100 rounded w-full mb-2"></div>
                                  <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                              </div>
                          ))}
                      </div>
                  ) : displayedResults.length > 0 ? (
                      displayedResults.map((trial) => (
                          <motion.div 
                            key={trial.nctId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-xl border border-slate-200 p-0 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden"
                          >
                            {/* Relevance Header */}
                            <div className="bg-slate-50 border-b border-slate-100 px-6 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                        <div className="h-1.5 w-16 bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-brand-500" style={{ width: `${trial.relevanceScore}%` }}></div>
                                        </div>
                                        <span className="text-xs font-bold text-brand-700">{trial.relevanceScore}% Match</span>
                                    </div>
                                    <span className="text-slate-300 text-xs">|</span>
                                    <div className="flex gap-2">
                                        {trial.matchReasons?.slice(0, 3).map(reason => (
                                            <span key={reason} className="text-[10px] font-medium text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <Check className="w-2.5 h-2.5 text-brand-500" /> {reason}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400">{trial.nctId}</span>
                            </div>

                            <div className="p-6">
                                <div className="flex justify-between items-start mb-3 pr-4">
                                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-brand-700 transition-colors">
                                        {trial.title}
                                    </h3>
                                </div>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 ${
                                        trial.status === 'Recruiting' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                        'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${trial.status === 'Recruiting' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                        {trial.status}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                        {trial.phase}
                                    </span>
                                    {trial.conditions.slice(0, 2).map(c => (
                                        <span key={c} className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-600 border border-slate-100">
                                            {c}
                                        </span>
                                    ))}
                                </div>

                                <p className="text-sm text-slate-600 mb-6 leading-relaxed line-clamp-2">
                                    {trial.description}
                                </p>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-500 bg-slate-50/50 p-4 rounded-lg border border-slate-100">
                                    <div>
                                        <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Sponsor</span>
                                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                            <Building2 className="w-3.5 h-3.5 text-brand-500" />
                                            {trial.sponsor}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Enrollment</span>
                                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                            <Users className="w-3.5 h-3.5 text-brand-500" />
                                            {trial.enrollment}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Locations</span>
                                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                            <MapPin className="w-3.5 h-3.5 text-brand-500" />
                                            {trial.locations.length} Sites
                                        </div>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Completion</span>
                                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                            <Calendar className="w-3.5 h-3.5 text-brand-500" />
                                            {trial.completionDate}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center hover:bg-slate-100 transition-colors cursor-pointer group-hover:border-brand-100">
                                <span className="text-xs font-semibold text-slate-500 group-hover:text-brand-600 transition-colors">View full protocol details</span>
                                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-1 transition-all" />
                            </div>
                          </motion.div>
                      ))
                  ) : (
                      <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-slate-300" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2">No trials found matching "{query}"</h3>
                          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
                              We couldn't find exact matches. Try broadening your search or using different keywords.
                          </p>
                          
                          <div className="max-w-xs mx-auto space-y-2">
                             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Suggestions</div>
                             <button onClick={() => handleSearch(undefined, "cancer trials")} className="w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-600 font-medium transition-colors text-left flex justify-between">
                                Broaden to "Cancer trials" <ArrowRight className="w-3.5 h-3.5 opacity-50" />
                             </button>
                             <button onClick={() => setActiveFilters({ phases: new Set(), statuses: new Set(), sponsors: new Set() })} className="w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-600 font-medium transition-colors text-left flex justify-between">
                                Clear all filters <X className="w-3.5 h-3.5 opacity-50" />
                             </button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
