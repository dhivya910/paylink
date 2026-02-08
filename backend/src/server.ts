import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { isAddress } from 'viem';
import { readFileSync, writeFileSync, existsSync } from 'fs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// =============================================================================
// TYPES
// =============================================================================

type Intent = {
  id: string;
  type: 'payment' | 'split';
  amount: number;
  token: string;           // e.g., 'USDC'
  recipient: string;       // EVM address or ENS name
  note?: string;
  status: 'unpaid' | 'partial' | 'paid';
  txHash?: string;
  createdAt: number;
  // Split-specific fields
  participants?: {
    address: string;
    share: number;
    paid: boolean;
    txHash?: string;
  }[];
  paidCount?: number;
  totalParticipants?: number;
};

// =============================================================================
// PERSISTENT STORAGE (JSON FILE)
// =============================================================================

const DATA_FILE = './data/intents.json';

// Load intents from file on startup
function loadIntents(): Map<string, Intent> {
  try {
    if (existsSync(DATA_FILE)) {
      const data = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
      return new Map(Object.entries(data));
    }
  } catch (err) {
    console.error('Failed to load intents:', err);
  }
  return new Map();
}

// Save intents to file
function saveIntents() {
  try {
    const data = Object.fromEntries(intents);
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save intents:', err);
  }
}

const intents = loadIntents();

// =============================================================================
// HELPERS
// =============================================================================

// Validate recipient: either valid EVM address or ENS name
function isValidRecipient(recipient: string): boolean {
  if (!recipient || typeof recipient !== 'string') return false;
  const trimmed = recipient.trim().toLowerCase();
  
  // ENS name check
  if (trimmed.endsWith('.eth')) return trimmed.length > 4;
  
  // Handle addresses with or without 0x prefix
  const address = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  return isAddress(address);
}

// Generate a simple intent ID
const generateIntentId = () => `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const generateSplitId = () => `split_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /create-intent
 * 
 * Creates a new payment intent. 
 */
app.post('/create-intent', (req, res) => {
  const { amount, token, recipient, note } = req.body || {};
  
  // Validation
  if (!amount || !token || !recipient) {
    return res.status(400).json({ error: 'amount, token, recipient required' });
  }
  
  if (!isValidRecipient(recipient)) {
    return res.status(400).json({ 
      error: 'Invalid recipient. Must be a valid EVM address (0x...) or ENS name (.eth)' 
    });
  }
  
  const numAmount = Number(amount);
  if (Number.isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  // Create intent
  const id = generateIntentId();
  const intent: Intent = {
    id,
    type: 'payment',
    amount: numAmount,
    token: token.toUpperCase(),
    recipient: recipient.trim(),
    note: note?.trim() || undefined,
    status: 'unpaid',
    createdAt: Date.now(),
  };
  
  intents.set(id, intent);
  saveIntents();
  
  console.log(`✅ Created intent ${id}: ${numAmount} ${token} → ${recipient}`);
  
  return res.json({ 
    intentId: id, 
    url: `/pay/${id}`,
    message: 'Payment link created successfully'
  });
});

/**
 * GET /intent/:id
 * 
 * Retrieves an intent by ID.
 */
app.get('/intent/:id', (req, res) => {
  const { id } = req.params;
  const intent = intents.get(id);
  
  if (!intent) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  
  return res.json(intent);
});

/**
 * GET /intents
 * 
 * Lists all intents.
 */
app.get('/intents', (_req, res) => {
  const all = Array.from(intents.values()).sort((a, b) => b.createdAt - a.createdAt);
  return res.json(all);
});

/**
 * POST /create-split
 * 
 * Creates a new split payment
 */
app.post('/create-split', (req, res) => {
  const { amount, token, recipient, note, participants } = req.body || {};
  
  // Validation
  if (!amount || !token || !recipient || !participants) {
    return res.status(400).json({ error: 'amount, token, recipient, participants required' });
  }
  
  if (!isValidRecipient(recipient)) {
    return res.status(400).json({ error: 'Invalid recipient address' });
  }

  if (!Array.isArray(participants) || participants.length < 1) {
    return res.status(400).json({ error: 'At least 1 participant required' });
  }

  const numAmount = Number(amount);
  if (Number.isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  // Create split intent
  const id = generateSplitId();
  const intent: Intent = {
    id,
    type: 'split',
    amount: numAmount,
    token: token.toUpperCase(),
    recipient: recipient.trim(),
    note: note?.trim() || undefined,
    status: 'unpaid',
    createdAt: Date.now(),
    participants: participants.map((p: { address: string; share: number }) => ({
      address: p.address.trim(),
      share: p.share,
      paid: false,
    })),
    paidCount: 0,
    totalParticipants: participants.length,
  };
  
  intents.set(id, intent);
  saveIntents();
  
  console.log(`✅ Created split ${id}: ${numAmount} ${token} with ${participants.length} participants`);
  
  return res.json({ 
    splitId: id, 
    url: `/split/${id}`,
    message: 'Split payment created successfully'
  });
});

/**
 * POST /split/:id/pay
 * 
 * Mark a participant as paid in a split.
 */
app.post('/split/:id/pay', (req, res) => {
  const { id } = req.params;
  const { participantAddress, txHash } = req.body || {};
  
  const intent = intents.get(id);
  if (!intent || intent.type !== 'split') {
    return res.status(404).json({ error: 'Split not found' });
  }
  
  if (!intent.participants) {
    return res.status(400).json({ error: 'Invalid split data' });
  }
  
  const participant = intent.participants.find(
    p => p.address.toLowerCase() === participantAddress?.toLowerCase()
  );
  
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }
  
  if (participant.paid) {
    return res.json({ ok: true, message: 'Already paid' });
  }
  
  // Mark as paid
  participant.paid = true;
  participant.txHash = txHash;
  intent.paidCount = (intent.paidCount || 0) + 1;
  
  // Update overall status
  if (intent.paidCount === intent.totalParticipants) {
    intent.status = 'paid';
  } else if (intent.paidCount > 0) {
    intent.status = 'partial';
  }
  
  intents.set(id, intent);
  saveIntents();
  
  console.log(`💰 Split ${id}: ${participantAddress} paid (${intent.paidCount}/${intent.totalParticipants})`);
  
  return res.json({ 
    ok: true, 
    paidCount: intent.paidCount,
    totalParticipants: intent.totalParticipants,
    status: intent.status
  });
});

/**
 * POST /fusion/callback
 * 
 * Updates intent status after successful payment.
 */
app.post('/fusion/callback', (req, res) => {
  const { intentId, txHash } = req.body || {};
  
  const intent = intents.get(intentId);
  if (!intent) {
    return res.status(404).json({ error: 'Intent not found' });
  }
  
  if (intent.status === 'paid') {
    return res.json({ ok: true, message: 'Already marked as paid' });
  }
  
  // Update status
  intent.status = 'paid';
  intent.txHash = txHash || undefined;
  intents.set(intentId, intent);
  saveIntents();
  
  console.log(`💰 Payment completed for ${intentId}: ${txHash}`);
  
  return res.json({ ok: true, message: 'Payment status updated' });
});

/**
 * DELETE /intent/:id
 * 
 * Deletes/closes an intent or split.
 */
app.delete('/intent/:id', (req, res) => {
  const { id } = req.params;
  
  const intent = intents.get(id);
  if (!intent) {
    return res.status(404).json({ error: 'Intent not found' });
  }
  
  intents.delete(id);
  saveIntents();
  
  console.log(`🗑️ Deleted ${intent.type} ${id}`);
  
  return res.json({ ok: true, message: `${intent.type === 'split' ? 'Split' : 'Payment'} closed successfully` });
});

/**
 * GET /health
 * 
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
  return res.json({ 
    status: 'ok', 
    activeIntents: intents.size,
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// START SERVER
// =============================================================================

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
