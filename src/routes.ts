import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from './db.js';
import { runEvaluation } from './evaluator/index.js';
import { wsManager } from './ws-manager.js';
import { Address } from 'viem';

/**
 * A2A Market API v1 - Route Definitions
 * Updated to use FastifyPluginAsyncZod for reliable type safety.
 */

// --- Zod Schemas ---

const JobSchema = z.object({
  schema_version: z.literal("2.1.0"),
  job_id: z.string().optional(),
  erc8183_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  job_type: z.enum(["coding", "research", "data_transform"]),
  title: z.string().max(120),
  description: z.string().max(1000).optional(),
  agent_skill_requirements: z.array(z.string()).optional(),
  input_schema: z.any(),
  output_schema: z.any(),
  example_input: z.any().optional(),
  constraints: z.any().optional(),
  execution_environment: z.object({
    runtime: z.enum(["python3.11", "python3.12", "nodejs20", "none", "docker"]),
    memory_mb: z.number().min(128).optional(),
    timeout_seconds: z.number().min(10).optional()
  }),
  budget_usdc: z.number().min(0.01),
  evaluator_type: z.enum(["coding-judge", "research-judge", "data-judge", "custom"]),
  evaluation_criteria: z.string().optional(),
  deliverable_format: z.enum(["ipfs_cid", "arweave_tx", "direct_json"]).default("ipfs_cid"),
  expired_at: z.string().datetime(),
  client_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  min_provider_reputation: z.number().min(0).max(100).optional(),
  metadata: z.any().optional()
});

const TakeSchema = z.object({
  provider_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().optional()
});

const BidSchema = z.object({
  bid_amount: z.number().min(0.01),
  proposal_cid: z.string().optional(),
  eta_seconds: z.number().positive(),
  provider_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

const SubmitSchema = z.object({
  deliverable_cid: z.string(),
  metadata: z.any().optional(),
  worker_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

// --- API Routes ---

const a2aRoutes: FastifyPluginAsyncZod = async (fastify, options) => {
  
  fastify.get('/jobs', {
    schema: {
      querystring: z.object({
        type: z.enum(["coding", "research", "data_transform"]).optional(),
        min_budget: z.coerce.number().optional(),
        skills: z.string().optional(),
        status: z.enum(['open', 'active', 'completed']).default('open')
      })
    }
  }, async (request, reply) => {
    const filters = request.query;
    const jobs = db.listOpenJobs({
      type: filters.type,
      min_budget: filters.min_budget
    });
    return { jobs };
  });

  fastify.get('/jobs/:id', async (request, reply) => {
    const { id } = (request.params as any);
    const job = db.getJob(id);
    if (!job) return reply.status(404).send({ error: "Job not found" });
    return { job };
  });

  fastify.post('/jobs', {
    schema: { body: JobSchema }
  }, async (request, reply) => {
    // 1. Save Off-Chain Metadata as 'pending_onchain'
    const jobRecord = db.createJob({
        ...request.body,
        status: 'pending_onchain'
    });
    
    // 2. Return instructions for the Agent Client
    return reply.status(201).send({ 
      status: "metadata_registered", 
      job_id: jobRecord.job_id,
      instructions: {
        action: "createJobOnChain",
        contract: "0x0747EEf0706327138c69792bF28Cd525089e4583",
        params: {
            provider: request.body.client_address || "0x0000000000000000000000000000000000000000",
            evaluator: "0x0747EEf0706327138c69792bF28Cd525089e4583", // The platform or specific evaluator
            expiredAt: Math.floor(new Date(request.body.expired_at).getTime() / 1000),
            description: jobRecord.job_id // Critical for linking!
        }
      }
    });
  });

  fastify.post('/jobs/:id/take', {
    schema: { body: TakeSchema }
  }, async (request, reply) => {
    const { id } = (request.params as any);
    const success = db.updateStatus(id, 'active', request.body.provider_address);
    if (!success) return reply.status(404).send({ error: "Job not found or already taken" });
    return { status: "accepted", job_id: id };
  });

  fastify.post('/jobs/:id/bid', {
    schema: { body: BidSchema }
  }, async (request, reply) => {
    return { status: "bid_recorded" };
  });

  fastify.post('/jobs/:id/submit', {
    schema: { body: SubmitSchema }
  }, async (request, reply) => {
    const { id } = (request.params as any);
    const job = db.getJob(id);
    if (!job) return reply.status(404).send({ error: "Job not found" });

    // Store deliverable metadata off-chain, status remains 'active' or 'pending_onchain_submit'
    // The actual evaluation triggers when the JobSubmitted event is detected on-chain.
    db.storeDeliverable(id, request.body);

    return { 
        status: "metadata_received", 
        message: "Now call submitDeliverable on-chain to trigger evaluation",
        onchain_params: {
            jobId: job.erc8183_id,
            deliverableHash: "keccak256(deliverable_cid)"
        }
    };
  });

  fastify.post('/jobs/:id/evaluate', {
    onRequest: [async (request, reply) => {
        const internalToken = request.headers['x-internal-evaluator-key'];
        if (!internalToken || internalToken !== process.env.INTERNAL_EVALUATOR_KEY) {
            return reply.status(403).send({ error: "Unauthorized evaluator" });
        }
    }]
  }, async (request, reply) => {
    return { status: "evaluation_complete", result: "success" };
  });
};

export default a2aRoutes;
