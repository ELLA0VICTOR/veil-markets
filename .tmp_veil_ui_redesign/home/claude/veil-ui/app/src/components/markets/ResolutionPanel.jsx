import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { PROGRAM_ID, ARCIUM_PROGRAM_ID } from "../../utils/constants";
import { checkPolymarketResolution } from "../../utils/polymarket";
import { decryptMarketResult, generateResolverKeypair } from "../../utils/arcium";
import { useWallet } from "../../hooks/useWallet";
import { getCircuitAccounts, waitForArciumComputation } from "../../utils/arciumAccounts";
import { createVeilProgram } from "../../utils/program";
import AnimatedReveal from "../ui/AnimatedReveal";

function ChainIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 7.5L7.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M5.5 8.5L4.5 9.5C3.5 10.5 1.5 10.5 1.5 8.5L3.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.5 3.5L7.5 2.5C8.5 1.5 10.5 1.5 10.5 3.5L8.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const PHASE_LABELS = {
  idle:       null,
  resolving:  "Queuing MPC resolve computation…",
  decrypting: "MPC cluster decrypting vote totals…",
  publishing: "Publishing result on-chain…",
  done:       "Market settled.",
};

export default function ResolutionPanel({ market, onResolved }) {
  const { connection } = useConnection();
  const wallet         = useAnchorWallet();
  const { publicKey }  = useWallet();

  const [pmStatus,    setPmStatus]    = useState(null);
  const [loadingPM,   setLoadingPM]   = useState(false);
  const [phase,       setPhase]       = useState("idle");
  const [error,       setError]       = useState("");
  const [revealData,  setRevealData]  = useState(null);
  const [showReveal,  setShowReveal]  = useState(false);
  const [customYesWins, setCustom]    = useState(true);

  const isCreator = publicKey && market.creator === publicKey.toBase58();
  const isActive  = phase !== "idle" && phase !== "done";

  useEffect(() => {
    if (!market.isPolymarket || !market.conditionId) return;
    const check = async () => {
      setLoadingPM(true);
      try { setPmStatus(await checkPolymarketResolution(market.conditionId)); }
      catch (err) { setError(`Polymarket: ${err.message}`); }
      finally { setLoadingPM(false); }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [market.conditionId, market.isPolymarket]);

  const handleResolve = async (yesWinsOverride = null) => {
    if (!wallet || !publicKey) { setError("Connect your wallet first"); return; }
    setError(""); setPhase("resolving");

    try {
      const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
      const program  = createVeilProgram(provider);
      const { privateKey: resolverPrivKey, publicKey: resolverPubKey } = generateResolverKeypair();

      const offsetBuf = crypto.getRandomValues(new Uint8Array(8));
      const offsetBig = new DataView(offsetBuf.buffer).getBigUint64(0, true);
      const computationOffset = new BN(offsetBig.toString());

      const marketPubkey    = new PublicKey(market.publicKey);
      const arciumAccounts  = getCircuitAccounts("resolve_market", computationOffset);

      await program.methods
        .resolveMarket(computationOffset, Array.from(resolverPubKey))
        .accounts({ resolver: publicKey, market: marketPubkey, ...arciumAccounts, resolveMarketCallbackProgram: new PublicKey(PROGRAM_ID), arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID), systemProgram: SystemProgram.programId })
        .rpc({ commitment: "confirmed" });

      setPhase("decrypting");
      await waitForArciumComputation(provider, computationOffset, "confirmed");

      const updated   = await program.account.market.fetch(marketPubkey);
      const decrypted = decryptMarketResult(
        resolverPrivKey,
        Array.from(updated.resultEncryptionKey),
        BigInt(updated.resultNonce.toString()),
        [Array.from(updated.resultCtTotalYes), Array.from(updated.resultCtTotalNo), Array.from(updated.resultCtYesWins)]
      );

      const finalYesWins = yesWinsOverride !== null ? yesWinsOverride : decrypted.yesWins;
      setRevealData({ totalYes: decrypted.totalYes, totalNo: decrypted.totalNo, yesWins: finalYesWins });

      setPhase("publishing");
      await program.methods
        .publishResult(finalYesWins, new BN(decrypted.totalYes.toString()), new BN(decrypted.totalNo.toString()))
        .accounts({ authority: publicKey, market: marketPubkey })
        .rpc({ commitment: "confirmed" });

      setPhase("done");
      setShowReveal(true);
    } catch (err) {
      setError(err.message || "Resolution failed");
      setPhase("idle");
    }
  };

  /* Status 2 — waiting for callback */
  if (market.status === 2) {
    return (
      <div style={{ background: "var(--pending-dim)", border: "1px solid var(--pending-border)", borderRadius: 12, padding: "18px 20px", marginTop: 16 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--pending)", letterSpacing: "0.1em", marginBottom: 6 }}>
          MPC CALLBACK PENDING
        </p>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-secondary)" }}>
          The resolve_market computation is in progress. Once the callback fires you can publish the final result.
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 14, overflow: "hidden", marginTop: 16 }}>
        {/* Header */}
        <div style={{ padding: "14px 20px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--pending)", letterSpacing: "0.14em" }}>
            MARKET ENDED · RESOLUTION AVAILABLE
          </p>
        </div>

        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Polymarket oracle */}
          {market.isPolymarket && (
            loadingPM ? (
              <div className="skeleton" style={{ height: 72 }} />
            ) : pmStatus?.resolved ? (
              <div style={{ background: "var(--accent-dim)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: 11, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <ChainIcon />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent-bright)", letterSpacing: "0.1em" }}>POLYMARKET ORACLE RESOLVED</span>
                </div>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, letterSpacing: "-0.01em", color: pmStatus.yesWins ? "var(--yes-color)" : "var(--no-color)" }}>
                  {pmStatus.yesWins ? "YES WON" : "NO WON"}
                </p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Arcium MPC will decrypt VEIL's encrypted vote totals.
                </p>
              </div>
            ) : pmStatus && !pmStatus.resolved ? (
              <div style={{ background: "var(--pending-dim)", border: "1px solid var(--pending-border)", borderRadius: 11, padding: "14px 16px" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--pending)", letterSpacing: "0.1em", marginBottom: 6 }}>WAITING FOR POLYMARKET ORACLE</p>
                {pmStatus.outcomePrices && (() => {
                  try {
                    const prices = JSON.parse(pmStatus.outcomePrices);
                    return <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-secondary)" }}>Market sentiment: YES {(parseFloat(prices[0]) * 100).toFixed(0)}% / NO {(parseFloat(prices[1]) * 100).toFixed(0)}%</p>;
                  } catch { return null; }
                })()}
              </div>
            ) : null
          )}

          {/* Custom market — creator declares winner */}
          {!market.isPolymarket && isCreator && (
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.14em", marginBottom: 10 }}>
                DECLARE WINNER
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[true, false].map((val) => {
                  const sel   = customYesWins === val;
                  const color = val ? "var(--yes-color)" : "var(--no-color)";
                  const dim   = val ? "var(--yes-dim)"   : "var(--no-dim)";
                  const bdr   = val ? "var(--yes-border)" : "var(--no-border)";
                  return (
                    <button key={String(val)} onClick={() => setCustom(val)}
                      style={{ background: sel ? dim : "var(--bg-elevated)", border: `2px solid ${sel ? color : "var(--border-default)"}`, borderRadius: 10, padding: "12px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "0.04em", color: sel ? color : "var(--text-muted)", cursor: "pointer", transition: "all 150ms ease" }}>
                      {val ? "YES" : "NO"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!market.isPolymarket && !isCreator && (
            <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "13px 16px" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-secondary)" }}>
                This is a custom market. The creator must resolve it.
              </p>
            </div>
          )}

          {/* Phase indicator */}
          {phase !== "idle" && (
            <div style={{ padding: "10px 13px", background: phase === "done" ? "var(--success-dim)" : "var(--pending-dim)", border: `1px solid ${phase === "done" ? "rgba(52,211,153,0.25)" : "var(--pending-border)"}`, borderRadius: 9, fontFamily: "var(--font-mono)", fontSize: 11, color: phase === "done" ? "var(--success)" : "var(--pending)", display: "flex", alignItems: "center", gap: 8 }}>
              {isActive && <span style={{ width: 9, height: 9, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />}
              {PHASE_LABELS[phase]}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: "10px 13px", background: "var(--no-dim)", border: "1px solid var(--no-border)", borderRadius: 9, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--no-color)" }}>
              {error}
            </div>
          )}

          {/* Resolve CTA */}
          {(market.isPolymarket ? pmStatus?.resolved : isCreator) && phase !== "done" && (
            <button
              onClick={() => handleResolve(market.isPolymarket ? pmStatus.yesWins : customYesWins)}
              disabled={isActive}
              style={{
                width: "100%",
                background: isActive ? "var(--bg-elevated)" : "linear-gradient(135deg, #FBBF24, #F59E0B)",
                border: "none",
                borderRadius: 11,
                padding: "13px",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "0.04em",
                color: isActive ? "var(--text-muted)" : "#000",
                cursor: isActive ? "not-allowed" : "pointer",
                transition: "all 180ms ease",
                boxShadow: isActive ? "none" : "0 4px 16px rgba(251,191,36,0.2)",
              }}
            >
              {isActive ? "Resolving…" : "REVEAL ENCRYPTED VOTE TOTALS"}
            </button>
          )}
        </div>
      </div>

      <AnimatedReveal
        visible={showReveal}
        onClose={() => { setShowReveal(false); if (onResolved) onResolved(); }}
        totalYes={revealData?.totalYes}
        totalNo={revealData?.totalNo}
        yesWins={revealData?.yesWins}
        isPolymarket={market.isPolymarket}
        question={market.question}
      />
    </>
  );
}
