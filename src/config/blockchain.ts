import { createPublicClient, createWalletClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Arc Testnet Configuration
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
    public: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
});

export const CONTRACTS = {
  AGENTIC_COMMERCE: '0x0747EEf0706327138c69792bF28Cd525089e4583' as `0x${string}`,
  USDC: '0x3600000000000000000000000000000000000000' as `0x${string}`,
};

// --- Clients ---

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

// Helper to get a wallet client from a private key
export const getWalletClient = (privateKey: string) => {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });
};

// Global clients using environment variables if available
export const platformAccount = process.env.PLATFORM_PRIVATE_KEY 
  ? privateKeyToAccount(process.env.PLATFORM_PRIVATE_KEY as `0x${string}`) 
  : undefined;

export const platformWalletClient = platformAccount 
  ? createWalletClient({
      account: platformAccount,
      chain: arcTestnet,
      transport: http(),
    })
  : undefined;
