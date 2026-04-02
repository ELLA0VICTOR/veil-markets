import { Buffer } from "buffer";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { ARCIUM_API_BASE, ARCIUM_PROGRAM_ID, CLUSTER_OFFSET, withApiBase } from "./constants.js";
import { getProgramId } from "./program.js";

const OFFSET_BUFFER_SIZE = 4;

const SEEDS = {
  computation: "ComputationAccount",
  mempool: "Mempool",
  execpool: "Execpool",
  cluster: "Cluster",
  mxe: "MXEAccount",
  compDef: "ComputationDefinitionAccount",
};

// Keep browser-side circuit offsets local so the frontend does not need to
// import the full `@arcium-hq/client` package just to derive comp-def PDAs.
const COMP_DEF_OFFSETS = {
  init_market_state: 749427652,
  init_user_balance: 3690557688,
  deposit_balance: 2044512493,
  withdraw_balance: 2134253957,
  add_vote: 1483301163,
  resolve_market: 2116189289,
  claim_payout: 1381326356,
};

const MXE_PUBLIC_KEY_CACHE = new Map();

function arciumProgramId() {
  return new PublicKey(ARCIUM_PROGRAM_ID);
}

function u32Le(value) {
  const buffer = Buffer.alloc(OFFSET_BUFFER_SIZE);
  buffer.writeUInt32LE(value, 0);
  return buffer;
}

function deriveArciumPda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, arciumProgramId())[0];
}

export function getCompDefOffset(circuitName) {
  const offset = COMP_DEF_OFFSETS[circuitName];
  if (offset === undefined) {
    throw new Error(`Unknown circuit name: ${circuitName}`);
  }
  return offset;
}

export function getMXEAccAddress(mxeProgramId) {
  return deriveArciumPda([Buffer.from(SEEDS.mxe), mxeProgramId.toBuffer()]);
}

export function getMempoolAccAddress(clusterOffset) {
  return deriveArciumPda([Buffer.from(SEEDS.mempool), u32Le(clusterOffset)]);
}

export function getExecutingPoolAccAddress(clusterOffset) {
  return deriveArciumPda([Buffer.from(SEEDS.execpool), u32Le(clusterOffset)]);
}

export function getClusterAccAddress(clusterOffset) {
  return deriveArciumPda([Buffer.from(SEEDS.cluster), u32Le(clusterOffset)]);
}

export function getCompDefAccAddress(mxeProgramId, compDefOffset) {
  return deriveArciumPda([
    Buffer.from(SEEDS.compDef),
    mxeProgramId.toBuffer(),
    u32Le(compDefOffset),
  ]);
}

export function getComputationAccAddress(clusterOffset, computationOffset) {
  const offset =
    computationOffset instanceof BN
      ? computationOffset
      : new BN(computationOffset.toString());

  return deriveArciumPda([
    Buffer.from(SEEDS.computation),
    u32Le(clusterOffset),
    offset.toArrayLike(Buffer, "le", 8),
  ]);
}

export function getCircuitAccounts(circuitName, computationOffset) {
  const programId = getProgramId();
  const offset =
    computationOffset instanceof BN
      ? computationOffset
      : new BN(computationOffset.toString());

  return {
    mxeAccount: getMXEAccAddress(programId),
    mempoolAccount: getMempoolAccAddress(CLUSTER_OFFSET),
    executingPool: getExecutingPoolAccAddress(CLUSTER_OFFSET),
    compDefAccount: getCompDefAccAddress(programId, getCompDefOffset(circuitName)),
    computationAccount: getComputationAccAddress(CLUSTER_OFFSET, offset),
    clusterAccount: getClusterAccAddress(CLUSTER_OFFSET),
  };
}

export async function getMxePublicKeyWithRetry(
  _provider,
  { maxRetries = 20, retryDelayMs = 1500 } = {}
) {
  const programId = getProgramId();
  const cacheKey = programId.toBase58();

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(
        withApiBase(
          ARCIUM_API_BASE,
          `/api/arcium/mxe-public-key?programId=${encodeURIComponent(programId.toBase58())}`
        )
      );
      if (response.ok) {
        const body = await response.json();
        const key = Array.isArray(body?.key) ? Uint8Array.from(body.key) : null;
        if (key) {
          MXE_PUBLIC_KEY_CACHE.set(cacheKey, key);
          return key;
        }
      } else if (response.status !== 404) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `MXE key request failed (${response.status})`);
      }
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  const cachedKey = MXE_PUBLIC_KEY_CACHE.get(cacheKey);
  if (cachedKey) {
    return cachedKey;
  }

  throw new Error(
    "MXE public key not available yet. If deploy just finished, wait briefly or run arcium finalize-mxe-keys."
  );
}

export async function waitForArciumComputation(
  _provider,
  computationOffset,
  commitment = "confirmed"
) {
  const offset =
    computationOffset instanceof BN
      ? computationOffset
      : new BN(computationOffset.toString());
  const response = await fetch(withApiBase(ARCIUM_API_BASE, "/api/arcium/await-computation"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      programId: getProgramId().toBase58(),
      computationOffset: offset.toString(),
      commitment,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body?.message || body?.error || `Await computation failed (${response.status})`
    );
  }

  const body = await response.json();
  return body?.result ?? null;
}

