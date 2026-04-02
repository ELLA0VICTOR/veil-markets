# VEIL Markets v2

VEIL Markets v2 is a Solana prediction market app built around **private betting balances and encrypted market totals**.

This version fixes the core v1 problem: in v1 the privacy story was incomplete because bet amounts were still too exposed. In v2, the live market flow is built around Arcium-backed encrypted state so that:

- user private balances are encrypted on-chain
- individual bet stake amounts are encrypted on-chain
- market YES / NO pooled stake totals are encrypted on-chain
- market outcomes are public after resolution
- winnings are credited back into a user's **private VEIL balance**

The app currently targets **Solana devnet**.

## What v2 Means

VEIL Markets v2 separates:

- **public wallet transfers**: deposit and withdraw
- **private in-app balance state**: encrypted VEIL balance used for betting and claiming
- **public resolution outcome**: YES or NO wins publicly
- **private market totals**: pooled YES / NO stake remains encrypted

So users can move SOL in and out publicly, while their per-market stake and aggregated market-side balance updates stay private inside the VEIL flow.

## Core Privacy Model

On-chain, the important state is encrypted:

- `UserBalance`
  - encrypted internal balance state
  - encrypted viewer-readable balance view for the user's browser/profile
- `Position`
  - encrypted `is_yes` vote
  - encrypted `stake` amount
- `Market`
  - encrypted YES pooled total
  - encrypted NO pooled total
  - public resolution outcome after settlement

This means VEIL v2 is now aligned with the privacy goal it was originally aiming for: **private balances, private stake amounts, and encrypted pooled market totals**.

## What The App Does

VEIL supports two market sources:

1. **Custom markets**
   - created directly inside VEIL
   - creator resolves the outcome after expiry

2. **Imported Polymarket markets**
   - discovered from the Polymarket feed
   - imported into VEIL as real on-chain VEIL markets
   - resolved against the linked Polymarket condition once available

## End-to-End User Flow

### 1. Initialize a private balance

A user creates a `UserBalance` account once.

That account stores:

- encrypted private balance state for Arcium computations
- encrypted viewer-readable balance data for the user's local browser/profile

### 2. Deposit into private balance

A deposit is:

- publicly transferred from wallet to treasury
- privately applied into the encrypted `UserBalance`
- shown in the UI after the Arcium callback finalizes

### 3. Place a bet

When a user bets:

1. the frontend prepares the private vote payload
2. wallet signs the on-chain transaction
3. the market encrypted YES / NO totals are updated through Arcium
4. the user's private balance is reduced privately
5. the `Position` stores encrypted vote side and encrypted stake

### 4. Resolve the market

When the market ends:

- the winning outcome becomes public
- the encrypted market state is settled through Arcium
- custom markets are resolved by the creator
- imported Polymarket markets follow the linked oracle result path

### 5. Claim winnings

A winning user claims into their **private VEIL balance**, not into a public per-position payout record.

This keeps the private balance model consistent all the way through settlement.

### 6. Withdraw from private balance

A withdraw:

- privately updates the encrypted balance first
- then publicly transfers SOL back to the wallet after the callback succeeds

## Arcium Callback Safety

VEIL v2 now includes recovery handling for stuck private balance actions.

That means:

- pending deposit / withdraw / bet / claim state is tracked explicitly
- stale pending actions can be recovered by the owner
- late callbacks are ignored if they no longer match the active pending computation
- the UI shows pending state more clearly and exposes recovery when needed

This was added specifically to prevent a failed or stale callback from permanently locking a user's private balance.

## UX Improvements In v2

In addition to the privacy fixes, v2 includes a number of quality-of-life improvements:

- clearer private balance status messaging
- better pending-state visibility for deposits / withdraws / claims
- stale-action recovery flow for blocked balances
- improved decrypt reliability in the browser
- better resolve flow behavior when markets expire
- faster UI refresh around pending balance actions and market end-state transitions

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
|-- build/
|-- target/
|-- Anchor.toml
|-- Arcium.toml
|-- Cargo.toml
|-- package.json
`-- README.md
```

## Program And Network

Current devnet program id:

- `Hq6Jyd8FjALKcdQoReCdsoyi51DW3dWHyGHVA2vWhU8z`

Current constants:

- Arcium cluster offset: `456`
- Arcium program id: `Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ`
- minimum bet: `0.01 SOL`

If you deploy a fresh program id, keep these aligned:

- `Anchor.toml`
- `programs/veil_markets/src/lib.rs`
- `src/utils/constants.js`
- `src/idl/veil_markets.json`
- `target/idl/veil_markets.json`

## Local Development

Prerequisites:

- Solana CLI configured for devnet
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

Refresh frontend IDL after build / deploy:

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

`server/index.js` is required for the current app shape.

It handles:

- Polymarket proxying
- Arcium MXE public key lookup
- encrypted vote helper flow
- computation waiting helper
- other Arcium-facing helper endpoints used by the frontend

Current routes include:

- `GET /api/polymarket/*`
- `GET /api/arcium/mxe-public-key`
- `POST /api/arcium/encrypt-vote`
- `POST /api/arcium/await-computation`
- `POST /api/arcium/decrypt-result`

## Deploy / Upgrade Flow

Build everything:

```bash
cd /mnt/c/Users/hp/Desktop/veil-markets
bash scripts/build_offchain.sh
```

Upgrade / deploy the program:

```bash
anchor deploy
```

Or use direct Solana deploy if needed for a more reliable upgrade path:

```bash
solana program deploy target/deploy/veil_markets.so \
  --program-id Hq6Jyd8FjALKcdQoReCdsoyi51DW3dWHyGHVA2vWhU8z \
  --upgrade-authority ~/.config/solana/id.json \
  --url https://api.devnet.solana.com \
  --use-rpc
```

Then sync IDL:

```bash
cp target/idl/veil_markets.json src/idl/veil_markets.json
```

Then initialize / refresh computation definitions:

```bash
export ANCHOR_PROVIDER_URL=<reliable-devnet-rpc>
export ANCHOR_WALLET=~/.config/solana/id.json
npm run init:comp-defs
```

## Production-Style Deployment

Recommended setup for this repo:

- backend on Render
- frontend on Vercel

### Backend env

```bash
PORT=8787
SOLANA_RPC_URL=https://your-devnet-rpc
POLYMARKET_UPSTREAM=https://gamma-api.polymarket.com
POLYMARKET_ALLOW_ORIGIN=https://your-vercel-app.vercel.app
```

### Frontend env

```bash
VITE_PROGRAM_ID=Hq6Jyd8FjALKcdQoReCdsoyi51DW3dWHyGHVA2vWhU8z
VITE_RPC_ENDPOINT=https://your-devnet-rpc
VITE_BACKEND_API_BASE=https://your-render-service.onrender.com
VITE_POLYMARKET_API_BASE=https://your-render-service.onrender.com/api/polymarket
```

Optional:

```bash
VITE_ARCIUM_API_BASE=https://your-render-service.onrender.com
```

## Recommended Test Flow

Suggested sanity flow for Veil Markets v2:

1. initialize private balance
2. deposit into private balance
3. create or import a market
4. place a private bet
5. resolve the market
6. claim winnings to private balance
7. withdraw from private balance

Also test:

- stale pending action recovery
- market-end refresh behavior
- custom market resolution
- imported Polymarket resolution path

## Current Status

VEIL Markets v2 is the version that should be reviewed and demoed.

The major v1 privacy weakness has been addressed. The current implementation is centered on:

- encrypted private balances
- encrypted stake amounts
- encrypted market totals
- private claim flow back into the VEIL balance

This is the version that represents the real product direction.

## Remaining Caveats

A few things are still worth saying clearly:

- this is a devnet product, not a mainnet launch
- callback-based systems still need operational monitoring
- reliable RPC infrastructure matters a lot for smooth UX
- the app is much stronger now, but production hardening is still a separate phase

## License

MIT
