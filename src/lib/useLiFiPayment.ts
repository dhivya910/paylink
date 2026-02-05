import { useState, useCallback } from 'react';
import { getQuote, executeRoute, convertQuoteToRoute, type Route, type ExecutionOptions } from '@lifi/sdk';
import { useWalletClient, useSwitchChain } from 'wagmi';
import { TOKENS, CHAIN_NAMES } from './lifi';

// Payment execution states for clean UX
export type PaymentStatus = 
  | 'idle'           // Initial state
  | 'fetching-quote' // Getting route from LI.FI
  | 'awaiting-sig'   // Waiting for user to sign transaction
  | 'executing'      // Transaction submitted, waiting for completion
  | 'success'        // Payment completed successfully
  | 'error';         // Something went wrong

// Route information for display
export interface RouteInfo {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedGasUSD: string;
  route: Route;
}

// Hook return type
export interface UseLiFiPaymentReturn {
  status: PaymentStatus;
  routeInfo: RouteInfo | null;
  error: string | null;
  txHash: string | null;
  fetchQuote: (params: FetchQuoteParams) => Promise<void>;
  executePayment: () => Promise<void>;
  reset: () => void;
}

export interface FetchQuoteParams {
  fromChainId: number;
  fromAddress: string;
  toAddress: string;
  amountUSD: number;
}

export function useLiFiPayment(): UseLiFiPaymentReturn {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  // Get wallet client from wagmi for signing transactions
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  /**
   * Fetch a quote/route from LI.FI
   * 
   * This finds the optimal path to convert user's native token (ETH, MATIC, etc.)
   * to USDC on the destination chain, handling any necessary swaps and bridges.
   */
  const fetchQuote = useCallback(async (params: FetchQuoteParams) => {
    const { fromChainId, fromAddress, toAddress, amountUSD } = params;
    
    setStatus('fetching-quote');
    setError(null);
    setRouteInfo(null);
    setTxHash(null);

    try {
      // Settle payments to Polygon USDC (low fees, fast finality)
      const toChainId = 137; // Polygon mainnet
      const toTokenAddress = TOKENS.USDC[toChainId];
      
      // Convert USDC amount to smallest units (6 decimals)
      const toAmountWei = (amountUSD * 1e6).toString();

      /**
       * LI.FI getQuote finds the best route
       * 
       * We use 'toAmount' to specify we want a specific output amount,
       * and LI.FI calculates how much input is needed.
       */
      const quote = await getQuote({
        fromChain: fromChainId,
        toChain: toChainId,
        fromToken: TOKENS.NATIVE,           // Pay with native token (ETH, MATIC, etc.)
        toToken: toTokenAddress,             // Receive USDC
        toAmount: toAmountWei,               // Exact amount recipient should get
        fromAddress,                          // Payer's address
        toAddress,                            // Payment recipient
      });

      // Extract fee information for display
      const estimatedGasUSD = quote.estimate?.gasCosts?.reduce(
        (sum, cost) => sum + parseFloat(cost.amountUSD || '0'),
        0
      ) || 0;

      // Convert quote to executable route format
      const route = convertQuoteToRoute(quote);

      // Store route info for display and execution
      setRouteInfo({
        fromChainId: quote.action.fromChainId,
        toChainId: quote.action.toChainId,
        fromToken: CHAIN_NAMES[quote.action.fromChainId] + ' ' + (quote.action.fromToken.symbol || 'ETH'),
        toToken: 'USDC',
        fromAmount: quote.estimate?.fromAmount || '0',
        toAmount: quote.estimate?.toAmount || '0',
        estimatedGasUSD: estimatedGasUSD.toFixed(2),
        route,
      });

      setStatus('idle');
    } catch (err: any) {
      console.error('LI.FI quote error:', err);
      setError(err?.message || 'Failed to get payment quote');
      setStatus('error');
    }
  }, []);

  /**
   * Execute the payment route
   * 
   * This is where the magic happens:
   * 1. User signs ONE transaction
   * 2. LI.FI handles swap + bridge automatically
   * 3. Recipient gets USDC on destination chain
   */
  const executePayment = useCallback(async () => {
    if (!routeInfo?.route || !walletClient) {
      setError('No route available or wallet not connected');
      setStatus('error');
      return;
    }

    setStatus('awaiting-sig');
    setError(null);

    try {
      // Ensure user is on the correct chain
      const requiredChainId = routeInfo.fromChainId;
      const currentChainId = await walletClient.getChainId();
      
      if (currentChainId !== requiredChainId) {
        await switchChainAsync({ chainId: requiredChainId });
      }

      /**
       * LI.FI executeRoute handles everything:
       * - Token approvals (if needed)
       * - Swap on source chain
       * - Bridge to destination chain
       * - Final swap to USDC (if needed)
       * 
       * The user only signs the initial transaction(s).
       */
      const executionOptions: ExecutionOptions = {
        // Update UI as execution progresses
        updateRouteHook: (updatedRoute) => {
          console.log('Route update:', updatedRoute);
          
          // Check if we have a transaction hash
          const step = updatedRoute.steps?.[0];
          if (step?.execution?.process) {
            const process = step.execution.process.find(
              p => p.txHash && p.status === 'DONE'
            );
            if (process?.txHash) {
              setTxHash(process.txHash);
            }
          }
        },
      };

      setStatus('executing');

      // Execute the route - LI.FI SDK handles signing via window.ethereum
      await executeRoute(routeInfo.route, executionOptions);

      setStatus('success');
    } catch (err: any) {
      console.error('LI.FI execution error:', err);
      
      // Handle user rejection gracefully
      if (err?.code === 4001 || err?.message?.includes('rejected')) {
        setError('Transaction rejected by user');
      } else {
        setError(err?.message || 'Payment execution failed');
      }
      setStatus('error');
    }
  }, [routeInfo, walletClient, switchChainAsync]);

  /**
   * Reset the hook state for a new payment
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setRouteInfo(null);
    setError(null);
    setTxHash(null);
  }, []);

  return {
    status,
    routeInfo,
    error,
    txHash,
    fetchQuote,
    executePayment,
    reset,
  };
}
