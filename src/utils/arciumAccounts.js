import { Buffer } from "buffer";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { ARCIUM_PROGRAM_ID, CLUSTER_OFFSET } from "./constants.js";
import { getProgramId } from "./program.js";

const OFFSET_BUFFER_SIZE = 4;
const COMP_DEF_OFFSETS = {
  init_market_state: 749427652,
  add_vote: 1483301163,
  resolve_market: 484556922,
};

const SEEDS = {
  computation: "ComputationAccount",
  mempool: "Mempool",
  execpool: "Execpool",
  cluster: "Cluster",
  mxe: "MXEAccount",
  compDef: "ComputationDefinitionAccount",
};

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
  provider,
  { maxRetries = 20, retryDelayMs = 1500 } = {}
) {
  const { getMXEPublicKey } = await import("@arcium-hq/client");
  const programId = getProgramId();

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const key = await getMXEPublicKey(provider, programId);
      if (key) return key;
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  throw new Error(
    "MXE public key not available yet. If deploy just finished, wait briefly or run arcium finalize-mxe-keys."
  );
}

export async function waitForArciumComputation(
  provider,
  computationOffset,
  commitment = "confirmed"
) {
  const { awaitComputationFinalization } = await import("@arcium-hq/client");
  const offset =
    computationOffset instanceof BN
      ? computationOffset
      : new BN(computationOffset.toString());

  return awaitComputationFinalization(
    provider,
    offset,
    getProgramId(),
    commitment
  );
}
