import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import { Users, Plus, Trash2, Copy, Check, ArrowLeft, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useENSProfile, formatAddress, generateAddressGradient, getInitials } from '../lib/useENS'
import ShareMenu from '../components/ShareMenu'

interface Participant {
  id: string
  address: string
  share: number
}

// Check if address is valid for ENS lookup
function isValidForENS(address: string): boolean {
  if (!address) return false
  // Only lookup ENS for .eth names or valid 0x addresses
  if (address.endsWith('.eth')) return address.length > 4
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// ENS Avatar component with fallback - only looks up if valid
function ENSAvatar({ address, size = 'sm' }: { address: string; size?: 'sm' | 'md' }) {
  const shouldLookup = isValidForENS(address)
  const { avatar, name } = useENSProfile(shouldLookup ? address as `0x${string}` : undefined)
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
  
  if (avatar) {
    return <img src={avatar} alt={name || address} className={`${sizeClass} rounded-full object-cover`} />
  }
  
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br ${generateAddressGradient(address)} flex items-center justify-center text-white font-medium`}>
      {getInitials(name || address)}
    </div>
  )
}

// Participant input with ENS validation (using ENS metadata service to avoid CORS)
function ParticipantInput({ 
  value, 
  onChange, 
  onValidationChange,
  placeholder 
}: { 
  value: string; 
  onChange: (v: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  placeholder?: string;
}) {
  const isENS = value.endsWith('.eth') && value.length > 4
  const isValidAddress = !!(value && isAddress(value))
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [hasAvatar, setHasAvatar] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  
  // Use ref to avoid infinite loops with callback in dependencies
  const onValidationChangeRef = useRef(onValidationChange)
  onValidationChangeRef.current = onValidationChange

  useEffect(() => {
    if (!isENS) {
      setAvatarUrl(null)
      setHasAvatar(false)
      setIsVerified(false)
      setIsChecking(false)
      return
    }
    
    setIsChecking(true)
    setIsVerified(false)
    setHasAvatar(false)
    
    // Use ENS metadata service for avatar
    const avatarUrlStr = `https://metadata.ens.domains/mainnet/avatar/${value}`
    setAvatarUrl(avatarUrlStr)
    
    // Check avatar (for display purposes)
    const img = new Image()
    img.onload = () => setHasAvatar(true)
    img.onerror = () => setHasAvatar(false)
    img.src = avatarUrlStr
    
    // Use ensideas API to verify ENS registration (more reliable)
    fetch(`https://api.ensideas.com/ens/resolve/${value}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then(data => {
        // If we get an address back, ENS is registered
        const valid = !!(data && data.address)
        setIsVerified(valid)
        setIsChecking(false)
        onValidationChangeRef.current?.(valid)
      })
      .catch(() => {
        setIsVerified(false)
        setIsChecking(false)
        onValidationChangeRef.current?.(false)
      })
  }, [value, isENS])

  // Notify parent of validation state for non-ENS values
  useEffect(() => {
    if (!isENS && value) {
      onValidationChangeRef.current?.(isValidAddress)
    } else if (!value) {
      onValidationChangeRef.current?.(false)
    }
  }, [value, isENS, isValidAddress])

  const showError = isENS && !isChecking && !isVerified
  const showSuccess = (isENS && isVerified) || isValidAddress

  return (
    <div className="space-y-1 flex-1">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "0x... or vitalik.eth"}
          className={`input py-2.5 text-sm font-mono ${isENS ? 'pr-10' : ''} ${showError ? 'border-red-300 dark:border-red-500/50' : showSuccess ? 'border-emerald-300 dark:border-emerald-500/50' : ''}`}
        />
        {isENS && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {isChecking ? (
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className={`w-6 h-6 rounded-full ${isVerified ? 'ring-2 ring-emerald-500' : 'ring-2 ring-red-400'} p-0.5`}>
                {avatarUrl && hasAvatar ? (
                  <img 
                    src={avatarUrl} 
                    alt={value} 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className={`w-full h-full rounded-full bg-gradient-to-br ${generateAddressGradient(value)} flex items-center justify-center text-white text-[8px] font-bold`}>
                    {getInitials(value)}
                  </div>
                )}
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
  )
}

// Participant display with ENS - simplified, no loading state blocking
function ParticipantDisplay({ address }: { address: string }) {
  const shouldLookup = isValidForENS(address)
  const { name } = useENSProfile(shouldLookup ? address as `0x${string}` : undefined)
  
  // For ENS names entered directly (vitalik.eth)
  if (address.endsWith('.eth')) {
    return (
      <span className="flex items-center gap-1.5">
        <ENSAvatar address={address} />
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{address}</span>
      </span>
    )
  }
  
  // For addresses that resolved to ENS names
  if (name) {
    return (
      <span className="flex items-center gap-1.5">
        <ENSAvatar address={address} />
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{name}</span>
      </span>
    )
  }
  
  // Default: show formatted address
  return (
    <span className="flex items-center gap-1.5">
      <ENSAvatar address={address} />
      <span className="font-mono text-slate-600 dark:text-slate-400">{formatAddress(address)}</span>
    </span>
  )
}

export default function SplitPage() {
  const { address } = useAccount()
  const [totalAmount, setTotalAmount] = useState('')
  const [description, setDescription] = useState('')
  const [recipient, setRecipient] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', address: '', share: 100 },
  ])
  const [participantValidations, setParticipantValidations] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [splitCreated, setSplitCreated] = useState(false)
  const [splitId, setSplitId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addParticipant = () => {
    const newShare = Math.floor(100 / (participants.length + 1))
    const updatedParticipants = participants.map(p => ({ ...p, share: newShare }))
    setParticipants([
      ...updatedParticipants,
      { id: Date.now().toString(), address: '', share: newShare }
    ])
  }

  const removeParticipant = (id: string) => {
    if (participants.length <= 1) return
    const filtered = participants.filter(p => p.id !== id)
    const newShare = Math.floor(100 / filtered.length)
    setParticipants(filtered.map(p => ({ ...p, share: newShare })))
  }

  const updateParticipant = (id: string, field: 'address' | 'share', value: string | number) => {
    setParticipants(participants.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ))
  }

  const totalShares = participants.reduce((sum, p) => sum + p.share, 0)

  const updateParticipantValidation = (id: string, isValid: boolean) => {
    setParticipantValidations(prev => ({ ...prev, [id]: isValid }))
  }

  const allParticipantsValid = participants.every(p => 
    p.address.trim() && participantValidations[p.id] === true
  )

  const handleCreateSplit = async () => {
    setError(null)
    
    // Validation
    if (!totalAmount || Number(totalAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }
    
    const recipientAddress = recipient || address
    if (!recipientAddress) {
      setError('Please enter a recipient address or connect your wallet')
      return
    }

    if (!allParticipantsValid) {
      setError('Please enter valid addresses or registered ENS names for all participants')
      return
    }

    if (totalShares !== 100) {
      setError('Shares must total 100%')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('http://localhost:3001/create-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(totalAmount),
          token: 'USDC',
          recipient: recipientAddress,
          note: description || undefined,
          participants: participants.map(p => ({
            address: p.address.trim(),
            share: p.share
          }))
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create split')
      }

      const data = await res.json()
      setSplitId(data.splitId)
      setSplitCreated(true)
    } catch (e: any) {
      setError(e.message || 'Error creating split')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    const link = `${window.location.origin}/split/${splitId}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Success state
  if (splitCreated && splitId) {
    return (
      <div className="py-8 lg:py-12 max-w-lg mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="card text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center">
            <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Split Created!</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Share this link with participants
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-500 mb-1">Split Amount</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">
              ${totalAmount} <span className="text-lg text-slate-500">USDC</span>
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {participants.length} participants
            </div>
          </div>

          {/* Participant breakdown */}
          <div className="text-left space-y-2">
            <p className="text-xs text-slate-500 font-medium">Breakdown</p>
            {participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm p-2 rounded bg-slate-50 dark:bg-slate-800">
                <ParticipantDisplay address={p.address} />
                <span className="font-medium text-slate-900 dark:text-white">
                  ${((Number(totalAmount) * p.share) / 100).toFixed(2)} ({p.share}%)
                </span>
              </div>
            ))}
          </div>

          <button onClick={copyLink} className="btn-primary w-full">
            {copied ? (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-5 h-5" />
                Copied!
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Copy className="w-5 h-5" />
                Copy Split Link
              </span>
            )}
          </button>

          {/* Share Menu */}
          <ShareMenu
            splitId={splitId}
            amount={Number(totalAmount)}
            description={description}
            buttonClassName="btn-secondary w-full flex items-center justify-center gap-2"
            buttonText="Share via Messenger"
          />

          {/* View Split button */}
          <Link 
            to={`/split/${splitId}`} 
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <Users className="w-5 h-5" />
            View Split Details
          </Link>

          <button 
            onClick={() => {
              setSplitCreated(false)
              setSplitId(null)
              setTotalAmount('')
              setDescription('')
              setRecipient('')
              setParticipants([
                { id: '1', address: '', share: 50 },
                { id: '2', address: '', share: 50 },
              ])
            }} 
            className="btn-secondary w-full"
          >
            Create Another Split
          </button>
        </div>
      </div>
    )
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
          <div className="w-12 h-12 mx-auto rounded-full bg-violet-100 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Cross-chain Bill Split</h1>
          <p className="text-sm text-slate-500">Pay together, from any chain</p>
        </div>

        {/* Total Amount */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Amount (USDC)</label>
          <input
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="0.00"
            className="input text-center text-2xl font-semibold"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description (Optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dinner, rent, trip..."
            className="input"
          />
        </div>

        {/* Participants */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Participants</label>
            <button
              onClick={addParticipant}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>

          <div className="space-y-2">
            {participants.map((participant, index) => (
              <div key={participant.id} className="flex items-start gap-2">
                <ParticipantInput
                  value={participant.address}
                  onChange={(v) => updateParticipant(participant.id, 'address', v)}
                  onValidationChange={(isValid) => updateParticipantValidation(participant.id, isValid)}
                  placeholder={`Participant ${index + 1} address or ENS`}
                />
                <div className="w-20 flex-shrink-0">
                  <div className="relative">
                    <input
                      type="number"
                      value={participant.share}
                      onChange={(e) => updateParticipant(participant.id, 'share', Number(e.target.value))}
                      className="input py-2.5 text-sm text-center pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
                  </div>
                </div>
                {participants.length > 2 && (
                  <button
                    onClick={() => removeParticipant(participant.id)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors mt-0.5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Share validation */}
          {totalShares !== 100 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Shares must total 100% (currently {totalShares}%)
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Preview */}
        {totalAmount && participants.some(p => p.address) && (
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Split Preview</p>
            {participants.filter(p => p.address).map((p) => (
              <div key={p.id} className="flex justify-between items-center text-sm">
                <ParticipantDisplay address={p.address} />
                <span className="text-slate-900 dark:text-white font-medium">
                  ${((Number(totalAmount) * p.share) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleCreateSplit}
          disabled={loading || !totalAmount || !allParticipantsValid || totalShares !== 100}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </span>
          ) : (
            'Create Split'
          )}
        </button>

        {/* Validation hints */}
        {(!totalAmount || !allParticipantsValid || totalShares !== 100) && (
          <div className="text-xs text-slate-500 space-y-1">
            {!totalAmount && <p>• Enter a total amount</p>}
            {!allParticipantsValid && (
              <p>• Enter valid addresses or registered ENS names for all participants</p>
            )}
            {totalShares !== 100 && <p>• Shares must total 100% (currently {totalShares}%)</p>}
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>Cross-chain payments</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>Auto-split amounts</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>ENS support</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>Track payments</span>
          </div>
        </div>
      </div>
    </div>
  )
}
