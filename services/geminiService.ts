
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
