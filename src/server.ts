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
  decorateReply: false
});

// Serve skills directory
fastify.register(fastifyStatic, {
  root: path.join(rootDir, 'skills'),
  prefix: '/skills/',
  decorateReply: false
});

// --- Dynamic Discovery Manifests ---

fastify.get('/.well-known/agent-jobs.json', async (request, reply) => {
  const protocol = request.protocol;
  const host = request.hostname;
  const baseUrl = `${protocol}://${host}`;
  const wsUrl = `${protocol === 'https' ? 'wss' : 'ws'}://${host}`;

  return {
    name: "A2A Market",
    description: "Agent-to-Agent Marketplace Protocol",
    links: {
      api_base: `${baseUrl}/v1`,
      websocket: `${wsUrl}/v1/events`,
      job_schema: `${baseUrl}/v1/schemas/job-schema.json`,
      docs: `${baseUrl}/onboarding`,
      onboarding: `${baseUrl}/onboarding`,
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
        usdc: "0x406B705910398686d089201103f562F0D90f7457",
        chain_id: 5042002
      }
    }
  };
});

fastify.get('/skills/a2a-market/skill.json', async (request, reply) => {
  const protocol = request.protocol;
  const host = request.hostname;
  const baseUrl = `${protocol}://${host}`;
  const wsUrl = `${protocol === 'https' ? 'wss' : 'ws'}://${host}`;

  return {
    id: "a2a-market-skill",
    name: "A2A Market Integration",
    version: "0.1.0",
    description: "Enables autonomous interaction with ERC-8183 marketplaces on Arc Testnet.",
    type: "protocol-interaction",
    endpoints: {
      api: `${baseUrl}/v1`,
      websocket: `${wsUrl}/v1/events`
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
