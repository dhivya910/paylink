/**
 * CreatePage - Payment Link Creator
 * Clean, minimal Stripe/Linear/Vercel inspired design
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { isAddress } from 'viem';
import { 
  Copy, 
  Check, 
  ArrowRight, 
  Zap, 
  ExternalLink,
  ArrowLeft
} from 'lucide-react';
import { generateAddressGradient, getInitials } from '../lib/useENS';

// Recipient input with ENS avatar (using ENS metadata service to avoid CORS)
function RecipientInput({ value, onChange, onValidationChange }: { value: string; onChange: (v: string) => void; onValidationChange?: (isValid: boolean) => void }) {
  const isENS = value.endsWith('.eth') && value.length > 4;
  const isValidAddress = !!(value && isAddress(value));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasAvatar, setHasAvatar] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Use ref to avoid infinite loops with callback in dependencies
  const onValidationChangeRef = useRef(onValidationChange);
  onValidationChangeRef.current = onValidationChange;

  useEffect(() => {
    if (!isENS) {
      setAvatarUrl(null);
      setHasAvatar(false);
      setIsVerified(false);
      setIsChecking(false);
      return;
    }
    
    setIsChecking(true);
    setIsVerified(false);
    setHasAvatar(false);
    
    // Use ENS metadata service for avatar
    const avatarUrlStr = `https://metadata.ens.domains/mainnet/avatar/${value}`;
    setAvatarUrl(avatarUrlStr);
    
    // Check avatar (for display purposes)
    const img = new Image();
    img.onload = () => setHasAvatar(true);
    img.onerror = () => setHasAvatar(false);
    img.src = avatarUrlStr;
    
    // Use enstate.rs API to verify ENS registration (checks resolver exists)
    fetch(`https://enstate.rs/n/${value}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => {
        // ENS is valid if it has a resolver (even if address is null/zero)
        // Or if it has a non-zero address
        const hasResolver = !!(data && data.resolver && data.resolver !== '0x0000000000000000000000000000000000000000');
        const hasAddress = !!(data && data.address && data.address !== '0x0000000000000000000000000000000000000000');
        const valid = hasResolver || hasAddress;
        setIsVerified(valid);
        setIsChecking(false);
        onValidationChangeRef.current?.(valid);
      })
      .catch(() => {
        setIsVerified(false);
        setIsChecking(false);
        onValidationChangeRef.current?.(false);
      });
  }, [value, isENS]);

  // Notify parent of validation state for non-ENS values
  useEffect(() => {
    if (!isENS && value) {
      onValidationChangeRef.current?.(isValidAddress);
    } else if (!value) {
      onValidationChangeRef.current?.(false);
    }
  }, [value, isENS, isValidAddress]);

  const showError = isENS && !isChecking && !isVerified;

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          type="text"
          placeholder="0x... or vitalik.eth"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`input font-mono text-sm ${isENS ? 'pr-12' : ''} ${showError ? 'border-red-300 dark:border-red-500/50 focus:ring-red-500/20' : ''}`}
        />
        {isENS && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isChecking ? (
              <div className="w-8 h-8 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="relative">
                <div className={`w-8 h-8 rounded-full ${isVerified ? 'ring-2 ring-emerald-500' : 'ring-2 ring-red-400'} p-0.5`}>
                  {avatarUrl && hasAvatar ? (
                    <img 
                      src={avatarUrl} 
                      alt={value} 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className={`w-full h-full rounded-full bg-gradient-to-br ${generateAddressGradient(value)} flex items-center justify-center text-white text-xs font-bold`}>
                      {getInitials(value)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {showError && (
        <p className="text-xs text-red-500 dark:text-red-400">
          "{value}" is not a registered ENS name
        </p>
      )}
    </div>
  );
}

export default function CreatePage() {
  const [amount, setAmount] = useState('');
  const [token] = useState('USDC');
  const [recipient, setRecipient] = useState('');
  const [isRecipientValid, setIsRecipientValid] = useState(false);
  const [note, setNote] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createIntent = async () => {
    setError(null);
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!isRecipientValid) {
      setError('Please enter a valid wallet address or registered ENS name');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, token, recipient: recipient.trim(), note })
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to create payment link');
      }
      const data = await res.json();
      if (data.intentId) {
        setLink(`${window.location.origin}/pay/${data.intentId}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Error creating payment link');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (link) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Success state
  if (link) {
    return (
      <div className="py-8 lg:py-12 max-w-lg mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Success header */}
        <div className="text-center space-y-4 mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Payment Link Ready</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Share this link to receive your payment</p>
          </div>
        </div>

        {/* Payment summary card */}
        <div className="card space-y-6">
          {/* Amount display */}
          <div className="text-center py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Amount</p>
            <p className="text-4xl font-bold text-slate-900 dark:text-white">${Number(amount).toFixed(2)}</p>
            <p className="text-slate-500 font-medium mt-1">{token}</p>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Details */}
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-sm text-slate-500">Recipient</span>
              <span className="font-mono text-sm text-slate-900 dark:text-white text-right max-w-[200px] break-all">
                {recipient.length > 20 
                  ? `${recipient.slice(0, 10)}...${recipient.slice(-8)}`
                  : recipient
                }
              </span>
            </div>
            {note && (
              <div className="flex justify-between items-start">
                <span className="text-sm text-slate-500">Note</span>
                <span className="text-sm text-slate-700 dark:text-slate-300 text-right max-w-[200px]">{note}</span>
              </div>
            )}
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Link with copy */}
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Payment Link</p>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
                <p className="text-sm font-mono text-slate-600 dark:text-slate-400 truncate">{link}</p>
              </div>
              <button
                onClick={copyToClipboard}
                className={`flex-shrink-0 px-4 rounded-lg border transition-all ${
                  copied 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            {copied && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Copied to clipboard
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setLink(null);
                setAmount('');
                setRecipient('');
                setNote('');
              }}
              className="btn-secondary flex-1"
            >
              Create New
            </button>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost flex-1 flex items-center justify-center gap-2"
            >
              <span>Preview</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Create form
  return (
    <div className="py-8 lg:py-12 max-w-lg mx-auto">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="card space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center">
            <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Create Payment Link</h1>
          <p className="text-sm text-slate-500">Accept crypto from any chain, receive USDC on Polygon</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount (USD)</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input text-center text-2xl font-semibold"
            />
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Recipient Address</label>
            <RecipientInput value={recipient} onChange={setRecipient} onValidationChange={setIsRecipientValid} />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Note <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="What's this payment for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={createIntent}
          disabled={loading || !amount || !isRecipientValid}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Create Payment Link
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </button>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>Cross-chain payments</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>ENS support</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>Best rates via LI.FI</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>Instant settlement</span>
          </div>
        </div>
      </div>
    </div>
  );
}
