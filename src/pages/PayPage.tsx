import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAccount, useChainId, useEnsAddress } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { useLiFiPayment } from '../lib/useLiFiPayment';
import { CHAIN_NAMES } from '../lib/lifi';
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
  ChevronRight
} from 'lucide-react';

interface Intent {
  id: string;
  amount: number;
  token: string;
  recipient: string;
  note?: string;
  status: 'unpaid' | 'paid';
}

export default function PayPage() {
  const { intentId } = useParams();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [intentLoading, setIntentLoading] = useState(true);

  const {
    status,
    routeInfo,
    error,
    txHash,
    fetchQuote,
    executePayment,
    reset,
  } = useLiFiPayment();

  // ENS resolution
  const recipientIsENS = intent?.recipient?.endsWith('.eth');
  const { data: resolvedAddress, isLoading: ensLoading } = useEnsAddress({
    name: recipientIsENS ? intent?.recipient : undefined,
    chainId: mainnet.id,
  });
  const finalRecipient = recipientIsENS ? resolvedAddress : intent?.recipient;

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
    await fetchQuote({
      fromChainId: chainId,
      fromAddress: address,
      toAddress: finalRecipient,
      amountUSD: intent.amount,
    });
  };

  const handlePay = async () => {
    await executePayment();
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
              <span className="text-sm font-mono text-slate-900 dark:text-white">
                {recipientIsENS ? intent.recipient : `${intent.recipient.slice(0, 8)}...${intent.recipient.slice(-6)}`}
              </span>
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
                href={`https://polygonscan.com/tx/${txHash}`}
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

        <div className="flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
          <Zap className="w-4 h-4" />
          <span>Powered by LI.FI</span>
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
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">To</span>
            <span className="text-sm text-slate-900 dark:text-white">
              {recipientIsENS ? (
                ensLoading ? (
                  <span className="text-amber-600 dark:text-amber-400">Resolving...</span>
                ) : resolvedAddress ? (
                  <span className="flex items-center gap-1.5">
                    {intent.recipient}
                    <Check className="w-4 h-4 text-emerald-500" />
                  </span>
                ) : (
                  <span className="text-red-500">{intent.recipient}</span>
                )
              ) : (
                <span className="font-mono">{intent.recipient.slice(0, 10)}...{intent.recipient.slice(-8)}</span>
              )}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Your Chain</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{chainName}</span>
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
          <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin flex-shrink-0" />
            <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">Processing payment...</p>
          </div>
        )}

        {/* Get Quote button */}
        {!routeInfo && status === 'idle' && (
          <button
            onClick={handleGetQuote}
            disabled={!isConnected || !finalRecipient || ensLoading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ensLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Resolving...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Continue
                <ChevronRight className="w-5 h-5" />
              </span>
            )}
          </button>
        )}
      </div>

      {/* Route preview */}
      {routeInfo && (
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
                ~{(Number(routeInfo.fromAmount) / 1e18).toFixed(6)} {routeInfo.fromToken.split(' ').pop()}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">From</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{CHAIN_NAMES[routeInfo.fromChainId]}</span>
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
                {(Number(routeInfo.toAmount) / 1e6).toFixed(2)} USDC
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">On</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{CHAIN_NAMES[routeInfo.toChainId]}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Est. Fees</span>
              <span className="text-sm font-mono text-slate-600 dark:text-slate-400">~${routeInfo.estimatedGasUSD}</span>
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

      <div className="flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
        <Zap className="w-4 h-4" />
        <span>Powered by LI.FI</span>
      </div>
    </div>
  );
}
