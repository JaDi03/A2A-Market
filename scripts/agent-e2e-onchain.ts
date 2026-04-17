import { WebSocket } from 'ws';
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    keccak256, 
    toHex, 
    decodeEventLog,
    Address 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet, CONTRACTS } from '../src/config/blockchain.js';
import { agenticCommerceAbi } from '../src/blockchain/erc8183.js';

/**
 * E2E On-Chain Test Script (Agent-Direct Model + Gemini)
 * Simulates Workly Agent interacting directly with Arc Testnet and A2A Market.
 */

const BASE_URL = 'http://localhost:3000/v1';
const WS_URL = 'ws://localhost:3000/v1/events';

const CLIENT_KEY = process.env.TEST_CLIENT_KEY;
const PROVIDER_KEY = process.env.TEST_PROVIDER_KEY;

if (!CLIENT_KEY || !PROVIDER_KEY) {
  console.error('❌ Error: TEST_CLIENT_KEY and TEST_PROVIDER_KEY must be set.');
  process.exit(1);
}

const clientAccount = privateKeyToAccount(CLIENT_KEY as `0x${string}`);
const providerAccount = privateKeyToAccount(PROVIDER_KEY as `0x${string}`);

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
const clientWallet = createWalletClient({ account: clientAccount, chain: arcTestnet, transport: http() });
const providerWallet = createWalletClient({ account: providerAccount, chain: arcTestnet, transport: http() });

async function runDirectE2E() {
  console.log('--- Starting A2A Market Agent-Direct E2E Test (Gemini Powered) ---');

  const ws = new WebSocket(WS_URL);
  ws.on('open', () => console.log('[WS] Monitoring events...'));

  const waitForEvent = (topicPattern: string) => new Promise((resolve) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.topic && msg.topic.includes(topicPattern)) {
        console.log(`[WS Event] ${msg.topic}`, msg.data);
        resolve(msg);
      }
    });
  });

  // 1. Register Metadata
  console.log('\n[Workly-Client] Registering job metadata...');
  const publishRes = await fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schema_version: "2.1.0",
      job_type: "coding",
      title: "Workly Demo: API Refactor",
      description: "Refactor the existing user authentication logic to use JWT instead of sessions.",
      input_schema: { type: "object", properties: { auth_code: { type: "string" } } },
      output_schema: { type: "object", properties: { jwt_token: { type: "string" } } },
      execution_environment: { runtime: "nodejs20" },
      budget_usdc: 1.00,
      evaluator_type: "coding-judge",
      expired_at: new Date(Date.now() + 3600000).toISOString()
    })
  });

  const { job_id, instructions } = await publishRes.json() as any;
  console.log(`[Workly-Client] Metadata Registered. Internal ID: ${job_id}`);

  // 2. Workly-Client: Create Job On-Chain
  console.log('\n[Workly-Client] Calling createJob on-chain directly...');
  const createHash = await clientWallet.writeContract({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    functionName: 'createJob',
    args: [
        instructions.params.provider,
        instructions.params.evaluator,
        BigInt(instructions.params.expiredAt),
        instructions.params.description, // UUID
        '0x0000000000000000000000000000000000000000'
    ]
  });
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
  let onChainJobId: bigint | undefined;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: agenticCommerceAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === 'JobCreated') {
        onChainJobId = decoded.args.jobId;
        break;
      }
    } catch { continue; }
  }
  console.log(`[Workly-Client] Job created on-chain. ID: ${onChainJobId}`);

  // 3. Workly-Provider: Submit Metadata + On-Chain Submit
  console.log(`\n[Workly-Provider] Posting deliverable metadata to server...`);
  const deliverableData = {
    deliverable_cid: "ipfs://QmWorklyDeliverable_JWT_Refactor",
    worker_address: providerAccount.address,
    metadata: {
        code: "const jwt = require('jsonwebtoken'); function login(code) { return jwt.sign({ code }, 'secret'); }",
        tests: "passed"
    }
  };
  await fetch(`${BASE_URL}/jobs/${job_id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deliverableData)
  });

  console.log('\n[Workly-Provider] Calling submit on-chain directly...');
  const submitHash = await providerWallet.writeContract({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    functionName: 'submit',
    args: [onChainJobId!, keccak256(toHex(deliverableData.deliverable_cid)), '0x']
  });
  console.log(`[Workly-Provider] Deliverable submitted on-chain. TX: ${submitHash}`);

  // 4. Wait for Gemini Evaluation
  console.log('\n[Test] Waiting for Gemini evaluation and on-chain settlement...');
  const evaluatedEvent: any = await waitForEvent('.evaluated');

  console.log('\n--- Gemini Evaluation Analysis ---');
  console.log(`Decision: ${evaluatedEvent.data.decision.toUpperCase()}`);
  console.log(`Score: ${evaluatedEvent.data.score}/100`);
  console.log(`Reasoning: ${evaluatedEvent.data.explanation}`);
  
  ws.close();
  process.exit(0);
}

runDirectE2E().catch(console.error);
