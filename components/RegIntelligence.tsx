import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, Loader2, Newspaper, X, Sparkles, ExternalLink } from 'lucide-react';
import type { RegulatoryNewsItem, NewsCompany, NewsCategory } from '@/types';
import { fetchRegulatoryNews, refreshNews, fetchPharmaAIOverview, type AIOverview } from '@/services/newsService';
import { NewsCard } from './NewsCard';

const COMPANIES: NewsCompany[] = ['Pfizer', 'Johnson & Johnson', 'Merck', 'AbbVie', 'AstraZeneca'];
const CATEGORIES: NewsCategory[] = [
  'FDA Approval',
  'Clinical Trial',
  'Partnership',
  'Financial',
  'R&D',
  'Policy Update',
  'Safety Alert',
  'General News'
];

export const RegIntelligence: React.FC = () => {
  const [news, setNews] = useState<RegulatoryNewsItem[]>([]);
  const [filteredNews, setFilteredNews] = useState<RegulatoryNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState<Set<NewsCompany>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<NewsCategory>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [aiOverview, setAiOverview] = useState<AIOverview | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Load news on mount
  useEffect(() => {
    loadNews();
  }, []);

  // Load AI overview when news is loaded
  useEffect(() => {
    if (news.length > 0) {
      loadAIOverview(news);
    }
  }, [news]);

  // Apply filters when news or filters change
  useEffect(() => {
    applyFilters();
  }, [news, searchQuery, selectedCompanies, selectedCategories]);

  const loadNews = async () => {
    setLoading(true);
    try {
      const data = await fetchRegulatoryNews();
      setNews(data);
    } catch (error) {
      console.error('Error loading news:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAIOverview = async (newsData: RegulatoryNewsItem[]) => {
    setLoadingAI(true);
    try {
      const overview = await fetchPharmaAIOverview(newsData);
      setAiOverview(overview);
    } catch (error) {
      console.error('Error loading AI overview:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMessage('🔄 Fetching latest news from pharma companies...');

    try {
      const success = await refreshNews();
      if (success) {
        setRefreshMessage('✓ Successfully fetched latest news! Loading...');
        await loadNews();
        setRefreshMessage('✓ News updated! Showing latest articles.');
        setTimeout(() => setRefreshMessage(''), 3000);
      } else {
        setRefreshMessage('⚠️ Unable to fetch latest news. Showing cached results.');
        setTimeout(() => setRefreshMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error refreshing news:', error);
      setRefreshMessage('❌ Error refreshing news');
      setTimeout(() => setRefreshMessage(''), 3000);
    } finally {
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...news];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        item =>
          item.title.toLowerCase().includes(query) ||
          item.summary.toLowerCase().includes(query) ||
          item.tags.some(tag => tag.toLowerCase().includes(query)) ||
          item.company.toLowerCase().includes(query)
      );
    }

    // Company filter
    if (selectedCompanies.size > 0) {
      filtered = filtered.filter(item => selectedCompanies.has(item.company));
    }

    // Category filter
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(item => selectedCategories.has(item.category));
    }

    setFilteredNews(filtered);
  };

  const toggleCompany = (company: NewsCompany) => {
    const newSelected = new Set(selectedCompanies);
    if (newSelected.has(company)) {
      newSelected.delete(company);
    } else {
      newSelected.add(company);
    }
    setSelectedCompanies(newSelected);
  };

  const toggleCategory = (category: NewsCategory) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    setSelectedCategories(newSelected);
  };

  const clearFilters = () => {
    setSelectedCompanies(new Set());
    setSelectedCategories(new Set());
    setSearchQuery('');
  };

  const activeFilterCount = selectedCompanies.size + selectedCategories.size + (searchQuery ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-50 fixed inset-0 overflow-y-auto pt-14">
      {/* Simple Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Regulatory Intelligence</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium text-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* Status Message */}
        {refreshMessage && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            {refreshMessage}
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search news articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium"
          >
            <Filter className="w-4 h-4" />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>

          {showFilters && (
            <div className="mt-4 p-6 bg-white border border-slate-200 rounded-lg space-y-4">
              {activeFilterCount > 0 && (
                <div className="flex justify-end">
                  <button onClick={clearFilters} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                    Clear all filters
                  </button>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Companies</h3>
                <div className="flex flex-wrap gap-2">
                  {COMPANIES.map(company => (
                    <button
                      key={company}
                      onClick={() => toggleCompany(company)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        selectedCompanies.has(company)
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {company}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(category => (
                    <button
                      key={category}
                      onClick={() => toggleCategory(category)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        selectedCategories.has(category)
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Overview Card */}
        {loadingAI && (
          <div className="mb-6 p-6 bg-gradient-to-br from-teal-50 to-cyan-50 border-2 border-brand-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-bold text-slate-900">AI Intelligence Summary</h3>
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
              <p className="text-sm text-slate-600">Analyzing pharmaceutical news...</p>
            </div>
          </div>
        )}

        {!loadingAI && aiOverview && aiOverview.summary && (
          <div className="mb-6 p-6 bg-gradient-to-br from-teal-50 to-cyan-50 border-2 border-brand-200 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-bold text-slate-900">AI Intelligence Summary</h3>
            </div>
            <p className="text-slate-700 leading-relaxed mb-4">
              {aiOverview.summary}
            </p>
            {aiOverview.highlights && aiOverview.highlights.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Key Highlights:</p>
                <ul className="list-disc list-inside space-y-1.5">
                  {aiOverview.highlights.map((highlight, idx) => (
                    <li key={idx} className="text-sm text-slate-700 leading-relaxed">
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Feed */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border border-slate-200">
            <Newspaper className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No articles found</h3>
            <p className="text-slate-600">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNews.map((item, index) => (
              <NewsCard key={`${item.id}-${index}`} news={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
