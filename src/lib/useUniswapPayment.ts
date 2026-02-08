import { useState, useCallback } from 'react';
import { useWalletClient, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { 
  UNISWAP_CONFIG, 
  USDC_TOKENS, 
  WETH_TOKENS, 
  CHAIN_NAMES,
  FEE_TIERS,
  buildEthToUsdcSwap,
  calculateMaxInput,
} from './uniswap';

// Payment execution states
export type UniswapPaymentStatus = 
  | 'idle'
  | 'fetching-quote'
  | 'awaiting-approval'
  | 'executing'
  | 'success'
  | 'error';

export interface UniswapQuoteInfo {
  chainId: number;
  chainName: string;
  estimatedEthIn: string;
  estimatedEthInWei: bigint;
  maxEthIn: string;
  maxEthInWei: bigint;
  usdcOut: string;
  usdcOutWei: bigint;
  slippage: number;
  priceImpact: string;
}

export interface UseUniswapPaymentReturn {
  status: UniswapPaymentStatus;
  quote: UniswapQuoteInfo | null;
  error: string | null;
  txHash: string | null;
  fetchQuote: (params: { chainId: number; amountUSD: number; slippage?: number }) => Promise<void>;
  executeSwap: (recipient: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for executing ETH -> USDC swaps via Uniswap V3
 * 
 * This provides same-chain swaps as an alternative to LI.FI cross-chain routes.
 * Use this when the user is already on the destination chain.
 */
export function useUniswapPayment(): UseUniswapPaymentReturn {
  const [status, setStatus] = useState<UniswapPaymentStatus>('idle');
  const [quote, setQuote] = useState<UniswapQuoteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  /**
   * Fetch a quote from Uniswap Quoter V2
   */
  const fetchQuote = useCallback(async (params: { 
    chainId: number; 
    amountUSD: number; 
    slippage?: number 
  }) => {
    const { chainId, amountUSD, slippage = 0.5 } = params;

    setStatus('fetching-quote');
    setError(null);
    setQuote(null);

    try {
      const usdc = USDC_TOKENS[chainId];
      const weth = WETH_TOKENS[chainId];
      const config = UNISWAP_CONFIG[chainId];

      if (!usdc || !weth || !config) {
        throw new Error(`Chain ${chainId} not supported for Uniswap swaps`);
      }

      if (!publicClient) {
        throw new Error('Public client not available');
      }

      // USDC amount in smallest units (6 decimals)
      const usdcAmountWei = BigInt(Math.floor(amountUSD * 1e6));

      // Call Quoter V2 to get the required ETH input
      const quoterResult = await publicClient.readContract({
        address: config.QUOTER_V2,
        abi: [
          {
            name: 'quoteExactOutputSingle',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              {
                name: 'params',
                type: 'tuple',
                components: [
                  { name: 'tokenIn', type: 'address' },
                  { name: 'tokenOut', type: 'address' },
                  { name: 'amount', type: 'uint256' },
                  { name: 'fee', type: 'uint24' },
                  { name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
              },
            ],
            outputs: [
              { name: 'amountIn', type: 'uint256' },
              { name: 'sqrtPriceX96After', type: 'uint160' },
              { name: 'initializedTicksCrossed', type: 'uint32' },
              { name: 'gasEstimate', type: 'uint256' },
            ],
          },
        ],
        functionName: 'quoteExactOutputSingle',
        args: [
          {
            tokenIn: weth.address as `0x${string}`,
            tokenOut: usdc.address as `0x${string}`,
            amount: usdcAmountWei,
            fee: FEE_TIERS.MEDIUM,
            sqrtPriceLimitX96: 0n,
          },
        ],
      }) as [bigint, bigint, number, bigint];

      const estimatedEthIn = quoterResult[0];
      const maxEthIn = calculateMaxInput(estimatedEthIn, slippage);

      // Calculate approximate price impact
      const ethPrice = Number(formatEther(estimatedEthIn)) > 0 
        ? amountUSD / Number(formatEther(estimatedEthIn))
        : 0;
      const priceImpact = ethPrice > 0 ? ((slippage / 100) * ethPrice).toFixed(2) : '0.00';

      setQuote({
        chainId,
        chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
        estimatedEthIn: formatEther(estimatedEthIn),
        estimatedEthInWei: estimatedEthIn,
        maxEthIn: formatEther(maxEthIn),
        maxEthInWei: maxEthIn,
        usdcOut: amountUSD.toFixed(2),
        usdcOutWei: usdcAmountWei,
        slippage,
        priceImpact,
      });

      setStatus('idle');
    } catch (err: any) {
      console.error('Uniswap quote error:', err);
      setError(err?.message || 'Failed to get Uniswap quote');
      setStatus('error');
    }
  }, [publicClient]);

  /**
   * Execute the swap via Uniswap SwapRouter02
   */
  const executeSwap = useCallback(async (recipient: string) => {
    if (!quote || !walletClient) {
      console.error('Missing quote or wallet:', { quote: !!quote, walletClient: !!walletClient });
      setError('No quote available or wallet not connected');
      setStatus('error');
      return;
    }

    console.log('Starting swap execution...', { recipient, quote });
    setStatus('executing');
    setError(null);

    try {
      // Build the swap transaction
      console.log('Building swap transaction...');
      const swapTx = buildEthToUsdcSwap({
        chainId: quote.chainId,
        recipient,
        amountOutUsdc: quote.usdcOutWei,
        amountInMaxEth: quote.maxEthInWei,
      });
      console.log('Swap transaction built:', swapTx);

      // Send the transaction
      console.log('Sending transaction to wallet...');
      const hash = await walletClient.sendTransaction({
        to: swapTx.to as `0x${string}`,
        data: swapTx.data as `0x${string}`,
        value: swapTx.value,
      });

      console.log('Transaction sent! Hash:', hash);
      setTxHash(hash);

      // Wait for confirmation with timeout and verify transaction exists
      if (publicClient) {
        console.log('Waiting for transaction confirmation...');
        let confirmed = false;
        
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ 
            hash,
            timeout: 60_000, // 60 second timeout for testnets
          });
          console.log('Transaction confirmed!', receipt);
          confirmed = true;
        } catch (waitError: any) {
          console.warn('waitForTransactionReceipt failed:', waitError?.message || waitError);
          
          // Try to fetch the transaction to see if it at least exists
          try {
            const tx = await publicClient.getTransaction({ hash });
            if (tx) {
              console.log('Transaction found in mempool/chain:', tx);
              confirmed = true;
            } else {
              console.error('Transaction not found - may not have been broadcast');
            }
          } catch (getTxError) {
            console.error('Could not verify transaction exists:', getTxError);
          }
        }
        
        if (!confirmed) {
          // Transaction hash was returned but we can't verify it exists
          // This likely means it wasn't broadcast properly
          setError('Transaction may not have been broadcast. Please check your wallet and try again.');
          setStatus('error');
          return;
        }
      }

      setStatus('success');
      console.log('Payment complete! Status set to success');
    } catch (err: any) {
      console.error('Uniswap swap error:', err);
      
      if (err?.code === 4001 || err?.message?.includes('rejected')) {
        setError('Transaction rejected by user');
      } else {
        setError(err?.message || 'Swap execution failed');
      }
      setStatus('error');
    }
  }, [quote, walletClient, publicClient]);

  /**
   * Reset state for a new swap
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setQuote(null);
    setError(null);
    setTxHash(null);
  }, []);

  return {
    status,
    quote,
    error,
    txHash,
    fetchQuote,
    executeSwap,
    reset,
  };
}
