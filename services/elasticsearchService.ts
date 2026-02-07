/**
 * Elasticsearch Service
 *
 * Provides connection and query utilities for Elasticsearch Cloud via API proxy.
 * Handles:
 * - API proxy communication (server/api.js)
 * - Query building
 * - Error handling with graceful fallbacks
 * - Aggregations for filters
 * - Auto-complete suggestions
 *
 * Configuration:
 * The API server (server/api.js) must be running on http://localhost:3001
 * API server reads ES_CLOUD_ID and ES_API_KEY from .env.local
 */

const INDEX_NAME = 'clinical_trials';
const API_BASE_URL = 'http://localhost:3002/api';

// Track availability - default to true since API server handles connection
let isElasticsearchAvailable = true;

/**
 * Helper function for API requests
 */
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API request error (${endpoint}):`, error);
    throw error;
  }
}

/**
 * Check if Elasticsearch is available
 */
export function isElasticsearchEnabled(): boolean {
  return isElasticsearchAvailable;
}

/**
 * Test connection to Elasticsearch via API proxy
 */
export async function testConnection(): Promise<boolean> {
  try {
    const response = await apiRequest('/health');
    console.log('✓ Elasticsearch connection successful');
    isElasticsearchAvailable = response.status === 'ok';
    return isElasticsearchAvailable;
  } catch (error) {
    console.error('Elasticsearch connection failed:', error);
    isElasticsearchAvailable = false;
    return false;
  }
}

/**
 * Search trials with full query via API proxy
 */
export async function searchTrials(query: any): Promise<any | null> {
  try {
    const response = await apiRequest('/search', {
      method: 'POST',
      body: JSON.stringify({
        index: INDEX_NAME,
        body: query
      })
    });
    return response;
  } catch (error) {
    console.error('Elasticsearch search error:', error);
    return null;
  }
}

/**
 * Get aggregations for filters (phase, status, sponsors) via API proxy
 */
export async function getFilterAggregations(): Promise<{
  phases: Array<{ key: string; count: number }>;
  statuses: Array<{ key: string; count: number }>;
  sponsors: Array<{ key: string; count: number }>;
} | null> {
  try {
    const response = await apiRequest('/aggregations', {
      method: 'POST',
      body: JSON.stringify({
        index: INDEX_NAME,
        body: {
          aggs: {
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
            }
          }
        }
      })
    });

    return {
      phases: response?.phases?.buckets?.map((b: any) => ({
        key: b.key,
        count: b.doc_count
      })) || [],
      statuses: response?.statuses?.buckets?.map((b: any) => ({
        key: b.key,
        count: b.doc_count
      })) || [],
      sponsors: response?.sponsors?.buckets?.map((b: any) => ({
        key: b.key,
        count: b.doc_count
      })) || []
    };
  } catch (error) {
    console.error('Error fetching aggregations:', error);
    return null;
  }
}

/**
 * Get auto-complete suggestions via API proxy
 */
export async function getAutocompleteSuggestions(prefix: string): Promise<string[]> {
  if (prefix.length < 2) return [];

  try {
    const response = await apiRequest('/search', {
      method: 'POST',
      body: JSON.stringify({
        index: INDEX_NAME,
        body: {
          suggest: {
            title_suggest: {
              prefix: prefix,
              completion: {
                field: 'brief_title.keyword',
                size: 5,
                skip_duplicates: true
              }
            }
          }
        }
      })
    });

    const suggestions = response.suggest?.title_suggest[0].options || [];
    return suggestions.map((s: any) => s.text);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return [];
  }
}

/**
 * Get trial by NCT ID via API proxy
 */
export async function getTrialById(nctId: string): Promise<any | null> {
  try {
    const response = await apiRequest(`/document/${nctId}?index=${INDEX_NAME}`);
    return response._source;
  } catch (error) {
    console.error(`Error fetching trial ${nctId}:`, error);
    return null;
  }
}

/**
 * Get similar trials using More Like This query via API proxy
 */
export async function getSimilarTrials(nctId: string, limit: number = 5): Promise<any[]> {
  try {
    const response = await apiRequest('/search', {
      method: 'POST',
      body: JSON.stringify({
        index: INDEX_NAME,
        body: {
          query: {
            more_like_this: {
              fields: ['brief_title', 'brief_summaries_description', 'conditions', 'interventions'],
              like: [
                {
                  _index: INDEX_NAME,
                  _id: nctId
                }
              ],
              min_term_freq: 1,
              min_doc_freq: 1,
              max_query_terms: 25
            }
          },
          size: limit
        }
      })
    });

    return response.hits.hits.map((hit: any) => ({
      ...hit._source,
      _score: hit._score
    }));
  } catch (error) {
    console.error('Error fetching similar trials:', error);
    return [];
  }
}

/**
 * Get total trial count via API proxy
 */
export async function getTotalTrialCount(): Promise<number> {
  try {
    const response = await apiRequest('/count', {
      method: 'POST',
      body: JSON.stringify({
        index: INDEX_NAME,
        body: {}
      })
    });
    return response.count || 0;
  } catch (error) {
    console.error('Error getting trial count:', error);
    return 0;
  }
}

/**
 * Bulk search multiple trials by IDs via API proxy
 */
export async function getTrialsByIds(nctIds: string[]): Promise<any[]> {
  if (nctIds.length === 0) return [];

  try {
    // API proxy doesn't have mget endpoint, so we'll use search with terms query
    const response = await apiRequest('/search', {
      method: 'POST',
      body: JSON.stringify({
        index: INDEX_NAME,
        body: {
          query: {
            terms: {
              nct_id: nctIds
            }
          },
          size: nctIds.length
        }
      })
    });

    return response.hits.hits.map((hit: any) => hit._source);
  } catch (error) {
    console.error('Error fetching multiple trials:', error);
    return [];
  }
}

/**
 * Get statistics about the index via API proxy
 */
export async function getIndexStats(): Promise<{
  totalTrials: number;
  phaseDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  averageEnrollment: number;
} | null> {
  try {
    const response = await apiRequest('/aggregations', {
      method: 'POST',
      body: JSON.stringify({
        index: INDEX_NAME,
        body: {
          aggs: {
            total: {
              value_count: {
                field: 'nct_id'
              }
            },
            phases: {
              terms: {
                field: 'phase',
                size: 10
              }
            },
            statuses: {
              terms: {
                field: 'overall_status',
                size: 10
              }
            },
            avg_enrollment: {
              avg: {
                field: 'enrollment'
              }
            }
          }
        }
      })
    });

    return {
      totalTrials: response?.total?.value || 0,
      phaseDistribution: Object.fromEntries(
        response?.phases?.buckets?.map((b: any) => [b.key, b.doc_count]) || []
      ),
      statusDistribution: Object.fromEntries(
        response?.statuses?.buckets?.map((b: any) => [b.key, b.doc_count]) || []
      ),
      averageEnrollment: Math.round(response?.avg_enrollment?.value || 0)
    };
  } catch (error) {
    console.error('Error fetching index stats:', error);
    return null;
  }
}

/**
 * Search trials with geographic filtering via API proxy
 */
export async function searchTrialsByLocation(
  query: string,
  latitude: number,
  longitude: number,
  radiusKm: number = 50
): Promise<any[]> {
  try {
    const response = await apiRequest('/search', {
      method: 'POST',
      body: JSON.stringify({
        index: INDEX_NAME,
        body: {
          query: {
            bool: {
              must: query ? {
                multi_match: {
                  query,
                  fields: ['brief_title^2', 'brief_summaries_description', 'conditions', 'interventions']
                }
              } : { match_all: {} },
              filter: {
                geo_distance: {
                  distance: `${radiusKm}km`,
                  'facilities.location': {
                    lat: latitude,
                    lon: longitude
                  }
                }
              }
            }
          },
          size: 50,
          sort: [
            {
              _geo_distance: {
                'facilities.location': {
                  lat: latitude,
                  lon: longitude
                },
                order: 'asc',
                unit: 'km'
              }
            }
          ]
        }
      })
    });

    return response.hits.hits.map((hit: any) => ({
      ...hit._source,
      _score: hit._score,
      _distance: hit.sort?.[0]
    }));
  } catch (error) {
    console.error('Error searching by location:', error);
    return [];
  }
}

// Export constants
export { INDEX_NAME };
