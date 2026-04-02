import * as anchor from "@coral-xyz/anchor";
import anchorPkg from "@coral-xyz/anchor";
const { BN } = anchorPkg;
import {
  AddressLookupTableProgram,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  awaitComputationFinalization,
  getArciumProgram,
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
  "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
);

export type CircuitName =
  | "init_market_state"
  | "init_user_balance"
  | "deposit_balance"
  | "withdraw_balance"
  | "add_vote"
  | "resolve_market"
  | "claim_payout";

const CIRCUIT_NAME_ALIASES: Partial<Record<CircuitName, string>> = {
  resolve_market: "resolve_market_v2",
};

function resolveCircuitName(circuitName: CircuitName): string {
  return CIRCUIT_NAME_ALIASES[circuitName] ?? circuitName;
}

export function getCompDefOffset(circuitName: CircuitName): number {
  return Buffer.from(getCompDefAccOffset(resolveCircuitName(circuitName))).readUInt32LE(0);
}

export async function getInitCompDefAccounts(
  provider: anchor.AnchorProvider,
  programId: PublicKey,
  payer: PublicKey,
  circuitName: CircuitName
) {
  const compDefOffset = getCompDefOffset(circuitName);
  const mxeAccount = getMXEAccAddress(programId);
  const arciumProgram = getArciumProgram(provider);
  const mxeAccountData = await arciumProgram.account.mxeAccount.fetch(mxeAccount);
  const lutOffset = new BN(mxeAccountData.lutOffsetSlot.toString());

  return {
    payer,
    mxeAccount,
    compDefAccount: getCompDefAccAddress(programId, compDefOffset),
    addressLookupTable: getLookupTableAddress(programId, lutOffset),
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

