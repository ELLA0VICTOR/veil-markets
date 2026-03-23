import { useState } from "react";
import { Buffer } from "buffer";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { PROGRAM_ID, ARCIUM_PROGRAM_ID, DEFAULT_INITIAL_POOL_SOL } from "../../utils/constants";
import { conditionIdToBytes } from "../../utils/polymarket";
import { useWallet } from "../../hooks/useWallet";
import { getCircuitAccounts, waitForArciumComputation } from "../../utils/arciumAccounts";
import { createVeilProgram, getProgramId } from "../../utils/program";
import { solToLamports } from "../../utils/solana";
import PolymarketBrowser from "./PolymarketBrowser";

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2.5 2.5l9 9M11.5 2.5l-9 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const inputSt = {
  width: "100%",
  background: "var(--bg-input)",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "10px 12px",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  outline: "none",
  transition: "border-color 150ms",
  colorScheme: "dark",
};

function onFocus(e) {
  e.target.style.borderColor = "var(--border-focus)";
}

function onBlur_(e) {
  e.target.style.borderColor = "var(--border)";
}

function Label({ ch, max, children }) {
  return (
    <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 7 }}>
      {children}
      {ch !== undefined ? ` (${ch}/${max})` : ""}
    </p>
  );
}

export default function CreateMarketModal({
  onClose,
  onCreated,
  initialTab = "custom",
  initialSelectedPM = null,
}) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const [tab, setTab] = useState(initialTab);
  const [question, setQuestion] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sol, setSol] = useState(String(DEFAULT_INITIAL_POOL_SOL));
  const [selectedPM, setSelectedPM] = useState(initialSelectedPM);
  const [sub, setSub] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  const handleSubmit = async () => {
    if (!wallet || !publicKey) {
      setErr("Connect wallet first");
      return;
    }

    setErr("");
    setSub(true);

    try {
      const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
      const program = createVeilProgram(provider);
      const isPoly = tab === "polymarket";
      const q = isPoly ? selectedPM?.question : question;

      if (!q) {
        throw new Error("Question required");
      }

      const ts = isPoly
        ? Math.floor(selectedPM.endDate.getTime() / 1000)
        : Math.floor(new Date(endDate).getTime() / 1000);

      if (ts <= Math.floor(Date.now() / 1000)) {
        throw new Error("End time must be in the future");
      }

      const solAmt = sol.trim() === "" ? 0 : parseFloat(sol);
      if (Number.isNaN(solAmt) || solAmt < 0) {
        throw new Error("Creator seed must be 0 or more");
      }

      const initialPoolLamports = solToLamports(String(solAmt));

      const qBytes = new Uint8Array(280);
      qBytes.set(new TextEncoder().encode(q.slice(0, 280)));

      const cid =
        isPoly && selectedPM
          ? conditionIdToBytes(selectedPM.conditionId)
          : Array.from(new Uint8Array(32));

      const off = crypto.getRandomValues(new Uint8Array(8));
      const cOff = new BN(new DataView(off.buffer).getBigUint64(0, true).toString());
      const [mPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), publicKey.toBuffer(), cOff.toArrayLike(Buffer, "le", 8)],
        getProgramId()
      );
      const [vPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), mPda.toBuffer()],
        getProgramId()
      );

      setStatus("Submitting...");

      await program.methods
        .createMarket(
          cOff,
          Array.from(qBytes),
          new BN(ts),
          new BN(initialPoolLamports.toString()),
          isPoly,
          cid
        )
        .accounts({
          creator: publicKey,
          market: mPda,
          vault: vPda,
          ...getCircuitAccounts("init_market_state", cOff),
          createMarketCallbackProgram: new PublicKey(PROGRAM_ID),
          arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID),
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

      setStatus("MPC initializing...");
      await waitForArciumComputation(provider, cOff, "confirmed");
      setStatus("Market is live!");
      setTimeout(() => onCreated({ source: isPoly ? "polymarket" : "custom", question: q }), 800);
    } catch (e) {
      setErr(e.message || "Failed");
    } finally {
      setSub(false);
    }
  };

  const canSubmit = !sub && (tab === "custom" ? question.trim() && endDate : selectedPM !== null);

  return (
    <div
      className="create-market-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="anim-scale create-market-modal"
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--bg-card)",
          border: "1px solid var(--border-hover)",
          borderRadius: 16,
          overflow: "hidden",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15 }}>
            New Market
          </span>
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
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
          >
            <XIcon />
          </button>
        </div>

        <div className="create-market-tabs" style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {[["custom", "Custom"], ["polymarket", "Import from Polymarket"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              style={{
                flex: 1,
                padding: "10px",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${tab === v ? "var(--text)" : "transparent"}`,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: tab === v ? 700 : 500,
                letterSpacing: "0.04em",
                color: tab === v ? "var(--text)" : "var(--text-3)",
                cursor: "pointer",
                transition: "all 150ms",
              }}
            >
              {l}
            </button>
          ))}
        </div>

        <div
          className="create-market-body"
          style={{
            padding: "18px 20px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {tab === "custom" ? (
            <>
              <div>
                <Label ch={question.length} max={280}>
                  QUESTION
                </Label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, 280))}
                  placeholder="Will Bitcoin break $150k before 2026?"
                  rows={3}
                  style={{
                    ...inputSt,
                    resize: "vertical",
                    lineHeight: 1.5,
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                  }}
                  onFocus={onFocus}
                  onBlur={onBlur_}
                />
              </div>
              <div>
                <Label>END DATE & TIME</Label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  style={inputSt}
                  onFocus={onFocus}
                  onBlur={onBlur_}
                />
              </div>
              <div>
                <Label>OPTIONAL CREATOR SEED (SOL)</Label>
                <input
                  type="number"
                  value={sol}
                  onChange={(e) => setSol(e.target.value)}
                  min={0}
                  step="0.01"
                  style={{ ...inputSt, fontSize: 16, fontWeight: 700 }}
                  onFocus={onFocus}
                  onBlur={onBlur_}
                />
                <p style={{ marginTop: 7, fontSize: 11, color: "var(--text-3)", lineHeight: 1.45 }}>
                  Defaults to `0`. Winners split the live pool from bets unless you choose to seed extra SOL here.
                </p>
              </div>
            </>
          ) : (
            <>
              <PolymarketBrowser selected={selectedPM} onSelect={setSelectedPM} />
              {selectedPM && (
                <div>
                  <Label>OPTIONAL CREATOR SEED (SOL)</Label>
                  <input
                    type="number"
                    value={sol}
                    onChange={(e) => setSol(e.target.value)}
                    min={0}
                    step="0.01"
                    style={{ ...inputSt, fontSize: 16, fontWeight: 700 }}
                    onFocus={onFocus}
                    onBlur={onBlur_}
                  />
                  <p style={{ marginTop: 7, fontSize: 11, color: "var(--text-3)", lineHeight: 1.45 }}>
                    Imported markets can start at `0`. Add seed liquidity only if you want to boost the total pool.
                  </p>
                </div>
              )}
            </>
          )}

          {status && (
            <div
              style={{
                padding: "9px 12px",
                background: "var(--green-dim)",
                border: "1px solid var(--green-border)",
                borderRadius: 8,
                fontSize: 11,
                color: "var(--green)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
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
              {status}
            </div>
          )}
          {err && (
            <div
              style={{
                padding: "9px 12px",
                background: "var(--red-dim)",
                border: "1px solid var(--red-border)",
                borderRadius: 8,
                fontSize: 11,
                color: "var(--red)",
              }}
            >
              {err}
            </div>
          )}
        </div>

        <div
          className="create-market-footer"
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 16px",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-2)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? "var(--text)" : "var(--bg-input)",
              border: "none",
              borderRadius: 8,
              padding: "8px 20px",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 700,
              color: canSubmit ? "var(--bg)" : "var(--text-3)",
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "all 150ms",
            }}
          >
            {sub ? "Creating..." : "Create Market"}
          </button>
        </div>
      </div>
    </div>
  );
}
