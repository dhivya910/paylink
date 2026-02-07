# Zap — Cross-Chain USDC Payments Powered by LI.FI + Uniswap

**Built for ETHGlobal HackMoney 2026** 

## What is Zap?

Zap lets anyone create shareable payment links for USDC. The payer can pay from **any EVM chain** using **any token** — we automatically find the best route.

**One signature. Any chain. Any token. USDC delivered.**

## DEX & Bridge Integrations

### Uniswap V3 (Same-Chain)
- Direct ETH → USDC swaps on supported chains
- Best rates via 0.3% fee tier pools
- Slippage protection with exact output swaps

### LI.FI (Cross-Chain)
- Aggregates 15+ bridges and 30+ DEXes
- Automatic route optimization
- Single-transaction UX for swap + bridge

```
User selects payment method:
├── Same chain (Polygon) → Uniswap V3 direct swap
└── Cross chain (ETH → Polygon) → LI.FI bridge + swap
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │     │  Uniswap/LI.FI  │
│  React + Vite   │     │  Express API    │     │  Smart Routing  │
│  wagmi + Rainbow│     │  Intent Store   │     │                 │
└────────┬────────┘     └─────────────────┘     └────────┬────────┘
         │                                                │
         │              User's Wallet                     │
         └───────────────────┬───────────────────────────┘
                             │
                    Signs ONE transaction
                             │
                             ▼
              Uniswap swap or LI.FI bridge
```

### Non-Custodial Design

- **Backend never touches funds** — only stores payment intents
- **Frontend executes routes** — using Uniswap/LI.FI SDK with user's wallet
- **Transparent fees** — all gas/swap fees shown upfront

## Safety

> "Zap is non-custodial. Funds never touch our backend. We only coordinate intent execution using audited DEX and bridge infrastructure."
