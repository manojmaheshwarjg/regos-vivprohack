import { ClinicalTrial, SearchVerificationIssue, VerificationResult } from '../types';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Comprehensive fact-checking service for AI-generated clinical trial answers
 * Uses LLM-as-Judge approach for intelligent verification instead of regex patterns
 */

const genAI = new GoogleGenerativeAI((import.meta as any).env?.VITE_GEMINI_API_KEY || '');

// ===== 1. CITATION VALIDATION =====

export function validateCitations(
  citations: string[],
  searchResults: ClinicalTrial[]
): { valid: string[]; invalid: string[] } {
  const resultIds = new Set(searchResults.map(t => t.nctId));

  const valid: string[] = [];
  const invalid: string[] = [];

  citations.forEach(nctId => {
    if (resultIds.has(nctId)) {
      valid.push(nctId);
    } else {
      invalid.push(nctId);
    }
  });

  return { valid, invalid };
}

// ===== 2. STATISTICAL COMPUTATION =====

export function computeTrialStatistics(trials: ClinicalTrial[]) {
  const phaseDistribution: Record<string, number> = {};
  const statusDistribution: Record<string, number> = {};

  trials.forEach(trial => {
    // Phase distribution
    const phase = trial.phase || 'Unknown';
    phaseDistribution[phase] = (phaseDistribution[phase] || 0) + 1;

    // Status distribution
    const status = trial.status || 'Unknown';
    statusDistribution[status] = (statusDistribution[status] || 0) + 1;
  });

  return {
    totalTrials: trials.length,
    phaseDistribution,
    statusDistribution
  };
}

// ===== 3. LLM-BASED VERIFICATION (Intelligent Fact-Checking) =====

export async function llmBasedVerification(
  answerText: string,
  citations: string[],
  searchResults: ClinicalTrial[]
): Promise<SearchVerificationIssue[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    // Build source data summary for cited trials
    const citedTrialsData = citations
      .map(nctId => {
        const trial = searchResults.find(t => t.nctId === nctId);
        if (!trial) return null;
        return `${nctId}: ${trial.title}, Phase: ${trial.phase}, Status: ${trial.status}, Enrollment: ${trial.enrollment}, Sponsor: ${trial.sponsor}`;
      })
      .filter(Boolean)
      .join('\n');

    // Build statistics summary
    const stats = computeTrialStatistics(searchResults);
    const statsText = `Total trials in search results: ${stats.totalTrials}
Phase distribution: ${Object.entries(stats.phaseDistribution).map(([k, v]) => `${k}: ${v}`).join(', ')}
Status distribution: ${Object.entries(stats.statusDistribution).map(([k, v]) => `${k}: ${v}`).join(', ')}`;

    const prompt = `You are a fact-checking system for AI-generated clinical trial answers. Analyze the answer below and identify any factual errors, incorrect statistics, or mismatched data against the source trials.

**AI ANSWER TO VERIFY:**
${answerText}

**SOURCE TRIAL DATA:**
${citedTrialsData}

**AGGREGATE STATISTICS:**
${statsText}

**YOUR TASK:**
Carefully compare the AI answer against the source data. Identify specific factual errors including:
1. Fabricated NCT IDs (cited but not in source)
2. Incorrect enrollment numbers
3. Wrong phases
4. Mismatched statistics (trial counts, percentages)
5. Incorrect sponsor names
6. Any other factual inaccuracies

For each issue found, respond with a JSON array of objects with this structure:
{
  "severity": "critical" | "warning" | "info",
  "claim": "the exact text from the answer that's incorrect",
  "sourceData": "the correct data from source",
  "explanation": "brief explanation of the discrepancy",
  "field": "field name like 'enrollment', 'phase', 'citation', etc."
}

Return ONLY a valid JSON array. If no issues found, return [].

Examples:
- If answer says "enrolled 10,000" but actual is 5000: {"severity":"warning","claim":"enrolled 10,000","sourceData":"Actual: 5,000","explanation":"Enrollment number is incorrect","field":"enrollment"}
- If answer cites NCT99999999 but it's not in results: {"severity":"critical","claim":"NCT99999999","sourceData":"This trial does not exist in search results","explanation":"Fabricated citation","field":"citation"}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response
    console.log('🤖 LLM verification response:', responseText);

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const llmIssues = JSON.parse(jsonText);

    // Convert to SearchVerificationIssue format
    const issues: SearchVerificationIssue[] = llmIssues.map((issue: any, index: number) => {
      // Find the position of the claim in the text
      const startIndex = answerText.indexOf(issue.claim);
      const endIndex = startIndex >= 0 ? startIndex + issue.claim.length : -1;

      return {
        id: `llm-${issue.field}-${index}`,
        severity: issue.severity || 'warning',
        claim: issue.claim,
        sourceData: issue.sourceData,
        explanation: issue.explanation,
        field: issue.field,
        startIndex: startIndex >= 0 ? startIndex : undefined,
        endIndex: endIndex >= 0 ? endIndex : undefined
      };
    });

    console.log(`✓ LLM found ${issues.length} issues`);
    return issues;
  } catch (error) {
    console.error('❌ LLM verification failed:', error);
    return []; // Fail gracefully
  }
}

// ===== 4. NUMERIC CLAIM EXTRACTION (Legacy - for reference) =====

interface NumericClaim {
  fullMatch: string;
  number: number;
  context: string;
  position: number;
}

export function extractNumericClaims(text: string): NumericClaim[] {
  const claims: NumericClaim[] = [];

  // Patterns to match numeric claims
  const patterns = [
    /(\d+)\s+(?:of\s+)?(?:the\s+)?(\d+)\s+(?:trials?|studies)/gi,
    /(?:enrolled?|enrollment\s+of)\s+(\d+)\s+(?:patients?|participants?|subjects?)/gi,
    /(\d+)(?:%|percent)\s+(?:of|are|were)/gi,
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      claims.push({
        fullMatch: match[0],
        number: parseInt(match[1]),
        context: text.substring(Math.max(0, match.index - 50), Math.min(text.length, match.index + match[0].length + 50)),
        position: match.index
      });
    }
  });

  return claims;
}

// ===== 4. STATISTICAL CLAIM VERIFICATION =====

export function verifyStatisticalClaims(
  answerText: string,
  trials: ClinicalTrial[]
): SearchVerificationIssue[] {
  const issues: SearchVerificationIssue[] = [];
  const stats = computeTrialStatistics(trials);

  // Pattern: "X of Y trials are Phase Z" - more flexible
  const phasePattern = /(\d+)\s+(?:of\s+)?(?:the\s+)?(?:top\s+)?(\d+)\s+[^.]{0,50}?\s+(?:are|is|represent|include|classified)[^.]{0,30}?\s+Phase\s*(\d+)/gi;
  let match;

  while ((match = phasePattern.exec(answerText)) !== null) {
    const claimedCount = parseInt(match[1]);
    const totalMentioned = parseInt(match[2]);
    const phase = `PHASE${match[3]}`;

    const actualCount = stats.phaseDistribution[phase] || 0;

    if (claimedCount !== actualCount) {
      issues.push({
        id: `stat-phase-${match.index}`,
        severity: 'warning',
        claim: match[0],
        sourceData: `Actual: ${actualCount} of ${stats.totalTrials} trials are ${phase}`,
        explanation: `The answer claims ${claimedCount} trials are ${phase}, but the actual count is ${actualCount}.`,
        field: 'phase',
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }

  // Pattern: "X trials" (total count check) - allow for words in between
  const totalPattern = /(?:identified|found|returned|shows?|includes?)\s+(\d+)\s+(?:\w+\s+)?(?:\w+\s+)?(?:clinical\s+)?(?:trials?|studies?|results?)/gi;
  while ((match = totalPattern.exec(answerText)) !== null) {
    const claimedTotal = parseInt(match[1]);
    const actualTotal = stats.totalTrials;

    // Allow some tolerance for "top X" vs total
    if (Math.abs(claimedTotal - actualTotal) > 5) {
      issues.push({
        id: `stat-total-${match.index}`,
        severity: 'info',
        claim: match[0],
        sourceData: `Actual total: ${actualTotal} trials`,
        explanation: `The answer mentions ${claimedTotal} trials, but ${actualTotal} trials were found.`,
        field: 'totalCount',
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }

  // Pattern: "approximately X trials" or "about X trials"
  const approximatePattern = /(?:approximately|about|roughly|around)\s+(\d+)\s+(?:\w+\s+)?(?:trials?|studies?)/gi;
  while ((match = approximatePattern.exec(answerText)) !== null) {
    const claimedCount = parseInt(match[1]);

    // Check against actual counts with more tolerance
    if (claimedCount > stats.totalTrials * 1.5 || claimedCount < stats.totalTrials * 0.5) {
      issues.push({
        id: `stat-approx-${match.index}`,
        severity: 'info',
        claim: match[0],
        sourceData: `Actual total: ${stats.totalTrials} trials`,
        explanation: `The answer estimates ${claimedCount} trials, which differs significantly from ${stats.totalTrials} found.`,
        field: 'approximateCount',
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }

  return issues;
}

// ===== 5. FIELD-LEVEL VERIFICATION =====

export function verifyTrialFieldClaims(
  answerText: string,
  citations: string[],
  searchResults: ClinicalTrial[]
): SearchVerificationIssue[] {
  const issues: SearchVerificationIssue[] = [];
  const trialsById = new Map(searchResults.map(t => [t.nctId, t]));

  citations.forEach(nctId => {
    const trial = trialsById.get(nctId);
    if (!trial) return; // Already caught by citation validation

    // Find mentions of this NCT ID in the text - look for larger context
    const nctPattern = new RegExp(`(${nctId})[^.]{0,200}`, 'g');
    let match;

    while ((match = nctPattern.exec(answerText)) !== null) {
      const context = match[0];

      // Check enrollment claims - more flexible patterns
      const enrollmentPatterns = [
        /(?:enrolled?|enrollment\s+of|with\s+over|involving)\s+(\d+(?:,\d+)?)\s+(?:patients?|participants?|subjects?)/i,
        /(\d+(?:,\d+)?)\s+(?:patients?|participants?|subjects?)\s+(?:enrolled?|investigated?|studied?)/i
      ];

      for (const pattern of enrollmentPatterns) {
        const enrollmentMatch = context.match(pattern);
        if (enrollmentMatch) {
          const claimedEnrollment = parseInt(enrollmentMatch[1].replace(/,/g, ''));
          const actualEnrollment = trial.enrollment;

          // Allow 10% tolerance for rounding
          if (actualEnrollment && Math.abs(claimedEnrollment - actualEnrollment) > actualEnrollment * 0.1) {
            issues.push({
              id: `field-enrollment-${nctId}-${match.index}`,
              severity: 'warning',
              claim: `${nctId} enrolled ${claimedEnrollment.toLocaleString()} participants`,
              sourceData: `Actual enrollment: ${actualEnrollment.toLocaleString()}`,
              explanation: `The enrollment number for ${nctId} is incorrect.`,
              field: 'enrollment',
              trialId: nctId,
              startIndex: match.index,
              endIndex: match.index + match[0].length
            });
          }
          break; // Only check one enrollment pattern per mention
        }
      }

      // Check phase claims
      const phaseMatch = context.match(/(?:Phase\s+(\d+)|PHASE\s*(\d+))/i);
      if (phaseMatch) {
        const phaseNum = phaseMatch[1] || phaseMatch[2];
        const claimedPhase = `PHASE${phaseNum}`;
        const actualPhase = trial.phase;

        if (actualPhase && claimedPhase !== actualPhase) {
          issues.push({
            id: `field-phase-${nctId}-${match.index}`,
            severity: 'warning',
            claim: `${nctId} is Phase ${phaseNum}`,
            sourceData: `Actual phase: ${actualPhase}`,
            explanation: `The phase for ${nctId} is incorrect.`,
            field: 'phase',
            trialId: nctId,
            startIndex: match.index,
            endIndex: match.index + match[0].length
          });
        }
      }

      // Check sponsor claims
      const sponsorMatch = context.match(/(?:sponsored by|sponsor:|funding by)\s+([A-Z][^,\.]+)/i);
      if (sponsorMatch) {
        const claimedSponsor = sponsorMatch[1].trim();
        const actualSponsor = trial.sponsor;

        if (actualSponsor && !actualSponsor.toLowerCase().includes(claimedSponsor.toLowerCase())) {
          issues.push({
            id: `field-sponsor-${nctId}`,
            severity: 'info',
            claim: `${nctId} sponsored by ${claimedSponsor}`,
            sourceData: `Actual sponsor: ${actualSponsor}`,
            explanation: `The sponsor for ${nctId} may be incorrect or incomplete.`,
            field: 'sponsor',
            trialId: nctId,
            startIndex: match.index,
            endIndex: match.index + match[0].length
          });
        }
      }
    }
  });

  return issues;
}

// ===== 6. COMPREHENSIVE FACT-CHECKING =====

export async function factCheckAnswer(
  answerText: string,
  citations: string[],
  searchResults: ClinicalTrial[]
): Promise<VerificationResult> {
  console.log('🔍 Starting fact-check verification...');
  console.log(`📊 Checking ${citations.length} citations against ${searchResults.length} trials`);

  const issues: SearchVerificationIssue[] = [];

  // 1. Validate citations
  const { valid, invalid } = validateCitations(citations, searchResults);
  console.log(`✓ Citations: ${valid.length} valid, ${invalid.length} invalid`);

  // Add critical issues for invalid citations
  invalid.forEach(nctId => {
    const index = answerText.indexOf(nctId);
    issues.push({
      id: `citation-invalid-${nctId}`,
      severity: 'critical',
      claim: nctId,
      sourceData: 'This NCT ID does not exist in search results',
      explanation: `The trial ${nctId} was cited but is not in the search results. This may be a fabricated or incorrect citation.`,
      field: 'citation',
      trialId: nctId,
      startIndex: index,
      endIndex: index + nctId.length
    });
  });

  // 2. LLM-based intelligent verification
  console.log('🤖 Running LLM-based fact verification...');
  const llmIssues = await llmBasedVerification(answerText, valid, searchResults);
  console.log(`✓ LLM found ${llmIssues.length} issues`);
  issues.push(...llmIssues);

  // 3. Compute statistics
  const stats = computeTrialStatistics(searchResults);

  return {
    issues: issues.sort((a, b) => {
      // Sort by severity: critical > warning > info
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    validCitations: valid,
    invalidCitations: invalid,
    statisticalChecks: {
      ...stats,
      claimsVerified: llmIssues.length,
      claimsFailed: issues.length
    },
    verifiedAt: Date.now()
  };
}
