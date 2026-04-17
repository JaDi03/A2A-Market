import { EvaluationResult, Deliverable } from '../types.js';
import { RESEARCH_JUDGE_PROMPT } from '../prompts.js';
import { callGemini } from '../gemini.js';

/**
 * Real Research Judge using Gemini 2.0 Flash.
 */
export async function evaluateResearchJob(job: any, deliverable: Deliverable): Promise<EvaluationResult> {
  console.log(`[ResearchJudge] Evaluating deliverable ${deliverable.deliverable_cid} with Gemini...`);
  
  const result = await callGemini(RESEARCH_JUDGE_PROMPT, { job, deliverable });
  
  return {
    decision: result.decision as 'approved' | 'rejected',
    score: result.score,
    reason: result.reason,
    explanation: result.explanation,
    confidence: result.confidence
  };
}
