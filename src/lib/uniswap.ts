import { Token } from '@uniswap/sdk-core';
import { encodeFunctionData } from 'viem';

// Chain configurations
export const UNISWAP_CONFIG = {
  // Uniswap V3 Router addresses 
  // Sepolia uses different addresses than mainnet
  SWAP_ROUTER_02: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E' as const, // Sepolia SwapRouter02
  QUOTER_V2: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3' as const,       // Sepolia QuoterV2
  
  // Pool fees (in hundredths of a bip, e.g., 3000 = 0.3%)
  FEE_TIERS: {
    LOWEST: 100,   // 0.01% - stable pairs
    LOW: 500,      // 0.05% - stable pairs
    MEDIUM: 3000,  // 0.3%  - most pairs
    HIGH: 10000,   // 1%    - exotic pairs
  },
} as const;

// USDC token addresses by chain (Sepolia uses test USDC)
export const USDC_TOKENS: Record<number, Token> = {
  // Sepolia testnet
  11155111: new Token(11155111, '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 6, 'USDC', 'USD Coin'),
  // Mainnet (kept for reference)
  1: new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin'),
  137: new Token(137, '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 6, 'USDC', 'USD Coin'),
  42161: new Token(42161, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 6, 'USDC', 'USD Coin'),
  8453: new Token(8453, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 6, 'USDC', 'USD Coin'),
  10: new Token(10, '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', 6, 'USDC', 'USD Coin'),
};

// WETH token addresses by chain
export const WETH_TOKENS: Record<number, Token> = {
  // Sepolia testnet
  11155111: new Token(11155111, '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', 18, 'WETH', 'Wrapped Ether'),
  // Mainnet
  1: new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether'),
  137: new Token(137, '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', 18, 'WETH', 'Wrapped Ether'),
  42161: new Token(42161, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 18, 'WETH', 'Wrapped Ether'),
  8453: new Token(8453, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
  10: new Token(10, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
};

// Chain names for display
export const CHAIN_NAMES: Record<number, string> = {
  11155111: 'Sepolia',
  1: 'Ethereum',
  137: 'Polygon',
  42161: 'Arbitrum',
  8453: 'Base',
  10: 'Optimism',
};

/**
 * Build a swap transaction for Uniswap V3
 * Swaps native ETH -> USDC using SwapRouter02
 */
export function buildSwapExactOutputSingle(params: {
  tokenIn: Token;
  tokenOut: Token;
  fee: number;
  recipient: string;
  amountOut: bigint;
  amountInMaximum: bigint;
  sqrtPriceLimitX96?: bigint;
}) {
  const { tokenIn, tokenOut, fee, recipient, amountOut, amountInMaximum, sqrtPriceLimitX96 = 0n } = params;

  // SwapRouter02 exactOutputSingle function
  const swapData = encodeFunctionData({
    abi: [
      {
        name: 'exactOutputSingle',
        type: 'function',
        inputs: [
          {
            name: 'params',
            type: 'tuple',
            components: [
              { name: 'tokenIn', type: 'address' },
              { name: 'tokenOut', type: 'address' },
              { name: 'fee', type: 'uint24' },
              { name: 'recipient', type: 'address' },
              { name: 'amountOut', type: 'uint256' },
              { name: 'amountInMaximum', type: 'uint256' },
              { name: 'sqrtPriceLimitX96', type: 'uint160' },
            ],
          },
        ],
        outputs: [{ name: 'amountIn', type: 'uint256' }],
      },
    ],
    functionName: 'exactOutputSingle',
    args: [
      {
        tokenIn: tokenIn.address as `0x${string}`,
        tokenOut: tokenOut.address as `0x${string}`,
        fee,
        recipient: recipient as `0x${string}`,
        amountOut,
        amountInMaximum,
        sqrtPriceLimitX96,
      },
    ],
  });

  return swapData;
}

/**
 * Build multicall for ETH -> USDC swap (wrap + swap)
 * Uses SwapRouter02's multicall with unwrapWETH9 fallback
 */
export function buildEthToUsdcSwap(params: {
  chainId: number;
  recipient: string;
  amountOutUsdc: bigint;
  amountInMaxEth: bigint;
}) {
  const { chainId, recipient, amountOutUsdc, amountInMaxEth } = params;

  const weth = WETH_TOKENS[chainId];
  const usdc = USDC_TOKENS[chainId];

  if (!weth || !usdc) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  // Build the swap calldata
  const swapCalldata = buildSwapExactOutputSingle({
    tokenIn: weth,
    tokenOut: usdc,
    fee: UNISWAP_CONFIG.FEE_TIERS.MEDIUM, // 0.3% fee tier
    recipient,
    amountOut: amountOutUsdc,
    amountInMaximum: amountInMaxEth,
  });

  // Refund any unused ETH
  const refundCalldata = encodeFunctionData({
    abi: [
      {
        name: 'refundETH',
        type: 'function',
        inputs: [],
        outputs: [],
      },
    ],
    functionName: 'refundETH',
  });

  // Multicall: swap + refund unused ETH
  const multicallData = encodeFunctionData({
    abi: [
      {
        name: 'multicall',
        type: 'function',
        inputs: [{ name: 'data', type: 'bytes[]' }],
        outputs: [{ name: 'results', type: 'bytes[]' }],
      },
    ],
    functionName: 'multicall',
    args: [[swapCalldata, refundCalldata]],
  });

  return {
    to: UNISWAP_CONFIG.SWAP_ROUTER_02,
    data: multicallData,
    value: amountInMaxEth,
  };
}

/**
 * Calculate slippage-adjusted maximum input amount
 */
export function calculateMaxInput(estimatedAmount: bigint, slippagePercent: number): bigint {
  const slippageBps = BigInt(Math.floor(slippagePercent * 100));
  return estimatedAmount + (estimatedAmount * slippageBps) / 10000n;
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4);
  return `${whole}.${fractionStr}`;
}
