import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Check, 
  Clock, 
  Copy, 
  ExternalLink, 
  Users, 
  Loader2,
  AlertCircle,
  Trash2
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useENSProfile, formatAddress, generateAddressGradient, getInitials } from '../lib/useENS'
import { showToast } from '../lib/notifications'
import { ShareMenu } from '../components/ShareMenu'

interface Participant {
  address: string
  share: number
  paid: boolean
  txHash?: string
}

interface SplitIntent {
  id: string
  type: 'split'
  amount: number
  token: string
  recipient: string
  note?: string
  status: 'unpaid' | 'partial' | 'paid'
  createdAt: number
  participants: Participant[]
  paidCount: number
  totalParticipants: number
}

// Check if address is valid for ENS lookup
function isValidForENS(address: string): boolean {
  if (!address) return false
  if (address.endsWith('.eth')) return address.length > 4
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// ENS Avatar component
function ENSAvatar({ address, size = 'md' }: { address: string; size?: 'sm' | 'md' | 'lg' }) {
  const shouldLookup = isValidForENS(address)
  const { avatar, name } = useENSProfile(shouldLookup ? address as `0x${string}` : undefined)
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base'
  
  if (avatar) {
    return <img src={avatar} alt={name || address} className={`${sizeClass} rounded-full object-cover`} />
  }
  
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br ${generateAddressGradient(address)} flex items-center justify-center text-white font-bold`}>
      {getInitials(name || address)}
    </div>
  )
}

// Address display with ENS
function AddressDisplay({ address, className = '' }: { address: string; className?: string }) {
  const shouldLookup = isValidForENS(address)
  const { name } = useENSProfile(shouldLookup ? address as `0x${string}` : undefined)
  
  if (address.endsWith('.eth')) {
    return <span className={`text-emerald-600 dark:text-emerald-400 font-medium ${className}`}>{address}</span>
  }
  
  if (name) {
    return <span className={`text-emerald-600 dark:text-emerald-400 font-medium ${className}`}>{name}</span>
  }
  
  return <span className={`font-mono ${className}`}>{formatAddress(address)}</span>
}

export default function SplitDetailPage() {
  const { splitId } = useParams<{ splitId: string }>()
  const navigate = useNavigate()
  const { address: userAddress } = useAccount()
  const [split, setSplit] = useState<SplitIntent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [closing, setClosing] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  useEffect(() => {
    if (!splitId) return
    
    fetch(`http://localhost:3001/intent/${splitId}`)
      .then(r => {
        if (!r.ok) throw new Error('Split not found')
        return r.json()
      })
      .then(data => {
        if (data.type !== 'split') throw new Error('Not a split payment')
        setSplit(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [splitId])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    showToast('Link copied!', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCloseSplit = async () => {
    if (!splitId) return
    setClosing(true)
    try {
      const res = await fetch(`http://localhost:3001/intent/${splitId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to close split')
      showToast('Split closed successfully', 'success')
      navigate('/')
    } catch (err) {
      showToast('Failed to close split', 'error')
      setClosing(false)
      setShowCloseConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mb-4" />
        <p className="text-gray-500">Loading split details...</p>
      </div>
    )
  }

  if (error || !split) {
    return (
      <div className="py-20 max-w-md mx-auto text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Split Not Found</h2>
        <p className="text-gray-500 mb-6">{error || 'This split payment does not exist.'}</p>
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </div>
    )
  }

  const isSettled = split.status === 'paid'
  const unpaidCount = split.participants.filter(p => !p.paid).length
  const paidCount = split.totalParticipants - unpaidCount
  const progressPercent = (paidCount / split.totalParticipants) * 100

  // Check if current user is a participant
  const userParticipant = userAddress 
    ? split.participants.find(p => p.address.toLowerCase() === userAddress.toLowerCase())
    : null

  return (
    <div className="py-12 max-w-2xl mx-auto">
      {/* Back link */}
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      {/* Header card */}
      <div className={`card p-6 mb-6 ${
        isSettled 
          ? 'border-emerald-200 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-500/5 dark:to-gray-900' 
          : ''
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isSettled 
                ? 'bg-emerald-100 dark:bg-emerald-500/10' 
                : 'bg-violet-100 dark:bg-violet-500/10'
            }`}>
              {isSettled ? (
                <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                ${split.amount.toFixed(2)} <span className="text-lg text-gray-500">{split.token}</span>
              </h1>
              {split.note && (
                <p className="text-gray-600 dark:text-gray-400">{split.note}</p>
              )}
            </div>
          </div>
          
          <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            isSettled
              ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : split.status === 'partial'
                ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                : 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
          }`}>
            {isSettled ? '✓ Settled' : `${unpaidCount} pending`}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium text-gray-900 dark:text-white">{paidCount}/{split.totalParticipants} paid</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${isSettled ? 'bg-emerald-500' : 'bg-violet-500'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Recipient */}
        <div className="flex items-center justify-between py-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-500">Collecting to</span>
          <div className="flex items-center gap-2">
            <ENSAvatar address={split.recipient} size="sm" />
            <AddressDisplay address={split.recipient} />
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
          {/* Primary actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span className="text-sm font-medium">{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
            
            {/* Share Menu */}
            <ShareMenu
              splitId={split.id}
              amount={split.amount}
              description={split.note}
              buttonClassName="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              buttonText="Share"
            />
          </div>

          {/* Close Split */}
          {!showCloseConfirm ? (
            <button
              onClick={() => setShowCloseConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Close Split
            </button>
          ) : (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                Are you sure you want to close this split? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCloseConfirm(false)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloseSplit}
                  disabled={closing}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {closing ? 'Closing...' : 'Yes, Close'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User's status (if participant) */}
      {userParticipant && (
        <div className={`card p-4 mb-6 ${
          userParticipant.paid 
            ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5' 
            : 'border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/5'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Your share</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                ${((split.amount * userParticipant.share) / 100).toFixed(2)}
                <span className="text-sm text-gray-500 ml-1">({userParticipant.share}%)</span>
              </p>
            </div>
            {userParticipant.paid ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Check className="w-5 h-5" />
                <span className="font-medium">Paid</span>
              </div>
            ) : (
              <button className="btn-primary">
                Pay now
              </button>
            )}
          </div>
          {userParticipant.txHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${userParticipant.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View transaction
            </a>
          )}
        </div>
      )}

      {/* Participants list */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
          Participants ({split.totalParticipants})
        </h2>
        
        <div className="space-y-3">
          {split.participants.map((participant, index) => {
            const shareAmount = (split.amount * participant.share) / 100
            const isCurrentUser = userAddress && participant.address.toLowerCase() === userAddress.toLowerCase()
            
            return (
              <div 
                key={index}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  participant.paid 
                    ? 'bg-emerald-50 dark:bg-emerald-500/5' 
                    : 'bg-gray-50 dark:bg-gray-800/50'
                } ${isCurrentUser ? 'ring-2 ring-indigo-500/20' : ''}`}
              >
                {/* Avatar */}
                <div className="relative">
                  <ENSAvatar address={participant.address} size="md" />
                  {participant.paid && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <AddressDisplay address={participant.address} className="text-sm" />
                    {isCurrentUser && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {participant.share}% • ${shareAmount.toFixed(2)}
                  </p>
                </div>
                
                {/* Status */}
                <div className="text-right">
                  {participant.paid ? (
                    <div>
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Paid</span>
                      {participant.txHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${participant.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 mt-0.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Tx
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">Pending</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Created date */}
      <p className="text-center text-xs text-gray-500 mt-6">
        Created {new Date(split.createdAt).toLocaleDateString()} at {new Date(split.createdAt).toLocaleTimeString()}
      </p>
    </div>
  )
}
