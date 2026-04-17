import { db } from '../src/db.js';
import { runEvaluation } from '../src/evaluator/index.js';
import { wsManager } from '../src/ws-manager.js';
import { completeJob, rejectJob } from '../src/blockchain/erc8183.js';

/**
 * A2A Market - Real Flow Simulation (Virtual On-Chain)
 * This script bypasses the need for actual funds by manually injecting 
 * blockchain events into the system, triggering the real Gemini Evaluator.
 */

async function runSimulation() {
  console.log('🚀 Starting A2A Market Virtual Real Flow Simulation...');
  console.log('-------------------------------------------------------');

  // 1. Client: Register Metadata
  console.log('\n[1/5] Workly-Client: Registering metadata via API...');
  const jobMetadata = {
    job_id: "workly-job-" + Math.random().toString(36).substring(7),
    job_type: "coding",
    title: "Secure Auth Module",
    description: "Build a Node.js module that validates JWTs using RSA256. Must include unit tests.",
    input_schema: { type: "object" },
    output_schema: { type: "object" },
    budget_usdc: 15.0,
    evaluator_type: "coding-judge",
    expired_at: new Date(Date.now() + 86400000).toISOString()
  };

  const jobRecord = db.createJob({ ...jobMetadata, status: 'pending_onchain' });
  console.log(`✅ Metadata registered. Internal ID: ${jobRecord.job_id}`);

  // 2. Blockchain: Simulate JobCreated Event
  console.log('\n[2/5] Blockchain: Detecting JobCreated event (Simulated)...');
  const onChainJobId = "88"; 
  // Manually link as the listener would do
  jobRecord.erc8183_id = onChainJobId;
  db.updateStatus(jobRecord.job_id, 'open');
  console.log(`🔗 Linked On-Chain ID ${onChainJobId} to UUID ${jobRecord.job_id}`);
  wsManager.notifyNewJob(jobRecord.data);

  // 3. Provider: Submit Deliverable via API
  console.log('\n[3/5] Workly-Provider: Submitting deliverable metadata...');
  const deliverable = {
    deliverable_cid: "ipfs://QmWorklyDeliverable_RSA256",
    worker_address: "0xAgentProvider",
    metadata: {
        code: "const jwt = require('jsonwebtoken'); const publicKey = '...'; function verify(token) { return jwt.verify(token, publicKey, { algorithms: ['RS256'] }); }",
        tests: "npm test passed (100% coverage)"
    }
  };
  db.storeDeliverable(jobRecord.job_id, deliverable);
  console.log('✅ Deliverable metadata stored in backend.');

  // 4. Blockchain: Simulate JobSubmitted Event
  console.log('\n[4/5] Blockchain: Detecting JobSubmitted event (Simulated)...');
  console.log(`[System] Triggering Gemini 2.0 Flash for Job ${onChainJobId}...`);
  
  db.updateStatus(jobRecord.job_id, 'pending_evaluation');
  wsManager.notifyJobSubmitted(jobRecord.job_id, deliverable);

  // 5. Evaluation & Settlement
  try {
    const result = await runEvaluation(jobRecord, deliverable);
    
    console.log('\n[5/5] --- Gemini Evaluation Result ---');
    console.log(`Decision: ${result.decision.toUpperCase()}`);
    console.log(`Score: ${result.score}/100`);
    console.log(`Reasoning: ${result.explanation}`);
    console.log('---------------------------------------');

    const finalStatus = result.decision === 'approved' ? 'completed' : 'failed';
    db.updateStatus(jobRecord.job_id, finalStatus);

    // Simulate on-chain settlement
    const evaluatorKey = process.env.EVALUATOR_PRIVATE_KEY || '0x_MOCK_KEY';
    console.log(`\n[Settlement] Calling ${result.decision === 'approved' ? 'completeJob' : 'rejectJob'} on Arc Testnet...`);
    console.log(`✅ Job ${onChainJobId} settled on-chain. Funds ${result.decision === 'approved' ? 'released to Provider' : 'returned to Client'}.`);

    wsManager.notifyJobEvaluated(jobRecord.job_id, result);

  } catch (err: any) {
    console.error('❌ Simulation Error:', err.message);
  }

  console.log('\n✨ Simulation finished successfully.');
}

runSimulation();
