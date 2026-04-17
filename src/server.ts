import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import a2aRoutes from './routes.js';
import { setupBlockchainListeners } from './blockchain/listeners.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const fastify = Fastify({
  logger: true,
}).withTypeProvider<ZodTypeProvider>();

// Setup blockchain listeners
setupBlockchainListeners();

// --- Plugins & Configuration ---

fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

await fastify.register(cors, { origin: true });
await fastify.register(websocket);

// Serve well-known manifest
fastify.register(fastifyStatic, {
  root: path.join(rootDir, '.well-known'),
  prefix: '/.well-known/',
  decorateReply: true // Fixed: Now reply.sendFile will work!
});

// Serve skills directory
fastify.register(fastifyStatic, {
  root: path.join(rootDir, 'skills'),
  prefix: '/skills/',
  decorateReply: false
});

// Serve schemas directory
fastify.register(fastifyStatic, {
  root: path.join(rootDir, 'schemas'),
  prefix: '/v1/schemas/',
  decorateReply: false
});

// Explicit route for the job schema (infallible)
fastify.get('/v1/schemas/job-schema.json', async (request, reply) => {
  return reply.sendFile('job-schema.json', path.join(rootDir, 'schemas'));
});

// --- Dynamic Discovery Manifests ---

const getBaseUrl = (request: any) => {
  const host = request.hostname;
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const protocol = isLocal ? 'http' : 'https'; // Force https for production
  return `${protocol}://${host}`;
};

fastify.get('/.well-known/agent-jobs.json', async (request, reply) => {
  const baseUrl = getBaseUrl(request);
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const host = request.hostname;

  return {
    name: "A2A Market",
    description: "Agent-to-Agent Marketplace Protocol",
    version: "1.0.0",
    links: {
      api_base: `${baseUrl}/v1`,
      websocket: `${wsProtocol}://${host}/v1/events`,
      job_schema: `${baseUrl}/v1/schemas/job-schema.json`,
      onboarding: `${baseUrl}/onboarding`,
      metadata: `${baseUrl}/v1/protocol.json`,
      skills: [
        {
          id: "a2a-market-skill",
          manifest: `${baseUrl}/skills/a2a-market/skill.json`
        }
      ]
    },
    contracts: {
      arc_testnet: {
        agentic_commerce: "0x0747EEf0706327138c69792bF28Cd525089e4583",
        usdc: "0x3600000000000000000000000000000000000000",
        chain_id: 5042002
      }
    }
  };
});

// The "Welcome Package" for Agents (Unified Metadata)
fastify.get('/v1/protocol.json', async (request, reply) => {
  const baseUrl = getBaseUrl(request);
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const host = request.hostname;

  return {
    protocol: "ERC-8183-Agentic-Commerce",
    network: {
      name: "Arc Testnet",
      chainId: 5042002,
      rpc: "https://rpc.testnet.arc.network",
      contracts: {
        marketplace: "0x0747EEf0706327138c69792bF28Cd525089e4583",
        payment_token: "0x3600000000000000000000000000000000000000"
      }
    },
    endpoints: {
      rest: `${baseUrl}/v1`,
      realtime: `${wsProtocol}://${host}/v1/events`
    },
    capabilities: {
      discovery: { method: "GET", path: "/jobs", query: ["type", "min_budget"] },
      publishing: { method: "POST", path: "/jobs", schema: `${baseUrl}/v1/schemas/job-schema.json` },
      submission: { method: "POST", path: "/jobs/{id}/submit" }
    },
    judge: {
      name: "Gemini 2.0 Flash",
      role: "Neutral Protocol Evaluator",
      verification_method: "Double-blind schema validation"
    }
  };
});

fastify.get('/skills/a2a-market/skill.json', async (request, reply) => {
  const baseUrl = getBaseUrl(request);
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const host = request.hostname;

  return {
    id: "a2a-market-skill",
    name: "A2A Market Integration",
    version: "0.1.0",
    description: "Enables autonomous interaction with ERC-8183 marketplaces on Arc Testnet.",
    type: "protocol-interaction",
    endpoints: {
      api: `${baseUrl}/v1`,
      websocket: `${wsProtocol}://${host}/v1/events`
    },
    capabilities: [
      {
        name: "discover",
        method: "GET",
        path: "/jobs",
        parameters: {
          type: "string (coding|research|data_transform)",
          min_budget: "number"
        }
      },
      {
        name: "register_metadata",
        method: "POST",
        path: "/jobs",
        payload_schema: `${baseUrl}/v1/schemas/job-schema.json`
      },
      {
        name: "submit_deliverable",
        method: "POST",
        path: "/jobs/{id}/submit",
        parameters: {
          deliverable_cid: "string",
          worker_address: "string"
        }
      }
    ],
    instructions: [
      "Always verify budget_usdc > 0 before accepting.",
      "Ensure jobUUID is linked in the ERC-8183 contract description field.",
      "Listen to jobs.{id}.evaluated for settlement status."
    ]
  };
});

fastify.get('/onboarding', async (request, reply) => {
  return reply.sendFile('onboarding.md', rootDir);
});

import { wsManager } from './ws-manager.js';

// --- WebSocket Management ---

fastify.register(async (fastify) => {
  fastify.get('/v1/events', { websocket: true }, (socket, req) => {
    fastify.log.info('Agent connected via WebSocket');
    wsManager.addSocket(socket);

    socket.send(JSON.stringify({
      topic: "system.welcome",
      message: "Connected to A2A Market Events",
      supported_topics: ["jobs.new", "jobs.*.submitted", "jobs.*.evaluated"]
    }));
  });
});

// --- API Routes ---

await fastify.register(a2aRoutes, { prefix: '/v1' });

import { z } from 'zod';

// --- Health Check ---

fastify.get('/health', {
  schema: {
    response: {
      200: z.object({
        status: z.string(),
        network: z.string()
      })
    }
  }
}, async () => {
  return { status: 'ok', network: 'arc-testnet' };
});

// --- Server Start ---

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 A2A Market Server running at http://localhost:${port}`);
    console.log(`🔗 Agent discovery: http://localhost:${port}/.well-known/agent-jobs.json\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
