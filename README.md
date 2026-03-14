# VEIL - Private Prediction Markets

VEIL is a privacy-first prediction market on Solana that uses Arcium MPC to keep vote direction and stake amounts hidden during market activity.

It supports two flows:
- custom markets created directly inside VEIL
- imported Polymarket markets where Polymarket decides the outcome and VEIL privately reveals stake totals

## Architecture

```text
User wallet
  |
  | encrypt vote client-side (x25519 + RescueCipher)
  v
Solana program instruction
  |
  | queues Arcium computation
  v
Arcium devnet cluster (offset 456)
  |
  | updates encrypted market state
  | returns callback output on-chain
  v
VEIL market account
  |
  | result published after resolve flow
  v
Claims and settlement
```

## What Arcium Does Here

Arcium is responsible for the private computation layer.

- `init_market_state` initializes the encrypted market state.
- `add_vote` updates encrypted YES and NO totals without revealing plaintext values.
- `resolve_market` returns encrypted result totals that the resolver can decrypt and publish.

This means:
- other users cannot see the live vote split
- stake sizes are not exposed during the market
- the market only reveals what is needed for settlement

## Project Layout

```text
veil-markets/
|-- encrypted-ixs/
|   `-- src/lib.rs
|-- programs/
|   `-- veil_markets/src/lib.rs
|-- scripts/
|   |-- arcium_helpers.ts
|   |-- init_comp_defs.ts
|   `-- seed_markets.ts
|-- src/
|   |-- components/
|   |-- hooks/
|   |-- idl/
|   `-- utils/
|-- tests/
|   `-- veil_markets.ts
|-- Anchor.toml
|-- Arcium.toml
|-- Cargo.toml
|-- index.html
|-- package.json
|-- tsconfig.json
`-- vite.config.js
```

## Versions

This repo is aligned around the Arcium 0.8.x line.

- Arcium CLI: `0.8.5` recommended
- `@arcium-hq/client`: `0.8.x`
- Anchor: `0.32.x`
- Solana CLI: `2.3.0`
- Cluster offset: `456`
- Recovery set size: `4`

## Prerequisites

```bash
# Solana
solana config set --url devnet
solana address
solana balance

# Anchor + Arcium + Docker
anchor --version
arcium --version
docker --version
```

You will also need:
- a funded devnet wallet at `~/.config/solana/id.json`
- Docker running for `arcium build`
- a reliable devnet RPC for deployment work

## Frontend Environment

The frontend reads these values from Vite env variables.

```bash
VITE_PROGRAM_ID=<your deployed program id>
VITE_RPC_ENDPOINT=https://api.devnet.solana.com
```

If you do not set them, the app falls back to the placeholder values in `src/utils/constants.js`.

## Offchain Circuit Hosting

This project is set up for the offchain circuit pattern.

The computation definition init instructions in `programs/veil_markets/src/lib.rs` now expect your `.arcis` files to be publicly hosted and verified by hash.

Compile-time environment variables:

```bash
VEIL_INIT_MARKET_STATE_CIRCUIT_URL=https://your-public-storage/init_market_state.arcis
VEIL_ADD_VOTE_CIRCUIT_URL=https://your-public-storage/add_vote.arcis
VEIL_RESOLVE_MARKET_CIRCUIT_URL=https://your-public-storage/resolve_market.arcis
```

Recommended hosting options:
- Supabase Storage
- public S3 bucket
- IPFS gateway

## Local Build Flow

### 1. Install JS dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Build circuits and program

```bash
arcium build
```

### 3. Copy fresh IDL to frontend

```bash
cp target/idl/veil_markets.json src/idl/veil_markets.json
```

## Devnet Deployment Flow

### 1. Generate or choose a program keypair

Make sure the following all use the same program id before deploying:
- `programs/veil_markets/src/lib.rs`
- `Anchor.toml`
- `src/utils/constants.js` or `VITE_PROGRAM_ID`

### 2. Deploy

```bash
arcium deploy \
  --cluster-offset 456 \
  --recovery-set-size 4 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url <reliable-devnet-rpc>
```

### 3. If MXE utility keys are still unset

```bash
arcium finalize-mxe-keys <program-id> \
  --cluster-offset 456 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url <reliable-devnet-rpc>
```

### 4. Initialize computation definitions

```bash
npx ts-node scripts/init_comp_defs.ts
```

### 5. Seed markets

```bash
npx ts-node scripts/seed_markets.ts
```

### 6. Run frontend

```bash
npm run dev
```

## Test Flow

```bash
arcium test
```

The TypeScript integration test covers:
- comp-def initialization
- custom market creation
- encrypted YES vote
- encrypted NO vote
- resolution via MPC
- publishing results
- winner claim behavior

## Notes

- `src/idl/veil_markets.json` is a checked-in copy for the frontend. Refresh it after each new build.
- `Anchor.toml` and `declare_id!` still need your real deployed program id before devnet deployment.
- If you see `utility_pubkeys unset`, finalize the MXE keys and verify again before trying encrypted vote flows.

## License

MIT
