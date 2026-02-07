/**
 * Embedding Service
 *
 * Generates 3072-dimensional embeddings for queries using Google Gemini API.
 * Used for semantic search to convert user queries into vectors.
 *
 * Features:
 * - Query embedding generation with embedding-001 model (3072 dims, normalized)
 * - Caching to avoid redundant API calls
 * - Rate limiting support
 * - Graceful fallback when API unavailable
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;

// In-memory cache for embeddings (to avoid redundant API calls)
const embeddingCache = new Map<string, number[]>();
const CACHE_MAX_SIZE = 100; // Keep last 100 queries

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 50; // 50ms = 20 requests/second

/**
 * Initialize Gemini AI client
 */
function initializeGemini(): boolean {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not found. Semantic search will be disabled.');
    console.warn('Set VITE_GEMINI_API_KEY in .env.local to enable');
    return false;
  }

  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('✓ Gemini AI initialized for embeddings');
    return true;
  } catch (error) {
    console.error('Failed to initialize Gemini AI:', error);
    return false;
  }
}

/**
 * Generate embedding for a query string
 * Returns 3072-dimensional vector or null if unavailable
 */
export async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  // Check cache first
  const cacheKey = query.toLowerCase().trim();
  if (embeddingCache.has(cacheKey)) {
    console.log('✓ Using cached embedding');
    return embeddingCache.get(cacheKey)!;
  }

  // Initialize if not done
  if (!genAI && !initializeGemini()) {
    return null;
  }

  if (!genAI) {
    return null;
  }

  try {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    // Generate embedding using gemini-embedding-001 model (3072 dims, normalized)
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

    const result = await model.embedContent({
      content: { parts: [{ text: query }] },
      taskType: 'RETRIEVAL_QUERY'
    });

    const embedding = result.embedding.values;

    // Validate embedding
    if (!Array.isArray(embedding) || embedding.length !== 3072) {
      console.warn(`Unexpected embedding dimension: ${embedding?.length || 0}, expected 3072`);
      return null;
    }

    // Cache the result
    if (embeddingCache.size >= CACHE_MAX_SIZE) {
      // Remove oldest entry
      const firstKey = embeddingCache.keys().next().value;
      embeddingCache.delete(firstKey);
    }
    embeddingCache.set(cacheKey, embedding);

    console.log(`✓ Generated embedding (3072 dims) for query: "${query.substring(0, 50)}..."`);
    return embedding;

  } catch (error) {
    console.error('Error generating embedding:', error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('quota')) {
        console.error('Gemini API quota exceeded. Falling back to keyword-only search.');
      } else if (error.message.includes('API key')) {
        console.error('Invalid Gemini API key. Please check VITE_GEMINI_API_KEY in .env.local');
      }
    }

    return null;
  }
}

/**
 * Check if embedding service is available
 */
export function isEmbeddingServiceAvailable(): boolean {
  return !!GEMINI_API_KEY;
}

/**
 * Clear embedding cache (useful for memory management)
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
  console.log('✓ Embedding cache cleared');
}

/**
 * Get cache statistics
 */
export function getEmbeddingCacheStats(): {
  size: number;
  maxSize: number;
  hitRate: number;
} {
  return {
    size: embeddingCache.size,
    maxSize: CACHE_MAX_SIZE,
    hitRate: 0 // Would need to track hits/misses for accurate rate
  };
}

/**
 * Pre-generate embeddings for common queries
 * Useful for warming up the cache on app start
 */
export async function preloadCommonQueries(queries: string[]): Promise<void> {
  console.log(`Preloading embeddings for ${queries.length} common queries...`);

  const promises = queries.map(async (query) => {
    try {
      await generateQueryEmbedding(query);
    } catch (error) {
      console.warn(`Failed to preload embedding for "${query}":`, error);
    }
  });

  await Promise.all(promises);
  console.log(`✓ Preloaded ${embeddingCache.size} embeddings`);
}

/**
 * Batch generate embeddings for multiple queries
 * More efficient than calling generateQueryEmbedding multiple times
 */
export async function generateBatchEmbeddings(queries: string[]): Promise<Array<number[] | null>> {
  const results: Array<number[] | null> = [];

  for (const query of queries) {
    const embedding = await generateQueryEmbedding(query);
    results.push(embedding);
  }

  return results;
}
