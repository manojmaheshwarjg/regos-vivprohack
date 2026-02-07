
import { GoogleGenAI } from "@google/genai";
import { QueryAnalysis, Message, ClinicalTrial } from '../types';

const getAiClient = () => {
  // Get API key from Vite environment variable
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ No Gemini API key found. AI features will use fallback data.');
    return null;
  }
  try {
    return new GoogleGenAI({ apiKey });
  } catch (error) {
    console.error('❌ Failed to initialize Gemini client:', error);
    return null;
  }
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

/**
 * Generate related follow-up questions based on the user's query and search results
 * Helps users explore the dataset with relevant questions
 *
 * @param originalQuery - The user's original search query
 * @param results - Array of search results to analyze
 * @returns Array of related question strings
 */
export const generateRelatedQuestions = async (
  originalQuery: string,
  results: any[]
): Promise<string[]> => {
  const ai = getAiClient();

  // Fallback questions if no AI or error
  const fallbackQuestions = [
    "Which trials are currently recruiting?",
    "What phases are most common?",
    "Show me completed studies only",
    "Which sponsors are leading research?"
  ];

  if (!ai || !results || results.length === 0) {
    return fallbackQuestions.slice(0, 3);
  }

  try {
    // Extract key insights from results for context
    const sampleSize = Math.min(20, results.length);
    const phases = new Set(results.slice(0, sampleSize).map((r: any) => r.phase || r.phases?.[0]).filter(Boolean));
    const conditions = new Set(
      results.slice(0, sampleSize)
        .flatMap((r: any) => Array.isArray(r.conditions) ? r.conditions : [])
        .map((c: any) => typeof c === 'string' ? c : c.name)
        .filter(Boolean)
    );
    const sponsors = new Set(
      results.slice(0, sampleSize)
        .map((r: any) => r.sponsor || r.lead_sponsor?.name || r.source)
        .filter(Boolean)
    );

    console.log('🤔 Generating related questions...');

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `You are a clinical research assistant helping users explore clinical trial data.

Original user question: "${originalQuery}"

The search found ${results.length} trials with these characteristics:
- Phases present: ${Array.from(phases).join(', ')}
- Top conditions: ${Array.from(conditions).slice(0, 5).join(', ')}
- Key sponsors: ${Array.from(sponsors).slice(0, 5).join(', ')}

Generate exactly 4 natural language follow-up questions that:
1. Help the user dig deeper into these specific results
2. Explore different aspects (phases, sponsors, conditions, status, enrollment)
3. Are phrased as complete questions (start with What/Which/How/Show/Find)
4. Are concise (max 8 words each)
5. Are directly answerable from this dataset

Return as JSON array of 4 question strings.

Example format: ["How many Phase 3 trials were found?", "Which sponsors funded these studies?", "Show me only recruiting trials", "What conditions were most studied?"]`,
      config: { responseMimeType: 'application/json' }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`✓ Generated ${parsed.length} related questions`);
        return parsed.slice(0, 4);
      }
    }

    return fallbackQuestions.slice(0, 4);
  } catch (e: any) {
    console.error('Related questions generation error:', e);
    return fallbackQuestions.slice(0, 4);
  }
};

// Chat response cache
const chatCache = new Map<string, { answer: string; citations: string[]; timestamp: number }>();
const CHAT_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

/**
 * Generate a conversational chat response based on message history and trial context
 * Used for follow-up questions in chat sessions
 *
 * @param messages - Array of previous messages in the conversation
 * @param contextTrials - Clinical trials that form the context for this conversation
 * @returns Object with answer text and array of cited NCT IDs
 */
/**
 * Generate AI overview of pharmaceutical news from scraped articles
 * Used for the Regulatory Intelligence feed
 *
 * @param newsItems - Array of scraped pharmaceutical news items
 * @returns Object with summary text and highlighted news items
 */
export const generatePharmaNewsOverview = async (
  newsItems: any[]
): Promise<{ summary: string; highlights: string[] } | null> => {
  const ai = getAiClient();

  // Return null if no news items
  if (!newsItems || newsItems.length === 0) {
    return null;
  }

  // Fallback if no AI client - return basic summary
  if (!ai) {
    return {
      summary: `${newsItems.length} pharmaceutical news articles from leading companies including ${[...new Set(newsItems.slice(0, 5).map((n: any) => n.company))].join(', ')}.`,
      highlights: newsItems.slice(0, 3).map((n: any) => n.title)
    };
  }

  try {
    // Format news items for AI analysis (top 20 for context)
    const topNews = newsItems.slice(0, 20);
    const newsContext = topNews.map((item: any, idx: number) => {
      return `[${idx + 1}] ${item.company} - ${item.category}
Title: ${item.title}
Summary: ${item.summary}
Date: ${item.publishedDate}
Tags: ${item.tags.join(', ')}`;
    }).join('\n\n');

    console.log('🤖 Generating pharmaceutical news overview with Gemini...');

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `You are a pharmaceutical regulatory intelligence analyst. Analyze these recent news articles from major pharma companies.

PHARMACEUTICAL NEWS (${newsItems.length} total articles, analyzing top ${topNews.length}):

${newsContext}

Your task:
1. Read and understand the content of each news article
2. Identify the most significant developments across all news
3. Extract the key insights that matter most to pharmaceutical professionals
4. Focus on: FDA approvals, clinical trial results, partnerships, M&A, safety alerts, regulatory changes, pipeline updates

CRITICAL FORMATTING RULES:
- Write in clean, readable prose - NO markdown formatting
- DO NOT use asterisks, underscores, or any markdown syntax
- DO NOT use bold (**text**) or italics (*text*)
- Use plain text only with proper punctuation
- Summary: 2-3 sentences analyzing the overall landscape
- Highlights: 3-4 specific, actionable insights from the actual news content

Return JSON format:
{
  "summary": "Your executive summary analyzing the pharmaceutical landscape based on these news articles",
  "highlights": ["Specific insight from article 1 with company name and details", "Specific insight from article 2", "Specific insight from article 3", "Specific insight from article 4"]
}

Example based on actual news:
{
  "summary": "This week's pharmaceutical news highlights strong financial performance from AbbVie with their Q4 2025 earnings report, while regulatory activity includes guidance updates from the FDA. Major companies continue advancing their clinical pipelines with several Phase 3 trials reaching key milestones across oncology and rare disease programs.",
  "highlights": ["AbbVie reports record Q4 2025 revenue driven by Rinvoq and Skyrizi growth", "FDA issues new guidance on accelerated approval pathway for oncology drugs", "Merck announces positive Phase 3 data for investigational diabetes treatment", "Johnson & Johnson completes acquisition of biotech firm focused on gene therapy"]
}`,
      config: { responseMimeType: 'application/json' }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      console.log('✓ Pharma news overview generated');
      return {
        summary: parsed.summary || '',
        highlights: parsed.highlights || []
      };
    }

    // Fallback if parsing fails
    return {
      summary: `${newsItems.length} pharmaceutical news articles covering regulatory approvals, clinical trials, and industry partnerships.`,
      highlights: topNews.slice(0, 3).map((n: any) => n.title)
    };
  } catch (e: any) {
    console.error('Pharma news overview generation error:', e);
    // Return basic summary on error
    return {
      summary: `${newsItems.length} pharmaceutical news articles from ${[...new Set(newsItems.slice(0, 5).map((n: any) => n.company))].join(', ')}.`,
      highlights: newsItems.slice(0, 3).map((n: any) => n.title)
    };
  }
};

export const generateChatResponse = async (
  messages: Message[],
  contextTrials: ClinicalTrial[]
): Promise<{ answer: string; citations: string[] }> => {
  // Create cache key from last user message + trial count
  const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0];
  if (!lastUserMessage) {
    return {
      answer: 'Please ask a question about the clinical trials.',
      citations: []
    };
  }

  const cacheKey = `${lastUserMessage.content}_${contextTrials.length}`.toLowerCase();
  const cached = chatCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CHAT_CACHE_TTL) {
    console.log('✓ Using cached chat response');
    return { answer: cached.answer, citations: cached.citations };
  }

  const ai = getAiClient();

  // Fallback if no trials
  if (!contextTrials || contextTrials.length === 0) {
    return {
      answer: 'No clinical trials are available in this conversation context. Please start a new chat from a search result.',
      citations: []
    };
  }

  // Fallback if no AI client
  if (!ai) {
    return {
      answer: `I have ${contextTrials.length} clinical trial${contextTrials.length === 1 ? '' : 's'} in context, but AI analysis is currently unavailable. Please try again later.`,
      citations: contextTrials.slice(0, 3).map(t => t.nctId)
    };
  }

  try {
    // Format trial context
    const trialContext = contextTrials.map((trial, idx) => {
      return `[${idx + 1}] NCT ID: ${trial.nctId}
Title: ${trial.title}
Phase: ${trial.phase}
Status: ${trial.status}
Enrollment: ${trial.enrollment}
Conditions: ${trial.conditions.join(', ')}
Sponsor: ${trial.sponsor}
Intervention: ${trial.intervention}
Description: ${trial.description}`;
    }).join('\n\n');

    // Format conversation history
    const conversationHistory = messages.map(m => {
      return `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`;
    }).join('\n');

    console.log('💬 Generating chat response...');

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `You are a clinical research intelligence assistant helping a user explore specific clinical trials through conversation.

CONVERSATION HISTORY:
${conversationHistory}

CLINICAL TRIALS IN CONTEXT (${contextTrials.length} trials):
${trialContext}

The user just asked: "${lastUserMessage.content}"

Generate a helpful, conversational answer based ONLY on the ${contextTrials.length} clinical trials provided above.

CRITICAL FORMATTING RULES:
- Write in clean, readable prose - NO markdown formatting
- DO NOT use asterisks, underscores, or any markdown syntax
- DO NOT use bold (**text**) or italics (*text*)
- Use plain text only with proper punctuation
- Cite trials by NCT ID in parentheses: (NCT12345678)
- Use natural language for emphasis instead of formatting

Your answer should:
1. Directly answer the user's question
2. Reference specific trials by NCT ID when making claims
3. Provide specific details (phases, enrollment numbers, sponsors, etc.)
4. Stay within the context of the ${contextTrials.length} trials provided
5. Be conversational and helpful
6. Use professional medical terminology
7. Write as flowing prose, not bullet points

Return JSON format:
{
  "answer": "Your conversational answer in clean prose without any markdown. Include inline citations like (NCT12345678).",
  "citations": ["NCT12345678", "NCT87654321"]
}

Example for "Which trials are recruiting?":
{
  "answer": "Among the trials we're discussing, there are 2 currently recruiting participants. The first is NCT05678901, a Phase 3 semaglutide study for Type 2 Diabetes with 500 participants planned, sponsored by Novo Nordisk. The second is NCT04567890, evaluating Pembrolizumab plus chemotherapy for non-small cell lung cancer, enrolling 1200 patients through Merck Sharp and Dohme.",
  "citations": ["NCT05678901", "NCT04567890"]
}`,
      config: { responseMimeType: 'application/json' }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      const result = {
        answer: parsed.answer || 'I apologize, but I could not generate a proper response. Please try rephrasing your question.',
        citations: parsed.citations || []
      };

      // Cache the result
      chatCache.set(cacheKey, { ...result, timestamp: Date.now() });

      console.log(`✓ Chat response generated (${result.citations.length} citations)`);
      return result;
    }

    // Fallback if parsing fails
    return {
      answer: `I have ${contextTrials.length} clinical trials in context. How can I help you analyze them?`,
      citations: contextTrials.slice(0, 2).map(t => t.nctId)
    };
  } catch (e: any) {
    console.error('Chat response generation error:', e);
    // Return basic summary on error
    return {
      answer: `I have ${contextTrials.length} clinical trials in context, but I'm having trouble generating a detailed response. Please try rephrasing your question.`,
      citations: contextTrials.slice(0, 2).map(t => t.nctId)
    };
  }
};
