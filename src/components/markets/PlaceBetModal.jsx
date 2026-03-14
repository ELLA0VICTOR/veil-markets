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

// Lock icon
function LockIcon() {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" fill="none">
      <rect x="1.5" y="5.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M3.5 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

// X icon
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default function PlaceBetModal({ market, onClose, onSuccess }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const { encryptVoteForSubmission, awaitComputation } = useArcium();

  const [isYes, setIsYes] = useState(true);
  const [amount, setAmount] = useState(String(MIN_BET_SOL));
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | encrypting | submitting | mpc | done
  const [error, setError] = useState("");
  const handleSubmit = async () => {
    if (!wallet || !publicKey) { setError("Connect your wallet first"); return; }

    const solAmt = parseFloat(amount);
    if (isNaN(solAmt) || solAmt < MIN_BET_SOL) { setError(`Minimum bet is ${MIN_BET_SOL} SOL`); return; }

    setError("");
    setSubmitting(true);
    setPhase("encrypting");

    try {
      const lamports = solToLamports(solAmt);

      // Step 1: Encrypt vote
      const { ciphertexts, nonce, publicKey: voterPubKey } = await encryptVoteForSubmission(isYes, lamports);

      setPhase("submitting");

      const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
      const program = createVeilProgram(provider);

      // Random computation offset
      const offsetBuf = crypto.getRandomValues(new Uint8Array(8));
      const view = new DataView(offsetBuf.buffer);
      const offsetBig = view.getBigUint64(0, true);
      const computationOffset = new BN(offsetBig.toString());

      const marketPubkey = new PublicKey(market.publicKey);
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPubkey.toBuffer()],
        getProgramId()
      );
      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPubkey.toBuffer(), publicKey.toBuffer()],
        getProgramId()
      );
      const arciumAccounts = getCircuitAccounts("add_vote", computationOffset);

      await program.methods
        .placeVote(
          computationOffset,
          nonce,
          Array.from(ciphertexts[0]),
          Array.from(ciphertexts[1]),
          voterPubKey,
          new BN(lamports),
          isYes
        )
        .accounts({
          voter: publicKey,
          market: marketPubkey,
          vault: vaultPda,
          position: positionPda,
          ...arciumAccounts,
          addVoteCallbackProgram: new PublicKey(PROGRAM_ID),
          arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID),
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });
      setPhase("mpc");

      // Await MPC computation
      await awaitComputation(computationOffset);

      setPhase("done");
      setTimeout(() => onSuccess(), 1200);
    } catch (err) {
      setError(err.message || "Transaction failed");
      setPhase("idle");
    } finally {
      setSubmitting(false);
    }
  };

  const phaseLabels = {
    idle: null,
    encrypting: "Encrypting vote with Arcium MPC...",
    submitting: "Submitting to Solana...",
    mpc: "MPC cluster computing encrypted state...",
    done: "Vote recorded! Vote distribution remains hidden.",
  };

  return (
    <div
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}
    >
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16 }}>Place Bet</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(163,255,18,0.06)", border: "1px solid rgba(163,255,18,0.15)", borderRadius: 6, padding: "4px 8px" }}>
            <LockIcon />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.1em" }}>END-TO-END ENCRYPTED</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 2 }}>
            <XIcon />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "20px" }}>
        {/* YES / NO toggle */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 8 }}>YOUR PREDICTION</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              onClick={() => setIsYes(true)}
              style={{
                background: isYes ? "var(--yes-dim)" : "var(--bg-elevated)",
                border: `2px solid ${isYes ? "var(--yes-color)" : "var(--border-default)"}`,
                borderRadius: 10, padding: "16px",
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20,
                color: isYes ? "var(--yes-color)" : "var(--text-muted)",
                cursor: "pointer", transition: "all 150ms ease",
                boxShadow: isYes ? "0 0 16px rgba(0,180,255,0.15)" : "none",
              }}
            >
              YES
            </button>
            <button
              onClick={() => setIsYes(false)}
              style={{
                background: !isYes ? "var(--no-dim)" : "var(--bg-elevated)",
                border: `2px solid ${!isYes ? "var(--no-color)" : "var(--border-default)"}`,
                borderRadius: 10, padding: "16px",
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20,
                color: !isYes ? "var(--no-color)" : "var(--text-muted)",
                cursor: "pointer", transition: "all 150ms ease",
                boxShadow: !isYes ? "0 0 16px rgba(255,61,61,0.15)" : "none",
              }}
            >
              NO
            </button>
          </div>
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
            AMOUNT (SOL)
          </label>
          <div style={{ position: "relative" }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={MIN_BET_SOL}
              step="0.01"
              disabled={submitting}
              style={{
                width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8,
                padding: "12px 50px 12px 14px", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: 16,
                outline: "none", transition: "border-color 150ms",
              }}
              onFocus={(e) => e.target.style.borderColor = "var(--border-accent)"}
              onBlur={(e) => e.target.style.borderColor = "var(--border-default)"}
            />
            <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
              SOL
            </span>
          </div>
          <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>
            Min: {MIN_BET_SOL} SOL
          </p>
        </div>

        {/* Status */}
        {phase !== "idle" && (
          <div
            style={{
              marginBottom: 16, padding: "10px 14px",
              background: phase === "done" ? "var(--accent-dim)" : "var(--pending-dim)",
              border: `1px solid ${phase === "done" ? "rgba(163,255,18,0.2)" : "rgba(255,176,23,0.2)"}`,
              borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12,
              color: phase === "done" ? "var(--accent)" : "var(--pending)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {phase !== "done" && (
              <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }} />
            )}
            {phaseLabels[phase]}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(255,61,61,0.08)", border: "1px solid rgba(255,61,61,0.2)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no-color)" }}>
            {error}
          </div>
        )}

        {/* Privacy note */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: "10px 12px", marginBottom: 16, borderLeft: "2px solid var(--accent)" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Your vote direction and stake are encrypted via Arcium MPC before hitting the chain. No one can see the vote distribution until this market resolves.
          </p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || phase === "done"}
          style={{
            width: "100%", background: submitting || phase === "done" ? "var(--bg-elevated)" : isYes ? "var(--yes-color)" : "var(--no-color)",
            border: "none", borderRadius: 10, padding: "13px",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15,
            color: submitting || phase === "done" ? "var(--text-muted)" : "#070707",
            cursor: submitting || phase === "done" ? "not-allowed" : "pointer",
            transition: "all 150ms ease",
            letterSpacing: "0.05em",
          }}
        >
          {submitting ? "Processing..." : phase === "done" ? "Vote Recorded" : `BET ${isYes ? "YES" : "NO"} — ${amount} SOL`}
        </button>
      </div>
    </div>
  );
}
