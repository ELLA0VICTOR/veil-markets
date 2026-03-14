import { useState } from "react";
import { Buffer } from "buffer";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { PROGRAM_ID, ARCIUM_PROGRAM_ID, MIN_INITIAL_POOL_SOL } from "../../utils/constants";
import { conditionIdToBytes } from "../../utils/polymarket";
import { useWallet } from "../../hooks/useWallet";
import {
  getCircuitAccounts,
  waitForArciumComputation,
} from "../../utils/arciumAccounts";
import { createVeilProgram, getProgramId } from "../../utils/program";
import PolymarketBrowser from "./PolymarketBrowser";

// X icon
function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

// Lock icon
function LockIcon() {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" fill="none">
      <rect x="1.5" y="5.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M3.5 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export default function CreateMarketModal({ onClose, onCreated }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const [tab, setTab] = useState("custom"); // custom | polymarket
  const [question, setQuestion] = useState("");
  const [endDate, setEndDate] = useState("");
  const [initialSOL, setInitialSOL] = useState(String(MIN_INITIAL_POOL_SOL));
  const [selectedPM, setSelectedPM] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!wallet || !publicKey) { setError("Connect your wallet first"); return; }

    setError("");
    setSubmitting(true);

    try {
      const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
      const program = createVeilProgram(provider);

      const isPolymarket = tab === "polymarket";
      const q = isPolymarket ? selectedPM?.question : question;
      if (!q) throw new Error("Question is required");

      const endTimestamp = isPolymarket
        ? Math.floor(selectedPM.endDate.getTime() / 1000)
        : Math.floor(new Date(endDate).getTime() / 1000);

      if (endTimestamp <= Math.floor(Date.now() / 1000)) throw new Error("End time must be in the future");

      const solAmount = parseFloat(initialSOL);
      if (isNaN(solAmount) || solAmount < MIN_INITIAL_POOL_SOL) throw new Error(`Minimum initial pool is ${MIN_INITIAL_POOL_SOL} SOL`);

      // Encode question
      const questionBytes = new Uint8Array(280);
      questionBytes.set(new TextEncoder().encode(q.slice(0, 280)));

      const conditionId = isPolymarket && selectedPM
        ? conditionIdToBytes(selectedPM.conditionId)
        : Array.from(new Uint8Array(32));

      // Random computation offset
      const offsetBuffer = crypto.getRandomValues(new Uint8Array(8));
      const view = new DataView(offsetBuffer.buffer);
      const offsetNum = view.getBigUint64(0, true);
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

      setStatus("Submitting transaction...");

      await program.methods
        .createMarket(
          computationOffset,
          Array.from(questionBytes),
          new BN(endTimestamp),
          isPolymarket,
          conditionId
        )
        .accounts({
          creator: publicKey,
          market: marketPda,
          vault: vaultPda,
          ...arciumAccounts,
          createMarketCallbackProgram: new PublicKey(PROGRAM_ID),
          arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID),
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

      setStatus("MPC initializing market state...");

      await waitForArciumComputation(provider, computationOffset, "confirmed");

      setStatus("Market is live!");
      setTimeout(() => { onCreated(); }, 800);
    } catch (err) {
      setError(err.message || "Failed to create market");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting && (
    tab === "custom" ? (question.trim() && endDate) :
    (selectedPM !== null)
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(7,7,7,0.88)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 560, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 16, overflow: "hidden", animation: "fadeUp 300ms ease-out", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>Create Market</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 4 }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
          >
            <XIcon />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          {[["custom", "Custom"], ["polymarket", "Import from Polymarket"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTab(val)}
              style={{
                flex: 1, padding: "12px", background: "none", border: "none", borderBottom: `2px solid ${tab === val ? "var(--accent)" : "transparent"}`,
                fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500,
                color: tab === val ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 150ms ease",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {tab === "custom" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
                  QUESTION ({question.length}/280)
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, 280))}
                  placeholder="Will... ?"
                  rows={3}
                  style={{
                    width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 8,
                    padding: "10px 12px", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: 14,
                    resize: "vertical", outline: "none", transition: "border-color 150ms",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--border-accent)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border-default)"}
                />
              </div>

              <div>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
                  END DATE & TIME
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  style={{
                    width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 8,
                    padding: "10px 12px", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: 13,
                    outline: "none", colorScheme: "dark",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--border-accent)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border-default)"}
                />
              </div>

              <div>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
                  INITIAL POOL (SOL)
                </label>
                <input
                  type="number"
                  value={initialSOL}
                  onChange={(e) => setInitialSOL(e.target.value)}
                  min={MIN_INITIAL_POOL_SOL}
                  step="0.01"
                  style={{
                    width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 8,
                    padding: "10px 12px", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: 14,
                    outline: "none",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--border-accent)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border-default)"}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <PolymarketBrowser selected={selectedPM} onSelect={setSelectedPM} />

              {selectedPM && (
                <div>
                  <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
                    VEIL INITIAL POOL (SOL)
                  </label>
                  <input
                    type="number"
                    value={initialSOL}
                    onChange={(e) => setInitialSOL(e.target.value)}
                    min={MIN_INITIAL_POOL_SOL}
                    step="0.01"
                    style={{
                      width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 8,
                      padding: "10px 12px", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: 14,
                      outline: "none",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "var(--border-accent)"}
                    onBlur={(e) => e.target.style.borderColor = "var(--border-default)"}
                  />
                </div>
              )}
            </div>
          )}

          {/* Status/error */}
          {status && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--accent-dim)", border: "1px solid rgba(163,255,18,0.2)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>
              {status}
            </div>
          )}
          {error && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(255,61,61,0.08)", border: "1px solid rgba(255,61,61,0.2)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no-color)" }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
            <LockIcon />
            END-TO-END ENCRYPTED
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "9px 16px", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-secondary)", cursor: "pointer" }}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                background: canSubmit ? "var(--accent)" : "var(--bg-surface)",
                border: canSubmit ? "none" : "1px solid var(--border-default)",
                borderRadius: 8, padding: "9px 18px",
                fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 500,
                color: canSubmit ? "#070707" : "var(--text-muted)",
                cursor: canSubmit ? "pointer" : "not-allowed",
                transition: "all 150ms ease",
              }}
            >
              {submitting ? "Creating..." : "Create Market"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
