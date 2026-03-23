# VEIL

VEIL is a Solana prediction market app with:

- custom markets
- imported Polymarket markets
- encrypted vote submission via Arcium-assisted flow
- manual resolution for custom markets
- result publishing and winner claiming

This repo currently targets **devnet** and uses:

- a deployed Solana program
- an Arcium-backed computation flow
- a backend proxy for Polymarket and Arcium helper routes
- a React frontend

## What The App Does

There are two market sources:

1. **Custom markets**
   - created directly inside VEIL
   - default to **0 SOL** starting pool
   - can optionally include a creator seed deposit
   - creator resolves the winner manually after expiry

2. **Imported Polymarket markets**
   - discovered through the Polymarket feed
   - imported into VEIL as actual on-chain VEIL markets
   - can also start at **0 SOL** or include an optional creator seed
   - later resolve against the linked Polymarket condition

## What Happens When A User Bets

The live flow is:

1. user chooses `YES` or `NO`
2. frontend asks the backend to prepare encrypted vote payload data
3. wallet signs the actual `place_vote` transaction
4. Solana program stores the position and updates market state
5. Arcium computation finalizes the encrypted market state
6. UI refreshes from chain state

Important:

- a canceled wallet signature should not create a real on-chain bet
- the UI now shows a clearer wallet-approval phase and captures the transaction signature after submit

## What Happens When A Market Resolves

### Custom markets

1. market creator selects the winner
2. frontend submits `resolve_market`
3. Arcium computation completes
4. app publishes the result on-chain
5. winners can claim

### Imported Polymarket markets

1. VEIL market is linked to a Polymarket condition
2. once resolvable, the result path is triggered
3. settlement is published in VEIL
4. winners can claim

## Current Reality And Caveats

This part is important.

The app is working end-to-end, but these implementation truths are still important:

- markets now default to **0 SOL** pool unless a creator explicitly seeds them
- winners claim from the actual vault balance built from bets plus any optional creator seed
- claiming is **manual**, not automatic
- `Position` accounts currently store `stake` and `is_yes` on-chain
- settlement publishing currently reconstructs totals from `Position` accounts after resolve computation
- this means the privacy model is **not fully private in the strict sense**

So the app works, but the privacy branding is stronger than the current on-chain data model.

## Repository Layout

```text
veil-markets/
|-- encrypted-ixs/
|-- programs/
|   `-- veil_markets/src/lib.rs
|-- scripts/
|   |-- arcium_helpers.ts
|   |-- init_comp_defs.ts
|   `-- seed_markets.ts
|-- server/
|   `-- index.js
|-- src/
|   |-- components/
|   |-- hooks/
|   |-- idl/
|   `-- utils/
|-- Anchor.toml
|-- Arcium.toml
|-- Cargo.toml
|-- package.json
|-- vite.config.js
`-- README.md
```

## Program And Network

Current frontend default program id:

- `6Yzx9fKe52tqhKmV81rTmDGH4hXFgiPKU9T5TgPezemR`

Current constants:

- Arcium cluster offset: `456`
- Arcium program id: `Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ`
- minimum bet: `0.01 SOL`

If you deploy a new program id, keep these aligned:

- `programs/veil_markets/src/lib.rs`
- `Anchor.toml`
- `src/utils/constants.js`
- `src/idl/veil_markets.json`

## Local Development

Prerequisites:

- Solana CLI configured to devnet
- Anchor installed
- Arcium CLI installed
- Docker running
- funded wallet at `~/.config/solana/id.json`

Install dependencies:

```bash
npm install --legacy-peer-deps
```

Build frontend:

```bash
npm run build
```

Build circuits + program:

```bash
bash scripts/build_offchain.sh
```

Refresh frontend IDL after a build/deploy cycle:

```bash
cp target/idl/veil_markets.json src/idl/veil_markets.json
```

Initialize computation definitions:

```bash
export ANCHOR_PROVIDER_URL=<rpc>
export ANCHOR_WALLET=~/.config/solana/id.json
npm run init:comp-defs
```

Run backend:

```bash
npm run server
```

Run frontend:

```bash
npm run dev
```

## Backend Responsibilities

`server/index.js` is not optional for the current app shape.

It handles:

- Polymarket proxy
- Arcium MXE public key lookup
- vote encryption helper
- computation waiting helper
- result decryption helper

Routes:

- `GET /api/polymarket/*`
- `GET /api/arcium/mxe-public-key`
- `POST /api/arcium/encrypt-vote`
- `POST /api/arcium/await-computation`
- `POST /api/arcium/decrypt-result`

## Production Deployment

Recommended production-style setup for this repo:

- **backend** on Render
- **frontend** on Vercel

### 1. Deploy the backend first

Deploy `server/index.js` on Render as a Node service.

Required backend environment variables:

```bash
PORT=8787
SOLANA_RPC_URL=https://your-devnet-rpc
POLYMARKET_UPSTREAM=https://gamma-api.polymarket.com
POLYMARKET_ALLOW_ORIGIN=https://your-vercel-app.vercel.app
```

Notes:

- `POLYMARKET_ALLOW_ORIGIN` should be your actual frontend domain, not `*`
- use a reliable devnet RPC, ideally not the public default

### 2. Deploy the frontend on Vercel

Required frontend environment variables:

```bash
VITE_PROGRAM_ID=6Yzx9fKe52tqhKmV81rTmDGH4hXFgiPKU9T5TgPezemR
VITE_RPC_ENDPOINT=https://your-devnet-rpc
VITE_BACKEND_API_BASE=https://your-render-service.onrender.com
VITE_POLYMARKET_API_BASE=https://your-render-service.onrender.com/api/polymarket
```

Notes:

- `VITE_PROGRAM_ID` must match the deployed Solana program
- `VITE_RPC_ENDPOINT` should point at the same cluster you used for deploy and comp-def init
- `VITE_BACKEND_API_BASE` is used for the Arcium helper routes from the frontend
- `VITE_POLYMARKET_API_BASE` should point to your Render backend
- `VITE_ARCIUM_API_BASE` is optional; if omitted it falls back to `VITE_BACKEND_API_BASE`

### 3. Keep backend and frontend aligned

These must all point to the same live setup:

- Solana program id
- RPC endpoint
- backend Arcium helper routes
- frontend IDL
- frontend backend-base env vars

If you upgrade the program:

1. rebuild
2. redeploy
3. copy fresh IDL into `src/idl/veil_markets.json`
4. redeploy frontend if needed

## Deploy / Upgrade Flow

Build:

```bash
cd /mnt/c/Users/hp/Desktop/veil-markets
bash scripts/build_offchain.sh
```

Deploy:

```bash
arcium deploy \
  --program-name veil_markets \
  --program-keypair target/deploy/veil_markets_v5-keypair.json \
  --cluster-offset 456 \
  --recovery-set-size 4 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url <reliable-devnet-rpc>
```

Copy IDL:

```bash
cp target/idl/veil_markets.json src/idl/veil_markets.json
```

If circuits changed or comp defs are fresh:

```bash
export ANCHOR_PROVIDER_URL=<reliable-devnet-rpc>
export ANCHOR_WALLET=~/.config/solana/id.json
npm run init:comp-defs
```

## Manual Test Flow

Recommended sanity test order:

1. create custom market with `0` creator seed
2. place bet
3. resolve market
4. publish result
5. claim winnings from winning wallet

Then test Polymarket path:

1. import Polymarket market
2. place bet
3. resolve when available
4. claim winnings

## Are We Ready For Render + Vercel?

Yes, with the following conditions:

- the current Solana program upgrade is already deployed
- `src/idl/veil_markets.json` matches that deployment
- Render backend is live first
- Vercel frontend points at that backend through `VITE_BACKEND_API_BASE` and the same RPC/program id
- you are comfortable launching with the current privacy caveat

So this is **good to go for a devnet production-style deployment**, not a final mainnet-grade privacy product.

## Remaining Product Risks

Before calling this final-final, keep these in mind:

- wallet cancellation and signature UX is improved, but production monitoring is still a good idea
- privacy is partial, not absolute
- settlement still depends on position-based totals
- imported Polymarket settlement should be tested on more real markets over time
- Render cold starts may slow helper routes unless your plan avoids sleeping

## License

MIT
