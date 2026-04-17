import { publicClient, CONTRACTS } from '../config/blockchain.js';
import { agenticCommerceAbi } from './erc8183.js';
import { db } from '../db.js';
import { wsManager } from '../ws-manager.js';
import { formatUnits } from 'viem';
import { runEvaluation } from '../evaluator/index.js';
import { completeJob, rejectJob } from './erc8183.js';

/**
 * Global Blockchain Event Listeners.
 * Sychronizes on-chain state with internal DB and notifies agents via WS.
 */
export function setupBlockchainListeners() {
  console.log('[Blockchain] Setting up event listeners on Arc Testnet...');

  // 1. Listen for JobCreated
  publicClient.watchContractEvent({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    eventName: 'JobCreated',
    onLogs: (logs) => {
      logs.forEach(async (log) => {
        const { jobId } = log.args;
        
        // Fetch full job details to get the 'description' (which contains our UUID)
        try {
            const onChainJob = await publicClient.readContract({
                address: CONTRACTS.AGENTIC_COMMERCE,
                abi: agenticCommerceAbi,
                functionName: 'getJob',
                args: [jobId!],
            });
            
            const uuid = onChainJob.description;
            console.log(`[Event] JobCreated: ${jobId} (UUID Linked: ${uuid})`);
            
            const job = db.getJob(uuid);
            if (job) {
                job.erc8183_id = jobId!.toString();
                db.updateStatus(job.job_id, 'open');
                wsManager.notifyNewJob(job.data);
            }
        } catch (err) {
            console.error(`[Event Error] Failed to fetch job details for ${jobId}:`, err);
        }
      });
    }
  });

  // 2. Listen for JobFunded
  publicClient.watchContractEvent({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    eventName: 'JobFunded',
    onLogs: (logs) => {
      logs.forEach(log => {
        const { jobId, amount } = log.args;
        console.log(`[Event] JobFunded: ${jobId} (Amount: ${formatUnits(amount!, 6)} USDC)`);
        // Update DB
        const internalJob = db.getJobByChainId(jobId!.toString());
        if (internalJob) {
          db.updateStatus(internalJob.job_id, 'open'); // Transition to open/active
          wsManager.broadcast(`jobs.${internalJob.job_id}.funded`, { jobId: jobId!.toString(), amount: formatUnits(amount!, 6) });
        }
      });
    }
  });

  // 3. Listen for JobSubmitted
  publicClient.watchContractEvent({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    eventName: 'JobSubmitted',
    onLogs: (logs) => {
      logs.forEach(log => {
        const { jobId, deliverable: deliverableHash } = log.args;
        console.log(`[Event] JobSubmitted: ${jobId} (Hash: ${deliverableHash})`);
        
        const internalJob = db.getJobByChainId(jobId!.toString());
        if (internalJob && internalJob.deliverable) {
            console.log(`[Evaluator] Triggering auto-evaluation for Job ${jobId}...`);
            db.updateStatus(internalJob.job_id, 'pending_evaluation');
            
            runEvaluation(internalJob, internalJob.deliverable).then(async (result) => {
                const finalStatus = result.decision === 'approved' ? 'completed' : 'failed';
                db.updateStatus(internalJob.job_id, finalStatus);
                
                // On-Chain Settle
                const evaluatorKey = process.env.EVALUATOR_PRIVATE_KEY;
                if (evaluatorKey) {
                    try {
                        if (result.decision === 'approved') {
                            await completeJob(evaluatorKey, jobId!, result.reason);
                        } else {
                            await rejectJob(evaluatorKey, jobId!, result.reason);
                        }
                        console.log(`[Blockchain] Job ${jobId} settled on-chain: ${result.decision}`);
                    } catch (err) {
                        console.error('[Blockchain Error] Settlement failed:', err);
                    }
                }
                wsManager.notifyJobEvaluated(internalJob.job_id, result);
            });
        }
      });
    }
  });

  // 4. Listen for JobCompleted
  publicClient.watchContractEvent({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    eventName: 'JobCompleted',
    onLogs: (logs) => {
      logs.forEach(log => {
        const { jobId } = log.args;
        console.log(`[Event] JobCompleted: ${jobId}`);
        const internalJob = db.getJobByChainId(jobId!.toString());
        if (internalJob) {
          db.updateStatus(internalJob.job_id, 'completed');
          wsManager.broadcast(`jobs.${internalJob.job_id}.completed`, { jobId: jobId!.toString() });
        }
      });
    }
  });

  // 5. Listen for JobRejected
  publicClient.watchContractEvent({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    eventName: 'JobRejected',
    onLogs: (logs) => {
      logs.forEach(log => {
        const { jobId } = log.args;
        console.log(`[Event] JobRejected: ${jobId}`);
        const internalJob = db.getJobByChainId(jobId!.toString());
        if (internalJob) {
          db.updateStatus(internalJob.job_id, 'failed');
          wsManager.broadcast(`jobs.${internalJob.job_id}.rejected`, { jobId: jobId!.toString() });
        }
      });
    }
  });
}
