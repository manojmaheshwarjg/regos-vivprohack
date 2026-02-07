

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Sparkles, Filter, MapPin, Building2, Users, Calendar, ArrowRight, Brain, X, Check, Activity, Microscope, FlaskConical, Dna, AlertCircle, HelpCircle, History, Clock, ChevronRight, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeClinicalQuery, validateMedicalQuery, generateAnswerWithCitations, generateRelatedQuestions } from '../services/geminiService';
import { executeSearch } from '../services/searchEngine';
import { generateQueryEmbedding } from '../services/embeddingService';
import { DOMAIN_KNOWLEDGE } from '../constants';
import { ClinicalTrial, QueryAnalysis, ChatSession, Message } from '../types';

// Search History Type
interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  results: ClinicalTrial[];
  aiAnswer: { answer: string; citations: string[] } | null;
  relatedQuestions: string[];
  searchMode: 'hybrid' | 'keyword';
  resultCount: number;
}

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

// Helper: Detect if query is a question that should trigger AI answer generation
const isQuestionQuery = (query: string): boolean => {
  const lowerQuery = query.toLowerCase().trim();
  const questionPatterns = [
    /\?$/,                                    // Ends with question mark
    /^(how many|how much|what|which|when|where|who|why|can you|could you|tell me|show me|find me|are there|is there)/i,
    /\b(trials? have been|studies? have been|research has been)\b/i
  ];

  return questionPatterns.some(pattern => pattern.test(lowerQuery));
};

interface ClinicalSearchProps {
  onCreateChat?: (session: ChatSession) => void;
}

export const ClinicalSearch: React.FC<ClinicalSearchProps> = ({ onCreateChat }) => {
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<QueryAnalysis | null>(null);
  const [results, setResults] = useState<ClinicalTrial[]>([]);
  const [searched, setSearched] = useState(false);
  const [validationError, setValidationError] = useState<{ score: number; reason: string } | null>(null);
  const [aiAnswer, setAiAnswer] = useState<{ answer: string; citations: string[] } | null>(null);
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  const [relatedQuestions, setRelatedQuestions] = useState<string[]>([]);

  // Search History State
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Model Switcher State (removed 'semantic' - use hybrid for AI-powered search)
  const [searchMode, setSearchMode] = useState<'hybrid' | 'keyword'>('hybrid');
  
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
    { label: "What are the latest diabetes trials?", icon: <Activity className="w-3.5 h-3.5" /> },
    { label: "Which cancer trials are currently recruiting?", icon: <Microscope className="w-3.5 h-3.5" /> },
    { label: "Show me Phase 3 cardiovascular studies", icon: <Dna className="w-3.5 h-3.5" /> },
    { label: "How many gene therapy trials exist?", icon: <FlaskConical className="w-3.5 h-3.5" /> },
    { label: "Find completed immunotherapy studies", icon: <Users className="w-3.5 h-3.5" /> }
  ];

  // Load search history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('regosSearchHistory');
      if (stored) {
        const parsed = JSON.parse(stored);
        setSearchHistory(parsed.slice(0, 20)); // Keep last 20 searches
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, []);

  // Save search history to localStorage whenever it changes
  useEffect(() => {
    if (searchHistory.length > 0) {
      try {
        localStorage.setItem('regosSearchHistory', JSON.stringify(searchHistory));
      } catch (error) {
        console.error('Failed to save search history:', error);
      }
    }
  }, [searchHistory]);

  // Autocomplete Logic
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const lowerQ = query.toLowerCase();
    const uniqueSuggestions = new Set<string>();

    // Check Domain Knowledge keys for suggestions
    Object.keys(DOMAIN_KNOWLEDGE).forEach(k => {
      if (k.includes(lowerQ)) uniqueSuggestions.add(k + " trials");
    });

    // Add common search patterns
    const commonPatterns = [
      'diabetes trials',
      'cancer immunotherapy',
      'heart disease',
      'phase 3 recruiting',
      'pediatric studies',
      'gene therapy',
      'vaccine trials'
    ];

    commonPatterns.forEach(pattern => {
      if (pattern.toLowerCase().includes(lowerQ)) {
        uniqueSuggestions.add(pattern);
      }
    });

    setSuggestions(Array.from(uniqueSuggestions).slice(0, 5));
  }, [query]);

  // Function to save current search to history
  const saveToHistory = (
    searchQuery: string,
    searchResults: ClinicalTrial[],
    answer: { answer: string; citations: string[] } | null,
    related: string[],
    mode: 'hybrid' | 'keyword'
  ) => {
    const historyItem: SearchHistoryItem = {
      id: Date.now().toString() + Math.random(),
      query: searchQuery,
      timestamp: Date.now(),
      results: searchResults,
      aiAnswer: answer,
      relatedQuestions: related,
      searchMode: mode,
      resultCount: searchResults.length
    };

    setSearchHistory(prev => [historyItem, ...prev].slice(0, 20));
  };

  // Function to restore from history
  const restoreFromHistory = (item: SearchHistoryItem) => {
    setQuery(item.query);
    setResults(item.results);
    setAiAnswer(item.aiAnswer);
    setRelatedQuestions(item.relatedQuestions);
    setSearchMode(item.searchMode);
    setSearched(true);
    setShowHistory(false);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    setAiAnswer(null); // Reset AI answer
    setActiveFilters({ phases: new Set(), statuses: new Set(), sponsors: new Set() }); // Reset filters on new search

    try {
      console.log('🔍 Starting Elasticsearch search:', searchQuery, 'Mode:', searchMode);

      // 1. Query Validation (for hybrid mode that uses embeddings)
      if (searchMode === 'hybrid') {
        console.log('🔒 Validating query for medical relevance...');
        const validation = await validateMedicalQuery(searchQuery);

        if (!validation.isValid) {
          console.warn(`❌ Query blocked: "${searchQuery}" (score: ${validation.score}/100)`);
          setValidationError({ score: validation.score, reason: validation.reason });
          setIsAnalyzing(false);
          return; // Block the search
        }
        console.log(`✓ Query validated (score: ${validation.score}/100)`);
      }

      // 2. Intelligent Parsing
      const parsed = await analyzeClinicalQuery(searchQuery);
      setAnalysis(parsed);
      console.log('✓ Query analyzed:', parsed);

      // 3. Generate embedding for hybrid search
      let queryEmbedding: number[] | null = null;
      if (searchMode === 'hybrid') {
        console.log('🧠 Generating query embedding...');
        queryEmbedding = await generateQueryEmbedding(searchQuery);
        if (queryEmbedding) {
          console.log(`✓ Embedding generated (${queryEmbedding.length} dims)`);
        } else {
          console.warn('⚠ Embedding generation failed, falling back to keyword search');
        }
      }

      // 4. Build filters from parsed query
      const filters: any = {};
      if (parsed.phase) {
        filters.phases = [parsed.phase];
      }
      if (parsed.status) {
        filters.statuses = [parsed.status];
      }
      if (parsed.sponsor) {
        filters.sponsors = [parsed.sponsor];
      }

      // 5. Perform Elasticsearch search
      console.log('📡 Calling Elasticsearch...');
      const searchResult = await executeSearch({
        query: searchQuery,
        mode: searchMode,
        queryAnalysis: parsed,
        queryEmbedding: queryEmbedding || undefined,
        filters,
        page: 1,
        pageSize: 50
      });

      console.log(`✓ Found ${searchResult.total} results in ${searchResult.took}ms`);

      // 6. Transform ES results to match component expectations
      const transformedResults: ClinicalTrial[] = searchResult.trials.map((esDoc: any) => ({
        id: esDoc.nct_id || esDoc._id,
        nctId: esDoc.nct_id,
        title: esDoc.brief_title || esDoc.title || 'Untitled Study',
        sponsor: esDoc.source || 'Unknown Sponsor',
        phase: esDoc.phase || 'N/A',
        status: esDoc.overall_status || esDoc.status || 'Unknown',
        conditions: Array.isArray(esDoc.conditions)
          ? esDoc.conditions.map((c: any) => typeof c === 'object' ? c.condition_name || c.name || String(c) : String(c))
          : [],
        intervention: Array.isArray(esDoc.interventions) && esDoc.interventions.length > 0
          ? (typeof esDoc.interventions[0] === 'object'
              ? esDoc.interventions[0].intervention_name || esDoc.interventions[0].name || 'N/A'
              : String(esDoc.interventions[0]))
          : 'N/A',
        enrollment: typeof esDoc.enrollment === 'number' ? esDoc.enrollment : 0,
        locations: Array.isArray(esDoc.facilities)
          ? esDoc.facilities.slice(0, 3).map((f: any) => ({
              city: f.city || 'Unknown',
              state: f.state || f.country || 'Unknown',
              country: f.country || 'Unknown'
            }))
          : [],
        startDate: esDoc.start_date || null,
        description: esDoc.brief_summaries_description || esDoc.detailed_description || 'No description available',
        relevanceScore: esDoc._score ? Math.min(100, esDoc._score * 10) : 50,
        matchReasons: esDoc.matchReasons || ['Elasticsearch Match'],
        matchDetails: esDoc.matchDetails || {}
      }));

      setResults(transformedResults);
      console.log('✓ Results transformed and displayed');

      // 7. Generate AI answer for question-type queries
      let finalAnswer: { answer: string; citations: string[] } | null = null;
      let finalRelatedQuestions: string[] = [];

      if (isQuestionQuery(searchQuery) && transformedResults.length > 0) {
        setIsGeneratingAnswer(true);
        console.log('🤖 Detected question query, generating AI answer...');

        try {
          const answer = await generateAnswerWithCitations(searchQuery, transformedResults);
          setAiAnswer(answer);
          finalAnswer = answer;
          console.log('✓ AI answer generated with', answer.citations.length, 'citations');

          // Generate related follow-up questions
          const related = await generateRelatedQuestions(searchQuery, transformedResults);
          setRelatedQuestions(related);
          finalRelatedQuestions = related;
          console.log('✓ Generated', related.length, 'related questions');
        } catch (answerErr) {
          console.error('⚠ Failed to generate AI answer:', answerErr);
          // Silently fail - results are still shown
        } finally {
          setIsGeneratingAnswer(false);
        }
      }

      // 8. Save to search history
      saveToHistory(searchQuery, transformedResults, finalAnswer, finalRelatedQuestions, searchMode);
      console.log('✓ Search saved to history');

    } catch (err) {
      console.error('❌ Search error:', err);
      alert(`Search failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

      {/* Search History Button */}
      {searchHistory.length > 0 && (
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="fixed top-20 right-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm font-medium text-slate-700 hover:text-brand-700 hover:border-brand-300"
        >
          <History className="w-4 h-4" />
          <span className="hidden md:inline">Recent Searches</span>
          <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full text-xs font-bold">
            {searchHistory.length}
          </span>
        </button>
      )}

      {/* Search History Modal */}
      <AnimatePresence>
        {showHistory && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              {/* Modal - Click inside won't close */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-brand-100 rounded-xl">
                        <History className="w-5 h-5 text-brand-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Search History</h3>
                        <p className="text-xs text-slate-500">Click any search to restore results instantly</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowHistory(false)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-500" />
                    </button>
                  </div>
                </div>

                {/* Scrollable History List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {searchHistory.map((item, idx) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => restoreFromHistory(item)}
                      className="w-full text-left p-4 bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-300 rounded-xl transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700 line-clamp-2 transition-colors">
                            {item.query}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 shrink-0 ml-2 mt-0.5 group-hover:translate-x-1 transition-transform" />
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Search className="w-3 h-3" />
                          {item.resultCount} results
                        </div>
                        {item.searchMode === 'hybrid' && (
                          <span className="px-2 py-0.5 bg-brand-100 text-brand-700 rounded text-[10px] font-bold">
                            AI
                          </span>
                        )}
                      </div>

                      {item.aiAnswer && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {item.aiAnswer.answer.substring(0, 100)}...
                          </p>
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
                  <button
                    onClick={() => {
                      if (confirm('Clear all search history?')) {
                        setSearchHistory([]);
                        localStorage.removeItem('regosSearchHistory');
                        setShowHistory(false);
                      }
                    }}
                    className="w-full px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200 hover:border-red-300"
                  >
                    Clear All History
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Query Validation Error Modal */}
      {validationError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-xl shadow-2xl max-w-md mx-4 overflow-hidden border border-slate-200"
          >
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Unable to Process Query</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {validationError.score < 20
                      ? 'This query does not appear to be related to clinical research or medical topics.'
                      : validationError.score < 40
                      ? 'This query has low medical relevance. Please refine your search with clinical terms.'
                      : 'Query validation failed. Try adding more specific medical terminology.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Search Requirements</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Hybrid search mode requires queries with medical or clinical research relevance. Include at least one of the following:
                </p>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>Disease or condition names (e.g., diabetes, lung cancer, hypertension)</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>Drug or intervention names (e.g., pembrolizumab, chemotherapy)</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>Trial phases or status (e.g., Phase 3, recruiting)</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setValidationError(null);
                    setQuery('');
                  }}
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
                >
                  Modify Query
                </button>
                <button
                  onClick={() => {
                    setValidationError(null);
                    setSearchMode('keyword');
                  }}
                  className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Switch to Keywords
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      
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
                        {(['hybrid', 'keyword'] as const).map((mode) => (
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
                                {mode === 'hybrid' ? 'Hybrid (AI + Keywords)' : 'Keywords Only'}
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

                  {/* AI Answer Card */}
                  <AnimatePresence>
                    {aiAnswer && !isAnalyzing && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white rounded-xl border border-brand-200 shadow-xl overflow-hidden relative"
                      >
                        {/* Gradient accent bar */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700"></div>

                        <div className="p-6 pt-7">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl shadow-md shrink-0">
                              <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-4">
                                <h3 className="text-xs font-bold text-brand-700 uppercase tracking-widest">AI-Generated Answer</h3>
                                {isGeneratingAnswer && (
                                  <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                                )}
                              </div>
                              <div className="prose prose-slate max-w-none">
                                <p className="text-[15px] text-slate-700 leading-relaxed font-normal tracking-tight">
                                  {aiAnswer.answer}
                                </p>
                              </div>
                              {aiAnswer.citations.length > 0 && (
                                <div className="mt-5 pt-5 border-t border-slate-100">
                                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                                    <div className="p-1 bg-brand-50 rounded">
                                      <Check className="w-3 h-3 text-brand-600" />
                                    </div>
                                    Referenced Trials ({aiAnswer.citations.length})
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {aiAnswer.citations.slice(0, 10).map((nctId, idx) => (
                                      <a
                                        key={idx}
                                        href={`#${nctId}`}
                                        className="group px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition-all shadow-sm hover:shadow-md"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          // Scroll to the cited trial in results
                                          const element = document.querySelector(`[data-nct-id="${nctId}"]`);
                                          if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            // Brief highlight effect
                                            element.classList.add('ring-2', 'ring-brand-400', 'ring-offset-2');
                                            setTimeout(() => {
                                              element.classList.remove('ring-2', 'ring-brand-400', 'ring-offset-2');
                                            }, 2000);
                                          }
                                        }}
                                      >
                                        <span className="group-hover:font-semibold transition-all">{nctId}</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Related Questions */}
                              {relatedQuestions.length > 0 && (
                                <div className="mt-5 pt-5 border-t border-slate-100">
                                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                                    <div className="p-1 bg-brand-50 rounded">
                                      <HelpCircle className="w-3 h-3 text-brand-600" />
                                    </div>
                                    Related Questions
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {relatedQuestions.map((question, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() => {
                                          setQuery(question);
                                          handleSearch(undefined, question);
                                        }}
                                        className="group text-left px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition-all shadow-sm hover:shadow-md flex items-start gap-2"
                                      >
                                        <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 shrink-0 mt-0.5" />
                                        <span className="flex-1 group-hover:font-medium transition-all">{question}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Continue in Chat Button */}
                              {onCreateChat && aiAnswer && aiAnswer.citations.length > 0 && (
                                <div className="mt-5 pt-5 border-t border-slate-100 flex justify-end">
                                  <button
                                    onClick={() => {
                                      // Get cited trials from results
                                      const citedTrials = results.filter(trial =>
                                        aiAnswer.citations.includes(trial.nctId)
                                      );

                                      // Create initial assistant message
                                      const initialMessage: Message = {
                                        id: Date.now().toString() + Math.random(),
                                        role: 'assistant',
                                        content: aiAnswer.answer,
                                        timestamp: Date.now(),
                                        citations: aiAnswer.citations
                                      };

                                      // Create chat session
                                      const chatSession: ChatSession = {
                                        id: Date.now().toString() + Math.random(),
                                        title: query.substring(0, 60),
                                        messages: [initialMessage],
                                        contextTrials: citedTrials,
                                        createdAt: Date.now(),
                                        updatedAt: Date.now()
                                      };

                                      if (onCreateChat) {
                                        onCreateChat(chatSession);
                                      }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md hover:shadow-lg font-semibold text-sm"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                    Continue in Chat
                                    <span className="px-2 py-0.5 bg-white/20 rounded text-xs">
                                      {aiAnswer.citations.length} trial{aiAnswer.citations.length === 1 ? '' : 's'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
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
                            data-nct-id={trial.nctId}
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
