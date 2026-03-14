import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";
import { MARKET_SEED, VAULT_SEED, POSITION_SEED } from "./constants.js";
import { getProgramId } from "./program.js";

/**
 * Derive market PDA
 * seeds: [b"market", creator.key(), computation_offset.to_le_bytes()]
 */
export function deriveMarketPda(creatorPubkey, computationOffset) {
  // computationOffset may be a BN, bigint, or number — normalise to 8-byte LE
  const big = BigInt(computationOffset.toString());
  const offsetBuf = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    offsetBuf[i] = Number((big >> BigInt(i * 8)) & 0xffn);
  }

  return PublicKey.findProgramAddressSync(
    [Buffer.from(MARKET_SEED), new PublicKey(creatorPubkey).toBuffer(), offsetBuf],
    getProgramId()
  );
}

/**
 * Derive vault PDA for a market
 * seeds: [b"vault", market.key()]
 */
export function deriveVaultPda(marketPubkey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED), new PublicKey(marketPubkey).toBuffer()],
    getProgramId()
  );
}

/**
 * Derive position PDA for a (voter, market) pair
 * seeds: [b"position", market.key(), voter.key()]
 */
export function derivePositionPda(marketPubkey, voterPubkey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(POSITION_SEED),
      new PublicKey(marketPubkey).toBuffer(),
      new PublicKey(voterPubkey).toBuffer(),
    ],
    getProgramId()
  );
}

/**
 * Parse market account question bytes to string
 */
export function decodeQuestion(questionBytes) {
  const uint8 = new Uint8Array(questionBytes);
  // Find null terminator
  let end = uint8.length;
  for (let i = 0; i < uint8.length; i++) {
    if (uint8[i] === 0) {
      end = i;
      break;
    }
  }
  return new TextDecoder().decode(uint8.slice(0, end));
}

/**
 * Convert lamports to SOL display string
 */
export function lamportsToSol(lamports) {
  return (Number(lamports) / 1e9).toFixed(3);
}

/**
 * Convert SOL to lamports as BN-compatible number
 */
export function solToLamports(sol) {
  return Math.floor(parseFloat(sol) * 1e9);
}

/**
 * Market status enum to label
 */
export function marketStatusLabel(status) {
  switch (status) {
    case 0: return "INITIALIZING";
    case 1: return "OPEN";
    case 2: return "RESOLVING";
    case 3: return "SETTLED";
    default: return "UNKNOWN";
  }
}
