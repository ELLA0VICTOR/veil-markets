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
import { archiveMarket, isMarketArchived } from "../../utils/archivedMarkets";
import { useWallet } from "../../hooks/useWallet";
import { createReadonlyProvider, createVeilProgram } from "../../utils/program";
import StatusBadge from "../ui/StatusBadge";
import CountdownTimer from "../ui/CountdownTimer";
import OracleTag from "../ui/OracleTag";

const PlaceBetModal  = lazy(() => import("./PlaceBetModal"));
const ResolutionPanel = lazy(() => import("./ResolutionPanel"));

function ArrowLeft() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 3L4.5 7.5l5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 5 }}>{label}</p>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: accent || "var(--text)", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function MarketDetail({ marketPubkey }) {
  const { connection } = useConnection();
  const wallet         = useAnchorWallet();
  const { publicKey }  = useWallet();
  const [market, setMarket]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [showBet, setShowBet]   = useState(false);
  const [position, setPosition] = useState(null);
  const [archived, setArchived] = useState(false);

  const fetchMarket = useCallback(async () => {
    try {
      setError(null);
      const provider = wallet ? new AnchorProvider(connection, wallet, { commitment: "confirmed" }) : createReadonlyProvider(connection);
      const program  = createVeilProgram(provider);
      const pubkey   = new PublicKey(marketPubkey);
      const acct     = await program.account.market.fetch(pubkey);

      const cidBytes = acct.polymarketConditionId;
      const isPoly   = acct.isPolymarket;
      let   pmData   = null;
      if (isPoly && !isZeroConditionId(cidBytes)) {
        try { pmData = await fetchPolymarketMarket(bytesToConditionId(cidBytes)); } catch {}
      }
      setMarket({
        publicKey: pubkey.toBase58(), creator: acct.creator.toBase58(),
        question: pmData?.question || decodeQuestion(acct.question),
        endTime: new Date(acct.endTime.toNumber() * 1000),
        status: acct.status, isPolymarket: isPoly,
        conditionId: isPoly ? bytesToConditionId(cidBytes) : null,
        totalSolPool: lamportsToSol(acct.totalSolPool),
        totalSolPoolLamports: acct.totalSolPool.toNumber(),
        voteCount: acct.voteCount, yesWins: acct.yesWins,
        resultPublished: acct.resultPublished,
        plaintextTotalYes: acct.plaintextTotalYes?.toNumber(),
        plaintextTotalNo: acct.plaintextTotalNo?.toNumber(),
        stateNonce: acct.stateNonce, stateCtYes: acct.stateCtYes, stateCtNo: acct.stateCtNo,
        resultEncryptionKey: acct.resultEncryptionKey, resultNonce: acct.resultNonce,
        resultCtTotalYes: acct.resultCtTotalYes, resultCtTotalNo: acct.resultCtTotalNo, resultCtYesWins: acct.resultCtYesWins,
        polymarketPrices: pmData?.outcomePrices || null, polymarketCategory: pmData?.category || null,
      });
      if (publicKey) {
        try {
          const [pPda] = PublicKey.findProgramAddressSync([Buffer.from("position"), pubkey.toBuffer(), publicKey.toBuffer()], new PublicKey(PROGRAM_ID));
          const pos = await program.account.position.fetch(pPda);
          setPosition({ stake: lamportsToSol(pos.stake), isYes: pos.isYes, hasClaimed: pos.hasClaimed });
        } catch { setPosition(null); }
      }
      setArchived(isMarketArchived(pubkey.toBase58()));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [connection, wallet, marketPubkey, publicKey]);

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  const pastEnd = market && new Date() >= market.endTime;
  const canBet  = market?.status === 1 && !pastEnd && !position;
  const canArchive = market && publicKey && market.creator === publicKey.toBase58();

  const handleArchive = () => {
    if (!market) return;
    archiveMarket(market.publicKey);
    setArchived(true);
    navigate("#/");
  };

  if (loading) return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "40px 24px" }}>
      <div className="skeleton" style={{ height: 18, width: "20%", marginBottom: 32 }} />
      <div className="skeleton" style={{ height: 32, width: "88%", marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 32, width: "72%", marginBottom: 28 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 66 }} />)}
      </div>
    </div>
  );

  if (error) return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ background: "var(--red-dim)", border: "1px solid var(--red-border)", borderRadius: 10, padding: "14px 16px", color: "var(--red)", fontSize: 12 }}>
        {error}
      </div>
    </div>
  );

  if (!market) return null;

  return (
    <div className="anim-up" style={{ maxWidth: 780, margin: "0 auto", padding: "36px 24px 64px" }}>

      {/* Back */}
      <button
        onClick={() => navigate("#/")}
        style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, color: "var(--text-3)", fontSize: 12, marginBottom: 28, padding: 0, fontFamily: "var(--font-mono)", transition: "color 150ms" }}
        onMouseEnter={(e) => e.currentTarget.style.color = "var(--text)"}
        onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-3)"}
      >
        <ArrowLeft /> Back to Markets
      </button>

      {/* Header card */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
          <StatusBadge status={market.status} />
          <OracleTag isPolymarket={market.isPolymarket} />
          {market.polymarketCategory && (
            <span className="pill" style={{ background: "transparent", color: "var(--text-3)", border: "1px solid var(--border)", fontSize: 9 }}>
              {market.polymarketCategory}
            </span>
          )}
        </div>
        <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "clamp(17px, 3vw, 24px)", lineHeight: 1.35, letterSpacing: "-0.01em", marginBottom: 22 }}>
          {market.question}
        </h1>
        {canArchive && !archived && (
          <div style={{ marginBottom: 18 }}>
            <button
              onClick={handleArchive}
              style={{
                background: "var(--red-dim)",
                color: "var(--red)",
                border: "1px solid var(--red-border)",
                borderRadius: 9,
                padding: "9px 14px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
                cursor: "pointer",
              }}
            >
              ARCHIVE MARKET
            </button>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <Stat label="PRIZE POOL" value={`${market.totalSolPool} SOL`} accent="var(--text)" />
          <Stat label="BETS" value={String(market.voteCount)} />
          <Stat label={pastEnd ? "ENDED" : "CLOSES"} value={<CountdownTimer endTime={market.endTime} />} />
        </div>
      </div>

      {/* Polymarket sentiment bar */}
      {market.isPolymarket && market.polymarketPrices && market.status === 1 && (() => {
        try {
          const p = JSON.parse(market.polymarketPrices);
          const y = (parseFloat(p[0]) * 100).toFixed(0);
          const n = (parseFloat(p[1]) * 100).toFixed(0);
          return (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", marginBottom: 12 }}>
              <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 10 }}>POLYMARKET LIVE SENTIMENT</p>
              <div style={{ display: "flex", gap: 3, height: 5, borderRadius: 99, overflow: "hidden", marginBottom: 9 }}>
                <div style={{ width: `${y}%`, background: "var(--cyan)", borderRadius: 99, transition: "width 1s ease" }} />
                <div style={{ flex: 1, background: "var(--red-dim)", borderRadius: 99 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--cyan)" }}>YES {y}%</span>
                <span style={{ fontSize: 12, color: "var(--red)" }}>NO {n}%</span>
              </div>
            </div>
          );
        } catch { return null; }
      })()}

      {/* My position */}
      {position && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", marginBottom: 12 }}>
          <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 9 }}>MY POSITION</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 16, color: position.isYes ? "var(--cyan)" : "var(--red)" }}>
              {position.isYes ? "YES" : "NO"}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{position.stake} SOL</span>
            {position.hasClaimed && (
              <span className="pill" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green-border)", fontSize: 9 }}>CLAIMED</span>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      {canBet && !showBet && (
        <button
          onClick={() => setShowBet(true)}
          style={{ width: "100%", background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 11, padding: "14px", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", cursor: "pointer", transition: "opacity 150ms", marginBottom: 12 }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
        >
          PLACE ENCRYPTED BET
        </button>
      )}

      {showBet && (
        <Suspense fallback={null}>
          <PlaceBetModal market={market} onClose={() => setShowBet(false)} onSuccess={() => { setShowBet(false); fetchMarket(); }} />
        </Suspense>
      )}

      {pastEnd && market.status < 3 && (
        <Suspense fallback={null}>
          <ResolutionPanel market={market} onResolved={fetchMarket} />
        </Suspense>
      )}

      {/* Settled */}
      {market.status === 3 && market.resultPublished && (
        <div style={{ background: market.yesWins ? "var(--cyan-dim)" : "var(--red-dim)", border: `1px solid ${market.yesWins ? "var(--cyan-border)" : "var(--red-border)"}`, borderRadius: 12, padding: "24px", textAlign: "center", marginTop: 12 }}>
          <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 28, letterSpacing: "-0.01em", color: market.yesWins ? "var(--cyan)" : "var(--red)", marginBottom: 10 }}>
            {market.yesWins ? "YES WON" : "NO WON"}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
            <span style={{ fontSize: 12, color: "var(--cyan)" }}>YES: {lamportsToSol(market.plaintextTotalYes)} SOL</span>
            <span style={{ fontSize: 12, color: "var(--red)" }}>NO: {lamportsToSol(market.plaintextTotalNo)} SOL</span>
          </div>
        </div>
      )}
    </div>
  );
}
