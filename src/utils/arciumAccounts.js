import { Buffer } from "buffer";
import { BN } from "@coral-xyz/anchor";
import {
  awaitComputationFinalization,
  getClusterAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getComputationAccAddress,
  getExecutingPoolAccAddress,
  getMXEAccAddress,
  getMXEPublicKey,
  getMempoolAccAddress,
} from "@arcium-hq/client";
import { CLUSTER_OFFSET } from "./constants.js";
import { getProgramId } from "./program.js";

export function getCompDefOffset(circuitName) {
  return Buffer.from(getCompDefAccOffset(circuitName)).readUInt32LE(0);
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
    compDefAccount: getCompDefAccAddress(
      programId,
      getCompDefOffset(circuitName)
    ),
    computationAccount: getComputationAccAddress(CLUSTER_OFFSET, offset),
    clusterAccount: getClusterAccAddress(CLUSTER_OFFSET),
  };
}

export async function getMxePublicKeyWithRetry(
  provider,
  { maxRetries = 20, retryDelayMs = 1500 } = {}
) {
  const programId = getProgramId();

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
    "MXE public key not available yet. If deploy just finished, wait briefly or run arcium finalize-mxe-keys."
  );
}

export async function waitForArciumComputation(
  provider,
  computationOffset,
  commitment = "confirmed"
) {
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
