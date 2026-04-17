import { WebSocket } from 'ws';

/**
 * E2E Test Script with WebSocket Monitoring
 * Simulates: Publish -> Discover -> Take -> Submit -> [Evaluation] -> WS Notification
 */

const BASE_URL = 'http://localhost:3000/v1';
const WS_URL = 'ws://localhost:3000/v1/events';

async function runE2ETest() {
  console.log('--- Starting A2A Market E2E Evaluation Test ---');

  // 1. Connect to WebSocket
  const ws = new WebSocket(WS_URL);
  
  const waitForEvent = (topicPattern: string) => new Promise((resolve) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.topic && msg.topic.includes(topicPattern)) {
        console.log(`[WS Event Received] Topic: ${msg.topic}`, msg.data);
        resolve(msg);
      }
    });
  });

  ws.on('open', () => console.log('[WS] Connected to events stream'));

  // 2. Client: Publish Job
  console.log('\n[Client] Publishing Coding Job...');
  const jobPayload = {
    schema_version: "2.1.0",
    job_type: "coding",
    title: "Refactor API logic",
    input_schema: { type: "object" },
    output_schema: { type: "object" },
    execution_environment: { runtime: "nodejs20" },
    budget_usdc: 100.00,
    evaluator_type: "coding-judge",
    expired_at: new Date(Date.now() + 100000).toISOString()
  };

  const publishRes = await fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jobPayload)
  });
  
  const resData = await publishRes.json() as any;
  if (resData.error) {
    console.error('[Client] Job Creation Failed:', resData);
    process.exit(1);
  }
  
  const { job_id } = resData;
  console.log(`[Client] Job Created: ${job_id}`);

  // 3. Provider: Take and Submit
  const providerAddress = "0x1234567890123456789012345678901234567890";

  console.log(`\n[Provider] Taking job ${job_id}...`);
  await fetch(`${BASE_URL}/jobs/${job_id}/take`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider_address: providerAddress })
  });

  console.log(`[Provider] Submitting deliverable...`);
  await fetch(`${BASE_URL}/jobs/${job_id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deliverable_cid: "ipfs://QmEvaluationTest...",
      worker_address: providerAddress,
      metadata: { lines_of_code: 150 }
    })
  });

  // 4. Wait for Evaluation Notification via WS
  console.log(`\n[Test] Waiting for evaluation result for job ${job_id}...`);
  const evaluationEvent: any = await waitForEvent(`.evaluated`);
  
  console.log('\n--- E2E Test Analysis ---');
  console.log(`Job ID: ${job_id}`);
  console.log(`Decision: ${evaluationEvent.data.decision.toUpperCase()}`);
  console.log(`Score: ${evaluationEvent.data.score}/100`);
  console.log(`Reason: ${evaluationEvent.data.reason}`);

  ws.close();
  console.log('\n--- Test Completed Successfully ---');
  // Wait a bit to ensure logs are flushed
  await new Promise(r => setTimeout(r, 1000));
  process.exit(0);
}

runE2ETest().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
