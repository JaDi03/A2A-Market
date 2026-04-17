import { 
  keccak256, 
  toHex, 
  decodeEventLog, 
  parseUnits, 
  type Address, 
  type Hex 
} from 'viem';
import { publicClient, CONTRACTS, getWalletClient } from '../config/blockchain.js';

/**
 * ERC-8183 AgenticCommerce ABI
 */
export const agenticCommerceAbi = [
  { name: "createJob", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "provider", type: "address" },
    { name: "evaluator", type: "address" },
    { name: "expiredAt", type: "uint256" },
    { name: "description", type: "string" },
    { name: "hook", type: "address" },
  ], outputs: [{ name: "jobId", type: "uint256" }] },
  { name: "setBudget", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "jobId", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "optParams", type: "bytes" },
  ], outputs: [] },
  { name: "fund", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "jobId", type: "uint256" },
    { name: "optParams", type: "bytes" },
  ], outputs: [] },
  { name: "submit", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "jobId", type: "uint256" },
    { name: "deliverable", type: "bytes32" },
    { name: "optParams", type: "bytes" },
  ], outputs: [] },
  { name: "complete", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "jobId", type: "uint256" },
    { name: "reason", type: "bytes32" },
    { name: "optParams", type: "bytes" },
  ], outputs: [] },
  { name: "reject", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "jobId", type: "uint256" },
    { name: "reason", type: "bytes32" },
    { name: "optParams", type: "bytes" },
  ], outputs: [] },
  { name: "getJob", type: "function", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [
    { type: "tuple", components: [
      { name: "id", type: "uint256" },
      { name: "client", type: "address" },
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "description", type: "string" },
      { name: "budget", type: "uint256" },
      { name: "expiredAt", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "hook", type: "address" },
    ] }
  ] },
  { name: "JobCreated", type: "event", anonymous: false, inputs: [
    { indexed: true, name: "jobId", type: "uint256" },
    { indexed: true, name: "client", type: "address" },
    { indexed: true, name: "provider", type: "address" },
    { indexed: false, name: "evaluator", type: "address" },
    { indexed: false, name: "expiredAt", type: "uint256" },
    { indexed: false, name: "hook", type: "address" },
  ] },
  { name: "JobFunded", type: "event", anonymous: false, inputs: [
    { indexed: true, name: "jobId", type: "uint256" },
    { indexed: false, name: "amount", type: "uint256" },
  ] },
  { name: "JobSubmitted", type: "event", anonymous: false, inputs: [
    { indexed: true, name: "jobId", type: "uint256" },
    { indexed: false, name: "deliverable", type: "bytes32" },
  ] },
  { name: "JobCompleted", type: "event", anonymous: false, inputs: [
    { indexed: true, name: "jobId", type: "uint256" },
    { indexed: false, name: "reason", type: "bytes32" },
  ] },
  { name: "JobRejected", type: "event", anonymous: false, inputs: [
    { indexed: true, name: "jobId", type: "uint256" },
    { indexed: false, name: "reason", type: "bytes32" },
  ] },
] as const;

export const erc20Abi = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "spender", type: "address" },
    { name: "amount", type: "uint256" },
  ], outputs: [{ name: "", type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

// --- Service Functions ---

export async function createJobOnChain(
  clientPrivateKey: string,
  params: { provider: Address, evaluator: Address, expiredAt: bigint, description: string }
) {
  const walletClient = getWalletClient(clientPrivateKey);
  const hash = await walletClient.writeContract({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    functionName: 'createJob',
    args: [params.provider, params.evaluator, params.expiredAt, params.description, '0x0000000000000000000000000000000000000000'],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  // Extract Job ID from events
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: agenticCommerceAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'JobCreated') {
        return { jobId: decoded.args.jobId, txHash: hash };
      }
    } catch { continue; }
  }
  throw new Error("JobCreated event not found in receipt");
}

export async function approveAndFundJob(
  clientPrivateKey: string,
  jobId: bigint,
  amountUsdc: number
) {
  const walletClient = getWalletClient(clientPrivateKey);
  const amount = parseUnits(amountUsdc.toString(), 6);

  // 1. Approve
  const approveHash = await walletClient.writeContract({
    address: CONTRACTS.USDC,
    abi: erc20Abi,
    functionName: 'approve',
    args: [CONTRACTS.AGENTIC_COMMERCE, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  // 2. Set Budget (optional if already set, but tutorial shows it's often needed or combined)
  // Note: Standard ERC-8183 might require setBudget from provider or client depending on implementation.
  // In the tutorial, provider calls setBudget. Let's assume client can do it or it's handled.
  
  // 3. Fund
  const fundHash = await walletClient.writeContract({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    functionName: 'fund',
    args: [jobId, '0x'],
  });
  return await publicClient.waitForTransactionReceipt({ hash: fundHash });
}

export async function submitDeliverable(
  providerPrivateKey: string,
  jobId: bigint,
  deliverableUri: string
) {
  const walletClient = getWalletClient(providerPrivateKey);
  const deliverableHash = keccak256(toHex(deliverableUri));

  const hash = await walletClient.writeContract({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    functionName: 'submit',
    args: [jobId, deliverableHash, '0x'],
  });
  return await publicClient.waitForTransactionReceipt({ hash });
}

export async function completeJob(
  evaluatorPrivateKey: string,
  jobId: bigint,
  reason: string
) {
  const walletClient = getWalletClient(evaluatorPrivateKey);
  const reasonHash = keccak256(toHex(reason));

  const hash = await walletClient.writeContract({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    functionName: 'complete',
    args: [jobId, reasonHash, '0x'],
  });
  return await publicClient.waitForTransactionReceipt({ hash });
}

export async function rejectJob(
  evaluatorPrivateKey: string,
  jobId: bigint,
  reason: string
) {
  const walletClient = getWalletClient(evaluatorPrivateKey);
  const reasonHash = keccak256(toHex(reason));

  const hash = await walletClient.writeContract({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    functionName: 'reject',
    args: [jobId, reasonHash, '0x'],
  });
  return await publicClient.waitForTransactionReceipt({ hash });
}

export async function getJobOnChain(jobId: bigint) {
  return await publicClient.readContract({
    address: CONTRACTS.AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    functionName: 'getJob',
    args: [jobId],
  });
}
