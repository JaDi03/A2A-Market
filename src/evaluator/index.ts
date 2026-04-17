import { EvaluationResult, Deliverable } from './types.js';
import { evaluateCodingJob } from './judges/coding-judge.js';
import { evaluateResearchJob } from './judges/research-judge.js';
import { evaluateDataJob } from './judges/data-judge.js';

/**
 * Main Evaluator Orchestrator.
 * Selects the appropriate judge based on the job type and returns the result.
 */
export async function runEvaluation(job: any, deliverable: Deliverable): Promise<EvaluationResult> {
  const jobType = job.job_type || job.data?.job_type;
  const evaluatorType = job.evaluator_type || job.data?.evaluator_type;

  console.log(`[Evaluator] Starting evaluation for Job ${job.job_id} (${jobType}) using ${evaluatorType}`);

  switch (evaluatorType) {
    case 'coding-judge':
      return await evaluateCodingJob(job, deliverable);
    
    case 'research-judge':
      return await evaluateResearchJob(job, deliverable);
    
    case 'data-judge':
      return await evaluateDataJob(job, deliverable);
    
    case 'custom':
      // Default to data judge or a generic implementation for custom
      return await evaluateDataJob(job, deliverable);

    default:
      console.warn(`[Evaluator] Unknown evaluator type: ${evaluatorType}. Falling back to default.`);
      return await evaluateDataJob(job, deliverable);
  }
}
