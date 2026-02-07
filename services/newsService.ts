import type { RegulatoryNewsItem, NewsFilter, NewsResponse } from '@/types';
import { MOCK_NEWS } from '@/constants';
import { generatePharmaNewsOverview } from './geminiService';

const API_BASE_URL = 'http://localhost:3002/api';
const CACHE_KEY = 'regosNewsFeed';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CachedNews {
  data: RegulatoryNewsItem[];
  timestamp: number;
}

/**
 * Fetch regulatory news from the backend API with caching
 * Mock data is ONLY used as a fallback when API is unavailable
 */
export async function fetchRegulatoryNews(
  filters?: Partial<NewsFilter>
): Promise<RegulatoryNewsItem[]> {
  try {
    // Check cache first
    const cached = getCache();
    if (cached && !isCacheExpired(cached.timestamp)) {
      console.log('📦 Using cached news data');
      return applyFiltersLocally(cached.data, filters);
    }

    // Build query parameters
    const params = new URLSearchParams();

    if (filters?.companies && filters.companies.size > 0) {
      params.append('company', Array.from(filters.companies).join(','));
    }

    if (filters?.categories && filters.categories.size > 0) {
      params.append('category', Array.from(filters.categories).join(','));
    }

    if (filters?.dateRange?.from) {
      params.append('from', filters.dateRange.from);
    }

    if (filters?.dateRange?.to) {
      params.append('to', filters.dateRange.to);
    }

    // Fetch from API
    console.log('🌐 Fetching news from API...');
    const response = await fetch(`${API_BASE_URL}/news?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: NewsResponse = await response.json();
    const newsItems = data.items || [];

    // Update cache with real data
    setCache(newsItems);

    console.log(`✓ Fetched ${newsItems.length} REAL news items from API`);
    return newsItems;
  } catch (error) {
    console.error('❌ Error fetching news from API:', error);

    // Return cached data if available
    const cached = getCache();
    if (cached) {
      console.log('📦 Using cached data as fallback');
      return applyFiltersLocally(cached.data, filters);
    }

    // ONLY use mock data if API is completely unavailable AND no cache
    console.warn('⚠️  API unavailable and no cache - using mock data as last resort');
    return applyFiltersLocally(MOCK_NEWS, filters);
  }
}

/**
 * Manually trigger news refresh from sources
 */
export async function refreshNews(): Promise<boolean> {
  try {
    console.log('🔄 Triggering manual news refresh...');

    const response = await fetch(`${API_BASE_URL}/news/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✓ News refreshed: ${result.count} items`);

    // Clear cache to force refetch
    clearCache();

    return true;
  } catch (error) {
    console.error('❌ Error refreshing news:', error);
    return false;
  }
}

/**
 * Get news aggregations (count by company, category)
 */
export async function getNewsAggregations() {
  try {
    const response = await fetch(`${API_BASE_URL}/news/aggregations`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Error fetching aggregations:', error);
    return null;
  }
}

// ============================================================
// LOCAL CACHE MANAGEMENT
// ============================================================

function getCache(): CachedNews | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    return parsed;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
}

function setCache(data: RegulatoryNewsItem[]): void {
  try {
    const cacheData: CachedNews = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log('💾 News cached locally');
  } catch (error) {
    console.error('Error setting cache:', error);
  }
}

function clearCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️  Cache cleared');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

function isCacheExpired(timestamp: number): boolean {
  return Date.now() - timestamp > CACHE_DURATION;
}

// ============================================================
// LOCAL FILTERING (for cached data)
// ============================================================

function applyFiltersLocally(
  news: RegulatoryNewsItem[],
  filters?: Partial<NewsFilter>
): RegulatoryNewsItem[] {
  let filtered = [...news];

  // Filter by company
  if (filters?.companies && filters.companies.size > 0) {
    filtered = filtered.filter(item => filters.companies!.has(item.company));
  }

  // Filter by category
  if (filters?.categories && filters.categories.size > 0) {
    filtered = filtered.filter(item => filters.categories!.has(item.category));
  }

  // Filter by date range
  if (filters?.dateRange?.from) {
    const fromDate = new Date(filters.dateRange.from);
    filtered = filtered.filter(item => new Date(item.publishedDate) >= fromDate);
  }

  if (filters?.dateRange?.to) {
    const toDate = new Date(filters.dateRange.to);
    filtered = filtered.filter(item => new Date(item.publishedDate) <= toDate);
  }

  // Filter by search query
  if (filters?.searchQuery && filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(
      item =>
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  // Sort by date (newest first)
  filtered.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());

  return filtered;
}

// ============================================================
// AI OVERVIEW
// ============================================================

export interface AIOverview {
  summary: string;
  highlights: string[];
}

/**
 * Generate AI overview for pharmaceutical news using Gemini
 */
export async function fetchPharmaAIOverview(newsItems: RegulatoryNewsItem[]): Promise<AIOverview | null> {
  try {
    console.log('🤖 Generating AI overview from scraped news...');

    if (!newsItems || newsItems.length === 0) {
      console.log('⚠️ No news items available');
      return null;
    }

    // Use Gemini to generate overview from our scraped news
    const overview = await generatePharmaNewsOverview(newsItems);

    if (!overview) {
      console.log('⚠️ Could not generate AI overview');
      return null;
    }

    console.log('✨ AI overview generated successfully');
    return overview;
  } catch (error) {
    console.error('❌ Error generating AI overview:', error);
    return null;
  }
}
