import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Link2, 
  Users, 
  Zap, 
  Globe, 
  Shield, 
  ArrowRight,
  Check,
  Clock,
  Wallet,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Trash2
} from 'lucide-react'
import { useENSProfile, formatAddress, generateAddressGradient, getInitials } from '../lib/useENS'
import { copyShareLink } from '../lib/notifications'
import { ShareButton } from '../components/ShareMenu'

// Types matching backend
interface Participant {
  address: string
  share: number
  paid: boolean
  txHash?: string
}

interface Intent {
  id: string
  type: 'payment' | 'split'
  amount: number
  token: string
  recipient: string
  note?: string
  status: 'unpaid' | 'partial' | 'paid'
  txHash?: string
  createdAt: number
  // Split-specific
  participants?: Participant[]
  paidCount?: number
  totalParticipants?: number
}

const features = [
  { icon: Globe, label: 'Cross-chain' },
  { icon: Wallet, label: 'Any token' },
  { icon: Shield, label: 'Non-custodial' },
]

// Mock route data for display (in production, store this with the intent)
const mockRouteData: Record<string, { fromChain: string; toChain: string; bridge: string }> = {}

function getRouteData(intentId: string) {
  if (!mockRouteData[intentId]) {
    const chains = ['Ethereum', 'Polygon', 'Arbitrum', 'Base', 'Optimism']
    const bridges = ['Stargate', 'Across', 'Hop', 'Connext']
    mockRouteData[intentId] = {
      fromChain: chains[Math.floor(Math.random() * chains.length)],
      toChain: 'Polygon',
      bridge: bridges[Math.floor(Math.random() * bridges.length)],
    }
  }
  return mockRouteData[intentId]
}

// Check if address is valid for ENS lookup
function isValidForENS(address: string): boolean {
  if (!address) return false
  if (address.endsWith('.eth')) return address.length > 4
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// ENS Avatar with gradient fallback - only looks up if valid
function ENSAvatar({ address, size = 'sm' }: { address: string; size?: 'sm' | 'md' }) {
  const shouldLookup = isValidForENS(address)
  const { avatar, name } = useENSProfile(shouldLookup ? address as `0x${string}` : undefined)
  const sizeClass = size === 'sm' ? 'w-5 h-5 text-[8px]' : 'w-7 h-7 text-xs'
  
  if (avatar) {
    return <img src={avatar} alt={name || address} className={`${sizeClass} rounded-full object-cover`} />
  }
  
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br ${generateAddressGradient(address)} flex items-center justify-center text-white font-bold`}>
      {getInitials(name || address)}
    </div>
  )
}

// Address display with ENS resolution - no blocking loading state
function AddressDisplay({ address, className = '' }: { address: string; className?: string }) {
  const shouldLookup = isValidForENS(address)
  const { name } = useENSProfile(shouldLookup ? address as `0x${string}` : undefined)
  
  // For ENS names entered directly
  if (address.endsWith('.eth')) {
    return (
      <span className={`flex items-center gap-1.5 ${className}`}>
        <ENSAvatar address={address} />
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{address}</span>
      </span>
    )
  }
  
  // For addresses that resolved to ENS names
  if (name) {
    return (
      <span className={`flex items-center gap-1.5 ${className}`}>
        <ENSAvatar address={address} />
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{name}</span>
      </span>
    )
  }
  
  // Default: show formatted address
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <ENSAvatar address={address} />
      <span className="font-mono">{formatAddress(address)}</span>
    </span>
  )
}

function IntentRow({ intent, isExpanded, onToggle, onDelete }: { 
  intent: Intent
  isExpanded: boolean
  onToggle: () => void
  onDelete: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const route = getRouteData(intent.id)
  const isSplit = intent.type === 'split'
  const paymentUrl = `${window.location.origin}/${isSplit ? 'split' : 'pay'}/${intent.id}`
  const unpaidCount = isSplit && intent.participants 
    ? intent.participants.filter(p => !p.paid).length 
    : 0

  const copyLink = () => {
    navigator.clipboard.writeText(paymentUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const getStatusBadge = () => {
    if (intent.status === 'paid') {
      return { bg: 'bg-emerald-100 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', label: 'Completed' }
    }
    if (intent.status === 'partial') {
      return { bg: 'bg-blue-100 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', label: `Partial • ${intent.paidCount}/${intent.totalParticipants} Paid` }
    }
    return { bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', label: 'Pending' }
  }

  const statusBadge = getStatusBadge()

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Main row - clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
      >
        {/* Type & Status icon */}
        {intent.status === 'paid' ? (
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        ) : intent.status === 'partial' ? (
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            {isSplit ? <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          </div>
        )}
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isSplit && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 font-medium">
                Split
              </span>
            )}
            <span className="font-semibold text-gray-900 dark:text-white">
              {intent.amount} {intent.token}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge.bg} ${statusBadge.text}`}>
              {statusBadge.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate">
            {intent.note || (isSplit 
              ? `${intent.totalParticipants} participants` 
              : `To: ${intent.recipient.slice(0, 8)}...${intent.recipient.slice(-6)}`
            )}
          </p>
        </div>

        {/* Time & expand */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{timeAgo(intent.createdAt)}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Recipient</p>
              <AddressDisplay address={intent.recipient} className="text-sm text-gray-900 dark:text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Created</p>
              <p className="text-sm text-gray-900 dark:text-white">
                {new Date(intent.createdAt).toLocaleDateString()}
              </p>
            </div>
            {(intent.status === 'paid' || intent.status === 'partial') && (
              <>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Route</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {route.fromChain} → {route.toChain}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Bridge</p>
                  <p className="text-sm text-gray-900 dark:text-white">{route.bridge}</p>
                </div>
              </>
            )}
          </div>

          {/* Split participants */}
          {isSplit && intent.participants && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Participants</p>
              <div className="space-y-1.5">
                {intent.participants.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {p.paid ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <AddressDisplay address={p.address} className="text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 dark:text-white font-medium">
                        ${((intent.amount * p.share) / 100).toFixed(2)}
                      </span>
                      <span className="text-gray-500">({p.share}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notification actions for unsettled splits */}
          {isSplit && intent.status !== 'paid' && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">
                    {unpaidCount} {unpaidCount === 1 ? 'participant' : 'participants'} haven't paid
                  </span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <ShareButton
                    splitId={intent.id}
                    amount={intent.amount}
                    description={intent.note}
                    className="p-2 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 transition-colors"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      copyShareLink(intent.id)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tx hash or payment link */}
          {intent.status === 'paid' && intent.txHash ? (
            <a
              href={`https://sepolia.etherscan.io/tx/${intent.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              View transaction
            </a>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={(e) => { e.stopPropagation(); copyLink(); }}
                className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              {isSplit && (
                <Link
                  to={`/split/${intent.id}`}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-4 h-4" />
                  View Split
                </Link>
              )}
              {!isSplit && (
                <Link
                  to={`/pay/${intent.id}`}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-4 h-4" />
                  Open
                </Link>
              )}
              
              {/* Delete button */}
              {!showDeleteConfirm ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                  className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Revoke
                </button>
              ) : (
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                    className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setDeleting(true);
                      onDelete(intent.id);
                    }}
                    disabled={deleting}
                    className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    {deleting ? 'Deleting...' : 'Confirm'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function LandingPage() {
  const [intents, setIntents] = useState<Intent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'partial' | 'paid'>('all')

  useEffect(() => {
    fetch('http://localhost:3001/intents')
      .then(r => r.json())
      .then(data => {
        setIntents(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleDeleteIntent = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3001/intent/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete')
      // Remove from local state
      setIntents(prev => prev.filter(i => i.id !== id))
      setExpandedId(null)
    } catch (err) {
      console.error('Failed to delete intent:', err)
    }
  }

  const filteredIntents = intents.filter(i => {
    if (filter === 'pending') return i.status === 'unpaid'
    if (filter === 'partial') return i.status === 'partial'
    if (filter === 'paid') return i.status === 'paid'
    return true
  })

  const pendingCount = intents.filter(i => i.status === 'unpaid').length
  const partialCount = intents.filter(i => i.status === 'partial').length
  const paidCount = intents.filter(i => i.status === 'paid').length

  return (
    <div className="py-12 lg:py-20 max-w-3xl mx-auto">
      {/* Hero */}
      <section className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
          Get paid in USDC from any chain
        </h1>
        
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
          Create payment links and split bills. Payers use any token on any chain — you receive USDC.
        </p>
      </section>

      {/* Primary Actions */}
      <section className="grid sm:grid-cols-2 gap-4 mb-12">
        <Link
          to="/create"
          className="group card p-6 flex items-center gap-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-500/10 
                        flex items-center justify-center flex-shrink-0">
            <Link2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 text-left">
            <h2 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Create Payment Link
            </h2>
            <p className="text-sm text-gray-500">Share a link to get paid</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
        </Link>

        <Link
          to="/split"
          className="group card p-6 flex items-center gap-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-500/10 
                        flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 text-left">
            <h2 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Cross-chain Bill Split
            </h2>
            <p className="text-sm text-gray-500">Pay together, from any chain</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
        </Link>
      </section>

      {/* Your Splits - GPay style */}
      {intents.filter(i => i.type === 'split').length > 0 && (
        <section className="card p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Your Splits</h3>
            </div>
            <Link 
              to="/split" 
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Create new
            </Link>
          </div>
          
          <div className="space-y-3">
            {intents
              .filter(i => i.type === 'split')
              .sort((a, b) => {
                // Show unsettled first
                if (a.status === 'paid' && b.status !== 'paid') return 1
                if (a.status !== 'paid' && b.status === 'paid') return -1
                return b.createdAt - a.createdAt
              })
              .map(split => {
                const unpaid = split.participants?.filter(p => !p.paid).length || 0
                const total = split.totalParticipants || 0
                const isSettled = split.status === 'paid'
                const progressPercent = total > 0 ? ((total - unpaid) / total) * 100 : 0
                
                return (
                  <Link
                    key={split.id}
                    to={`/split/${split.id}`}
                    className={`block p-4 rounded-xl border transition-all hover:shadow-md ${
                      isSettled 
                        ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            ${split.amount.toFixed(2)} {split.token}
                          </span>
                          {isSettled ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium">
                              ✓ Settled
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                              {unpaid} pending
                            </span>
                          )}
                        </div>
                        {split.note && (
                          <p className="text-sm text-gray-500 mt-0.5">{split.note}</p>
                        )}
                      </div>
                      
                      {/* Share button for unsettled */}
                      {!isSettled && (
                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
                          <ShareButton
                            splitId={split.id}
                            amount={split.amount}
                            description={split.note}
                            className="p-2 rounded-full hover:bg-violet-100 dark:hover:bg-violet-500/10 text-violet-600 dark:text-violet-400 transition-colors"
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Progress bar */}
                    <div className="mb-2">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            isSettled ? 'bg-emerald-500' : 'bg-violet-500'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Participants avatars */}
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {split.participants?.slice(0, 5).map((p, i) => (
                          <div
                            key={i}
                            className={`w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-bold text-white ${
                              p.paid 
                                ? 'bg-emerald-500' 
                                : `bg-gradient-to-br ${generateAddressGradient(p.address)}`
                            }`}
                            title={p.paid ? `${formatAddress(p.address)} - Paid` : formatAddress(p.address)}
                          >
                            {p.paid ? <Check className="w-3 h-3" /> : getInitials(p.address)}
                          </div>
                        ))}
                        {(split.participants?.length || 0) > 5 && (
                          <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-[8px] font-bold text-gray-600 dark:text-gray-300">
                            +{(split.participants?.length || 0) - 5}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {total - unpaid}/{total} paid
                      </span>
                    </div>
                  </Link>
                )
              })}
          </div>
        </section>
      )}

      {/* Payment Requests */}
      <section className="card p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Payment Requests</h3>
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'all' 
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              All ({intents.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'pending' 
                  ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Pending ({pendingCount})
            </button>
            {partialCount > 0 && (
              <button
                onClick={() => setFilter('partial')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filter === 'partial' 
                    ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' 
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Partial ({partialCount})
              </button>
            )}
            <button
              onClick={() => setFilter('paid')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'paid' 
                  ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Completed ({paidCount})
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-spin" />
          </div>
        ) : filteredIntents.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <Link2 className="w-6 h-6 text-gray-400" />
            </div>
            <p className="font-medium text-gray-900 dark:text-white text-sm mb-1">
              {filter === 'pending' 
                ? 'No pending requests'
                : filter === 'partial'
                  ? 'No partially paid requests'
                  : filter === 'paid'
                    ? 'No completed payments yet'
                    : 'No payment requests yet'
              }
            </p>
            <p className="text-gray-500 text-sm">
              {intents.length === 0 
                ? 'Send payment requests or split bills and get paid in USDC from any chain.'
                : filter === 'pending'
                  ? 'All your requests have been paid or are in progress.'
                  : filter === 'partial'
                    ? 'No split payments are partially complete.'
                    : filter === 'paid'
                      ? 'Completed payments will appear here.'
                      : ''
              }
            </p>
            {intents.length === 0 && (
              <Link to="/create" className="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 mt-3 hover:underline">
                Create your first request
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredIntents.map((intent) => (
              <IntentRow
                key={intent.id}
                intent={intent}
                isExpanded={expandedId === intent.id}
                onToggle={() => setExpandedId(expandedId === intent.id ? null : intent.id)}
                onDelete={handleDeleteIntent}
              />
            ))}
          </div>
        )}
      </section>

      {/* Route Preview - Interactive */}
      <section className="card p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Route Preview</h3>
          <span className="text-xs text-gray-500">Hover elements for details</span>
        </div>
        
        <div className="flex items-center justify-center gap-3 py-4">
          {/* From - ETH */}
          <div className="group/eth relative text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2 cursor-pointer hover:ring-2 hover:ring-indigo-500/50 transition-all">
              <span className="text-lg font-bold text-gray-600 dark:text-gray-400">ETH</span>
            </div>
            <p className="text-xs text-gray-500">Arbitrum</p>
          </div>
          
          {/* Arrow 1 - Swap */}
          <div className="group/swap relative flex-1 max-w-[60px] h-px bg-gradient-to-r from-gray-300 dark:from-gray-700 via-indigo-400 to-gray-300 dark:to-gray-700 cursor-pointer">
            <ArrowRight className="w-4 h-4 text-indigo-500 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 group-hover/swap:scale-125 transition-transform" />
            {/* Tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-4
                          opacity-0 group-hover/swap:opacity-100 pointer-events-none
                          transition-opacity duration-150 z-20">
              <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap border border-gray-700">
                <p className="font-medium">Swap via Uniswap</p>
                <p className="text-gray-400">Best price by LI.FI</p>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 
                            border-l-4 border-r-4 border-t-4 
                            border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-800" />
            </div>
          </div>
          
          {/* USDC - with swap tooltip */}
          <div className="group/usdc relative text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center mb-2 cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all">
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">USDC</span>
            </div>
            <p className="text-xs text-gray-500">Base</p>
            {/* Tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1
                          opacity-0 group-hover/usdc:opacity-100 pointer-events-none
                          transition-opacity duration-150 z-20">
              <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap border border-gray-700">
                <p className="font-medium">Swap executed via Uniswap</p>
                <p className="text-gray-400">Best price selected by LI.FI</p>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 
                            border-l-4 border-r-4 border-t-4 
                            border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-800" />
            </div>
          </div>
          
          {/* Arrow 2 - Bridge */}
          <div className="group/bridge relative flex-1 max-w-[60px] h-px bg-gradient-to-r from-gray-300 dark:from-gray-700 via-indigo-400 to-gray-300 dark:to-gray-700 cursor-pointer">
            <ArrowRight className="w-4 h-4 text-indigo-500 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 group-hover/bridge:scale-125 transition-transform" />
            {/* Tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-4
                          opacity-0 group-hover/bridge:opacity-100 pointer-events-none
                          transition-opacity duration-150 z-20">
              <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap border border-gray-700">
                <p className="font-medium">Bridged via Stargate</p>
                <p className="text-gray-400">Fastest + lowest fee route</p>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 
                            border-l-4 border-r-4 border-t-4 
                            border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-800" />
            </div>
          </div>
          
          {/* Recipient */}
          <div className="group/recipient relative text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mb-2 cursor-pointer hover:ring-2 hover:ring-emerald-500/50 transition-all">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xs text-gray-500">Recipient</p>
          </div>
        </div>

        {/* Fee indicator with tooltip */}
        <div className="flex justify-center mt-2">
          <div className="group/fee relative">
            <span className="text-sm text-gray-500 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Est. fees: <span className="font-medium text-emerald-600 dark:text-emerald-400">~$0.42</span>
            </span>
            {/* Tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2
                          opacity-0 group-hover/fee:opacity-100 pointer-events-none
                          transition-opacity duration-150 z-20">
              <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap border border-gray-700">
                <p className="font-medium">Gas + bridge + DEX fees</p>
                <p className="text-gray-400">Compared across 7 routes</p>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 
                            border-l-4 border-r-4 border-t-4 
                            border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-800" />
            </div>
          </div>
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-2">
          LI.FI finds the best route automatically
        </p>
      </section>

      {/* Why Zap */}
      <section className="text-center">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Why Zap</h3>
        
        <div className="flex flex-wrap justify-center gap-3">
          {features.map((feature) => (
            <div 
              key={feature.label}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                       bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium"
            >
              <feature.icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {feature.label}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
