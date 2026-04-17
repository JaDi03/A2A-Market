import { EvaluationResult, Deliverable } from '../types.js';
import { CODING_JUDGE_PROMPT } from '../prompts.js';
import { callGemini } from '../gemini.js';

/**
 * Real Coding Judge using Gemini 2.0 Flash.
 */
export async function evaluateCodingJob(job: any, deliverable: Deliverable): Promise<EvaluationResult> {
  console.log(`[CodingJudge] Evaluating deliverable ${deliverable.deliverable_cid} with Gemini...`);
  
  const result = await callGemini(CODING_JUDGE_PROMPT, { job, deliverable });
  
  return {
    decision: result.decision as 'approved' | 'rejected',
    score: result.score,
    reason: result.reason,
    explanation: result.explanation,
    confidence: result.confidence
  };
}
