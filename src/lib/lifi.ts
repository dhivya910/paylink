import { createConfig } from '@lifi/sdk';

// Mainnet chains supported by LI.FI
export const SUPPORTED_CHAIN_IDS = [1, 137, 42161, 8453, 10] as const;

// Token addresses used in this app
export const TOKENS = {
  // Native token address (used by LI.FI for ETH, MATIC, etc.)
  NATIVE: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  // USDC addresses on different chains (mainnet)
  USDC: {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',      // Ethereum
    137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',    // Polygon (native USDC)
    42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Arbitrum
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // Base
    10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',     // Optimism
  } as Record<number, string>,
} as const;

// Chain names for display
export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  137: 'Polygon',
  42161: 'Arbitrum',
  8453: 'Base',
  10: 'Optimism',
  11155111: 'Sepolia',
};

/**
 * Initialize LI.FI SDK
 * 
 * The SDK handles:
 * - Route finding across bridges and DEXes
 * - Transaction building and execution
 * - Status tracking for cross-chain transfers
 */
export function initializeLiFi() {
  createConfig({
    integrator: 'Zap-hackmoney',
  });
}

// Initialize on module load
initializeLiFi();
