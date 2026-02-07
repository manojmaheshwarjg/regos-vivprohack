
import { GoogleGenAI } from "@google/genai";
import { QueryAnalysis } from '../types';

const getAiClient = () => {
  // Using the specific API key provided
  const apiKey = process.env.API_KEY || 'AIzaSyCabO8_2Y-icW-RutRAvGVMeBrawJyyOY0';
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

// Rich fallback messages to ensure the app feels "alive" even when API quota is hit
const FALLBACK_LOGS: Record<string, string[]> = {
  'Intelligence Agent': [
    "Monitoring FDA guidance updates...",
    "Scanning EMA regulatory news feeds...",
    "Analyzing recent Warning Letters...",
    "Updating internal compliance rules...",
    "Checking ICH guidelines consistency...",
    "Detected new guidance on endpoints..."
  ],
  'Protocol Agent': [
    "Extracting study endpoints...",
    "Verifying inclusion/exclusion criteria...",
    "Cross-referencing FDA precedent...",
    "Drafting Module 2.5.4 summary...",
    "Checking statistical powering assumptions...",
    "Validating schedule of assessments..."
  ],
  'Safety Agent': [
    "Processing AE/SAE datasets...",
    "Classifying events per ICH E2A...",
    "Generating narrative for SAE #102-004...",
    "Analyzing signal detection algorithms...",
    "Compiling Module 2.7.4 tables...",
    "Reconciling safety database with clinical..."
  ],
  'Statistics Agent': [
    "Validating SAS datasets...",
    "Checking p-value calculations...",
    "Verifying sample size justification...",
    "Running sensitivity analysis...",
    "Formatting efficacy tables...",
    "Confirming primary endpoint analysis..."
  ],
  'CMC Agent': [
    "Reviewing stability data trends...",
    "Validating analytical methods (ICH Q2)...",
    "Checking drug substance specifications...",
    "Verifying batch analysis records...",
    "Compiling Module 3 quality sections...",
    "Assessing manufacturing process controls..."
  ],
  'Document Agent': [
    "Assembling eCTD XML backbone...",
    "Validating cross-references...",
    "Checking PDF compliance...",
    "Structuring folder hierarchy...",
    "Generating hyperlinked TOC...",
    "Verifying ICH M8 compliance..."
  ]
};

const getRandomFallback = (agentName: string, context: string) => {
  const specific = FALLBACK_LOGS[agentName];
  if (specific && specific.length > 0) {
    return specific[Math.floor(Math.random() * specific.length)];
  }
  return `Processing ${context} data streams...`;
};

export const generateAgentLog = async (agentName: string, context: string): Promise<string> => {
  const ai = getAiClient();
  
  // Instant fallback if no client
  if (!ai) {
    return getRandomFallback(agentName, context);
  }

  try {
    // Using the Flash model for speed and efficiency as requested
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest', 
      contents: `You are the ${agentName} in a pharmaceutical regulatory AI system called RegOS. 
      Generate a single, short, highly technical log line (max 10 words) that sounds like you are analyzing clinical trial data. 
      Use realistic medical/regulatory terminology (e.g., "ICH E9", "p-values", "SAE reconciliation", "eCTD backbone").
      Do not use quotes.`,
    });
    return response.text || getRandomFallback(agentName, context);
  } catch (e: any) {
    // Catch ALL errors (Quota, Network, 429, 500) and return fallback data seamlessly.
    // This ensures the user experience is never interrupted.
    return getRandomFallback(agentName, context);
  }
};

export const generateDiscrepancyAnalysis = async (severity: string): Promise<{explanation: string, suggestedFix: string}> => {
  const ai = getAiClient();
  
  const fallback = {
    explanation: `Automated analysis for ${severity} discrepancy is currently unavailable due to network limits.`,
    suggestedFix: "Please review the source document and generated text manually."
  };

  if (!ai) return fallback;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `You are TruthLayer, a regulatory verification AI. 
      Explain a simulated ${severity} error found in a clinical submission.
      Return JSON format: { "explanation": "string", "suggestedFix": "string" }.
      Keep it brief and professional.`,
      config: { responseMimeType: 'application/json' }
    });
    
    if (response.text) {
        return JSON.parse(response.text);
    }
    return fallback;
  } catch (e: any) {
    // Return fallback on any error to prevent crash
    return fallback;
  }
};

export const analyzeClinicalQuery = async (query: string): Promise<QueryAnalysis> => {
  const ai = getAiClient();

  const fallback: QueryAnalysis = {
    condition: null,
    phase: null,
    status: null,
    location: null,
    sponsor: null,
    intervention: null,
    ageGroup: null,
    enrollment_size: null,
    keywords: [query]
  };

  if (!ai) return fallback;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `Extract structured information from this clinical trial search query: "${query}".
      
      Return a JSON object with these fields (set to null if not mentioned):
      - condition: medical condition (string or null)
      - phase: trial phase - PHASE1, PHASE2, PHASE3, PHASE4, or null
      - status: recruiting, completed, terminated, or null
      - location: city/state/country or null
      - sponsor: organization name or null
      - intervention: drug/treatment name or null
      - age_group: adults, children, elderly, or null
      - enrollment_size: small (<100), medium (100-500), large (>500), or null
      - keywords: other important terms (array of strings)

      Example: "Phase 3 lung cancer trials" -> { "condition": "lung cancer", "phase": "PHASE3", ... }`,
      config: { responseMimeType: 'application/json' }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return fallback;
  } catch (e) {
    console.error("Gemini Search Analysis Error", e);
    return fallback;
  }
};

// Validation cache to avoid redundant API calls
const validationCache = new Map<string, { isValid: boolean; score: number; reason: string; timestamp: number }>();
const VALIDATION_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

/**
 * Validate if a query is medical/clinical in nature
 * Used to block non-medical queries from semantic search
 *
 * @param query - The search query to validate
 * @returns Object with isValid (boolean), score (0-100), and reason (string)
 */
export const validateMedicalQuery = async (query: string): Promise<{
  isValid: boolean;
  score: number;
  reason: string;
}> => {
  // Check cache first
  const cacheKey = query.toLowerCase().trim();
  const cached = validationCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < VALIDATION_CACHE_TTL) {
    console.log('✓ Using cached validation result');
    return { isValid: cached.isValid, score: cached.score, reason: cached.reason };
  }

  const ai = getAiClient();

  // Fallback for empty/very short queries
  if (!query || query.trim().length < 2) {
    return {
      isValid: false,
      score: 0,
      reason: 'Query is too short'
    };
  }

  // Quick heuristic checks for obvious non-medical queries
  // IMPORTANT: Keep these very conservative to avoid false positives
  const obviouslyInvalid =
    /^\d+$/.test(query.trim()) ||           // Only numbers: "123"
    /^[^a-z0-9\s]+$/.test(query.trim()) ||  // Only special chars: "!!!"
    /^test\d*$/i.test(query.trim());         // Test queries: "test", "test123"

  if (obviouslyInvalid) {
    const result = {
      isValid: false,
      score: 5,
      reason: 'Query appears to be invalid or a test input'
    };
    validationCache.set(cacheKey, { ...result, timestamp: Date.now() });
    return result;
  }

  // Check for extremely short queries (single character or very short)
  if (query.trim().length <= 2) {
    const result = {
      isValid: false,
      score: 10,
      reason: 'Query is too short. Please provide more detail.'
    };
    validationCache.set(cacheKey, { ...result, timestamp: Date.now() });
    return result;
  }

  // If no AI client available, be permissive (allow search)
  if (!ai) {
    return {
      isValid: true,
      score: 50,
      reason: 'AI validation unavailable, allowing query'
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `Analyze this search query for a clinical trials database: "${query}"

Is this query related to medical research, clinical trials, healthcare, drugs, diseases, or treatments?

Provide a JSON response with:
- score: 0-100 (0=completely unrelated to medicine, 100=clearly medical/clinical)
- reason: Brief explanation (max 15 words)
- isValid: true if score >= 40, false otherwise

Examples:
- "manoj" -> {"score": 5, "reason": "Appears to be a person's name, not medical", "isValid": false}
- "diabetes trials" -> {"score": 95, "reason": "Clear medical condition", "isValid": true}
- "blood sugar disease" -> {"score": 85, "reason": "Describes medical condition conceptually", "isValid": true}
- "john smith study" -> {"score": 10, "reason": "Person's name, not medical term", "isValid": false}
- "Phase 3" -> {"score": 90, "reason": "Clinical trial terminology", "isValid": true}

Be strict: only approve queries with clear medical/clinical intent.`,
      config: { responseMimeType: 'application/json' }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      const result = {
        isValid: parsed.isValid === true || parsed.score >= 40,
        score: parsed.score || 0,
        reason: parsed.reason || 'No reason provided'
      };

      // Cache result
      validationCache.set(cacheKey, { ...result, timestamp: Date.now() });

      console.log(`🔍 Query validation: "${query}" -> Score: ${result.score}/100, Valid: ${result.isValid}`);
      return result;
    }

    // If parsing fails, be permissive
    return {
      isValid: true,
      score: 50,
      reason: 'Validation response malformed, allowing query'
    };
  } catch (e: any) {
    console.error('Query validation error:', e);
    // On error, be permissive (don't block users due to API issues)
    return {
      isValid: true,
      score: 50,
      reason: 'Validation failed, allowing query'
    };
  }
};

// Answer generation cache
const answerCache = new Map<string, { answer: string; citations: string[]; timestamp: number }>();
const ANSWER_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

/**
 * Generate a conversational answer from search results with citations
 * Used for question-type queries to provide AI-powered responses
 *
 * @param query - The original search query (question)
 * @param results - Array of search results
 * @returns Object with answer text and array of cited NCT IDs
 */
export const generateAnswerWithCitations = async (
  query: string,
  results: any[]
): Promise<{ answer: string; citations: string[] }> => {
  // Check cache first
  const cacheKey = `${query}_${results.length}`.toLowerCase();
  const cached = answerCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < ANSWER_CACHE_TTL) {
    console.log('✓ Using cached AI answer');
    return { answer: cached.answer, citations: cached.citations };
  }

  const ai = getAiClient();

  // Fallback for no results
  if (!results || results.length === 0) {
    return {
      answer: 'No clinical trials were found matching your query. Try broadening your search terms or using different keywords.',
      citations: []
    };
  }

  // Fallback if no AI client
  if (!ai) {
    return {
      answer: `Found ${results.length} clinical trial${results.length === 1 ? '' : 's'} matching your query. AI analysis is currently unavailable.`,
      citations: results.slice(0, 5).map((r: any) => r.nct_id)
    };
  }

  try {
    // Analyze more trials for better accuracy (up to 50, or all if fewer)
    const sampleSize = Math.min(50, results.length);
    const totalResults = results.length;

    const trialSummaries = results.slice(0, sampleSize).map((trial: any, idx: number) => {
      return `[${idx + 1}] NCT ID: ${trial.nctId || trial.nct_id}
Title: ${trial.title || trial.brief_title || trial.official_title || 'Untitled'}
Phase: ${trial.phase || trial.phases?.join(', ') || 'Not specified'}
Status: ${trial.status || trial.overall_status || 'Unknown'}
Enrollment: ${trial.enrollment || trial.enrollment_count || 'N/A'}
Conditions: ${Array.isArray(trial.conditions) ? trial.conditions.join(', ') : (trial.conditions?.map((c: any) => c.name || c).join(', ') || 'N/A')}
Sponsor: ${trial.sponsor || trial.lead_sponsor?.name || trial.source || 'N/A'}`;
    }).join('\n\n');

    console.log('🤖 Generating AI answer from search results...');

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `You are a clinical research intelligence assistant. A user asked: "${query}"

IMPORTANT: The search found ${totalResults} total clinical trials. I am providing you with the top ${sampleSize} most relevant results for analysis:

${trialSummaries}

Generate a comprehensive, professional answer to the user's question based on these search results.

CRITICAL FORMATTING RULES:
- Write in clean, readable prose - NO markdown formatting
- DO NOT use asterisks, underscores, or any markdown syntax
- DO NOT use bold (**text**) or italics (*text*)
- Use plain text only with proper punctuation
- Cite trials by NCT ID in parentheses: (NCT12345678)
- Use natural language for emphasis instead of formatting

Your answer should:
1. START by stating the TOTAL number of trials found (${totalResults} total)
2. Then analyze the sample you were given (top ${sampleSize})
3. Cite trials by NCT ID - Reference specific trials like (NCT12345678) when making claims
4. Provide statistical insights - Summarize phase distribution, status breakdown, key sponsors
5. Be clear about totals vs. sample - "The search found X total trials. Among the top Y analyzed..."
6. Use professional medical terminology
7. Write as flowing prose, not bullet points

Return JSON format:
{
  "answer": "Your detailed answer in clean prose without any markdown. START with total count, then analyze the sample. Include inline citations like (NCT12345678).",
  "citations": ["NCT12345678", "NCT87654321"]
}

Example for "What are the main types of cancer trials?" (assuming 50 total, analyzing 20):
{
  "answer": "The search identified 50 cancer-related clinical trials in total. Among the top 20 most relevant results, three primary categories emerge. First, systemic therapy trials involving chemotherapy combinations for advanced or metastatic disease, such as NCT00003029 and NCT00004173. Second, endocrine therapy trials focusing on site-specific cancers like breast (NCT00003418) and prostate (NCT00003653). Third, immunotherapy and vaccination trials including treatment comparisons (NCT00002575) and vaccination-based approaches (NCT00003279). Statistically, 14 of the 20 analyzed trials represent highly mature Phase 3 studies, frequently sponsored by the National Cancer Institute.",
  "citations": ["NCT00003029", "NCT00004173", "NCT00003418", "NCT00003653", "NCT00002575", "NCT00003279"]
}`,
      config: { responseMimeType: 'application/json' }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      const result = {
        answer: parsed.answer || `Found ${results.length} clinical trials matching your query.`,
        citations: parsed.citations || []
      };

      // Cache the result
      answerCache.set(cacheKey, { ...result, timestamp: Date.now() });

      console.log(`✓ AI answer generated (${result.citations.length} citations)`);
      return result;
    }

    // Fallback if parsing fails
    return {
      answer: `Found ${results.length} clinical trial${results.length === 1 ? '' : 's'} matching your query.`,
      citations: results.slice(0, 3).map((r: any) => r.nct_id)
    };
  } catch (e: any) {
    console.error('AI answer generation error:', e);
    // Return basic summary on error
    return {
      answer: `Found ${results.length} clinical trial${results.length === 1 ? '' : 's'} matching your query. Advanced analysis is temporarily unavailable.`,
      citations: results.slice(0, 3).map((r: any) => r.nct_id)
    };
  }
};
