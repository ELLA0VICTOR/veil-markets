import { Buffer } from "buffer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import {
  ARCIUM_PROGRAM_ID,
  BALANCE_PENDING_STALE_SLOT_TTL,
  TREASURY_SEED,
  USER_BALANCE_PENDING_SEED,
  USER_BALANCE_SEED,
} from "../utils/constants";
import { decryptSharedU64 } from "../utils/arcium";
import {
  getCircuitAccounts,
  getMxePublicKeyWithRetry,
  waitForArciumComputation,
} from "../utils/arciumAccounts";
import { getOrCreateUserCipherKeypair } from "../utils/privateState";
import { createVeilProgram } from "../utils/program";
import { solToLamports } from "../utils/solana";
import { useWallet } from "./useWallet";

const U64_MAX = (1n << 64n) - 1n;

function randomComputationOffset() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return new BN(new DataView(bytes.buffer).getBigUint64(0, true).toString());
}

function randomNonceBn() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const value = Array.from(bytes).reduce(
    (acc, byte, index) => acc | (BigInt(byte) << BigInt(index * 8)),
    0n
  );
  return new BN(value.toString());
}

function bytesEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function isZeroBytes(value) {
  if (!value || value.length === 0) return true;
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== 0) return false;
  }
  return true;
}

function formatLamportsAsSol(lamports) {
  const value = BigInt(lamports.toString());
  const whole = value / 1_000_000_000n;
  const fractional = ((value % 1_000_000_000n) / 1_000_000n)
    .toString()
    .padStart(3, "0");
  return `${whole.toString()}.${fractional} SOL`;
}

function toBigIntValue(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  if (value && typeof value.toString === "function") return BigInt(value.toString());
  return 0n;
}

function getPendingActionValue(account) {
  return Number(account?.pendingAction ?? account?.pending_action ?? 0);
}

function getPendingWithdrawLamportsValue(account) {
  return toBigIntValue(
    account?.pendingWithdrawLamports ?? account?.pending_withdraw_lamports ?? 0
  );
}

function getPendingStartedSlotValue(account) {
  const raw = account?.startedAtSlot ?? account?.started_at_slot ?? 0;
  return Number(raw?.toString?.() ?? raw ?? 0);
}

function getPendingActionDisplay(action, pendingWithdrawLamports) {
  switch (action) {
    case 1:
      return {
        label: "Initialization pending",
        message: "Private balance initialization is still waiting for the Arcium callback.",
      };
    case 2:
      return {
        label: "Deposit pending",
        message: "A private balance deposit is still waiting for the Arcium callback.",
      };
    case 3:
      return {
        label: "Withdraw pending",
        message:
          pendingWithdrawLamports > 0n
            ? `A withdraw of ${formatLamportsAsSol(pendingWithdrawLamports)} is still waiting for the Arcium callback.`
            : "A private balance withdraw is still waiting for the Arcium callback.",
      };
    case 4:
      return {
        label: "Bet pending",
        message: "A private bet update is still waiting for the Arcium callback.",
      };
    case 5:
      return {
        label: "Claim pending",
        message: "A payout claim is still waiting for the Arcium callback.",
      };
    default:
      return {
        label: "No pending action",
        message: "",
      };
  }
}

function buildPendingStatus({ account, pendingState, currentSlot }) {
  const pendingAction = getPendingActionValue(account);
  const pendingWithdrawLamports = getPendingWithdrawLamportsValue(account);
  const pendingDisplay = getPendingActionDisplay(pendingAction, pendingWithdrawLamports);
  const pendingStartedAtSlot = pendingState ? getPendingStartedSlotValue(pendingState) : null;
  const pendingAgeSlots =
    currentSlot !== null && pendingStartedAtSlot !== null && pendingStartedAtSlot > 0
      ? Math.max(0, currentSlot - pendingStartedAtSlot)
      : null;
  const legacyPending = pendingAction !== 0 && !pendingState;
  const staleTrackedPending =
    pendingAction !== 0 &&
    pendingState &&
    pendingAgeSlots !== null &&
    pendingAgeSlots >= BALANCE_PENDING_STALE_SLOT_TTL;
  const canRecoverPendingAction = pendingAction !== 0 && (legacyPending || staleTrackedPending);

  let pendingMessage = pendingDisplay.message;
  if (pendingAction !== 0) {
    if (legacyPending) {
      pendingMessage = `${pendingMessage} This action predates recovery tracking, so it can be recovered now.`;
    } else if (staleTrackedPending) {
      pendingMessage = `${pendingMessage} This action appears stale and can be recovered now.`;
    } else if (pendingAgeSlots !== null) {
      const remainingSlots = Math.max(
        BALANCE_PENDING_STALE_SLOT_TTL - pendingAgeSlots,
        0
      );
      pendingMessage = `${pendingMessage} Recovery unlocks if it is still pending after ${remainingSlots} more slots.`;
    }
  }

  return {
    pendingAction,
    pendingActionLabel: pendingDisplay.label,
    pendingMessage: pendingMessage.trim(),
    pendingWithdrawLamports,
    pendingWithdrawDisplay:
      pendingAction === 3 && pendingWithdrawLamports > 0n
        ? formatLamportsAsSol(pendingWithdrawLamports)
        : "",
    pendingStartedAtSlot,
    pendingAgeSlots,
    canRecoverPendingAction,
    legacyPending,
  };
}

async function fetchOptionalAccount(accountClient, address) {
  if (!accountClient) return null;
  if (typeof accountClient.fetchNullable === "function") {
    return accountClient.fetchNullable(address);
  }
  try {
    return await accountClient.fetch(address);
  } catch {
    return null;
  }
}

function parseLamportsInput(solAmount) {
  const lamports = solToLamports(solAmount);
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error("Enter an amount greater than 0");
  }
  return BigInt(lamports);
}

function monitorArciumComputation(provider, computationOffset, refreshBalance) {
  void waitForArciumComputation(provider, computationOffset, "confirmed")
    .catch(() => null)
    .then(() => refreshBalance().catch(() => null));
}

export function usePrivateBalance() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const [account, setAccount] = useState(null);
  const [pendingState, setPendingState] = useState(null);
  const [pendingCurrentSlot, setPendingCurrentSlot] = useState(null);
  const [balanceLamports, setBalanceLamports] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const keypair = useMemo(() => {
    if (!publicKey) return null;
    return getOrCreateUserCipherKeypair(publicKey.toBase58());
  }, [publicKey]);

  const derived = useMemo(() => {
    if (!publicKey || !wallet) return null;
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = createVeilProgram(provider);
    const [userBalancePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(USER_BALANCE_SEED), publicKey.toBuffer()],
      program.programId
    );
    const [userBalancePendingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(USER_BALANCE_PENDING_SEED), publicKey.toBuffer()],
      program.programId
    );
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(TREASURY_SEED)],
      program.programId
    );
    return { provider, program, userBalancePda, userBalancePendingPda, treasuryPda };
  }, [connection, wallet, publicKey]);

  const refreshBalance = useCallback(async () => {
    if (!derived || !keypair) {
      setAccount(null);
      setPendingState(null);
      setPendingCurrentSlot(null);
      setBalanceLamports(null);
      return null;
    }

    try {
      const [fetched, fetchedPendingState] = await Promise.all([
        derived.program.account.userBalance.fetch(derived.userBalancePda),
        fetchOptionalAccount(
          derived.program.account.userBalancePendingState,
          derived.userBalancePendingPda
        ),
      ]);

      setAccount(fetched);
      setPendingState(fetchedPendingState);

      const keyMismatch = !bytesEqual(fetched.viewerPubkey, keypair.publicKey);
      const pendingAction = getPendingActionValue(fetched);
      const pending = pendingAction !== 0;
      const currentSlot = pending
        ? await connection.getSlot("confirmed").catch(() => null)
        : null;
      setPendingCurrentSlot(currentSlot);
      const pendingStatus = buildPendingStatus({
        account: fetched,
        pendingState: fetchedPendingState,
        currentSlot,
      });
      const missingView = isZeroBytes(fetched.viewEncryptionKey) || isZeroBytes(fetched.viewCt);

      if (keyMismatch) {
        setBalanceLamports(null);
        setError(
          "This private balance was created with a different local encryption key. Use the original browser/profile for this wallet, or move this redesign to a fresh program id."
        );
        return { account: fetched, lamports: null, keyMismatch: true, ...pendingStatus };
      }

      if (missingView) {
        setBalanceLamports(null);
        setError(
          pending
            ? pendingStatus.pendingMessage
            : "Private balance account exists, but its encrypted view has not been materialized yet. This usually means the Arcium callback did not finish for this fresh deployment."
        );
        return {
          account: fetched,
          pendingState: fetchedPendingState,
          lamports: null,
          missingView: true,
          pending,
          ...pendingStatus,
        };
      }

      let mxePublicKey = null;
      try {
        const treasuryLamports = BigInt(
          await connection.getBalance(derived.treasuryPda, "confirmed")
        );
        try {
          mxePublicKey = await getMxePublicKeyWithRetry(derived.provider, {
            maxRetries: 2,
            retryDelayMs: 500,
          });
        } catch {
          mxePublicKey = null;
        }

        const lamports = await decryptSharedU64(
          keypair.privateKey,
          fetched.viewEncryptionKey,
          fetched.viewNonce.toString(),
          fetched.viewCt,
          {
            extraPublicKeys: [
              { label: "mxeKey", bytes: mxePublicKey },
              { label: "viewerKey", bytes: fetched.viewerPubkey },
            ],
          }
        );

        const normalizedLamports = BigInt(lamports.toString());
        if (normalizedLamports < 0n || normalizedLamports > U64_MAX) {
          throw new Error("Decrypted balance is out of the valid u64 range");
        }
        if (normalizedLamports > treasuryLamports) {
          throw new Error(
            `Decrypted balance exceeds treasury backing (${normalizedLamports.toString()} > ${treasuryLamports.toString()})`
          );
        }

        setBalanceLamports(normalizedLamports);
        setError(
          pending
            ? `${pendingStatus.pendingMessage} Your last confirmed private balance is shown below.`
            : ""
        );
        return {
          account: fetched,
          pendingState: fetchedPendingState,
          lamports: normalizedLamports,
          pending,
          ...pendingStatus,
        };
      } catch (decryptError) {
        setBalanceLamports(null);
        console.error(
          "[usePrivateBalance] decrypt:error:message",
          decryptError?.message || String(decryptError)
        );
        console.error(
          "[usePrivateBalance] decrypt:error:stack",
          decryptError?.stack || "(no stack)"
        );
        console.error("[usePrivateBalance] decrypt:error", {
          programId: derived.program.programId.toBase58(),
          viewerPubkeyMatches: bytesEqual(fetched.viewerPubkey, keypair.publicKey),
          localViewerPubkey: Array.from(keypair.publicKey),
          accountViewerPubkey: Array.from(fetched.viewerPubkey),
          viewEncryptionKey: Array.from(fetched.viewEncryptionKey),
          mxePublicKey: mxePublicKey ? Array.from(mxePublicKey) : null,
          viewNonce: fetched.viewNonce?.toString?.() ?? fetched.viewNonce,
          treasuryPda: derived.treasuryPda.toBase58(),
          decryptError,
        });
        setError(
          `Private balance exists, but this browser cannot decrypt it yet. ${
            decryptError?.message || "Unknown decrypt error"
          }`
        );
        return { account: fetched, pendingState: fetchedPendingState, lamports: null };
      }
    } catch {
      setAccount(null);
      setPendingState(null);
      setPendingCurrentSlot(null);
      setBalanceLamports(null);
      return null;
    }
  }, [connection, derived, keypair]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    if (!account || getPendingActionValue(account) === 0) return undefined;

    const intervalId = window.setInterval(() => {
      refreshBalance();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [account, refreshBalance]);

  const ensureInitialized = useCallback(async () => {
    if (!derived || !publicKey || !keypair) {
      throw new Error("Connect your wallet first");
    }

    const existing = await refreshBalance();
    if (existing?.keyMismatch) {
      throw new Error(
        "This private balance was created with a different local encryption key. Use the original browser/profile for this wallet, or move this redesign to a fresh program id."
      );
    }
    if (existing?.pending) {
      throw new Error(
        existing?.pendingMessage ||
          "Private balance update is still waiting for the Arcium callback. Give it a moment, then refresh."
      );
    }
    if (existing?.missingView) {
      throw new Error(
        "Private balance account exists, but its encrypted view has not been materialized yet. This usually means the Arcium callback did not finish for this fresh deployment."
      );
    }
    if (existing?.account) return existing;

    setLoading(true);
    setError("");
    try {
      const computationOffset = randomComputationOffset();
      const viewerNonce = randomNonceBn();
      await derived.program.methods
        .initUserBalance(computationOffset, Array.from(keypair.publicKey), viewerNonce)
        .accounts({
          owner: publicKey,
          userBalance: derived.userBalancePda,
          pendingState: derived.userBalancePendingPda,
          ...getCircuitAccounts("init_user_balance", computationOffset),
          arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID),
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

      await waitForArciumComputation(derived.provider, computationOffset, "confirmed");
      const refreshed = await refreshBalance();
      if (!refreshed) throw new Error("Private balance init callback did not materialize");
      return refreshed;
    } finally {
      setLoading(false);
    }
  }, [derived, publicKey, keypair, refreshBalance]);

  const deposit = useCallback(
    async (solAmount) => {
      if (!derived || !publicKey) throw new Error("Connect your wallet first");
      await ensureInitialized();
      setLoading(true);
      setError("");
      try {
        const lamports = parseLamportsInput(solAmount);
        const computationOffset = randomComputationOffset();
        const viewerNonce = randomNonceBn();
        await derived.program.methods
          .depositBalance(computationOffset, new BN(lamports.toString()), viewerNonce)
          .accounts({
            owner: publicKey,
            userBalance: derived.userBalancePda,
            pendingState: derived.userBalancePendingPda,
            treasury: derived.treasuryPda,
            ...getCircuitAccounts("deposit_balance", computationOffset),
            arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID),
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: "confirmed" });

        const refreshed = await refreshBalance();
        monitorArciumComputation(derived.provider, computationOffset, refreshBalance);
        return refreshed;
      } finally {
        setLoading(false);
      }
    },
    [derived, ensureInitialized, publicKey, refreshBalance]
  );

  const withdraw = useCallback(
    async (solAmount) => {
      if (!derived || !publicKey) throw new Error("Connect your wallet first");
      const initialized = await ensureInitialized();
      setLoading(true);
      setError("");
      try {
        const lamports = parseLamportsInput(solAmount);
        const availableLamports = initialized?.lamports ?? balanceLamports;
        if (availableLamports !== null && lamports > availableLamports) {
          throw new Error(
            `Insufficient private balance. Available: ${formatLamportsAsSol(availableLamports)}`
          );
        }
        const computationOffset = randomComputationOffset();
        const viewerNonce = randomNonceBn();
        await derived.program.methods
          .withdrawBalance(computationOffset, new BN(lamports.toString()), viewerNonce)
          .accounts({
            owner: publicKey,
            userBalance: derived.userBalancePda,
            pendingState: derived.userBalancePendingPda,
            treasury: derived.treasuryPda,
            ...getCircuitAccounts("withdraw_balance", computationOffset),
            arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID),
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: "confirmed" });

        const refreshed = await refreshBalance();
        monitorArciumComputation(derived.provider, computationOffset, refreshBalance);
        return refreshed;
      } finally {
        setLoading(false);
      }
    },
    [balanceLamports, derived, ensureInitialized, publicKey, refreshBalance]
  );

  const recoverPendingAction = useCallback(async () => {
    if (!derived || !publicKey) throw new Error("Connect your wallet first");
    setLoading(true);
    setError("");
    try {
      await derived.program.methods
        .recoverStaleBalanceAction()
        .accounts({
          owner: publicKey,
          userBalance: derived.userBalancePda,
          pendingState: derived.userBalancePendingPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

      return refreshBalance();
    } finally {
      setLoading(false);
    }
  }, [derived, publicKey, refreshBalance]);

  const pendingStatus = buildPendingStatus({
    account,
    pendingState,
    currentSlot: pendingCurrentSlot,
  });
  const pendingAssessment =
    pendingStatus.pendingAction === 3 &&
    balanceLamports !== null &&
    pendingStatus.pendingWithdrawLamports > balanceLamports
      ? "This queued withdraw is larger than your last confirmed balance, so it should settle as rejected once the callback lands or once you recover it."
      : "";

  return {
    account,
    pendingState,
    balanceLamports,
    balanceSol:
      balanceLamports === null && error
        ? null
        : balanceLamports === null
          ? null
          : Number(balanceLamports) / 1e9,
    balanceDisplay:
      balanceLamports !== null
        ? formatLamportsAsSol(balanceLamports)
        : account
          ? pendingStatus.pendingAction !== 0
            ? pendingStatus.pendingActionLabel
            : "Private balance unavailable"
          : "Not initialized",
    pendingAction: pendingStatus.pendingAction,
    pendingActionLabel: pendingStatus.pendingActionLabel,
    pendingMessage: pendingStatus.pendingMessage,
    pendingWithdrawLamports: pendingStatus.pendingWithdrawLamports,
    pendingWithdrawDisplay: pendingStatus.pendingWithdrawDisplay,
    pendingStartedAtSlot: pendingStatus.pendingStartedAtSlot,
    pendingAgeSlots: pendingStatus.pendingAgeSlots,
    pendingAssessment,
    pendingRecoveryThresholdSlots: BALANCE_PENDING_STALE_SLOT_TTL,
    canRecoverPendingAction: pendingStatus.canRecoverPendingAction,
    isPending: pendingStatus.pendingAction !== 0,
    loading,
    error,
    keypair,
    userBalancePda: derived?.userBalancePda ?? null,
    userBalancePendingPda: derived?.userBalancePendingPda ?? null,
    treasuryPda: derived?.treasuryPda ?? null,
    refreshBalance,
    ensureInitialized,
    deposit,
    withdraw,
    recoverPendingAction,
  };
}
