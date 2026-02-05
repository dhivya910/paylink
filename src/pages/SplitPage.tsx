import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Users, Plus, Trash2, Copy, Check, ArrowLeft, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Participant {
  id: string
  address: string
  share: number
}

export default function SplitPage() {
  const { address } = useAccount()
  const [totalAmount, setTotalAmount] = useState('')
  const [description, setDescription] = useState('')
  const [recipient, setRecipient] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', address: '', share: 50 },
    { id: '2', address: '', share: 50 },
  ])
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
    if (participants.length <= 2) return
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

    if (!participants.every(p => p.address)) {
      setError('Please fill in all participant addresses')
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
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {p.address.slice(0, 6)}...{p.address.slice(-4)}
                </span>
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
              <div key={participant.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={participant.address}
                    onChange={(e) => updateParticipant(participant.id, 'address', e.target.value)}
                    placeholder={`Participant ${index + 1} address or ENS`}
                    className="input py-2.5 text-sm"
                  />
                </div>
                <div className="w-20">
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
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
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
              <div key={p.id} className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                  {p.address.includes('.eth') ? p.address : `${p.address.slice(0, 6)}...${p.address.slice(-4)}`}
                </span>
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
          disabled={loading || !totalAmount || !participants.every(p => p.address) || totalShares !== 100}
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
