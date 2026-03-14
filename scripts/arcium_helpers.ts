import * as anchor from "@coral-xyz/anchor";
import {
  AddressLookupTableProgram,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  awaitComputationFinalization,
  getClusterAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getComputationAccAddress,
  getExecutingPoolAccAddress,
  getLookupTableAddress,
  getMXEAccAddress,
  getMXEPublicKey,
  getMempoolAccAddress,
} from "@arcium-hq/client";

export const CLUSTER_OFFSET = 456;
export const ARCIUM_PROGRAM_ID = new PublicKey(
  "ARCiUMFnVrDqNZJqiWJAGgqaKRTfhqzGgPbMRqNuM9Wn"
);

export type CircuitName = "init_market_state" | "add_vote" | "resolve_market";

export function getCompDefOffset(circuitName: CircuitName): number {
  return Buffer.from(getCompDefAccOffset(circuitName)).readUInt32LE(0);
}

export function getInitCompDefAccounts(
  programId: PublicKey,
  payer: PublicKey,
  circuitName: CircuitName
) {
  const compDefOffset = getCompDefOffset(circuitName);

  return {
    payer,
    mxeAccount: getMXEAccAddress(programId),
    compDefAccount: getCompDefAccAddress(programId, compDefOffset),
    addressLookupTable: getLookupTableAddress(
      programId,
      new anchor.BN(compDefOffset)
    ),
    lutProgram: AddressLookupTableProgram.programId,
    arciumProgram: ARCIUM_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };
}

export function getComputationAccounts(
  programId: PublicKey,
  circuitName: CircuitName,
  computationOffset: anchor.BN
) {
  return {
    mxeAccount: getMXEAccAddress(programId),
    mempoolAccount: getMempoolAccAddress(CLUSTER_OFFSET),
    executingPool: getExecutingPoolAccAddress(CLUSTER_OFFSET),
    compDefAccount: getCompDefAccAddress(
      programId,
      getCompDefOffset(circuitName)
    ),
    computationAccount: getComputationAccAddress(
      CLUSTER_OFFSET,
      computationOffset
    ),
    clusterAccount: getClusterAccAddress(CLUSTER_OFFSET),
  };
}

export async function getMxePublicKeyWithRetry(
  provider: anchor.AnchorProvider,
  programId: PublicKey,
  maxRetries = 20,
  retryDelayMs = 1500
) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const key = await getMXEPublicKey(provider, programId);
      if (key) {
        return key;
      }
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  throw new Error(
    "MXE public key not set yet. Run arcium finalize-mxe-keys if deploy already succeeded."
  );
}

export async function waitForComputation(
  provider: anchor.AnchorProvider,
  computationOffset: anchor.BN,
  programId: PublicKey,
  commitment: anchor.web3.Finality = "confirmed"
) {
  return awaitComputationFinalization(
    provider,
    computationOffset,
    programId,
    commitment
  );
}
