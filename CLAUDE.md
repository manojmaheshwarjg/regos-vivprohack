# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RegOS** is a pharmaceutical regulatory intelligence platform built with React/TypeScript and Vite. The application simulates a regulatory submission workflow with AI agents that analyze clinical trial documents and verify their accuracy. It consists of two main apps:

1. **SubmissionOS** - eCTD document assembly and verification workflow
2. **Discovery** - Clinical trial intelligence search

View the live app: https://ai.studio/apps/drive/1vV3MOIx0Wg1gyqwtbrlAZ4DnRSvTWk5W

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm preview
```

## Environment Setup

Set `GEMINI_API_KEY` in `.env.local` to enable AI features. The app has fallback mechanisms if the API is unavailable or quota is exceeded.

## Architecture

### Core Application Structure

- **App.tsx** - Main application shell with view routing, navigation, and orchestration logic
  - Manages 4 views: DOCUMENTS, AGENTS, TRUTHLAYER, SEARCH
  - Controls project workflow state: draft → analyzing → analyzed
  - Implements parallel agent execution with sequential phases

### Agent Orchestration Flow

The submission analysis runs in 4 phases (see App.tsx:191-254):

1. **Intelligence Agent** (Monitoring) - Scans regulatory guidance
2. **Protocol Agent** (Design) - Analyzes study design
3. **Parallel Specialists** - Safety, Statistics, and CMC agents run concurrently
4. **Document Agent** (Assembly) - Compiles eCTD structure

Each agent progresses through states: IDLE → ANALYZING → COMPLETED

### Key Data Models (types.ts)

- **Agent** - Status, progress, logs, and configuration for each AI agent
- **SourceDocument** - Uploaded files with eCTD module classification (m1-m5)
- **Discrepancy** - Truth layer verification findings (critical/warning/administrative)
- **ClinicalTrial** - Search results data structure
- **QueryAnalysis** - Extracted structured data from search queries

### Services

**geminiService.ts** - Google Gemini AI integration
- `generateAgentLog()` - Generates realistic agent activity logs
- `generateDiscrepancyAnalysis()` - Analyzes verification findings
- `analyzeClinicalQuery()` - Extracts structured data from natural language queries
- All functions have rich fallback data to ensure functionality without API access

### Component Organization

- **DocumentsView** - File upload interface and eCTD module organization
- **AgentWorkflow** - Real-time agent execution visualization with progress and logs
- **TruthLayer** - Document verification interface showing discrepancies between generated and source content
- **ClinicalSearch** - Intelligent trial search with semantic understanding
- **AgentCard** - Individual agent status display with logs
- **Dashboard** - (unused in current flow)

### Static Data (constants.ts)

- `INITIAL_AGENTS` - Agent definitions with roles and icons
- `MOCK_DISCREPANCIES` - Sample verification findings
- `DOMAIN_KNOWLEDGE` - Medical terminology mappings for search
- `MOCK_TRIALS` - Clinical trial database (9 trials across diabetes, oncology, rare disease, cardiovascular)

### Styling and UI

- Uses Tailwind CSS classes throughout (utility-first approach)
- Custom branding: Brand color defined as `brand-*` variants (teal/turquoise gradient)
- Lucide React icons
- Framer Motion for animations
- Recharts for data visualization (in TruthLayer)

### Path Aliases

The project uses `@/*` as an alias for root-level imports (configured in tsconfig.json and vite.config.ts).

## Key Implementation Details

### eCTD Module Classification

Documents are automatically classified into eCTD modules (m1-m5) based on filename patterns:
- **m1** - Administrative (cover letters, forms)
- **m2** - Summary (overviews, introductions)
- **m3** - Quality (CMC, specifications)
- **m4** - Nonclinical (toxicology, animal studies)
- **m5** - Clinical (protocols, CSRs, SAPs, IB)

See `determineModule()` in App.tsx:89-97.

### Clinical Search Intelligence

The search system uses domain knowledge mappings to understand medical terminology (e.g., "heart attack" → "myocardial infarction", "MI", "STEMI"). Gemini AI extracts structured filters from natural language queries.

### API Key Handling

The app uses a hardcoded fallback API key in geminiService.ts:7 but prioritizes `process.env.API_KEY`. This is exposed via vite.config.ts environment variable injection.

### State Management

The app uses React useState for all state management (no external state library). Key state lives in App.tsx and is passed down through props.

## Regulatory Domain Context

This application simulates pharmaceutical regulatory workflows according to:
- **ICH guidelines** (International Council for Harmonisation)
- **eCTD format** (electronic Common Technical Document)
- **FDA/EMA submission standards**

Common regulatory terms:
- **SAE** - Serious Adverse Event
- **CSR** - Clinical Study Report
- **SAP** - Statistical Analysis Plan
- **CMC** - Chemistry, Manufacturing & Controls
- **IB** - Investigator's Brochure
- **ICSR** - Individual Case Safety Report

## Development Notes

- The app includes realistic sample data to demonstrate workflows without requiring actual regulatory documents
- Agent logs use pharmaceutical terminology (ICH E9, eCTD backbone, SAE reconciliation, etc.)
- The Truth Layer demonstrates a verification system that catches hallucinations and discrepancies between source documents and AI-generated content
- All AI features gracefully degrade when API quota is exceeded
