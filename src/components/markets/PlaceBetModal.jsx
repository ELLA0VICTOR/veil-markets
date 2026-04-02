import { Buffer } from "buffer";
import { useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { ARCIUM_PROGRAM_ID, MIN_BET_SOL } from "../../utils/constants";
import { encryptVoteWithPrivateKey } from "../../utils/arcium";
import { getCircuitAccounts } from "../../utils/arciumAccounts";
import { createVeilProgram } from "../../utils/program";
import { solToLamports } from "../../utils/solana";
import { useArcium } from "../../hooks/useArcium";
import { usePrivateBalance } from "../../hooks/usePrivateBalance";
import { useWallet } from "../../hooks/useWallet";

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="10" height="11" viewBox="0 0 10 11" fill="none">
      <rect x="1" y="5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.1" fill="none" />
      <path d="M2.5 5V3.5a2.5 2.5 0 0 1 5 0V5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

const PHASES = {
  idle: null,
  preparing: "Preparing your private balance context...",
  encrypting: "Encrypting hidden vote and stake...",
  awaitingWallet: "Awaiting wallet approval...",
  submitting: "Broadcasting signed transaction...",
  mpc: "MPC nodes updating market state and your private balance...",
  done: "Private bet recorded.",
};

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

export default function PlaceBetModal({ market, onClose, onSuccess }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const { getMxePublicKey, awaitComputation } = useArcium();
  const {
    keypair,
    balanceSol,
    balanceLamports,
    balanceDisplay,
    error: privateBalanceError,
    ensureInitialized,
    userBalancePda,
    userBalancePendingPda,
    refreshBalance,
  } =
    usePrivateBalance();

  const [isYes, setIsYes] = useState(true);
  const [amount, setAmount] = useState(String(MIN_BET_SOL));
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [txSignature, setTxSignature] = useState("");

  const handleSubmit = async () => {
    if (!wallet || !publicKey) {
      setError("Connect your wallet first");
      return;
    }

    const sol = parseFloat(amount);
    if (Number.isNaN(sol) || sol < MIN_BET_SOL) {
      setError(`Minimum ${MIN_BET_SOL} SOL`);
      return;
    }

    if (privateBalanceError) {
      setError(privateBalanceError);
      return;
    }

    if (balanceLamports !== null && BigInt(solToLamports(sol)) > balanceLamports) {
      setError("Not enough private balance. Deposit to your VEIL balance first.");
      return;
    }

    setError("");
    setTxSignature("");
    setSubmitting(true);
    setPhase("preparing");

    try {
      const initialized = await ensureInitialized();
      if (!keypair || !userBalancePda || !userBalancePendingPda) {
        throw new Error("Private balance keys are not ready yet");
      }

      if (
        initialized?.lamports !== undefined &&
        initialized?.lamports !== null &&
        BigInt(initialized.lamports.toString()) < BigInt(solToLamports(sol))
      ) {
        throw new Error("Not enough private balance. Deposit to your VEIL balance first.");
      }

      const lamports = solToLamports(sol);
      const mxePublicKey = await getMxePublicKey();

      setPhase("encrypting");
      const vote = await encryptVoteWithPrivateKey(
        isYes,
        lamports,
        mxePublicKey,
        keypair.privateKey
      );

      setPhase("awaitingWallet");

      const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });
      const program = createVeilProgram(provider);
      const computationOffset = randomComputationOffset();
      const viewerNonce = randomNonceBn();
      const marketPubkey = new PublicKey(market.publicKey);
      const [position] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPubkey.toBuffer(), publicKey.toBuffer()],
        program.programId
      );

      const signature = await program.methods
        .placeVote(
          computationOffset,
          viewerNonce,
          new BN(vote.nonce.toString()),
          Array.from(vote.ciphertexts[0]),
          Array.from(vote.ciphertexts[1]),
          vote.publicKey
        )
        .accounts({
          voter: publicKey,
          market: marketPubkey,
          userBalance: userBalancePda,
          pendingState: userBalancePendingPda,
          position,
          ...getCircuitAccounts("add_vote", computationOffset),
          arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID),
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

      setTxSignature(signature);
      setPhase("submitting");

      setPhase("mpc");
      await awaitComputation(computationOffset);
      await refreshBalance();
      setPhase("done");
      setTimeout(() => onSuccess?.({ signature, computationOffset: computationOffset.toString() }), 1200);
    } catch (caught) {
      console.error("[PlaceBetModal] submit:error", caught);
      const message = caught?.message || "Transaction failed";
      const lowered = message.toLowerCase();
      if (
        lowered.includes("user rejected") ||
        lowered.includes("user declined") ||
        lowered.includes("walletsigntransactionerror") ||
        lowered.includes("cancelled") ||
        lowered.includes("canceled")
      ) {
        setError("Transaction canceled before signing");
      } else {
        setError(message);
      }
      setPhase("idle");
    } finally {
      setSubmitting(false);
    }
  };

  const active = submitting || phase === "mpc";
  const done = phase === "done";

  return (
    <div
      className="place-bet-modal"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-input)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14 }}>
            Place Bet
          </span>
          <span
            className="pill"
            style={{
              background: "transparent",
              color: "var(--text-3)",
              border: "1px solid var(--border)",
              fontSize: 9,
            }}
          >
            <LockIcon /> PRIVATE BALANCE
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-3)",
            padding: 4,
            borderRadius: 6,
            transition: "color 150ms",
          }}
        >
          <XIcon />
        </button>
      </div>

      <div style={{ padding: "18px" }}>
        <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 8 }}>
          YOUR PRIVATE BALANCE
        </p>
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 9,
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            marginBottom: 16,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--text-2)",
          }}
        >
          {balanceDisplay}
        </div>
        {privateBalanceError && (
          <div
            style={{
              padding: "9px 12px",
              background: "var(--red-dim)",
              border: "1px solid var(--red-border)",
              borderRadius: 8,
              fontSize: 11,
              color: "var(--red)",
              marginBottom: 16,
            }}
          >
            {privateBalanceError}
          </div>
        )}

        <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 8 }}>
          YOUR PREDICTION
        </p>
        <div className="place-bet-choice-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 18 }}>
          {[true, false].map((value) => {
            const selected = isYes === value;
            return (
              <button
                key={String(value)}
                onClick={() => setIsYes(value)}
                style={{
                  background: selected ? "var(--text)" : "var(--bg-input)",
                  border: `1px solid ${selected ? "var(--text)" : "var(--border)"}`,
                  borderRadius: 9,
                  padding: "16px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 800,
                  fontSize: 20,
                  letterSpacing: "0.05em",
                  color: selected ? "var(--bg)" : "var(--text-3)",
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                {value ? "YES" : "NO"}
              </button>
            );
          })}
        </div>

        <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 8 }}>
          AMOUNT
        </p>

        <div style={{ position: "relative", marginBottom: 4 }}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={MIN_BET_SOL}
            step="0.01"
            disabled={active}
            style={{
              width: "100%",
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: 9,
              padding: "11px 48px 11px 12px",
              color: "var(--text)",
              fontFamily: "var(--font-mono)",
              fontSize: 17,
              fontWeight: 600,
              outline: "none",
            }}
          />
          <span
            style={{
              position: "absolute",
              right: 13,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 11,
              color: "var(--text-3)",
            }}
          >
            SOL
          </span>
        </div>
        <p style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 14 }}>
          min {MIN_BET_SOL} SOL
        </p>

        {phase !== "idle" && (
          <div
            style={{
              marginBottom: 12,
              padding: "9px 12px",
              background: done ? "var(--green-dim)" : "var(--amber-dim)",
              border: `1px solid ${done ? "var(--green-border)" : "var(--amber-border)"}`,
              borderRadius: 8,
              fontSize: 11,
              color: done ? "var(--green)" : "var(--amber)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {!done && (
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  border: "2px solid currentColor",
                  borderTopColor: "transparent",
                  animation: "spin 0.7s linear infinite",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
            )}
            {PHASES[phase]}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: "9px 12px",
              background: "var(--red-dim)",
              border: "1px solid var(--red-border)",
              borderRadius: 8,
              fontSize: 11,
              color: "var(--red)",
            }}
          >
            {error}
          </div>
        )}

        {txSignature && (
          <div
            style={{
              marginBottom: 12,
              padding: "9px 12px",
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 11,
              color: "var(--text-2)",
              wordBreak: "break-all",
            }}
          >
            TX: {txSignature}
          </div>
        )}

        <div style={{ borderLeft: "2px solid var(--border-hover)", paddingLeft: 10, marginBottom: 14 }}>
          <p style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.6 }}>
            Your stake is now spent from an encrypted VEIL balance, not by sending a public market-specific SOL transfer.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={active || done}
          style={{
            width: "100%",
            background: active || done ? "var(--bg-input)" : "var(--text)",
            border: "none",
            borderRadius: 10,
            padding: "13px",
            fontFamily: "var(--font-mono)",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: "0.07em",
            color: active || done ? "var(--text-3)" : "var(--bg)",
            cursor: active || done ? "not-allowed" : "pointer",
          }}
        >
          {active
            ? "PROCESSING..."
            : done
              ? "PRIVATE BET RECORDED"
              : `BET ${isYes ? "YES" : "NO"} · ${amount} SOL`}
        </button>
      </div>
    </div>
  );
}
