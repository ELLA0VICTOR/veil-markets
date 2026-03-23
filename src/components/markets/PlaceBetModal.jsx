import { useState } from "react";
import { Buffer } from "buffer";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { PROGRAM_ID, ARCIUM_PROGRAM_ID, MIN_BET_SOL } from "../../utils/constants";
import { solToLamports } from "../../utils/solana";
import { useArcium } from "../../hooks/useArcium";
import { useWallet } from "../../hooks/useWallet";
import { getCircuitAccounts } from "../../utils/arciumAccounts";
import { createVeilProgram, getProgramId } from "../../utils/program";

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
  encrypting: "Encrypting vote via Arcium MPC...",
  submitting: "Broadcasting to Solana...",
  mpc: "MPC nodes computing encrypted state...",
  done: "Vote recorded. Distribution hidden until resolution.",
};

export default function PlaceBetModal({ market, onClose, onSuccess }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey, balance } = useWallet();
  const { encryptVoteForSubmission, awaitComputation } = useArcium();

  const [isYes, setIsYes] = useState(true);
  const [amount, setAmount] = useState(String(MIN_BET_SOL));
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");

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

    setError("");
    setSubmitting(true);
    setPhase("encrypting");

    try {
      const lamports = solToLamports(sol);
      console.log("[PlaceBetModal] submit:start", {
        market: market?.publicKey,
        isYes,
        sol,
        lamports,
        wallet: publicKey?.toBase58?.(),
      });
      const { ciphertexts, nonce, publicKey: voterCipherPubkey } =
        await encryptVoteForSubmission(isYes, lamports);

      console.log("[PlaceBetModal] encrypt:done", {
        nonce: nonce?.toString?.() ?? nonce,
        ciphertextCount: ciphertexts?.length,
        voterCipherPubkeyLength: voterCipherPubkey?.length,
      });

      setPhase("submitting");

      const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });
      const program = createVeilProgram(provider);
      const randomOffsetBytes = crypto.getRandomValues(new Uint8Array(8));
      const computationOffset = new BN(
        new DataView(randomOffsetBytes.buffer).getBigUint64(0, true).toString()
      );
      const marketPubkey = new PublicKey(market.publicKey);
      const [vault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPubkey.toBuffer()],
        getProgramId()
      );
      const [position] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPubkey.toBuffer(), publicKey.toBuffer()],
        getProgramId()
      );

      console.log("[PlaceBetModal] accounts", {
        market: marketPubkey.toBase58(),
        vault: vault.toBase58(),
        position: position.toBase58(),
        circuitAccounts: {
          ...getCircuitAccounts("add_vote", computationOffset),
        },
      });

      await program.methods
        .placeVote(
          computationOffset,
          nonce,
          Array.from(ciphertexts[0]),
          Array.from(ciphertexts[1]),
          voterCipherPubkey,
          new BN(lamports),
          isYes
        )
        .accounts({
          voter: publicKey,
          market: marketPubkey,
          vault,
          position,
          ...getCircuitAccounts("add_vote", computationOffset),
          addVoteCallbackProgram: new PublicKey(PROGRAM_ID),
          arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID),
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

      console.log("[PlaceBetModal] rpc:submitted", {
        computationOffset: computationOffset.toString(),
      });

      setPhase("mpc");
      try {
        await awaitComputation(computationOffset);
        console.log("[PlaceBetModal] computation:done", {
          computationOffset: computationOffset.toString(),
        });
      } catch (awaitError) {
        console.warn("[PlaceBetModal] computation:warning", awaitError);
      }
      setPhase("done");
      setTimeout(() => onSuccess(), 1400);
    } catch (caught) {
      console.error("[PlaceBetModal] submit:error", caught);
      setError(caught?.message || "Transaction failed");
      setPhase("idle");
    } finally {
      setSubmitting(false);
    }
  };

  const active = submitting || phase === "mpc";
  const done = phase === "done";

  const applyBalancePercent = (percent) => {
    if (!balance) return;
    setAmount(((balance * percent) / 100).toFixed(3));
  };

  return (
    <div
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
            <LockIcon /> E2E ENCRYPTED
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
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-3)";
          }}
        >
          <XIcon />
        </button>
      </div>

      <div style={{ padding: "18px" }}>
        <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 8 }}>
          YOUR PREDICTION
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 18 }}>
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

        <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
          {[
            [25, "25%"],
            [50, "50%"],
            [75, "75%"],
            [100, "Max"],
          ].map(([percent, label]) => (
            <button
              key={percent}
              onClick={() => applyBalancePercent(percent)}
              style={{
                flex: 1,
                padding: "5px 0",
                background: "var(--bg-input)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-2)",
                cursor: "pointer",
                transition: "all 140ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-hover)";
                e.currentTarget.style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--text-2)";
              }}
            >
              {label}
            </button>
          ))}
        </div>

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
              transition: "border-color 150ms",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--border-focus)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border)";
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

        <div style={{ borderLeft: "2px solid var(--border-hover)", paddingLeft: 10, marginBottom: 14 }}>
          <p style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.6 }}>
            Vote encrypted with x25519 + RescueCipher client-side. Nobody sees the odds until this market resolves.
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
            transition: "all 150ms ease",
          }}
        >
          {active
            ? "PROCESSING..."
            : done
              ? "VOTE RECORDED"
              : `BET ${isYes ? "YES" : "NO"} · ${amount} SOL`}
        </button>
      </div>
    </div>
  );
}
