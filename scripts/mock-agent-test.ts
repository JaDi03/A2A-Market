/**
 * Mock Agent Test Script
 * Simulates the end-to-end lifecycle of a job in A2A Market.
 */

const BASE_URL = 'http://localhost:3000/v1';

async function runTest() {
  console.log('--- Starting A2A Market Flow Test ---');

  // 1. Client Agent: Publish a Job
  console.log('\n[Client] Publishing a new coding job...');
  const newJob = {
    schema_version: "2.1.0",
    job_type: "coding",
    title: "Simple Data Scraper",
    description: "Build a scraper for a specific JSON endpoint",
    input_schema: { type: "object", properties: { url: { type: "string" } } },
    output_schema: { type: "object", properties: { data: { type: "object" } } },
    execution_environment: { runtime: "nodejs20", memory_mb: 512, timeout_seconds: 60 },
    budget_usdc: 50.00,
    evaluator_type: "coding-judge",
    expired_at: new Date(Date.now() + 86400000).toISOString(),
    deliverable_format: "direct_json"
  };

  const publishRes = await fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newJob)
  });
  
  const publishData = await publishRes.json();
  console.log('[Client] Job Published:', publishData);
  const jobId = publishData.job_id;

  // 2. Provider Agent: Discover Jobs
  console.log('\n[Provider] Searching for open coding jobs...');
  const listRes = await fetch(`${BASE_URL}/jobs?type=coding`);
  const listData = await listRes.json();
  console.log(`[Provider] Found ${listData.jobs.length} jobs.`);

  // 3. Provider Agent: Take the Job (Simplified v1 flow)
  console.log(`\n[Provider] Taking job ${jobId}...`);
  const takeRes = await fetch(`${BASE_URL}/jobs/${jobId}/take`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider_address: "0x1234567890123456789012345678901234567890"
    })
  });
  const takeData = await takeRes.json();
  console.log('[Provider] Result:', takeData);

  // 4. Provider Agent: Submit the Result
  console.log(`\n[Provider] Submitting work for job ${jobId}...`);
  const submitRes = await fetch(`${BASE_URL}/jobs/${jobId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deliverable_cid: "ipfs://QmYourResultCID...",
      worker_address: "0x1234567890123456789012345678901234567890",
      metadata: { performance: "0.5s", accuracy: "100%" }
    })
  });
  const submitData = await submitRes.json();
  console.log('[Provider] Submission Result:', submitData);

  console.log('\n--- Test Completed Successfully ---');
}

runTest().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
