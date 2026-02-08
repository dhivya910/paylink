import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAccount, useChainId } from 'wagmi';
import { useLiFiPayment } from '../lib/useLiFiPayment';
import { useUniswapPayment } from '../lib/useUniswapPayment';
import { CHAIN_NAMES, getTxExplorerUrl } from '../lib/lifi';
import { generateAddressGradient, getInitials, formatAddress } from '../lib/useENS';
import { 
  ArrowRight, 
  Check,
  AlertCircle, 
  Loader2, 
  Zap, 
  ArrowDownUp,
  ExternalLink,
  Wallet,
  RefreshCw,
  ChevronRight,
  Repeat
} from 'lucide-react';

interface Intent {
  id: string;
  amount: number;
  token: string;
  recipient: string;
  note?: string;
  status: 'unpaid' | 'paid';
}

// ENS Avatar with gradient fallback
function RecipientAvatar({ address, ensName }: { address: string; ensName?: string }) {
  const [avatar, setAvatar] = useState<string | null>(null);
  
  useEffect(() => {
    if (!ensName) {
      setAvatar(null);
      return;
    }
    
    // Use ENS metadata service for avatar
    const avatarUrl = `https://metadata.ens.domains/mainnet/avatar/${ensName}`;
    
    // Test if avatar exists by loading as image
    const img = new Image();
    img.onload = () => setAvatar(avatarUrl);
    img.onerror = () => setAvatar(null);
    img.src = avatarUrl;
  }, [ensName]);
  
  if (avatar) {
    return <img src={avatar} alt={ensName || address} className="w-10 h-10 rounded-full object-cover border-2 border-emerald-200 dark:border-emerald-500/30" />
  }
  
  return (
    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${generateAddressGradient(address)} flex items-center justify-center text-white font-bold text-sm border-2 border-emerald-200 dark:border-emerald-500/30`}>
      {getInitials(ensName || address)}
    </div>
  )
}

export default function PayPage() {
  const { intentId } = useParams();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [intentLoading, setIntentLoading] = useState(true);
  const [routeType, setRouteType] = useState<'auto' | 'lifi' | 'uniswap'>('auto');
  const [txChainId, setTxChainId] = useState<number | null>(null); // Store chain ID when tx is made
  const {
    status: lifiStatus,
    routeInfo: lifiRouteInfo,
    error: lifiError,
    txHash: lifiTxHash,
    fetchQuote: fetchLifiQuote,
    executePayment: executeLifiPayment,
    reset: resetLifi,
  } = useLiFiPayment();

  // Uniswap hook (same-chain)
  const {
    status: uniswapStatus,
    quote: uniswapQuote,
    error: uniswapError,
    txHash: uniswapTxHash,
    fetchQuote: fetchUniswapQuote,
    executeSwap: executeUniswapSwap,
    reset: resetUniswap,
  } = useUniswapPayment();

  /**
   * Route Selection Logic:
   * 
   * UNISWAP is used for:
   * 1. Testnet (Sepolia) - LI.FI doesn't support testnets
   * 2. Same-chain swaps - Faster & cheaper than cross-chain
   * 3. User explicitly selects Uniswap route
   * 
   * LI.FI is used for:
   * 1. Cross-chain payments (different source & destination chain)
   * 2. When user explicitly selects LI.FI route
   * 
   * Benefits of Uniswap for same-chain:
   * - Lower gas fees (no bridge overhead)
   * - Faster settlement (single transaction)
   * - Direct DEX swap without intermediaries
   */
  const isTestnet = chainId === 11155111; // Sepolia
  const isSameChainAsRecipient = chainId === 137; // Recipient on Polygon, payer also on Polygon
  const useUniswap = isTestnet || routeType === 'uniswap' || (routeType === 'auto' && isSameChainAsRecipient);
  
  // Reason for route selection (for UI display)
  const routeReason = isTestnet 
    ? 'Testnet (LI.FI not supported)'
    : isSameChainAsRecipient && routeType === 'auto'
      ? 'Same-chain swap (faster & cheaper)'
      : routeType === 'uniswap'
        ? 'You selected Uniswap'
        : 'Cross-chain via LI.FI';
  
  // Combined state
  const status = useUniswap ? uniswapStatus : lifiStatus;
  const error = useUniswap ? uniswapError : lifiError;
  const txHash = useUniswap ? uniswapTxHash : lifiTxHash;
  const hasQuote = useUniswap ? !!uniswapQuote : !!lifiRouteInfo;

  const reset = useUniswap ? resetUniswap : resetLifi;

  // ENS resolution state
  const recipientIsENS = intent?.recipient?.endsWith('.eth');
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [ensLoading, setEnsLoading] = useState(false);
  
  // ENS resolution using enstate.rs API
  const resolveENS = async (ensName: string) => {
    setEnsLoading(true);
    setResolvedAddress(null);
    
    try {
      const response = await fetch(`https://enstate.rs/n/${ensName}`);
      if (!response.ok) throw new Error('ENS not found');
      
      const data = await response.json();
      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
      
      // Check if ENS has an address set
      const hasAddress = data.address && data.address !== ZERO_ADDRESS;
      
      if (hasAddress) {
        setResolvedAddress(data.address);
      }
      // If no address, resolvedAddress stays null and ensResolutionFailed will be true
    } catch {
      // resolvedAddress stays null
    } finally {
      setEnsLoading(false);
    }
  };
  
  // Resolve ENS when intent changes
  useEffect(() => {
    if (recipientIsENS && intent?.recipient) {
      resolveENS(intent.recipient);
    }
  }, [recipientIsENS, intent?.recipient]);
  
  // For ENS: use resolved address
  const finalRecipient = recipientIsENS 
    ? resolvedAddress
    : intent?.recipient;
  
  // ENS resolution status for UI
  const ensResolutionFailed = recipientIsENS && !ensLoading && !resolvedAddress;

  const chainName = chainId ? CHAIN_NAMES[chainId] || `Chain ${chainId}` : 'Unknown';

  // Load intent
  useEffect(() => {
    if (intentId) {
      setIntentLoading(true);
      fetch(`http://localhost:3001/intent/${intentId}`)
        .then(r => r.json())
        .then(data => {
          setIntent(data);
          setIntentLoading(false);
        })
        .catch(() => setIntentLoading(false));
    }
  }, [intentId]);

  const handleGetQuote = async () => {
    if (!intent || !address || !finalRecipient) return;
    
    if (useUniswap) {
      // Same-chain: use Uniswap
      await fetchUniswapQuote({
        chainId,
        amountUSD: intent.amount,
        slippage: 0.5,
      });
    } else {
      // Cross-chain: use LI.FI
      await fetchLifiQuote({
        fromChainId: chainId,
        fromAddress: address,
        toAddress: finalRecipient,
        amountUSD: intent.amount,
      });
    }
  };

  const handlePay = async () => {
    console.log('handlePay called', { finalRecipient, useUniswap });
    if (!finalRecipient) {
      console.error('No finalRecipient!');
      return;
    }
    
    // Store the chain ID before executing the transaction
    setTxChainId(chainId);
    
    if (useUniswap) {
      console.log('Executing Uniswap swap...');
      await executeUniswapSwap(finalRecipient);
    } else {
      console.log('Executing LI.FI payment...');
      await executeLifiPayment();
    }
  };

  // Update backend on success
  useEffect(() => {
    if (status === 'success' && txHash && intentId) {
      fetch('http://localhost:3001/fusion/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId, txHash }),
      }).catch(console.error);
    }
  }, [status, txHash, intentId]);

  const isProcessing = ['fetching-quote', 'awaiting-sig', 'executing'].includes(status);

  // Loading
  if (intentLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 mx-auto text-indigo-600 dark:text-indigo-400 animate-spin" />
          <p className="text-slate-500">Loading payment...</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!intent) {
    return (
      <div className="py-10 max-w-lg mx-auto">
        <div className="card text-center py-10 space-y-4">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Payment Not Found</h2>
          <p className="text-slate-500 text-sm">This link may have expired or doesn't exist.</p>
          <a href="/" className="btn-secondary inline-flex !w-auto px-6">Go Home</a>
        </div>
      </div>
    );
  }

  // Success
  if (status === 'success') {
    return (
      <div className="py-10 max-w-lg mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Payment Sent!</h1>
            <p className="text-slate-500 mt-1">Your transaction is being processed</p>
          </div>
        </div>

        <div className="card space-y-6">
          <div className="text-center py-4">
            <p className="text-sm text-slate-500 mb-2">Amount Sent</p>
            <p className="text-4xl font-bold text-slate-900 dark:text-white">${intent.amount.toFixed(2)}</p>
            <p className="text-slate-500 font-medium mt-1">{intent.token}</p>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">To</span>
              <div className="flex items-center gap-2">
                <RecipientAvatar 
                  address={finalRecipient || intent.recipient} 
                  ensName={recipientIsENS ? intent.recipient : undefined} 
                />
                <span className="text-sm text-slate-900 dark:text-white">
                  {recipientIsENS ? (
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{intent.recipient}</span>
                  ) : (
                    <span className="font-mono">{formatAddress(intent.recipient)}</span>
                  )}
                </span>
              </div>
            </div>
            {intent.note && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Note</span>
                <span className="text-sm text-slate-700 dark:text-slate-300">{intent.note}</span>
              </div>
            )}
          </div>

          {txHash && (
            <>
              <hr className="border-slate-200 dark:border-slate-700" />
              <a
                href={getTxExplorerUrl(txHash, txChainId || chainId)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <span>View on Explorer</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </>
          )}

          <button onClick={() => window.location.href = '/'} className="btn-ghost w-full">
            Create New Payment
          </button>
        </div>
      </div>
    );
  }

  // Main payment view
  return (
    <div className="py-10 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
          <Zap className="w-3.5 h-3.5" />
          Payment Request
        </span>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Complete Payment</h1>
      </div>

      {/* Amount card */}
      <div className="card space-y-6">
        {/* Amount */}
        <div className="text-center py-4">
          <p className="text-sm text-slate-500 mb-2">Amount Due</p>
          <p className="text-4xl font-bold text-slate-900 dark:text-white">${intent.amount.toFixed(2)}</p>
          <p className="text-slate-500 font-medium mt-1">{intent.token}</p>
        </div>

        <hr className="border-slate-200 dark:border-slate-700" />

        {/* Details */}
        <div className="space-y-3">
          {/* Recipient with avatar */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">To</span>
            <div className="flex items-center gap-2">
              <RecipientAvatar 
                address={finalRecipient || intent.recipient} 
                ensName={recipientIsENS ? intent.recipient : undefined} 
              />
              <span className="text-sm text-slate-900 dark:text-white">
                {recipientIsENS ? (
                  ensLoading ? (
                    <span className="text-amber-600 dark:text-amber-400">Resolving...</span>
                  ) : resolvedAddress ? (
                    <span className="flex items-center gap-1.5">
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{intent.recipient}</span>
                      <Check className="w-4 h-4 text-emerald-500" />
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="text-amber-600 dark:text-amber-400">{intent.recipient}</span>
                      <button 
                        onClick={() => intent?.recipient && resolveENS(intent.recipient)}
                        className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/20"
                      >
                        Retry
                      </button>
                    </span>
                  )
                ) : (
                  <span className="font-mono">{formatAddress(intent.recipient)}</span>
                )}
              </span>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Your Chain</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {chainName}
              {isTestnet && (
                <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded">
                  Testnet
                </span>
              )}
            </span>
          </div>

          {/* Route type selector */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Route</span>
            <div className="flex items-center gap-1 text-xs">
              {!isTestnet && (
                <button
                  onClick={() => setRouteType('auto')}
                  className={`px-2 py-1 rounded transition-colors ${
                    routeType === 'auto' 
                      ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Auto
                </button>
              )}
              <button
                onClick={() => setRouteType('uniswap')}
                className={`px-2 py-1 rounded transition-colors ${
                  (routeType === 'uniswap' || isTestnet)
                    ? 'bg-pink-100 dark:bg-pink-500/10 text-pink-700 dark:text-pink-400' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Uniswap
              </button>
              {!isTestnet && (
                <button
                  onClick={() => setRouteType('lifi')}
                  className={`px-2 py-1 rounded transition-colors ${
                    routeType === 'lifi' 
                      ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  LI.FI
                </button>
              )}
            </div>
          </div>

          {intent.note && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Note</span>
              <span className="text-sm text-slate-700 dark:text-slate-300">{intent.note}</span>
            </div>
          )}
        </div>

        {/* Wallet warning */}
        {!isConnected && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center gap-3">
            <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Connect your wallet to continue</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm font-medium text-red-700 dark:text-red-400 flex-1">{error}</p>
            <button onClick={reset} className="p-1 hover:bg-red-100 dark:hover:bg-red-500/20 rounded transition-colors">
              <RefreshCw className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          </div>
        )}

        {/* Status */}
        {status === 'fetching-quote' && (
          <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin flex-shrink-0" />
            <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">Finding the best route...</p>
          </div>
        )}

        {status === 'awaiting-sig' && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center gap-3">
            <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Confirm in your wallet...</p>
          </div>
        )}

        {status === 'executing' && (
          <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">Processing payment...</p>
                <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">
                  {isTestnet ? 'Testnet transactions may take 15-30 seconds' : 'Waiting for confirmation'}
                </p>
              </div>
            </div>
            {txHash && (
              <a
                href={getTxExplorerUrl(txHash, txChainId || chainId)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <span>View transaction on explorer</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Route type indicator */}
        {status === 'idle' && !hasQuote && (
          <div className={`flex items-center justify-center gap-2 p-3 rounded-lg ${
            useUniswap 
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20'
              : 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20'
          }`}>
            <Repeat className={`w-4 h-4 ${useUniswap ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <p className={`text-sm font-medium ${useUniswap ? 'text-emerald-700 dark:text-emerald-400' : 'text-indigo-700 dark:text-indigo-400'}`}>
              {routeReason}
            </p>
          </div>
        )}

        {/* Get Quote button */}
        {!hasQuote && status === 'idle' && (
          <>
            {/* ENS resolution failed warning */}
            {ensResolutionFailed && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Could not resolve ENS name
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                    Check your internet connection and try again
                  </p>
                </div>
                <button 
                  onClick={() => intent?.recipient && resolveENS(intent.recipient)}
                  className="px-3 py-1.5 rounded-lg bg-amber-200 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-sm font-medium hover:bg-amber-300 dark:hover:bg-amber-500/30 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
            
            <button
              onClick={handleGetQuote}
              disabled={!isConnected || !finalRecipient || ensLoading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ensLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Resolving ENS...
                </span>
              ) : !finalRecipient && recipientIsENS ? (
                <span className="flex items-center justify-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  ENS Resolution Required
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {/* Route preview - Uniswap (same-chain) */}
      {useUniswap && uniswapQuote && (
        <div className="card space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-500/20 flex items-center justify-center">
              <Repeat className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Uniswap Swap</h3>
              <p className="text-xs text-slate-500">Direct swap on {uniswapQuote.chainName}</p>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">You Pay</span>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                ~{parseFloat(uniswapQuote.estimatedEthIn).toFixed(6)} ETH
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Max (with {uniswapQuote.slippage}% slippage)</span>
              <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
                {parseFloat(uniswapQuote.maxEthIn).toFixed(6)} ETH
              </span>
            </div>

            {/* Visual swap indicator */}
            <div className="flex justify-center py-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-100 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-700 text-pink-600 dark:text-pink-400 text-xs font-medium">
                <Repeat className="w-3 h-3" />
                Uniswap V3
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Recipient Gets</span>
              <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                {uniswapQuote.usdcOut} USDC
              </span>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={isProcessing}
            className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'awaiting-approval' ? (
              <span className="flex items-center justify-center gap-2">
                <Wallet className="w-5 h-5" />
                Confirm in Wallet
              </span>
            ) : status === 'executing' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Swapping...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Pay ${intent.amount.toFixed(2)}
                <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </button>

          <p className="text-center text-xs text-slate-500">
            One signature • Uniswap V3 swap
          </p>
        </div>
      )}

      {/* Route preview - LI.FI (cross-chain) */}
      {!useUniswap && lifiRouteInfo && (
        <div className="card space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center">
              <ArrowDownUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Payment Route</h3>
              <p className="text-xs text-slate-500">Optimal path via LI.FI</p>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">You Pay</span>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                ~{(Number(lifiRouteInfo.fromAmount) / 1e18).toFixed(6)} {lifiRouteInfo.fromToken.split(' ').pop()}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">From</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{CHAIN_NAMES[lifiRouteInfo.fromChainId]}</span>
            </div>

            {/* Visual bridge indicator */}
            <div className="flex justify-center py-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium">
                <ArrowDownUp className="w-3 h-3" />
                Swap + Bridge
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Recipient Gets</span>
              <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                {(Number(lifiRouteInfo.toAmount) / 1e6).toFixed(2)} USDC
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">On</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{CHAIN_NAMES[lifiRouteInfo.toChainId]}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Est. Fees</span>
              <span className="text-sm font-mono text-slate-600 dark:text-slate-400">~${lifiRouteInfo.estimatedGasUSD}</span>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={isProcessing}
            className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'awaiting-sig' ? (
              <span className="flex items-center justify-center gap-2">
                <Wallet className="w-5 h-5" />
                Confirm in Wallet
              </span>
            ) : status === 'executing' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Pay ${intent.amount.toFixed(2)}
                <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </button>

          <p className="text-center text-xs text-slate-500">
            One signature • LI.FI handles routing
          </p>
        </div>
      )}

      {/* Trust indicators */}
      <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Check className="w-3 h-3" />
          Non-custodial
        </span>
        <span className="flex items-center gap-1">
          <Check className="w-3 h-3" />
          Direct transfer
        </span>
      </div>

      <div className="flex items-center justify-center gap-3 text-sm font-medium">
        <span className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400">
          <Repeat className="w-4 h-4" />
          Uniswap
        </span>
        <span className="text-slate-300 dark:text-slate-700">+</span>
        <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <Zap className="w-4 h-4" />
          LI.FI
        </span>
      </div>
    </div>
  );
}
