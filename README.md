# VEIL - Encrypted Prediction Markets on Solana

VEIL is a Solana prediction market app integrated with Arcium MPC and a Polymarket-backed import flow.

Current working flows:
- create custom markets
- import Polymarket markets into VEIL
- place bets
- queue and finalize resolve computations
- publish and settle results
- claim winnings

## Current State

The app is working end-to-end on devnet, but there are a few important implementation details to know up front:

- Arcium is used for market-state computations (`init_market_state`, `add_vote`, `resolve_market`).
- The frontend does not call Polymarket directly. It goes through the local/backend proxy in `server/index.js`.
- The frontend also uses backend-assisted Arcium helper routes for MXE key lookup, vote encryption, computation waiting, and result decryption.
- Settlement publishing currently uses on-chain `Position` accounts as the source of truth for totals after resolve computation completes.
- The custom market initial pool is currently fixed on-chain at `0.05 SOL` (`MIN_INITIAL_POOL_LAMPORTS`) even if the UI allows editing the value.
- Privacy is not absolute in the current program shape: `Position` accounts store `stake` and `is_yes` on-chain.

## Architecture

```text
Wallet / frontend
  |
  | submit market + vote transactions
  v
Solana program (`programs/veil_markets/src/lib.rs`)
  |
  | queues Arcium computations
  v
Arcium devnet cluster (offset 456)
  |
  | callbacks update market state
  v
Market + Position accounts on Solana
  |
  | publish result + claim winnings
  v
Settlement
```

Backend responsibilities in `server/index.js`:
- Polymarket proxy (`/api/polymarket/*`)
- Arcium MXE public key lookup (`/api/arcium/mxe-public-key`)
- vote encryption (`/api/arcium/encrypt-vote`)
- computation waiting (`/api/arcium/await-computation`)
- result decryption (`/api/arcium/decrypt-result`)

## Repository Layout

```text
veil-markets/
|-- build/
|-- encrypted-ixs/
|   `-- src/lib.rs
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
|-- target/
|-- tests/
|-- Anchor.toml
|-- Arcium.toml
|-- Cargo.toml
|-- package.json
|-- README.md
`-- vite.config.js
```

## Versions

This repo is aligned with:
- Arcium CLI: `0.9.2`
- `@arcium-hq/client`: `0.9.2`
- Anchor: `0.32.x`
- Solana CLI: `2.3.0`
- Arcium cluster offset: `456`
- Recovery set size: `4`

## Prerequisites

```bash
solana config set --url devnet
solana address
solana balance
anchor --version
arcium --version
docker --version
```

You also need:
- a funded devnet wallet at `~/.config/solana/id.json`
- Docker running for circuit/program builds
- a reliable devnet RPC

## Environment

Frontend / backend environment variables:

```bash
VITE_PROGRAM_ID=<your deployed program id>
VITE_RPC_ENDPOINT=https://api.devnet.solana.com
VITE_POLYMARKET_API_BASE=/api/polymarket
PORT=8787
POLYMARKET_UPSTREAM=https://gamma-api.polymarket.com
POLYMARKET_ALLOW_ORIGIN=https://your-frontend-domain.com
SOLANA_RPC_URL=https://your-devnet-rpc
```

Notes:
- For local dev, `VITE_POLYMARKET_API_BASE=/api/polymarket` is fine.
- If `VITE_PROGRAM_ID` is not set, the frontend falls back to `src/utils/constants.js`.
- The backend routes under `/api/arcium/*` assume the same program id and RPC as the frontend deployment you are testing.

## Circuit Hosting

This repo uses the offchain circuit pattern. The circuit URLs are compiled into the program via environment variables.

```bash
VEIL_INIT_MARKET_STATE_CIRCUIT_URL=https://your-public-storage/init_market_state.arcis
VEIL_ADD_VOTE_CIRCUIT_URL=https://your-public-storage/add_vote.arcis
VEIL_RESOLVE_MARKET_CIRCUIT_URL=https://your-public-storage/resolve_market.arcis
```

Recommended hosts:
- Supabase Storage
- public S3 bucket
- IPFS gateway

## Build Flow

Install dependencies:

```bash
npm install --legacy-peer-deps
```

Build circuits + program:

```bash
bash scripts/build_offchain.sh
```

Refresh frontend IDL after a build/deploy cycle:

```bash
cp target/idl/veil_markets.json src/idl/veil_markets.json
```

## Devnet Deployment Flow

### 1. Choose or generate a program keypair

Keep these aligned with the same program id:
- `programs/veil_markets/src/lib.rs`
- `Anchor.toml`
- `src/utils/constants.js`
- `src/idl/veil_markets.json` after rebuild/copy

### 2. Deploy

```bash
arcium deploy \
  --program-name veil_markets \
  --program-keypair target/deploy/<your-keypair>.json \
  --cluster-offset 456 \
  --recovery-set-size 4 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url <reliable-devnet-rpc>
```

### 3. Initialize computation definitions

```bash
export ANCHOR_PROVIDER_URL=<reliable-devnet-rpc>
export ANCHOR_WALLET=~/.config/solana/id.json
npm run init:comp-defs
```

### 4. Run backend + frontend

Backend:

```bash
npm run server
```

Frontend:

```bash
npm run dev
```

## Test Flow

Recommended manual test order:

1. create a custom market
2. place a bet
3. wait for market end
4. resolve the market
5. publish result
6. claim winnings

Polymarket path:
1. open the import flow
2. import a Polymarket market into VEIL
3. place a bet in VEIL
4. resolve once the market is resolvable

## Known Caveats

These are still true as of the current implementation:

- The custom market initial pool input is not honored on-chain yet; the program uses a hardcoded `0.05 SOL` initial pool.
- `Position` accounts store `stake` and `is_yes` on-chain, so the app is not currently fully private in the strict sense implied by the UI branding.
- Settlement publishing currently reconstructs totals from `Position` accounts after Arcium resolve computation completes, instead of trusting the decrypted result payload directly.
- `src/idl/veil_markets.json` should be refreshed after deploy-related changes.

## Production Notes

For production, plan around:
- a dedicated backend deployment for `server/index.js`
- controlled CORS via `POLYMARKET_ALLOW_ORIGIN`
- RPC stability and monitoring
- revisiting the privacy model if fully hidden direction/stake is a hard requirement
- wiring the custom initial pool amount properly into the on-chain program

## License

MIT