# RegOS Technology Stack Explained

This document explains all the technologies used in the RegOS pharmaceutical regulatory intelligence platform, why they were chosen, and how they work together.

---

## Table of Contents

1. [Frontend Technologies](#frontend-technologies)
2. [Backend Technologies](#backend-technologies)
3. [AI & Machine Learning](#ai--machine-learning)
4. [Search & Database](#search--database)
5. [Data Processing & Indexing](#data-processing--indexing)
6. [Web Scraping & News Intelligence](#web-scraping--news-intelligence)
7. [Build Tools & Development](#build-tools--development)
8. [UI/UX Libraries](#uiux-libraries)

---

## Frontend Technologies

### React 18.2.0
**What it is:** A JavaScript library for building user interfaces with component-based architecture.

**Why we use it:**
- Industry-standard for complex single-page applications
- Component reusability across SubmissionOS and Discovery apps
- Fast rendering for real-time agent workflow visualization
- Large ecosystem of compatible libraries
- Virtual DOM for efficient updates during AI agent progress tracking

**Where it's used:**
- All UI components (AgentWorkflow, DocumentsView, TruthLayer, ClinicalSearch)
- State management for agent status and document uploads
- Real-time progress tracking during submission analysis

### TypeScript 5.8.2
**What it is:** A typed superset of JavaScript that compiles to plain JavaScript.

**Why we use it:**
- Type safety prevents bugs in complex regulatory domain logic
- Better IDE support for pharmaceutical data structures (eCTD modules, clinical trials)
- Self-documenting code with interfaces for Agent, ClinicalTrial, Discrepancy types
- Easier refactoring as the platform grows
- Catches errors at compile-time rather than runtime

**Where it's used:**
- `types.ts` - Core data models for agents, trials, and discrepancies
- Service layer type safety in `geminiService.ts`
- Component props validation across all React components

### Vite 6.2.0
**What it is:** Next-generation frontend build tool that's extremely fast.

**Why we use it:**
- Lightning-fast development server with Hot Module Replacement (HMR)
- Instant startup compared to webpack-based tools
- Optimized production builds with code splitting
- Native ES modules support
- Built-in TypeScript support without configuration
- Environment variable injection for API keys (`GEMINI_API_KEY`)

**Where it's used:**
- `vite.config.ts` - Build configuration, path aliases (@/*), API key injection
- Development server running on port 3000
- Production builds for deployment

---

## Backend Technologies

### Node.js + Express 4.18.2
**What it is:** Express is a minimal web framework for Node.js.

**Why we use it:**
- Fast setup for API proxy server to Elasticsearch
- Keeps Elasticsearch credentials secure on server-side (never exposed to browser)
- Middleware support for CORS, JSON parsing
- Easy integration with Elasticsearch JavaScript client
- Lightweight for the API proxy use case

**Where it's used:**
- `server/api.js` - Main Express server
- `/api/search` - Proxy endpoint for clinical trial searches
- `/api/news` - Regulatory news feed endpoint
- `/api/health` - Elasticsearch health check

### CORS (Cross-Origin Resource Sharing)
**What it is:** Express middleware to enable cross-origin requests.

**Why we use it:**
- Frontend (localhost:3000) needs to communicate with backend (localhost:3002)
- Browsers block cross-origin requests by default
- Allows secure API communication between Vite dev server and Express API

**Where it's used:**
- `server/api.js:26` - Applied as middleware to all routes

### dotenv 16.4.0
**What it is:** Loads environment variables from `.env.local` file.

**Why we use it:**
- Keeps API keys and credentials out of source code
- Separate configuration from code
- Easy to manage different environments (dev, staging, prod)

**Where it's used:**
- Loading `ES_CLOUD_ID`, `ES_API_KEY` for Elasticsearch
- Loading `GEMINI_API_KEY` for AI features
- Used in both server (`server/api.js`) and Python scripts

---

## AI & Machine Learning

### Google Gemini API (@google/generative-ai 0.24.1)
**What it is:** Google's latest generative AI model API for text generation and understanding.

**Why we use it:**
- **gemini-flash-latest** model: Fast, cost-effective for real-time agent log generation
- Structured output with JSON mode for reliable parsing
- Advanced query understanding for clinical trial searches
- Conversational chat capabilities for multi-turn Q&A
- Medical domain knowledge without fine-tuning

**Where it's used:**
- `generateAgentLog()` - Creates realistic pharmaceutical agent activity logs
- `analyzeClinicalQuery()` - Extracts structured data from natural language queries
- `generateAnswerWithCitations()` - Provides AI-powered answers to clinical questions
- `validateMedicalQuery()` - Filters non-medical queries before search
- `generateChatResponse()` - Multi-turn conversational chat about trials
- `generatePharmaNewsOverview()` - Summarizes regulatory news with AI insights

### Google Gemini Embeddings (text-embedding-004)
**What it is:** Converts text into 768-dimensional vector representations for semantic understanding.

**Why we use it:**
- Enables semantic search: "diabetes treatment" matches trials about "glucose control"
- 768 dimensions capture nuanced medical terminology
- Task-specific embeddings (`task_type="retrieval_document"`) optimized for search
- Cosine similarity for finding conceptually similar trials

**How it works:**
1. Clinical trial data (title, description, conditions, interventions) combined into searchable text
2. Gemini API generates 768-dim vector embedding for each trial
3. Embeddings stored in Elasticsearch `dense_vector` field
4. User query embedded with same model
5. Elasticsearch finds trials with highest cosine similarity to query vector

**Where it's used:**
- `scripts/index_trials_gemini.py` - Batch embedding generation during indexing
- Elasticsearch index mapping with `dense_vector` field (768 dims, cosine similarity)
- Semantic search mode in Clinical Search interface

---

## Search & Database

### Elasticsearch 8.12.0 (@elastic/elasticsearch)
**What it is:** Distributed search and analytics engine designed for horizontal scalability and real-time search.

**Why we use it:**
- **Full-text search:** Medical terminology matching with custom analyzers
- **Semantic search:** Dense vector support for embedding-based similarity
- **Hybrid search:** Combines keyword relevance + semantic understanding
- **Aggregations:** Phase distribution, status breakdowns, sponsor analytics
- **Real-time indexing:** New trials searchable immediately
- **Cloud deployment:** Managed Elastic Cloud for reliability

**Architecture:**
```
Clinical Trial Document Structure:
{
  nct_id: "NCT12345678",           // Unique identifier
  brief_title: "text + keyword",   // Full-text + exact match
  conditions: [nested objects],     // Structured medical conditions
  interventions: [nested objects],  // Drug/treatment info
  description_embedding: [768 floats], // Semantic vector
  quality_score: 85.5,              // Calculated relevance score
  phase: "PHASE3",                  // Keyword field for filtering
  ...
}
```

**Custom Analyzer (`medical_analyzer`):**
- Tokenizer: standard (splits on whitespace/punctuation)
- Filters: lowercase + stemmer
- Example: "diabetes mellitus" → ["diabetes", "mellitus", "diabet", "mellit"]
- Improves recall for medical term variations

**Where it's used:**
- `server/api.js` - Elasticsearch client connection and query execution
- `/api/search` - Multi-mode search (keyword, semantic, hybrid)
- `/api/aggregations` - Statistical analysis of trial data
- Python indexing scripts for bulk data ingestion

### Elasticsearch Cloud
**What it is:** Managed Elasticsearch service hosted by Elastic.

**Why we use it:**
- No infrastructure management required
- Automatic scaling, backups, updates
- High availability and disaster recovery
- API key authentication for secure access
- Global CDN for low-latency searches

**Configuration:**
- Cloud ID stored in `.env.local`
- API key authentication (more secure than username/password)
- Dense vector indexing enabled for semantic search

---

## Data Processing & Indexing

### Python Scripts (scripts/index_trials_gemini.py)
**What it is:** Python automation for ETL (Extract, Transform, Load) pipeline.

**Why we use Python:**
- Excellent for data processing and batch operations
- Native Elasticsearch client with bulk indexing support
- Easy integration with Google Generative AI SDK
- Progress bars with `tqdm` for long-running operations
- Robust error handling for API rate limits

**Indexing Pipeline:**
```
1. Load clinical_trials.json (raw trial data)
   ↓
2. Calculate quality scores for each trial
   ↓
3. Generate searchable text (title + description + conditions)
   ↓
4. Call Gemini API to generate 768-dim embeddings
   ↓
5. Transform to Elasticsearch document format
   ↓
6. Bulk index to Elasticsearch with dense_vector field
   ↓
7. Validate indexing and run test queries
```

**Key Features:**
- **Rate limiting:** 0.05s delay between Gemini API calls (~20 req/sec, under 1500/min limit)
- **Batch processing:** 50 trials per bulk index, 10 texts per embedding batch
- **Quality scoring:** 100-point algorithm based on completeness, sponsor, design, size, recency
- **Fallback handling:** Continues without embeddings if Gemini API unavailable

**Where it's used:**
- `scripts/index_trials_gemini.py` - Main indexing script with embeddings
- `scripts/index_trials_win.py` - Windows-compatible version
- Runs once during setup, can be re-run to refresh index

### Quality Score Algorithm
**What it is:** Custom scoring system (0-100) to rank trial importance and completeness.

**Why we use it:**
- Boosts high-quality trials in search results
- Prioritizes industry-sponsored, large-scale, randomized controlled trials
- Filters out incomplete or low-quality data
- Weights recent trials higher than old ones

**Scoring factors:**
- **Completeness (40 pts):** All required fields present
- **Sponsor quality (15 pts):** Industry sponsors (Pfizer, Merck) vs academic
- **Study design (15 pts):** Randomized + double-blind + data monitoring committee
- **Enrollment size (10 pts):** 1000+ participants = 10 pts
- **Recency (10 pts):** Current year = 10 pts, decreases with age
- **Detailed description (10 pts):** Has comprehensive study details

**Where it's used:**
- `calculate_quality_score()` in Python indexing script
- Stored in Elasticsearch for result ranking
- Can be used in boosting queries (future enhancement)

---

## Web Scraping & News Intelligence

### RSS Parser (rss-parser 3.13.0)
**What it is:** Parses RSS/Atom feeds into JavaScript objects.

**Why we use it:**
- Pfizer provides structured RSS feed for press releases
- Standardized format is reliable and easy to parse
- Automatic date/title/link extraction
- No HTML parsing needed for RSS sources

**Where it's used:**
- `server/newsScraperService.js:parsePfizerRSS()` - Fetches Pfizer news feed
- Timeout handling (10s) for network errors

### Cheerio (cheerio 1.2.0)
**What it is:** jQuery-like library for server-side HTML parsing and manipulation.

**Why we use it:**
- Scrapes news from pharma company websites without RSS feeds
- Fast HTML traversal with familiar jQuery syntax
- Handles complex DOM structures (J&J, Merck, AbbVie, AstraZeneca sites)
- Extracts titles, links, dates, summaries from multiple selector patterns

**How it works:**
```javascript
// Load HTML into Cheerio
const $ = cheerio.load(response.data);

// Try multiple selector strategies
$('article, div[class*="press"], a[href*="press"]').each((i, elem) => {
  const title = $(elem).find('h1, h2, h3').text();
  const link = $(elem).attr('href');
  const date = $(elem).find('time, .date').text();
  // ... extract and categorize
});
```

**Where it's used:**
- `scrapeJNJ()`, `scrapeMerck()`, `scrapeAbbVie()`, `scrapeAstraZeneca()`
- Fallback selectors for different website structures
- Filters out navigation links and utility content

### Axios (axios 1.13.4)
**What it is:** Promise-based HTTP client for Node.js and browsers.

**Why we use it:**
- Fetches HTML pages for Cheerio scraping
- Timeout handling (10-15s) to avoid hanging requests
- Custom headers (User-Agent) to mimic browser requests
- Error handling for network failures

**Where it's used:**
- HTTP requests to pharma company websites
- Custom User-Agent to bypass simple bot detection
- Promise-based for concurrent scraping with `Promise.allSettled()`

### News Categorization & Tag Extraction
**What it is:** Rule-based NLP using keyword matching to classify news articles.

**Why we use it:**
- Organizes news by category: FDA Approval, Clinical Trial, Partnership, Financial, R&D, Policy, Safety Alert
- Extracts domain tags: Oncology, Cardiovascular, Diabetes, Vaccines, Rare Disease, COVID-19
- Enables filtering and aggregation in news feed
- No ML required - pharmaceutical news follows predictable patterns

**Algorithm:**
```javascript
// Category detection
if (text.match(/fda|approval|authorized/i))
  → "FDA Approval"
if (text.match(/clinical trial|phase \d/i))
  → "Clinical Trial"
if (text.match(/partnership|collaboration/i))
  → "Partnership"

// Tag extraction
if (text.match(/cancer|oncology|tumor/i))
  → Add "Oncology" tag
if (text.match(/diabetes|insulin/i))
  → Add "Diabetes" tag
```

**Where it's used:**
- `categorizeNews()` - Assigns category to each article
- `extractTags()` - Extracts up to 3 relevant therapeutic area tags
- News filtering in `/api/news` endpoint

### Node-Cron (node-cron 4.2.1)
**What it is:** Cron-like job scheduler for Node.js.

**Why we use it:**
- Automatically refreshes news feed every 6 hours
- Runs background scraping without manual intervention
- Ensures fresh pharmaceutical news in Regulatory Intelligence feed

**Where it's used:**
- `server/newsScheduler.js` - Cron job configuration
- Schedule: `0 */6 * * *` (every 6 hours at minute 0)
- Started when Express server launches

---

## Build Tools & Development

### Path Aliases (@/*)
**What it is:** TypeScript path mapping that allows importing from project root.

**Why we use it:**
```typescript
// Without alias
import { Agent } from '../../../types';

// With alias
import { Agent } from '@/types';
```

- Cleaner imports regardless of file depth
- Easy refactoring when moving files
- Standard convention in modern React projects

**Where it's configured:**
- `tsconfig.json:21-24` - TypeScript path mapping
- `vite.config.ts:17-21` - Vite resolution for dev/build

### ES Modules (type: "module")
**What it is:** Modern JavaScript module system (import/export instead of require()).

**Why we use it:**
- Standard for modern JavaScript
- Tree shaking for smaller bundles
- Static analysis for better optimization
- Required by Vite

**Where it's used:**
- `package.json:5` - Both frontend and server use ES modules
- `import` statements throughout codebase
- Compatible with TypeScript compilation

### Environment Variable Injection
**What it is:** Vite exposes environment variables to client-side code securely.

**How it works:**
```typescript
// vite.config.ts
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY)
}

// Client code
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
```

**Why we use it:**
- API keys accessible in browser without hardcoding
- Different keys for dev/staging/prod environments
- Compiled into bundle at build time (not exposed at runtime)

**Where it's used:**
- `vite.config.ts:13-16` - Injects `GEMINI_API_KEY`
- `geminiService.ts:7` - Reads API key from environment

---

## UI/UX Libraries

### Tailwind CSS (via CDN/classes)
**What it is:** Utility-first CSS framework for rapid UI development.

**Why we use it:**
- Fast prototyping with pre-built utility classes
- Consistent design system (spacing, colors, typography)
- No CSS files to maintain
- Custom brand colors: `brand-*` variants (teal/turquoise gradient)
- Responsive design with `sm:`, `md:`, `lg:` prefixes

**Example usage:**
```tsx
<div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
  <h2 className="text-2xl font-bold text-brand-600">
    Agent Workflow
  </h2>
</div>
```

**Where it's used:**
- All component styling (no separate CSS files)
- Responsive layouts in AgentWorkflow, DocumentsView, ClinicalSearch
- Custom medical analyzer theme with teal/blue gradients

### Lucide React (lucide-react 0.303.0)
**What it is:** Icon library with 1000+ customizable SVG icons.

**Why we use it:**
- Medical/professional icons: Beaker, FileText, Shield, Brain, Activity
- Tree-shakeable (only imports used icons)
- Consistent visual language across platform
- Customizable size, color, stroke width

**Where it's used:**
- Agent icons in workflow visualization
- Navigation icons for views
- Document type indicators
- Search and filter UI elements

### Framer Motion (framer-motion 10.16.16)
**What it is:** Production-ready animation library for React.

**Why we use it:**
- Smooth transitions for agent state changes (IDLE → ANALYZING → COMPLETED)
- Progress bar animations in real-time workflow
- Page transitions between views
- Card hover effects and entrance animations
- Gesture-based interactions (drag, hover, tap)

**Example animations:**
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  {/* Agent card content */}
</motion.div>
```

**Where it's used:**
- AgentCard component - state transition animations
- TruthLayer - discrepancy reveal animations
- ClinicalSearch - result entrance effects

### Recharts (recharts 2.10.3)
**What it is:** Composable charting library built on React components and D3.

**Why we use it:**
- Data visualization in TruthLayer (discrepancy charts)
- Responsive charts that adapt to container size
- Built with React (no DOM manipulation)
- Customizable themes matching Tailwind design system

**Where it's used:**
- TruthLayer component - Discrepancy distribution charts
- Could be extended for trial statistics, phase distribution, enrollment trends

---

## Architecture Patterns

### Client-Server Separation
**Why:**
- Keeps Elasticsearch credentials secure (never sent to browser)
- Backend can implement rate limiting, caching, authentication
- Frontend can be deployed to static hosting (Vercel, Netlify)

**Flow:**
```
React Frontend (port 3000)
  ↓ HTTP POST /api/search
Express API Server (port 3002)
  ↓ Elasticsearch query
Elasticsearch Cloud
  ↓ Search results
Express API Server
  ↓ JSON response
React Frontend
```

### Graceful Degradation
**Why:**
- App remains functional when Gemini API quota exceeded
- Rich fallback data ensures good UX without AI
- Caching reduces redundant API calls

**Examples:**
- `geminiService.ts` - Returns fallback logs if API unavailable
- News scraper saves to file, loads from cache on error
- Query validation allows search if AI validation fails

### State Management (React useState)
**Why:**
- No external state library (Redux, MobX) needed for this app size
- State lives close to components that use it
- Simple to understand and debug
- Props drilling acceptable for 2-3 level depth

**State locations:**
- `App.tsx` - Global state (agents, documents, workflow status, current view)
- Component-level state for UI interactions (search query, filters, chat messages)

---

## Data Flow Example: Clinical Trial Search

```
1. USER types: "diabetes trials"
   ↓
2. FRONTEND (ClinicalSearch.tsx)
   - Calls validateMedicalQuery() → Gemini API validates query
   - Calls analyzeClinicalQuery() → Gemini extracts structured filters
   ↓
3. FRONTEND builds Elasticsearch query
   - Semantic mode: KNN query using query embedding
   - Keyword mode: Match query with medical_analyzer
   - Hybrid mode: Combines both with RRF (Reciprocal Rank Fusion)
   ↓
4. FRONTEND → POST /api/search (Express server)
   ↓
5. BACKEND (api.js)
   - Receives query from frontend
   - Executes Elasticsearch query with credentials
   ↓
6. ELASTICSEARCH
   - Searches indexed trials
   - Ranks by relevance score (BM25 + cosine similarity)
   - Returns top results
   ↓
7. BACKEND → JSON response to frontend
   ↓
8. FRONTEND
   - Calls generateAnswerWithCitations() → Gemini summarizes results
   - Calls generateRelatedQuestions() → Gemini suggests follow-ups
   - Displays trials with AI answer and citations
```

---

## Summary

### Core Technology Choices

| Technology | Purpose | Why Chosen |
|-----------|---------|-----------|
| **React + TypeScript** | Frontend framework | Industry standard, type safety for complex domain |
| **Vite** | Build tool | Fast dev server, optimized production builds |
| **Elasticsearch** | Search engine | Full-text + semantic search, real-time indexing |
| **Gemini AI** | LLM & Embeddings | Medical knowledge, structured output, fast inference |
| **Express** | API server | Secure credential proxy, lightweight |
| **Python** | Data pipeline | Best for ETL, Elasticsearch bulk indexing |
| **Tailwind** | CSS framework | Rapid UI development, consistent design |
| **Framer Motion** | Animations | Smooth agent workflow transitions |

### Why This Stack Works

1. **Performance:** Vite (fast builds) + Elasticsearch (millisecond searches) + Gemini Flash (low latency)
2. **Security:** Backend proxy keeps credentials server-side, environment variables for secrets
3. **Scalability:** Elasticsearch Cloud auto-scales, stateless API server easy to replicate
4. **Developer Experience:** TypeScript catches errors, hot reload during dev, modern tooling
5. **AI Integration:** Gemini provides medical knowledge without fine-tuning, structured JSON output
6. **Cost Efficiency:** Serverless-friendly architecture, Gemini free tier for development

---

## Future Enhancements

Potential technologies to add:

- **Redis:** Caching for frequent searches and API responses
- **PostgreSQL:** User accounts, saved searches, audit logs
- **WebSockets:** Real-time collaboration on submissions
- **Docker:** Containerization for easier deployment
- **Kubernetes:** Orchestration for high availability
- **OpenTelemetry:** Distributed tracing and monitoring
- **Sentry:** Error tracking and performance monitoring
- **Jest + React Testing Library:** Automated testing
- **Playwright:** End-to-end testing
- **Storybook:** Component documentation

---

**Last Updated:** February 2026
**Project:** RegOS - Pharmaceutical Regulatory Intelligence Platform
**Tech Stack Version:** 1.0
