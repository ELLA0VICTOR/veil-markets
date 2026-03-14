import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { PROGRAM_ID, ARCIUM_PROGRAM_ID } from "../../utils/constants";
import { checkPolymarketResolution } from "../../utils/polymarket";
import { decryptMarketResult, generateResolverKeypair } from "../../utils/arcium";
import { useWallet } from "../../hooks/useWallet";
import {
  getCircuitAccounts,
  waitForArciumComputation,
} from "../../utils/arciumAccounts";
import { createVeilProgram } from "../../utils/program";
import AnimatedReveal from "../ui/AnimatedReveal";

// Chain icon
function ChainIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M5 8L8 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M6 9L5 10C4 11 2 11 2 9L4 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 4L8 3C9 2 11 2 11 4L9 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function ResolutionPanel({ market, onResolved }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();

  const [pmStatus, setPmStatus] = useState(null); // { resolved, yesWins, outcomePrices }
  const [loadingPM, setLoadingPM] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | resolving | decrypting | publishing | done
  const [error, setError] = useState("");
  const [revealData, setRevealData] = useState(null);
  const [showReveal, setShowReveal] = useState(false);

  const isCreator = publicKey && market.creator === publicKey.toBase58();
  const [customYesWins, setCustomYesWins] = useState(true);

  // Fetch Polymarket status
  useEffect(() => {
    if (!market.isPolymarket || !market.conditionId) return;
    const check = async () => {
      setLoadingPM(true);
      try {
        const status = await checkPolymarketResolution(market.conditionId);
        setPmStatus(status);
      } catch (err) {
        setError(`Polymarket check failed: ${err.message}`);
      } finally {
        setLoadingPM(false);
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [market.conditionId, market.isPolymarket]);

  const handleResolve = async (yesWinsOverride = null) => {
    if (!wallet || !publicKey) { setError("Connect your wallet first"); return; }

    setError("");
    setPhase("resolving");

    try {
      const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
      const program = createVeilProgram(provider);

      // Generate resolver keypair
      const { privateKey: resolverPrivKey, publicKey: resolverPubKey } = generateResolverKeypair();

      const offsetBuf = crypto.getRandomValues(new Uint8Array(8));
      const view = new DataView(offsetBuf.buffer);
      const offsetBig = view.getBigUint64(0, true);
      const computationOffset = new BN(offsetBig.toString());

      const marketPubkey = new PublicKey(market.publicKey);
      const arciumAccounts = getCircuitAccounts("resolve_market", computationOffset);

      await program.methods
        .resolveMarket(computationOffset, Array.from(resolverPubKey))
        .accounts({
          resolver: publicKey,
          market: marketPubkey,
          ...arciumAccounts,
          resolveMarketCallbackProgram: new PublicKey(PROGRAM_ID),
          arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID),
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

      setPhase("decrypting");

      // Await MPC finalization
      await waitForArciumComputation(provider, computationOffset, "confirmed");

      // Read updated market account
      const updated = await program.account.market.fetch(marketPubkey);

      // Decrypt
      const decrypted = decryptMarketResult(
        resolverPrivKey,
        Array.from(updated.resultEncryptionKey),
        BigInt(updated.resultNonce.toString()),
        [
          Array.from(updated.resultCtTotalYes),
          Array.from(updated.resultCtTotalNo),
          Array.from(updated.resultCtYesWins),
        ]
      );

      // Authoritative winner: Polymarket oracle for PM markets, circuit for custom
      const finalYesWins = yesWinsOverride !== null ? yesWinsOverride : decrypted.yesWins;

      setRevealData({
        totalYes: decrypted.totalYes,
        totalNo: decrypted.totalNo,
        yesWins: finalYesWins,
      });

      setPhase("publishing");

      // Publish result
      await program.methods
        .publishResult(
          finalYesWins,
          new BN(decrypted.totalYes.toString()),
          new BN(decrypted.totalNo.toString())
        )
        .accounts({
          authority: publicKey,
          market: marketPubkey,
        })
        .rpc({ commitment: "confirmed" });

      setPhase("done");
      setShowReveal(true);
    } catch (err) {
      setError(err.message || "Resolution failed");
      setPhase("idle");
    }
  };

  const phaseLabels = {
    idle: null,
    resolving: "Queuing MPC resolve computation...",
    decrypting: "MPC cluster decrypting vote totals...",
    publishing: "Publishing result on-chain...",
    done: "Market settled!",
  };

  const isActive = phase !== "idle" && phase !== "done";

  // If market is already at status 2 (resolving), show different UI
  if (market.status === 2) {
    return (
      <div style={{ background: "var(--pending-dim)", border: "1px solid rgba(255,176,23,0.2)", borderRadius: 12, padding: "20px", marginTop: 20 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--pending)", letterSpacing: "0.1em", marginBottom: 6 }}>MPC CALLBACK PENDING</p>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-secondary)" }}>
          The resolve_market MPC computation is in progress. Once the callback fires, you can publish the final result.
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "20px", marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--pending)", letterSpacing: "0.1em" }}>
            MARKET ENDED — RESOLUTION AVAILABLE
          </p>
        </div>

        {/* Polymarket oracle section */}
        {market.isPolymarket && (
          <div style={{ marginBottom: 16 }}>
            {loadingPM ? (
              <div className="skeleton" style={{ height: 60 }} />
            ) : pmStatus ? (
              pmStatus.resolved ? (
                <div style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <ChainIcon />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.1em" }}>POLYMARKET ORACLE RESOLVED</span>
                  </div>
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: pmStatus.yesWins ? "var(--yes-color)" : "var(--no-color)" }}>
                    {pmStatus.yesWins ? "YES WON" : "NO WON"}
                  </p>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    Arcium MPC will decrypt VEIL's hidden vote totals to reveal how much SOL was bet on each side.
                  </p>
                </div>
              ) : (
                <div style={{ background: "var(--pending-dim)", border: "1px solid rgba(255,176,23,0.2)", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--pending)", letterSpacing: "0.1em", marginBottom: 6 }}>
                    WAITING FOR POLYMARKET ORACLE
                  </p>
                  {pmStatus.outcomePrices && (() => {
                    try {
                      const prices = JSON.parse(pmStatus.outcomePrices);
                      return (
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-secondary)" }}>
                          Current market sentiment: YES {(parseFloat(prices[0]) * 100).toFixed(0)}% / NO {(parseFloat(prices[1]) * 100).toFixed(0)}%
                        </p>
                      );
                    } catch { return null; }
                  })()}
                </div>
              )
            ) : null}
          </div>
        )}

        {/* Custom market resolution */}
        {!market.isPolymarket && (
          <div style={{ marginBottom: 16 }}>
            {isCreator ? (
              <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 10 }}>
                  AS CREATOR, DECLARE WINNER
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {[true, false].map((val) => (
                    <button
                      key={String(val)}
                      onClick={() => setCustomYesWins(val)}
                      style={{
                        background: customYesWins === val ? (val ? "var(--yes-dim)" : "var(--no-dim)") : "var(--bg-surface)",
                        border: `2px solid ${customYesWins === val ? (val ? "var(--yes-color)" : "var(--no-color)") : "var(--border-default)"}`,
                        borderRadius: 8, padding: "10px",
                        fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16,
                        color: customYesWins === val ? (val ? "var(--yes-color)" : "var(--no-color)") : "var(--text-muted)",
                        cursor: "pointer", transition: "all 150ms ease",
                      }}
                    >
                      {val ? "YES" : "NO"}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-secondary)" }}>
                  This is a custom market. The creator must resolve it.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phase status */}
        {phase !== "idle" && (
          <div style={{
            padding: "10px 14px", marginBottom: 12,
            background: phase === "done" ? "var(--accent-dim)" : "var(--pending-dim)",
            border: `1px solid ${phase === "done" ? "rgba(163,255,18,0.2)" : "rgba(255,176,23,0.2)"}`,
            borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12,
            color: phase === "done" ? "var(--accent)" : "var(--pending)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {isActive && <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }} />}
            {phaseLabels[phase]}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: "10px 14px", marginBottom: 12, background: "rgba(255,61,61,0.08)", border: "1px solid rgba(255,61,61,0.2)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no-color)" }}>
            {error}
          </div>
        )}

        {/* Resolve button */}
        {(market.isPolymarket ? pmStatus?.resolved : isCreator) && phase !== "done" && (
          <button
            onClick={() => {
              const yesWinsOverride = market.isPolymarket ? pmStatus.yesWins : customYesWins;
              handleResolve(yesWinsOverride);
            }}
            disabled={isActive}
            style={{
              width: "100%", background: isActive ? "var(--bg-elevated)" : "var(--pending)",
              border: "none", borderRadius: 10, padding: "13px",
              fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15,
              color: isActive ? "var(--text-muted)" : "#070707",
              cursor: isActive ? "not-allowed" : "pointer",
              transition: "all 150ms ease", letterSpacing: "0.05em",
            }}
          >
            {isActive ? "Resolving..." : "REVEAL VEIL VOTE TOTALS"}
          </button>
        )}
      </div>

      {/* Animated reveal overlay */}
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
