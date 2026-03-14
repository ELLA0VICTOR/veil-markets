import { useState, useEffect, useCallback } from "react";
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
import PlaceBetModal from "./PlaceBetModal";
import ResolutionPanel from "./ResolutionPanel";

// Arrow left icon
function ArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function MarketDetail({ marketPubkey }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();

  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBet, setShowBet] = useState(false);
  const [position, setPosition] = useState(null);

  const fetchMarket = useCallback(async () => {
    try {
      setError(null);
      const provider = wallet
        ? new AnchorProvider(connection, wallet, { commitment: "confirmed" })
        : createReadonlyProvider(connection);

      const program = createVeilProgram(provider);
      const pubkey = new PublicKey(marketPubkey);
      const account = await program.account.market.fetch(pubkey);

      const conditionIdBytes = account.polymarketConditionId;
      const isPolymarket = account.isPolymarket;
      let polymarketData = null;

      if (isPolymarket && !isZeroConditionId(conditionIdBytes)) {
        try {
          polymarketData = await fetchPolymarketMarket(bytesToConditionId(conditionIdBytes));
        } catch { /* silent */ }
      }

      const marketData = {
        publicKey: pubkey.toBase58(),
        creator: account.creator.toBase58(),
        question: polymarketData?.question || decodeQuestion(account.question),
        endTime: new Date(account.endTime.toNumber() * 1000),
        status: account.status,
        isPolymarket,
        conditionId: isPolymarket ? bytesToConditionId(conditionIdBytes) : null,
        totalSolPool: lamportsToSol(account.totalSolPool),
        totalSolPoolLamports: account.totalSolPool.toNumber(),
        voteCount: account.voteCount,
        yesWins: account.yesWins,
        resultPublished: account.resultPublished,
        plaintextTotalYes: account.plaintextTotalYes?.toNumber(),
        plaintextTotalNo: account.plaintextTotalNo?.toNumber(),
        stateNonce: account.stateNonce,
        stateCtYes: account.stateCtYes,
        stateCtNo: account.stateCtNo,
        resultEncryptionKey: account.resultEncryptionKey,
        resultNonce: account.resultNonce,
        resultCtTotalYes: account.resultCtTotalYes,
        resultCtTotalNo: account.resultCtTotalNo,
        resultCtYesWins: account.resultCtYesWins,
        polymarketPrices: polymarketData?.outcomePrices || null,
        polymarketVolume: polymarketData?.volume || null,
        polymarketCategory: polymarketData?.category || null,
      };
      setMarket(marketData);

      // Fetch user position if wallet connected
      if (publicKey) {
        try {
          const [positionPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("position"), pubkey.toBuffer(), publicKey.toBuffer()],
            new PublicKey(PROGRAM_ID)
          );
          const pos = await program.account.position.fetch(positionPda);
          setPosition({
            stake: lamportsToSol(pos.stake),
            stakeLamports: pos.stake.toNumber(),
            isYes: pos.isYes,
            hasClaimed: pos.hasClaimed,
            pubkey: positionPda.toBase58(),
          });
        } catch { setPosition(null); }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, marketPubkey, publicKey]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  const isPastEnd = market && new Date() >= market.endTime;
  const canBet = market?.status === 1 && !isPastEnd && !position;
  const canClaim = market?.status === 3 && market?.resultPublished && position && !position.hasClaimed && position.isYes === market?.yesWins;

  if (loading) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
        <div className="skeleton" style={{ height: 28, width: "40%", marginBottom: 32 }} />
        <div className="skeleton" style={{ height: 44, width: "90%", marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 44, width: "75%", marginBottom: 32 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ background: "rgba(255,61,61,0.08)", border: "1px solid rgba(255,61,61,0.2)", borderRadius: 10, padding: 20 }}>
          <p style={{ color: "var(--no-color)", fontFamily: "var(--font-mono)", fontSize: 13 }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!market) return null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px", animation: "fadeUp 400ms ease-out" }}>
      {/* Back */}
      <button
        onClick={() => navigate("#/")}
        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: 14, marginBottom: 28, padding: 0 }}
        onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
        onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
      >
        <ArrowLeft />
        All Markets
      </button>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 14 }}>
          <StatusBadge status={market.status} />
          <OracleTag isPolymarket={market.isPolymarket} />
          {market.polymarketCategory && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "2px 6px" }}>
              {market.polymarketCategory}
            </span>
          )}
        </div>

        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: 16 }}>
          {market.question}
        </h1>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "PRIZE POOL", value: `${market.totalSolPool} SOL`, color: "var(--accent)" },
            { label: "VOTES", value: String(market.voteCount), color: "var(--text-primary)" },
            { label: isPastEnd ? "ENDED" : "ENDS", value: <CountdownTimer endTime={market.endTime} />, color: "var(--text-primary)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 4 }}>{label}</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 16, color, fontWeight: 500 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Polymarket live odds */}
      {market.isPolymarket && market.polymarketPrices && market.status === 1 && (
        <div style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 8 }}>
            POLYMARKET LIVE SENTIMENT
          </p>
          <div className="flex gap-6">
            {(() => {
              try {
                const prices = JSON.parse(market.polymarketPrices);
                return (
                  <>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>
                      <span style={{ color: "var(--yes-color)" }}>YES</span>
                      <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>{(parseFloat(prices[0]) * 100).toFixed(0)}%</span>
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>
                      <span style={{ color: "var(--no-color)" }}>NO</span>
                      <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>{(parseFloat(prices[1]) * 100).toFixed(0)}%</span>
                    </span>
                  </>
                );
              } catch { return null; }
            })()}
          </div>
        </div>
      )}

      {/* My position */}
      {position && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 8 }}>MY POSITION</p>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: position.isYes ? "var(--yes-color)" : "var(--no-color)", fontWeight: 500 }}>
                {position.isYes ? "YES" : "NO"}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-primary)" }}>
                {position.stake} SOL
              </span>
              {position.hasClaimed && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid rgba(163,255,18,0.2)", borderRadius: 4, padding: "2px 6px" }}>
                  CLAIMED
                </span>
              )}
            </div>
            {canClaim && (
              <button
                onClick={() => { /* claim action handled inline */ }}
                style={{ background: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, color: "#070707", cursor: "pointer" }}
              >
                Claim Winnings
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bet button */}
      {canBet && !showBet && (
        <button
          onClick={() => setShowBet(true)}
          style={{ width: "100%", background: "var(--accent)", border: "none", borderRadius: 10, padding: "14px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "#070707", cursor: "pointer", letterSpacing: "0.05em", transition: "all 150ms ease", marginBottom: 24 }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          PLACE ENCRYPTED BET
        </button>
      )}

      {/* Bet modal inline */}
      {showBet && (
        <PlaceBetModal
          market={market}
          onClose={() => setShowBet(false)}
          onSuccess={() => { setShowBet(false); fetchMarket(); }}
        />
      )}

      {/* Resolution panel */}
      {isPastEnd && market.status < 3 && (
        <ResolutionPanel market={market} onResolved={fetchMarket} />
      )}

      {/* Settled result */}
      {market.status === 3 && market.resultPublished && (
        <div style={{
          background: market.yesWins ? "var(--yes-dim)" : "var(--no-dim)",
          border: `1px solid ${market.yesWins ? "rgba(0,180,255,0.3)" : "rgba(255,61,61,0.3)"}`,
          borderRadius: 12, padding: "20px 24px", textAlign: "center", marginTop: 20,
        }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: market.yesWins ? "var(--yes-color)" : "var(--no-color)", letterSpacing: "0.08em" }}>
            {market.yesWins ? "YES WON" : "NO WON"}
          </p>
          <div className="flex justify-center gap-8" style={{ marginTop: 12 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--yes-color)" }}>YES: {lamportsToSol(market.plaintextTotalYes)} SOL</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--no-color)" }}>NO: {lamportsToSol(market.plaintextTotalNo)} SOL</span>
          </div>
        </div>
      )}
    </div>
  );
}
