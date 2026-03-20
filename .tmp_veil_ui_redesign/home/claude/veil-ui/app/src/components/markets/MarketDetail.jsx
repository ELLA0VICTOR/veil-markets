import { Suspense, lazy, useState, useEffect, useCallback } from "react";
import { Buffer } from "buffer";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { navigate } from "../../utils/navigation";
import { PROGRAM_ID } from "../../utils/constants";
import { decodeQuestion, lamportsToSol } from "../../utils/solana";
import { bytesToConditionId, isZeroConditionId, fetchPolymarketMarket } from "../../utils/polymarket";
import { useWallet } from "../../hooks/useWallet";
import { createReadonlyProvider, createVeilProgram } from "../../utils/program";
import StatusBadge from "../ui/StatusBadge";
import CountdownTimer from "../ui/CountdownTimer";
import OracleTag from "../ui/OracleTag";

const PlaceBetModal  = lazy(() => import("./PlaceBetModal"));
const ResolutionPanel = lazy(() => import("./ResolutionPanel"));

function ArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-default)",
      borderRadius: 12,
      padding: "14px 16px",
    }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 6 }}>
        {label}
      </p>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 17, color: accent || "var(--text-primary)", fontWeight: 500, letterSpacing: "-0.01em" }}>
        {value}
      </div>
    </div>
  );
}

export default function MarketDetail({ marketPubkey }) {
  const { connection }  = useConnection();
  const wallet          = useAnchorWallet();
  const { publicKey }   = useWallet();

  const [market, setMarket]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [showBet, setShowBet]   = useState(false);
  const [position, setPosition] = useState(null);

  const fetchMarket = useCallback(async () => {
    try {
      setError(null);
      const provider = wallet
        ? new AnchorProvider(connection, wallet, { commitment: "confirmed" })
        : createReadonlyProvider(connection);

      const program  = createVeilProgram(provider);
      const pubkey   = new PublicKey(marketPubkey);
      const account  = await program.account.market.fetch(pubkey);

      const conditionIdBytes = account.polymarketConditionId;
      const isPolymarket     = account.isPolymarket;
      let   polymarketData   = null;

      if (isPolymarket && !isZeroConditionId(conditionIdBytes)) {
        try { polymarketData = await fetchPolymarketMarket(bytesToConditionId(conditionIdBytes)); }
        catch { /* silent */ }
      }

      setMarket({
        publicKey: pubkey.toBase58(),
        creator: account.creator.toBase58(),
        question: polymarketData?.question || decodeQuestion(account.question),
        endTime:  new Date(account.endTime.toNumber() * 1000),
        status:   account.status,
        isPolymarket,
        conditionId: isPolymarket ? bytesToConditionId(conditionIdBytes) : null,
        totalSolPool: lamportsToSol(account.totalSolPool),
        totalSolPoolLamports: account.totalSolPool.toNumber(),
        voteCount: account.voteCount,
        yesWins:   account.yesWins,
        resultPublished: account.resultPublished,
        plaintextTotalYes: account.plaintextTotalYes?.toNumber(),
        plaintextTotalNo:  account.plaintextTotalNo?.toNumber(),
        stateNonce: account.stateNonce,
        stateCtYes: account.stateCtYes,
        stateCtNo:  account.stateCtNo,
        resultEncryptionKey: account.resultEncryptionKey,
        resultNonce:         account.resultNonce,
        resultCtTotalYes:    account.resultCtTotalYes,
        resultCtTotalNo:     account.resultCtTotalNo,
        resultCtYesWins:     account.resultCtYesWins,
        polymarketPrices:    polymarketData?.outcomePrices || null,
        polymarketCategory:  polymarketData?.category || null,
      });

      if (publicKey) {
        try {
          const [positionPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("position"), pubkey.toBuffer(), publicKey.toBuffer()],
            new PublicKey(PROGRAM_ID)
          );
          const pos = await program.account.position.fetch(positionPda);
          setPosition({ stake: lamportsToSol(pos.stake), stakeLamports: pos.stake.toNumber(), isYes: pos.isYes, hasClaimed: pos.hasClaimed, pubkey: positionPda.toBase58() });
        } catch { setPosition(null); }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, marketPubkey, publicKey]);

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  const isPastEnd = market && new Date() >= market.endTime;
  const canBet    = market?.status === 1 && !isPastEnd && !position;

  /* ── Loading ───────────────────────────────────────────────── */
  if (loading) return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 28px" }}>
      <div className="skeleton" style={{ height: 20, width: "25%", marginBottom: 36 }} />
      <div className="skeleton" style={{ height: 36, width: "88%", marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 36, width: "72%", marginBottom: 32 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}
      </div>
    </div>
  );

  /* ── Error ─────────────────────────────────────────────────── */
  if (error) return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 28px" }}>
      <div style={{ background: "var(--no-dim)", border: "1px solid var(--no-border)", borderRadius: 12, padding: 20 }}>
        <p style={{ color: "var(--no-color)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Error: {error}</p>
      </div>
    </div>
  );

  if (!market) return null;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 28px 64px", animation: "fadeUp 500ms cubic-bezier(0.16,1,0.3,1) both" }}>

      {/* Back */}
      <button
        onClick={() => navigate("#/")}
        style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontFamily: "var(--font-body)", fontSize: 13, marginBottom: 32, padding: 0, transition: "color 150ms" }}
        onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
        onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
      >
        <ArrowLeft /> All Markets
      </button>

      {/* Header card */}
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 16,
        padding: "28px",
        marginBottom: 16,
      }}>
        {/* Badges */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <StatusBadge status={market.status} />
          <OracleTag isPolymarket={market.isPolymarket} />
          {market.polymarketCategory && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "3px 7px", letterSpacing: "0.08em" }}>
              {market.polymarketCategory}
            </span>
          )}
        </div>

        {/* Question */}
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px, 3vw, 26px)", letterSpacing: "-0.02em", lineHeight: 1.3, marginBottom: 24, color: "var(--text-primary)" }}>
          {market.question}
        </h1>

        {/* Stat boxes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <StatBox label="PRIZE POOL" value={`${market.totalSolPool} SOL`} accent="var(--accent-bright)" />
          <StatBox label="TOTAL BETS" value={String(market.voteCount)} />
          <StatBox label={isPastEnd ? "ENDED" : "CLOSES"} value={<CountdownTimer endTime={market.endTime} />} />
        </div>
      </div>

      {/* Polymarket sentiment */}
      {market.isPolymarket && market.polymarketPrices && market.status === 1 && (() => {
        try {
          const prices = JSON.parse(market.polymarketPrices);
          const yesPct = (parseFloat(prices[0]) * 100).toFixed(0);
          const noPct  = (parseFloat(prices[1]) * 100).toFixed(0);
          return (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 10 }}>
                POLYMARKET LIVE SENTIMENT
              </p>
              <div style={{ display: "flex", gap: 4, height: 6, borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ width: `${yesPct}%`, background: "var(--yes-color)", borderRadius: 99, transition: "width 1s ease" }} />
                <div style={{ flex: 1, background: "var(--no-color)", borderRadius: 99 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--yes-color)" }}>YES {yesPct}%</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no-color)" }}>NO {noPct}%</span>
              </div>
            </div>
          );
        } catch { return null; }
      })()}

      {/* My position */}
      {position && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 10 }}>MY POSITION</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 18,
                color: position.isYes ? "var(--yes-color)" : "var(--no-color)",
              }}>
                {position.isYes ? "YES" : "NO"}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-primary)" }}>
                {position.stake} SOL
              </span>
              {position.hasClaimed && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--success)", background: "var(--success-dim)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 4, padding: "2px 7px", letterSpacing: "0.08em" }}>
                  CLAIMED
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Place bet CTA */}
      {canBet && !showBet && (
        <button
          onClick={() => setShowBet(true)}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #818CF8, #6366F1)",
            border: "none",
            borderRadius: 12,
            padding: "15px",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.04em",
            color: "#fff",
            cursor: "pointer",
            transition: "all 180ms ease",
            marginBottom: 16,
            boxShadow: "0 4px 20px rgba(129, 140, 248, 0.28)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(129, 140, 248, 0.4)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(129, 140, 248, 0.28)"; }}
        >
          PLACE ENCRYPTED BET
        </button>
      )}

      {/* Bet modal */}
      {showBet && (
        <Suspense fallback={null}>
          <PlaceBetModal market={market} onClose={() => setShowBet(false)} onSuccess={() => { setShowBet(false); fetchMarket(); }} />
        </Suspense>
      )}

      {/* Resolution panel */}
      {isPastEnd && market.status < 3 && (
        <Suspense fallback={null}>
          <ResolutionPanel market={market} onResolved={fetchMarket} />
        </Suspense>
      )}

      {/* Settled result */}
      {market.status === 3 && market.resultPublished && (
        <div style={{
          background: market.yesWins ? "var(--yes-dim)" : "var(--no-dim)",
          border: `1px solid ${market.yesWins ? "var(--yes-border)" : "var(--no-border)"}`,
          borderRadius: 14,
          padding: "28px 24px",
          textAlign: "center",
          marginTop: 16,
        }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 32, letterSpacing: "-0.01em", color: market.yesWins ? "var(--yes-color)" : "var(--no-color)", marginBottom: 12 }}>
            {market.yesWins ? "YES WON" : "NO WON"}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--yes-color)" }}>
              YES: {lamportsToSol(market.plaintextTotalYes)} SOL
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--no-color)" }}>
              NO: {lamportsToSol(market.plaintextTotalNo)} SOL
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
