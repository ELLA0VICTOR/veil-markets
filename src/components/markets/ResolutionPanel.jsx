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

const PHASES = {
  idle:       null,
  resolving:  "Queuing MPC resolve computationâ€¦",
  decrypting: "MPC cluster decrypting vote totalsâ€¦",
  publishing: "Publishing result on-chainâ€¦",
  done:       "Market settled.",
};

export default function ResolutionPanel({ market, onResolved }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const [pmStatus, setPmStatus] = useState(null);
  const [loadingPM, setLoadingPM] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [err, setErr] = useState("");
  const [revealData, setRevealData] = useState(null);
  const [showReveal, setShowReveal] = useState(false);
  const [customWins, setCustom] = useState(true);

  const isCreator = publicKey && market.creator === publicKey.toBase58();
  const isActive  = phase !== "idle" && phase !== "done";

  useEffect(() => {
    if (!market.isPolymarket || !market.conditionId) return;
    const check = async () => {
      setLoadingPM(true);
      try { setPmStatus(await checkPolymarketResolution(market.conditionId)); }
      catch (e) { setErr(e.message); }
      finally { setLoadingPM(false); }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [market.conditionId, market.isPolymarket]);

  const handleResolve = async (override = null) => {
    if (!wallet || !publicKey) { setErr("Connect wallet first"); return; }
    setErr(""); setPhase("resolving");
    try {
      const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
      const program  = createVeilProgram(provider);
      const { privateKey: privKey, publicKey: pubKey } = generateResolverKeypair();
      const off  = crypto.getRandomValues(new Uint8Array(8));
      const cOff = new BN(new DataView(off.buffer).getBigUint64(0,true).toString());
      const mPK  = new PublicKey(market.publicKey);
      await program.methods.resolveMarket(cOff, Array.from(pubKey))
        .accounts({ resolver: publicKey, market: mPK, ...getCircuitAccounts("resolve_market", cOff), resolveMarketCallbackProgram: new PublicKey(PROGRAM_ID), arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID), systemProgram: SystemProgram.programId })
        .rpc({ commitment: "confirmed" });
      setPhase("decrypting");
      await waitForArciumComputation(provider, cOff, "confirmed");
      const upd = await program.account.market.fetch(mPK);
      const dec = await decryptMarketResult(
        privKey,
        Array.from(upd.resultEncryptionKey),
        BigInt(upd.resultNonce.toString()),
        [
          Array.from(upd.resultCtTotalYes),
          Array.from(upd.resultCtTotalNo),
          Array.from(upd.resultCtYesWins),
        ]
      );
      const yesWins = override !== null ? override : dec.yesWins;
      setRevealData({ totalYes: dec.totalYes, totalNo: dec.totalNo, yesWins });
      setPhase("publishing");
      await program.methods.publishResult(yesWins, new BN(dec.totalYes.toString()), new BN(dec.totalNo.toString()))
        .accounts({ authority: publicKey, market: mPK }).rpc({ commitment: "confirmed" });
      setPhase("done");
      setShowReveal(true);
    } catch (e) { setErr(e.message || "Resolution failed"); setPhase("idle"); }
  };

  if (market.status === 2) return (
    <div style={{ background: "var(--amber-dim)", border: "1px solid var(--amber-border)", borderRadius: 12, padding: "16px 18px", marginTop: 12 }}>
      <p style={{ fontSize: 9, color: "var(--amber)", letterSpacing: "0.12em", marginBottom: 6 }}>MPC CALLBACK PENDING</p>
      <p style={{ fontSize: 13, color: "var(--text-2)" }}>Resolve computation in progress. Once callback fires you can publish the result.</p>
    </div>
  );

  return (
    <>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginTop: 12 }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-input)" }}>
          <p style={{ fontSize: 9, color: "var(--amber)", letterSpacing: "0.12em" }}>MARKET ENDED Â· RESOLUTION AVAILABLE</p>
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Polymarket oracle */}
          {market.isPolymarket && (
            loadingPM ? <div className="skeleton" style={{ height: 64 }} /> :
            pmStatus?.resolved ? (
              <div style={{ background: "var(--cyan-dim)", border: "1px solid var(--cyan-border)", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontSize: 9, color: "var(--cyan)", letterSpacing: "0.12em", marginBottom: 7 }}>POLYMARKET ORACLE RESOLVED</p>
                <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 20, color: pmStatus.yesWins ? "var(--cyan)" : "var(--red)" }}>
                  {pmStatus.yesWins ? "YES WON" : "NO WON"}
                </p>
                <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Arcium MPC will decrypt VEIL's encrypted vote totals.</p>
              </div>
            ) : pmStatus ? (
              <div style={{ background: "var(--amber-dim)", border: "1px solid var(--amber-border)", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontSize: 9, color: "var(--amber)", letterSpacing: "0.12em", marginBottom: 5 }}>WAITING FOR POLYMARKET ORACLE</p>
                {pmStatus.outcomePrices && (() => { try { const p = JSON.parse(pmStatus.outcomePrices); return <p style={{ fontSize: 12, color: "var(--text-2)" }}>YES {(parseFloat(p[0])*100).toFixed(0)}% / NO {(parseFloat(p[1])*100).toFixed(0)}%</p>; } catch { return null; } })()}
              </div>
            ) : null
          )}

          {/* Custom */}
          {!market.isPolymarket && isCreator && (
            <div>
              <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 9 }}>DECLARE WINNER</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {[true, false].map((v) => {
                  const sel = customWins === v;
                  return (
                    <button key={String(v)} onClick={() => setCustom(v)} style={{
                      background: sel ? "var(--text)" : "var(--bg-input)",
                      border: `1px solid ${sel ? "var(--text)" : "var(--border)"}`,
                      borderRadius: 9, padding: "11px", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 18,
                      letterSpacing: "0.05em", color: sel ? "var(--bg)" : "var(--text-3)", cursor: "pointer", transition: "all 150ms",
                    }}>{v ? "YES" : "NO"}</button>
                  );
                })}
              </div>
            </div>
          )}

          {!market.isPolymarket && !isCreator && (
            <div style={{ background: "var(--bg-input)", borderRadius: 9, padding: "12px 14px" }}>
              <p style={{ fontSize: 13, color: "var(--text-2)" }}>Custom market â€” creator must resolve this.</p>
            </div>
          )}

          {/* Phase */}
          {phase !== "idle" && (
            <div style={{ padding: "9px 12px", background: phase==="done" ? "var(--green-dim)" : "var(--amber-dim)", border: `1px solid ${phase==="done" ? "var(--green-border)" : "var(--amber-border)"}`, borderRadius: 8, fontSize: 11, color: phase==="done" ? "var(--green)" : "var(--amber)", display: "flex", alignItems: "center", gap: 8 }}>
              {isActive && <span style={{ width: 9, height: 9, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />}
              {PHASES[phase]}
            </div>
          )}

          {err && <div style={{ padding: "9px 12px", background: "var(--red-dim)", border: "1px solid var(--red-border)", borderRadius: 8, fontSize: 11, color: "var(--red)" }}>{err}</div>}

          {/* CTA */}
          {(market.isPolymarket ? pmStatus?.resolved : isCreator) && phase !== "done" && (
            <button
              onClick={() => handleResolve(market.isPolymarket ? pmStatus.yesWins : customWins)}
              disabled={isActive}
              style={{ width: "100%", background: isActive ? "var(--bg-input)" : "var(--text)", border: "none", borderRadius: 10, padding: "12px", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 13, letterSpacing: "0.07em", color: isActive ? "var(--text-3)" : "var(--bg)", cursor: isActive ? "not-allowed" : "pointer", transition: "all 150ms" }}
            >
              {isActive ? "RESOLVINGâ€¦" : "REVEAL ENCRYPTED VOTE TOTALS"}
            </button>
          )}
        </div>
      </div>

      <AnimatedReveal visible={showReveal} onClose={() => { setShowReveal(false); if (onResolved) onResolved(); }}
        totalYes={revealData?.totalYes} totalNo={revealData?.totalNo} yesWins={revealData?.yesWins}
        isPolymarket={market.isPolymarket} question={market.question}
      />
    </>
  );
}
