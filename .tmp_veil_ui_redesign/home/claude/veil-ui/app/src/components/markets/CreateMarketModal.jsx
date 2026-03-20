import { useState } from "react";
import { Buffer } from "buffer";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { PROGRAM_ID, ARCIUM_PROGRAM_ID, MIN_INITIAL_POOL_SOL } from "../../utils/constants";
import { conditionIdToBytes } from "../../utils/polymarket";
import { useWallet } from "../../hooks/useWallet";
import { getCircuitAccounts, waitForArciumComputation } from "../../utils/arciumAccounts";
import { createVeilProgram, getProgramId } from "../../utils/program";
import PolymarketBrowser from "./PolymarketBrowser";

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function inputStyle(focused) {
  return {
    width: "100%",
    background: "var(--bg-base)",
    border: `1px solid ${focused ? "var(--border-accent)" : "var(--border-default)"}`,
    borderRadius: 10,
    padding: "10px 13px",
    color: "var(--text-primary)",
    fontFamily: "var(--font-body)",
    fontSize: 14,
    outline: "none",
    transition: "border-color 150ms",
    colorScheme: "dark",
  };
}

function Label({ children }) {
  return (
    <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.14em", marginBottom: 7 }}>
      {children}
    </p>
  );
}

export default function CreateMarketModal({ onClose, onCreated }) {
  const { connection } = useConnection();
  const wallet         = useAnchorWallet();
  const { publicKey }  = useWallet();

  const [tab,        setTab]        = useState("custom");
  const [question,   setQuestion]   = useState("");
  const [endDate,    setEndDate]    = useState("");
  const [initialSOL, setInitialSOL] = useState(String(MIN_INITIAL_POOL_SOL));
  const [selectedPM, setSelectedPM] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [status,     setStatus]     = useState("");
  const [error,      setError]      = useState("");
  const [focusedInput, setFocused]  = useState(null);

  const handleSubmit = async () => {
    if (!wallet || !publicKey) { setError("Connect your wallet first"); return; }
    setError(""); setSubmitting(true);

    try {
      const provider    = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
      const program     = createVeilProgram(provider);
      const isPolymarket = tab === "polymarket";
      const q            = isPolymarket ? selectedPM?.question : question;
      if (!q) throw new Error("Question is required");

      const endTimestamp = isPolymarket
        ? Math.floor(selectedPM.endDate.getTime() / 1000)
        : Math.floor(new Date(endDate).getTime() / 1000);
      if (endTimestamp <= Math.floor(Date.now() / 1000)) throw new Error("End time must be in the future");

      const solAmount = parseFloat(initialSOL);
      if (isNaN(solAmount) || solAmount < MIN_INITIAL_POOL_SOL) throw new Error(`Minimum ${MIN_INITIAL_POOL_SOL} SOL`);

      const questionBytes = new Uint8Array(280);
      questionBytes.set(new TextEncoder().encode(q.slice(0, 280)));

      const conditionId = isPolymarket && selectedPM
        ? conditionIdToBytes(selectedPM.conditionId)
        : Array.from(new Uint8Array(32));

      const offsetBuf  = crypto.getRandomValues(new Uint8Array(8));
      const offsetNum  = new DataView(offsetBuf.buffer).getBigUint64(0, true);
      const computationOffset = new BN(offsetNum.toString());

      const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), publicKey.toBuffer(), computationOffset.toArrayLike(Buffer, "le", 8)],
        getProgramId()
      );
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        getProgramId()
      );
      const arciumAccounts = getCircuitAccounts("init_market_state", computationOffset);

      setStatus("Submitting transaction…");
      await program.methods
        .createMarket(computationOffset, Array.from(questionBytes), new BN(endTimestamp), isPolymarket, conditionId)
        .accounts({ creator: publicKey, market: marketPda, vault: vaultPda, ...arciumAccounts, createMarketCallbackProgram: new PublicKey(PROGRAM_ID), arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID), systemProgram: SystemProgram.programId })
        .rpc({ commitment: "confirmed" });

      setStatus("MPC initializing market state…");
      await waitForArciumComputation(provider, computationOffset, "confirmed");
      setStatus("Market is live!");
      setTimeout(() => onCreated(), 800);
    } catch (err) {
      setError(err.message || "Failed to create market");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting && (tab === "custom" ? (question.trim() && endDate) : selectedPM !== null);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(7,11,20,0.88)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}
    >
      <div
        className="scale-in"
        style={{ width: "100%", maxWidth: 540, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 18, overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent */}
        <div style={{ height: 2, background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }} />

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>New Market</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 5, borderRadius: 7, transition: "color 150ms" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
          ><XIcon /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0, padding: "4px 24px 0" }}>
          {[["custom", "Custom"], ["polymarket", "Import from Polymarket"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTab(val)}
              style={{
                padding: "10px 16px",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${tab === val ? "var(--accent)" : "transparent"}`,
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: 500,
                color: tab === val ? "var(--accent-bright)" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 150ms ease",
                marginBottom: -1,
              }}
            >{label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "22px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {tab === "custom" ? (
            <>
              <div>
                <Label>QUESTION ({question.length}/280)</Label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, 280))}
                  placeholder="Will Bitcoin break $150k before 2026?"
                  rows={3}
                  style={{ ...inputStyle(focusedInput === "q"), resize: "vertical", lineHeight: 1.5 }}
                  onFocus={() => setFocused("q")}
                  onBlur={() => setFocused(null)}
                />
              </div>
              <div>
                <Label>END DATE & TIME</Label>
                <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  style={{ ...inputStyle(focusedInput === "d"), fontFamily: "var(--font-mono)", fontSize: 13 }}
                  onFocus={() => setFocused("d")} onBlur={() => setFocused(null)}
                />
              </div>
              <div>
                <Label>INITIAL POOL (SOL)</Label>
                <input type="number" value={initialSOL} onChange={(e) => setInitialSOL(e.target.value)} min={MIN_INITIAL_POOL_SOL} step="0.01"
                  style={{ ...inputStyle(focusedInput === "s"), fontFamily: "var(--font-mono)", fontSize: 15 }}
                  onFocus={() => setFocused("s")} onBlur={() => setFocused(null)}
                />
              </div>
            </>
          ) : (
            <>
              <PolymarketBrowser selected={selectedPM} onSelect={setSelectedPM} />
              {selectedPM && (
                <div>
                  <Label>VEIL PRIZE POOL (SOL)</Label>
                  <input type="number" value={initialSOL} onChange={(e) => setInitialSOL(e.target.value)} min={MIN_INITIAL_POOL_SOL} step="0.01"
                    style={{ ...inputStyle(focusedInput === "s2"), fontFamily: "var(--font-mono)", fontSize: 15 }}
                    onFocus={() => setFocused("s2")} onBlur={() => setFocused(null)}
                  />
                </div>
              )}
            </>
          )}

          {status && (
            <div style={{ padding: "10px 13px", background: "var(--accent-dim)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: 9, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-bright)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />
              {status}
            </div>
          )}
          {error && (
            <div style={{ padding: "10px 13px", background: "var(--no-dim)", border: "1px solid var(--no-border)", borderRadius: 9, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--no-color)" }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 9, padding: "9px 18px", fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? "linear-gradient(135deg, #818CF8, #6366F1)" : "var(--bg-surface)",
              border: canSubmit ? "none" : "1px solid var(--border-default)",
              borderRadius: 9,
              padding: "9px 20px",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              color: canSubmit ? "#fff" : "var(--text-muted)",
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "all 160ms ease",
              boxShadow: canSubmit ? "0 2px 12px rgba(129,140,248,0.28)" : "none",
            }}
          >
            {submitting ? "Creating…" : "Create Market"}
          </button>
        </div>
      </div>
    </div>
  );
}
