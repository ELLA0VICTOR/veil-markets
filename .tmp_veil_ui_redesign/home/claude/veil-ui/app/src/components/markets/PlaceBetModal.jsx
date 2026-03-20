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
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="11" height="12" viewBox="0 0 11 12" fill="none">
      <path d="M5.5 1L1 3V6.5C1 8.985 3 11.13 5.5 11.5C8 11.13 10 8.985 10 6.5V3L5.5 1Z"
        stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round"/>
      <path d="M3.5 6.5L4.8 8L7.5 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const PHASE_LABELS = {
  idle:       null,
  encrypting: "Encrypting vote via Arcium MPC…",
  submitting: "Broadcasting to Solana…",
  mpc:        "MPC nodes computing encrypted state…",
  done:       "Vote recorded. Distribution stays hidden until resolution.",
};

const QUICK_AMOUNTS = [0.1, 0.5, 1, 5];

export default function PlaceBetModal({ market, onClose, onSuccess }) {
  const { connection } = useConnection();
  const wallet         = useAnchorWallet();
  const { publicKey }  = useWallet();
  const { encryptVoteForSubmission, awaitComputation } = useArcium();

  const [isYes,     setIsYes]     = useState(true);
  const [amount,    setAmount]    = useState(String(MIN_BET_SOL));
  const [submitting, setSubmitting] = useState(false);
  const [phase,     setPhase]     = useState("idle");
  const [error,     setError]     = useState("");

  const handleSubmit = async () => {
    if (!wallet || !publicKey) { setError("Connect your wallet first"); return; }
    const solAmt = parseFloat(amount);
    if (isNaN(solAmt) || solAmt < MIN_BET_SOL) { setError(`Minimum bet is ${MIN_BET_SOL} SOL`); return; }

    setError("");
    setSubmitting(true);
    setPhase("encrypting");

    try {
      const lamports = solToLamports(solAmt);
      const { ciphertexts, nonce, publicKey: voterPubKey } = await encryptVoteForSubmission(isYes, lamports);

      setPhase("submitting");

      const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
      const program  = createVeilProgram(provider);

      const offsetBuf = crypto.getRandomValues(new Uint8Array(8));
      const offsetBig = new DataView(offsetBuf.buffer).getBigUint64(0, true);
      const computationOffset = new BN(offsetBig.toString());

      const marketPubkey = new PublicKey(market.publicKey);
      const [vaultPda]    = PublicKey.findProgramAddressSync([Buffer.from("vault"),    marketPubkey.toBuffer()],  getProgramId());
      const [positionPda] = PublicKey.findProgramAddressSync([Buffer.from("position"), marketPubkey.toBuffer(), publicKey.toBuffer()], getProgramId());
      const arciumAccounts = getCircuitAccounts("add_vote", computationOffset);

      await program.methods
        .placeVote(computationOffset, nonce, Array.from(ciphertexts[0]), Array.from(ciphertexts[1]), voterPubKey, new BN(lamports), isYes)
        .accounts({ voter: publicKey, market: marketPubkey, vault: vaultPda, position: positionPda, ...arciumAccounts, addVoteCallbackProgram: new PublicKey(PROGRAM_ID), arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID), systemProgram: SystemProgram.programId })
        .rpc({ commitment: "confirmed" });

      setPhase("mpc");
      await awaitComputation(computationOffset);
      setPhase("done");
      setTimeout(() => onSuccess(), 1400);
    } catch (err) {
      setError(err.message || "Transaction failed");
      setPhase("idle");
    } finally {
      setSubmitting(false);
    }
  };

  const isActive = submitting || phase === "mpc";
  const isDone   = phase === "done";

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 16,
      boxShadow: "var(--shadow-card)",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--bg-elevated)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>Place Bet</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "var(--accent-dim)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: 99, color: "var(--accent-bright)" }}>
            <ShieldIcon />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em" }}>E2E ENCRYPTED</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 6, transition: "color 150ms" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
        >
          <XIcon />
        </button>
      </div>

      <div style={{ padding: "20px" }}>
        {/* YES / NO */}
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.14em", marginBottom: 10 }}>
          YOUR PREDICTION
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {[true, false].map((v) => {
            const sel    = isYes === v;
            const color  = v ? "var(--yes-color)" : "var(--no-color)";
            const dimBg  = v ? "var(--yes-dim)"   : "var(--no-dim)";
            const border = v ? "var(--yes-border)" : "var(--no-border)";
            return (
              <button
                key={String(v)}
                onClick={() => setIsYes(v)}
                style={{
                  background:  sel ? dimBg : "var(--bg-elevated)",
                  border:      `2px solid ${sel ? color : "var(--border-default)"}`,
                  borderRadius: 10,
                  padding:     "18px",
                  fontFamily:  "var(--font-display)",
                  fontWeight:   800,
                  fontSize:     22,
                  letterSpacing: "0.04em",
                  color:        sel ? color : "var(--text-muted)",
                  cursor:       "pointer",
                  transition:   "all 160ms ease",
                  boxShadow:    sel ? `0 0 20px ${v ? "rgba(34,211,238,0.12)" : "rgba(251,113,133,0.12)"}` : "none",
                }}
              >
                {v ? "YES" : "NO"}
              </button>
            );
          })}
        </div>

        {/* Amount */}
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.14em", marginBottom: 8 }}>
          STAKE AMOUNT
        </p>

        {/* Quick amounts */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(String(a))}
              style={{
                flex: 1,
                padding: "6px 4px",
                background: parseFloat(amount) === a ? "var(--accent-dim)" : "var(--bg-elevated)",
                border: `1px solid ${parseFloat(amount) === a ? "rgba(129,140,248,0.3)" : "var(--border-default)"}`,
                borderRadius: 7,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: parseFloat(amount) === a ? "var(--accent-bright)" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              {a}
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
            disabled={isActive}
            style={{
              width: "100%",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: 10,
              padding: "12px 52px 12px 14px",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: 18,
              outline: "none",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => e.target.style.borderColor = "var(--border-accent)"}
            onBlur={(e)  => e.target.style.borderColor = "var(--border-default)"}
          />
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
            SOL
          </span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", marginBottom: 16 }}>
          min {MIN_BET_SOL} SOL
        </p>

        {/* Phase status */}
        {phase !== "idle" && (
          <div style={{
            marginBottom: 14,
            padding: "10px 14px",
            background: isDone ? "var(--success-dim)" : "var(--pending-dim)",
            border: `1px solid ${isDone ? "rgba(52,211,153,0.25)" : "var(--pending-border)"}`,
            borderRadius: 9,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: isDone ? "var(--success)" : "var(--pending)",
            display: "flex",
            alignItems: "center",
            gap: 9,
          }}>
            {!isDone && (
              <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />
            )}
            {PHASE_LABELS[phase]}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 14, padding: "10px 14px", background: "var(--no-dim)", border: "1px solid var(--no-border)", borderRadius: 9, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--no-color)" }}>
            {error}
          </div>
        )}

        {/* Privacy notice */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 9, padding: "10px 13px", marginBottom: 16, borderLeft: "2px solid var(--accent)" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Vote encrypted client-side with x25519 + RescueCipher before hitting chain. Nobody sees the odds until resolution.
          </p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isActive || isDone}
          style={{
            width: "100%",
            background: isActive || isDone
              ? "var(--bg-elevated)"
              : isYes
                ? "linear-gradient(135deg, #22D3EE, #0EA5E9)"
                : "linear-gradient(135deg, #FB7185, #E11D48)",
            border: "none",
            borderRadius: 11,
            padding: "14px",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "0.05em",
            color: isActive || isDone ? "var(--text-muted)" : "#fff",
            cursor: isActive || isDone ? "not-allowed" : "pointer",
            transition: "all 180ms ease",
            boxShadow: isActive || isDone ? "none" : isYes ? "0 4px 16px rgba(34,211,238,0.25)" : "0 4px 16px rgba(251,113,133,0.25)",
          }}
        >
          {isActive ? "Processing…" : isDone ? "Vote Recorded" : `BET ${isYes ? "YES" : "NO"} · ${amount} SOL`}
        </button>
      </div>
    </div>
  );
}
