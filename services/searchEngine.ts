/**
 * Search Engine with RRF Hybrid Search
 *
 * Implements Elasticsearch Reciprocal Rank Fusion (RRF) combining:
 * - BM25 lexical search (keyword matching)
 * - kNN vector search (semantic similarity using Gemini embeddings)
 * - Function score boosting for relevance
 *
 * Based on 2025 best practices from Elasticsearch research
 *
 * Features:
 * - Hybrid search mode (RRF with BM25 + kNN)
 * - Pure keyword mode (BM25 only)
 * - Pure semantic mode (kNN only)
 * - Sophisticated function_score ranking
 * - Real-time aggregations for filters
 */

import { searchTrials, isElasticsearchEnabled } from './elasticsearchService';
import { QueryAnalysis } from '../types';
import type { SearchResponse } from '@elastic/elasticsearch/lib/api/types';
import { MIN_KNN_SIMILARITY } from '../constants';

export type SearchMode = 'hybrid' | 'semantic' | 'keyword';

export interface SearchOptions {
  query: string;
  mode?: SearchMode;
  queryAnalysis?: QueryAnalysis | null;
  queryEmbedding?: number[];  // 3072-dim vector from Gemini
  filters?: {
    phases?: string[];
    statuses?: string[];
    sponsors?: string[];
    minEnrollment?: number;
    maxEnrollment?: number;
    startDateFrom?: string;
    startDateTo?: string;
  };
  page?: number;
  pageSize?: number;
  includeAggregations?: boolean;
}

export interface SearchResult {
  trials: any[];
  total: number;
  took: number;
  aggregations?: {
    phases: Array<{ key: string; count: number }>;
    statuses: Array<{ key: string; count: number }>;
    sponsors: Array<{ key: string; count: number }>;
  };
  queryExplanation?: string;
}

/**
 * Build keyword query (BM25 multi-match across important fields)
 */
function buildKeywordQuery(query: string, queryAnalysis?: QueryAnalysis | null) {
  if (!query) {
    return { match_all: {} };
  }

  // Determine which fields to search based on query analysis
  const fields = [];

  // Always search core fields
  fields.push('brief_title^3');  // Title is most important
  fields.push('official_title^2');
  fields.push('brief_summaries_description^1.5');

  // Add specific field boosts based on query analysis
  if (queryAnalysis?.condition) {
    fields.push('conditions.name^2');
  }

  if (queryAnalysis?.intervention) {
    fields.push('interventions.name^2');
  }

  if (queryAnalysis?.keywords && queryAnalysis.keywords.length > 0) {
    fields.push('keywords^1.5');
  }

  fields.push('detailed_description');

  return {
    multi_match: {
      query,
      fields,
      type: 'best_fields',
      tie_breaker: 0.3,
      fuzziness: 'AUTO'
    }
  };
}

/**
 * Build kNN query for semantic vector search
 * @param minScore - Minimum cosine similarity threshold (0-1). Results below this are filtered.
 */
function buildKnnQuery(queryEmbedding: number[], k: number = 50, filters?: any, minScore?: number) {
  return {
    field: 'description_embedding',
    query_vector: queryEmbedding,
    k: k,
    num_candidates: k * 2,  // 2x for better recall
    ...(minScore && { similarity: minScore }),  // Filter low-similarity results
    ...(filters && { filter: filters })
  };
}

/**
 * Build filter query from QueryAnalysis and explicit filters
 */
function buildFilterQuery(
  queryAnalysis?: QueryAnalysis | null,
  filters?: SearchOptions['filters']
) {
  const must: any[] = [];
  const should: any[] = [];
  const filter: any[] = [];

  // Explicit filters (must match)
  if (filters?.phases && filters.phases.length > 0) {
    filter.push({
      terms: { phase: filters.phases }
    });
  }

  if (filters?.statuses && filters.statuses.length > 0) {
    filter.push({
      terms: { overall_status: filters.statuses }
    });
  }

  if (filters?.sponsors && filters.sponsors.length > 0) {
    filter.push({
      terms: { source: filters.sponsors }
    });
  }

  if (filters?.minEnrollment !== undefined || filters?.maxEnrollment !== undefined) {
    const range: any = {};
    if (filters.minEnrollment !== undefined) range.gte = filters.minEnrollment;
    if (filters.maxEnrollment !== undefined) range.lte = filters.maxEnrollment;
    filter.push({ range: { enrollment: range } });
  }

  if (filters?.startDateFrom || filters?.startDateTo) {
    const range: any = {};
    if (filters.startDateFrom) range.gte = filters.startDateFrom;
    if (filters.startDateTo) range.lte = filters.startDateTo;
    filter.push({ range: { start_date: range } });
  }

  // QueryAnalysis filters (should match - boost)
  if (queryAnalysis?.phase) {
    should.push({
      term: {
        phase: {
          value: queryAnalysis.phase,
          boost: 2.0
        }
      }
    });
  }

  if (queryAnalysis?.status) {
    should.push({
      term: {
        overall_status: {
          value: queryAnalysis.status,
          boost: 1.5
        }
      }
    });
  }

  if (queryAnalysis?.sponsor) {
    should.push({
      match: {
        source: {
          query: queryAnalysis.sponsor,
          boost: 1.5
        }
      }
    });
  }

  if (queryAnalysis?.location) {
    should.push({
      nested: {
        path: 'facilities',
        query: {
          multi_match: {
            query: queryAnalysis.location,
            fields: ['facilities.city', 'facilities.state', 'facilities.country'],
            boost: 1.3
          }
        }
      }
    });
  }

  if (queryAnalysis?.condition) {
    should.push({
      nested: {
        path: 'conditions',
        query: {
          match: {
            'conditions.name': {
              query: queryAnalysis.condition,
              boost: 2.0
            }
          }
        }
      }
    });
  }

  if (queryAnalysis?.intervention) {
    should.push({
      nested: {
        path: 'interventions',
        query: {
          match: {
            'interventions.name': {
              query: queryAnalysis.intervention,
              boost: 1.8
            }
          }
        }
      }
    });
  }

  return { must, should, filter };
}

/**
 * Build function_score query with sophisticated ranking
 */
function buildFunctionScoreQuery(baseQuery: any, queryAnalysis?: QueryAnalysis | null) {
  const functions = [];

  // Boost recruiting trials (1.5x)
  functions.push({
    filter: { term: { overall_status: 'RECRUITING' } },
    weight: 1.5
  });

  // Boost recently started trials (1.3x for last year)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  functions.push({
    filter: {
      range: {
        start_date: { gte: oneYearAgo.toISOString() }
      }
    },
    weight: 1.3
  });

  // Boost large enrollment trials (1.2x for > 500)
  functions.push({
    filter: {
      range: { enrollment: { gte: 500 } }
    },
    weight: 1.2
  });

  // Boost industry sponsors (1.2x)
  functions.push({
    filter: {
      nested: {
        path: 'sponsors',
        query: {
          term: { 'sponsors.agency_class': 'INDUSTRY' }
        }
      }
    },
    weight: 1.2
  });

  // Boost by quality score (field value factor)
  functions.push({
    field_value_factor: {
      field: 'quality_score',
      factor: 0.01,
      modifier: 'ln1p',
      missing: 50
    }
  });

  // Boost Phase 3 trials if no specific phase requested
  if (!queryAnalysis?.phase) {
    functions.push({
      filter: { term: { phase: 'PHASE3' } },
      weight: 1.1
    });
  }

  return {
    function_score: {
      query: baseQuery,
      functions,
      score_mode: 'multiply',
      boost_mode: 'multiply',
      max_boost: 3.0
    }
  };
}

/**
 * Build aggregations for filters
 */
function buildAggregations() {
  return {
    phases: {
      terms: {
        field: 'phase',
        size: 10,
        order: { _key: 'asc' }
      }
    },
    statuses: {
      terms: {
        field: 'overall_status',
        size: 10
      }
    },
    sponsors: {
      terms: {
        field: 'source',
        size: 50,
        order: { _count: 'desc' }
      }
    },
    enrollment_stats: {
      stats: {
        field: 'enrollment'
      }
    }
  };
}

/**
 * Build RRF hybrid search query (Elasticsearch 8.14+)
 * Combines BM25 lexical search with kNN vector search using Reciprocal Rank Fusion
 */
function buildRRFQuery(
  query: string,
  queryEmbedding: number[],
  queryAnalysis?: QueryAnalysis | null,
  filters?: SearchOptions['filters']
) {
  const { must, should, filter } = buildFilterQuery(queryAnalysis, filters);

  // Build base bool query for BM25
  const keywordQuery = buildKeywordQuery(query, queryAnalysis);
  const boolQuery = {
    bool: {
      must: [keywordQuery, ...must],
      should,
      filter,
      minimum_should_match: should.length > 0 ? 1 : 0
    }
  };

  // Apply function_score boosting
  const scoredBoolQuery = buildFunctionScoreQuery(boolQuery, queryAnalysis);

  // Build kNN retriever with similarity threshold
  const knnRetriever = {
    knn: buildKnnQuery(
      queryEmbedding,
      50,
      filter.length > 0 ? { bool: { filter } } : undefined,
      MIN_KNN_SIMILARITY  // Apply 0.55 threshold to filter low-quality matches
    )
  };

  // Build standard (BM25) retriever
  const standardRetriever = {
    standard: {
      query: scoredBoolQuery
    }
  };

  // RRF retriever combining both
  return {
    retriever: {
      rrf: {
        retrievers: [standardRetriever, knnRetriever],
        rank_constant: 60,
        rank_window_size: 100
      }
    }
  };
}

/**
 * Build fallback query for ES versions < 8.14 (no RRF support)
 * Uses manual score combination
 */
function buildFallbackHybridQuery(
  query: string,
  queryEmbedding: number[],
  queryAnalysis?: QueryAnalysis | null,
  filters?: SearchOptions['filters']
) {
  const { must, should, filter } = buildFilterQuery(queryAnalysis, filters);

  // BM25 component
  const keywordQuery = buildKeywordQuery(query, queryAnalysis);
  const boolQuery = {
    bool: {
      must: [keywordQuery, ...must],
      should,
      filter,
      minimum_should_match: should.length > 0 ? 1 : 0
    }
  };

  // Add script_score for kNN similarity
  const hybridQuery = {
    script_score: {
      query: boolQuery,
      script: {
        source: `
          double bm25Score = _score;
          double vectorScore = cosineSimilarity(params.query_vector, 'description_embedding') + 1.0;
          return (bm25Score * 0.5) + (vectorScore * 0.5);
        `,
        params: {
          query_vector: queryEmbedding
        }
      }
    }
  };

  return {
    query: buildFunctionScoreQuery(hybridQuery, queryAnalysis)
  };
}

/**
 * Main search function
 */
export async function executeSearch(options: SearchOptions): Promise<SearchResult> {
  const {
    query,
    mode = 'hybrid',
    queryAnalysis,
    queryEmbedding,
    filters,
    page = 1,
    pageSize = 25,
    includeAggregations = true
  } = options;

  // If Elasticsearch is not available, return empty results
  // (The component will fall back to mock data)
  if (!isElasticsearchEnabled()) {
    console.warn('Elasticsearch not available');
    return {
      trials: [],
      total: 0,
      took: 0
    };
  }

  try {
    let searchBody: any;

    // Build query based on mode
    if (mode === 'hybrid' && queryEmbedding && queryEmbedding.length === 3072) {
      // Try RRF first (requires ES 8.14+)
      try {
        searchBody = buildRRFQuery(query, queryEmbedding, queryAnalysis, filters);
        searchBody.size = pageSize;
        searchBody.from = (page - 1) * pageSize;
      } catch (error) {
        // Fall back to manual hybrid if RRF not supported
        console.warn('RRF not supported, using fallback hybrid query');
        searchBody = buildFallbackHybridQuery(query, queryEmbedding, queryAnalysis, filters);
        searchBody.from = (page - 1) * pageSize;
        searchBody.size = pageSize;
      }
    } else if (mode === 'semantic' && queryEmbedding && queryEmbedding.length === 3072) {
      // Pure semantic search (kNN only) - DEPRECATED: prefer hybrid mode
      // Applied similarity threshold to filter irrelevant results
      const { filter } = buildFilterQuery(queryAnalysis, filters);
      searchBody = {
        knn: buildKnnQuery(
          queryEmbedding,
          pageSize * 2,
          filter.length > 0 ? { bool: { filter } } : undefined,
          MIN_KNN_SIMILARITY  // Apply threshold
        ),
        from: (page - 1) * pageSize,
        size: pageSize
      };
    } else {
      // Pure keyword search (BM25 only)
      const { must, should, filter } = buildFilterQuery(queryAnalysis, filters);
      const keywordQuery = buildKeywordQuery(query, queryAnalysis);
      const boolQuery = {
        bool: {
          must: [keywordQuery, ...must],
          should,
          filter,
          minimum_should_match: should.length > 0 ? 1 : 0
        }
      };

      searchBody = {
        query: buildFunctionScoreQuery(boolQuery, queryAnalysis),
        from: (page - 1) * pageSize,
        size: pageSize
      };
    }

    // Add common parameters
    searchBody.track_total_hits = true;
    searchBody._source = {
      excludes: ['description_embedding']  // Don't return embeddings (large)
    };

    // Add aggregations if requested
    if (includeAggregations) {
      searchBody.aggs = buildAggregations();
    }

    // Execute search
    const response = await searchTrials(searchBody);

    if (!response) {
      throw new Error('Search failed');
    }

    // Transform results
    const trials = response.hits.hits.map((hit: any) => ({
      ...hit._source,
      _score: hit._score,
      relevanceScore: Math.min(100, Math.round((hit._score / 10) * 100)),
      matchReasons: generateMatchReasons(hit, queryAnalysis)
    }));

    // Extract aggregations
    let aggregations;
    if (response.aggregations) {
      aggregations = {
        phases: response.aggregations.phases.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count
        })),
        statuses: response.aggregations.statuses.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count
        })),
        sponsors: response.aggregations.sponsors.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count
        }))
      };
    }

    // Generate query explanation
    const queryExplanation = generateQueryExplanation(query, queryAnalysis, mode, filters, queryEmbedding !== undefined);

    return {
      trials,
      total: (response.hits.total as any).value || 0,
      took: response.took || 0,
      aggregations,
      queryExplanation
    };
  } catch (error) {
    console.error('Search error:', error);
    return {
      trials: [],
      total: 0,
      took: 0
    };
  }
}

/**
 * Generate match reasons based on hit and query analysis
 */
function generateMatchReasons(hit: any, queryAnalysis?: QueryAnalysis | null): string[] {
  const reasons: string[] = [];

  if (queryAnalysis?.condition) {
    reasons.push('Condition Match');
  }
  if (queryAnalysis?.intervention) {
    reasons.push('Intervention Match');
  }
  if (queryAnalysis?.phase) {
    reasons.push('Phase Match');
  }
  if (queryAnalysis?.status) {
    reasons.push('Status Match');
  }
  if (hit._source?.overall_status === 'RECRUITING') {
    reasons.push('Currently Recruiting');
  }
  if (hit._source?.quality_score && hit._source.quality_score > 80) {
    reasons.push('High Quality');
  }

  return reasons;
}

/**
 * Generate human-readable query explanation
 */
function generateQueryExplanation(
  query: string,
  queryAnalysis?: QueryAnalysis | null,
  mode?: SearchMode,
  filters?: SearchOptions['filters'],
  hasEmbedding?: boolean
): string {
  const parts = [];

  if (mode === 'hybrid') {
    parts.push(hasEmbedding ? 'Hybrid search (BM25 + Vector)' : 'Hybrid search (BM25 only)');
  } else if (mode === 'semantic') {
    parts.push(hasEmbedding ? 'Semantic search (Vector only)' : 'Semantic search (unavailable, using BM25)');
  } else {
    parts.push('Keyword search (BM25)');
  }

  if (query) {
    parts.push(`Query: "${query}"`);
  }

  if (queryAnalysis) {
    const extracted = [];
    if (queryAnalysis.condition) extracted.push(`Condition: ${queryAnalysis.condition}`);
    if (queryAnalysis.intervention) extracted.push(`Intervention: ${queryAnalysis.intervention}`);
    if (queryAnalysis.phase) extracted.push(`Phase: ${queryAnalysis.phase}`);
    if (queryAnalysis.status) extracted.push(`Status: ${queryAnalysis.status}`);
    if (extracted.length > 0) {
      parts.push(`Extracted: ${extracted.join(', ')}`);
    }
  }

  if (filters) {
    if (filters.phases && filters.phases.length > 0) {
      parts.push(`Filtered: ${filters.phases.join(', ')}`);
    }
  }

  return parts.join(' • ');
}

/**
 * Build "More Like This" query for similar trials
 */
export async function findSimilarTrials(
  nctId: string,
  limit: number = 5
): Promise<any[]> {
  if (!isElasticsearchEnabled()) {
    return [];
  }

  const query = {
    query: {
      more_like_this: {
        fields: [
          'brief_title^2',
          'brief_summaries_description',
          'conditions.name',
          'interventions.name'
        ],
        like: [
          {
            _index: 'clinical_trials',
            _id: nctId
          }
        ],
        min_term_freq: 1,
        min_doc_freq: 1,
        max_query_terms: 25,
        minimum_should_match: '30%'
      }
    },
    size: limit,
    _source: {
      excludes: ['description_embedding']
    }
  };

  try {
    const response = await searchTrials(query);
    if (!response) return [];

    return response.hits.hits.map((hit: any) => ({
      ...hit._source,
      similarityScore: Math.min(100, Math.round((hit._score / 5) * 100))
    }));
  } catch (error) {
    console.error('Error finding similar trials:', error);
    return [];
  }
}
