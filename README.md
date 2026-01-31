# PayLink — Cross-Chain USDC Payments Powered by LI.FI

**Built for ETHGlobal HackMoney 2026** 

## What is PayLink?

PayLink lets anyone create shareable payment links for USDC. The payer can pay from **any EVM chain** using **any token** — LI.FI handles all swaps and bridges automatically.

**One signature. Any chain. Any token. USDC delivered.**

## LI.FI Integration

This project uses **@lifi/sdk** as the core execution layer:

1. **Real Cross-Chain Execution**: Uses `executeRoute()` from LI.FI SDK to execute payments
2. **Multi-Chain Support**: Pay from Ethereum, Polygon, Arbitrum, Base, or Optimism
3. **Single Transaction UX**: User signs once; LI.FI handles swap + bridge automatically
4. **Quote → Execute Flow**: Clear separation between fetching routes and executing them


## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │     │     LI.FI       │
│  React + Vite   │     │  Express API    │     │  SDK + Infra    │
│  wagmi + Rainbow│     │  Intent Store   │     │                 │
└────────┬────────┘     └─────────────────┘     └────────┬────────┘
         │                                                │
         │              User's Wallet                     │
         └───────────────────┬───────────────────────────┘
                             │
                    Signs ONE transaction
                             │
                             ▼
              LI.FI executes swap + bridge
```

### Non-Custodial Design

- **Backend never touches funds** — only stores payment intents
- **Frontend executes routes** — using LI.FI SDK with user's wallet
- **Transparent fees** — all gas/bridge fees shown upfront

## Safety

> "PayLink is non-custodial. Funds never touch our backend. We only coordinate intent execution using audited routing infrastructure."
