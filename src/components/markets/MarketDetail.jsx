import { Suspense, lazy, useEffect, useMemo, useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { navigate } from "../../utils/navigation";
import { ARCIUM_PROGRAM_ID } from "../../utils/constants";
import { decodeQuestion, derivePositionPda } from "../../utils/solana";
import {
  bytesToConditionId,
  isZeroConditionId,
  fetchPolymarketMarket,
} from "../../utils/polymarket";
import {
  hideMarketFromDashboard,
  isMarketHidden,
  showMarketOnDashboard,
} from "../../utils/archivedMarkets";
import { decryptStoredVote } from "../../utils/arcium";
import { getCircuitAccounts, getMxePublicKeyWithRetry, waitForArciumComputation } from "../../utils/arciumAccounts";
import { usePrivateBalance } from "../../hooks/usePrivateBalance";
import { useWallet } from "../../hooks/useWallet";
import { createReadonlyProvider, createVeilProgram } from "../../utils/program";
import StatusBadge from "../ui/StatusBadge";
import CountdownTimer from "../ui/CountdownTimer";
import OracleTag from "../ui/OracleTag";

const PlaceBetModal = lazy(() => import("./PlaceBetModal"));
const ResolutionPanel = lazy(() => import("./ResolutionPanel"));

function ArrowLeft() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path
        d="M9.5 3L4.5 7.5l5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div
      style={{
        background: "var(--bg-input)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--text-3)",
          letterSpacing: "0.12em",
          marginBottom: 5,
        }}
      >
        {label}
      </p>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 15,
          color: accent || "var(--text)",
          fontWeight: 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function randomComputationOffset() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return new BN(new DataView(bytes.buffer).getBigUint64(0, true).toString());
}

function randomNonceBn() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const value = Array.from(bytes).reduce(
    (acc, byte, index) => acc | (BigInt(byte) << BigInt(index * 8)),
    0n
  );
  return new BN(value.toString());
}

export default function MarketDetail({ marketPubkey }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const {
    balanceSol,
    balanceDisplay,
    keypair,
    error: privateBalanceError,
    refreshBalance,
    deposit,
    withdraw,
    userBalancePda,
    userBalancePendingPda,
    pendingActionLabel,
    pendingMessage,
    pendingWithdrawDisplay,
    pendingAgeSlots,
    pendingAssessment,
    pendingRecoveryThresholdSlots,
    canRecoverPendingAction,
    isPending,
    recoverPendingAction,
  } = usePrivateBalance();
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBet, setShowBet] = useState(false);
  const [position, setPosition] = useState(null);
  const [decryptedPosition, setDecryptedPosition] = useState(null);
  const [hiddenFromDashboard, setHiddenFromDashboard] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [balanceInput, setBalanceInput] = useState("1");
  const [hasCrossedEnd, setHasCrossedEnd] = useState(false);
  const [balanceAction, setBalanceAction] = useState("");
  const [balanceError, setBalanceError] = useState("");

  const fetchMarket = useCallback(async () => {
    try {
      setError(null);
      setClaimError("");

      const provider = wallet
        ? new AnchorProvider(connection, wallet, { commitment: "confirmed" })
        : createReadonlyProvider(connection);
      const program = createVeilProgram(provider);
      const pubkey = new PublicKey(marketPubkey);
      const acct = await program.account.market.fetch(pubkey);

      const cidBytes = acct.polymarketConditionId;
      const isPoly = acct.isPolymarket;
      let pmData = null;

      if (isPoly && !isZeroConditionId(cidBytes)) {
        try {
          pmData = await fetchPolymarketMarket(bytesToConditionId(cidBytes));
        } catch {}
      }

      const endTime = new Date(acct.endTime.toNumber() * 1000);
      setHasCrossedEnd(Date.now() >= endTime.getTime());
      setMarket({
        publicKey: pubkey.toBase58(),
        creator: acct.creator.toBase58(),
        question: pmData?.question || decodeQuestion(acct.question),
        endTime,
        status: acct.status,
        isPolymarket: isPoly,
        conditionId: isPoly ? bytesToConditionId(cidBytes) : null,
        voteCount: acct.voteCount,
        yesWins: acct.yesWins,
        resultPublished: acct.resultPublished,
        polymarketPrices: pmData?.outcomePrices || null,
        polymarketCategory: pmData?.category || null,
      });

      if (publicKey) {
        try {
          const [positionPda] = derivePositionPda(pubkey, publicKey);
          const pos = await program.account.position.fetch(positionPda);
          setPosition({
            pda: positionPda.toBase58(),
            status: pos.status,
            voteNonce: pos.voteNonce,
            voteCtIsYes: pos.voteCtIsYes,
            voteCtStake: pos.voteCtStake,
          });

          if (keypair) {
            const mxePublicKey = await getMxePublicKeyWithRetry(provider);
            const decoded = await decryptStoredVote(
              keypair.privateKey,
              mxePublicKey,
              pos.voteNonce.toString(),
              pos.voteCtIsYes,
              pos.voteCtStake
            );
            setDecryptedPosition({
              isYes: decoded.isYes,
              stakeSol: Number(decoded.stakeLamports) / 1e9,
            });
          } else {
            setDecryptedPosition(null);
          }
        } catch {
          setPosition(null);
          setDecryptedPosition(null);
        }
      }

      setHiddenFromDashboard(isMarketHidden(pubkey.toBase58()));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, marketPubkey, publicKey, keypair]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  useEffect(() => {
    if (!market || market.status >= 3) return undefined;
    const id = setInterval(() => {
      fetchMarket();
    }, 15000);
    return () => clearInterval(id);
  }, [fetchMarket, market]);

  const handleMarketExpired = useCallback(() => {
    setHasCrossedEnd(true);
    fetchMarket();
  }, [fetchMarket]);

  const handleToggleDashboardVisibility = () => {
    if (!market) return;
    if (hiddenFromDashboard) {
      showMarketOnDashboard(market.publicKey);
      setHiddenFromDashboard(false);
      return;
    }
    hideMarketFromDashboard(market.publicKey);
    setHiddenFromDashboard(true);
  };

  const handleClaim = async () => {
    if (!wallet || !publicKey || !market || !userBalancePda || !userBalancePendingPda) {
      setClaimError("Connect wallet first");
      return;
    }

    try {
      setClaimError("");
      setClaiming(true);

      const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
      const program = createVeilProgram(provider);
      const marketPk = new PublicKey(market.publicKey);
      const [positionPda] = derivePositionPda(marketPk, publicKey);
      const computationOffset = randomComputationOffset();
      const viewerNonce = randomNonceBn();

      await program.methods
        .claimWinnings(computationOffset, viewerNonce)
        .accounts({
          voter: publicKey,
          market: marketPk,
          userBalance: userBalancePda,
          pendingState: userBalancePendingPda,
          position: positionPda,
          ...getCircuitAccounts("claim_payout", computationOffset),
          arciumProgram: new PublicKey(ARCIUM_PROGRAM_ID),
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

      await waitForArciumComputation(provider, computationOffset, "confirmed");
      await refreshBalance();
      await fetchMarket();
    } catch (err) {
      setClaimError(err.message || "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const handleBalanceAction = async (mode) => {
    try {
      setBalanceError("");
      setBalanceAction(mode);
      if (mode === "deposit") {
        await deposit(balanceInput);
      } else if (mode === "recover") {
        await recoverPendingAction();
      } else {
        await withdraw(balanceInput);
      }
    } catch (caught) {
      setBalanceError(caught?.message || "Balance update failed");
    } finally {
      setBalanceAction("");
    }
  };

  const userWon = useMemo(() => {
    if (!market || !decryptedPosition || market.status !== 3 || !market.resultPublished) {
      return false;
    }
    return decryptedPosition.isYes === market.yesWins;
  }, [market, decryptedPosition]);

  if (loading) {
    return (
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "40px 24px" }}>
        <div className="skeleton" style={{ height: 18, width: "20%", marginBottom: 32 }} />
        <div className="skeleton" style={{ height: 32, width: "88%", marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 32, width: "72%", marginBottom: 28 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ background: "var(--red-dim)", border: "1px solid var(--red-border)", borderRadius: 10, padding: "14px 16px", color: "var(--red)", fontSize: 12 }}>
          {error}
        </div>
      </div>
    );
  }

  if (!market) return null;

  const pastEnd = hasCrossedEnd || Date.now() >= market.endTime.getTime();
  const canBet = market.status === 1 && !pastEnd && (!position || position.status === 3);
  const canHideFromDashboard = Boolean(market);
  const canClaim =
    market.status === 3 &&
    market.resultPublished &&
    position &&
    position.status === 1 &&
    userWon;

  return (
    <div className="anim-up market-detail-root" style={{ maxWidth: 780, margin: "0 auto", padding: "36px 24px 64px" }}>
      <button
        onClick={() => navigate("#/")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          color: "var(--text-3)",
          fontSize: 12,
          marginBottom: 28,
          padding: 0,
          fontFamily: "var(--font-mono)",
        }}
      >
        <ArrowLeft /> Back to Markets
      </button>

      <div
        className="market-detail-summary"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "24px",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
          <StatusBadge status={market.status} ended={pastEnd && market.status === 1} />
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

        {canHideFromDashboard && (
          <div style={{ marginBottom: 18 }}>
            <button
              onClick={handleToggleDashboardVisibility}
              style={{
                background: hiddenFromDashboard ? "var(--bg-input)" : "transparent",
                color: hiddenFromDashboard ? "var(--text)" : "var(--text-2)",
                border: "1px solid var(--border)",
                borderRadius: 9,
                padding: "9px 14px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
                cursor: "pointer",
              }}
            >
              {hiddenFromDashboard ? "SHOW ON DASHBOARD" : "HIDE FROM DASHBOARD"}
            </button>
            <p style={{ marginTop: 8, fontSize: 11, color: "var(--text-3)" }}>
              This only changes your local dashboard view. The market stays on-chain and reachable by direct link.
            </p>
          </div>
        )}

        <div className="market-detail-stats" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <Stat label="POOL" value="PRIVATE" accent="var(--text)" />
          <Stat label="BETS" value={String(market.voteCount)} />
          <Stat label={pastEnd ? "ENDED" : "CLOSES"} value={<CountdownTimer endTime={market.endTime} onExpired={handleMarketExpired} />} />
        </div>
      </div>

      {pastEnd && market.status < 3 && (
        <div
          style={{
            background: "var(--amber-dim)",
            border: "1px solid var(--amber-border)",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 12,
          }}
        >
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--amber)", marginBottom: 6 }}>
            MARKET WAITING ON RESOLUTION
          </p>
          <p style={{ fontSize: 12, color: "var(--text-2)" }}>
            Betting is closed. This market will stay in the global &quot;Awaiting Resolution&quot; section until the creator publishes the outcome.
          </p>
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", marginBottom: 12 }}>
        <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 9 }}>PRIVATE VEIL BALANCE</p>
        <div className="market-position-row" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
            {balanceDisplay}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            Deposits and withdrawals are public wallet transfers, but per-market stake stays hidden inside this balance.
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: balanceError ? 10 : 0 }}>
          <input
            type="number"
            value={balanceInput}
            min="0.01"
            step="0.01"
            onChange={(e) => setBalanceInput(e.target.value)}
            style={{ flex: 1, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px", color: "var(--text)", fontFamily: "var(--font-mono)" }}
          />
          <button
            onClick={() => handleBalanceAction("deposit")}
            disabled={balanceAction !== "" || isPending}
            style={{ background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 9, padding: "10px 14px", fontFamily: "var(--font-mono)", fontWeight: 700, cursor: balanceAction !== "" || isPending ? "not-allowed" : "pointer", opacity: balanceAction !== "" || isPending ? 0.65 : 1 }}
          >
            {balanceAction === "deposit" ? "DEPOSITING..." : "DEPOSIT"}
          </button>
          <button
            onClick={() => handleBalanceAction("withdraw")}
            disabled={balanceAction !== "" || isPending}
            style={{ background: "var(--bg-input)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 14px", fontFamily: "var(--font-mono)", fontWeight: 700, cursor: balanceAction !== "" || isPending ? "not-allowed" : "pointer", opacity: balanceAction !== "" || isPending ? 0.65 : 1 }}
          >
            {balanceAction === "withdraw" ? "WITHDRAWING..." : "WITHDRAW"}
          </button>
          <button
            onClick={() => refreshBalance()}
            disabled={balanceAction !== ""}
            style={{ background: "transparent", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 14px", fontFamily: "var(--font-mono)", fontWeight: 700, cursor: balanceAction !== "" ? "not-allowed" : "pointer" }}
          >
            REFRESH
          </button>
        </div>
        {balanceError && (
          <div style={{ padding: "9px 12px", background: "var(--red-dim)", border: "1px solid var(--red-border)", borderRadius: 8, fontSize: 11, color: "var(--red)" }}>
            {balanceError}
          </div>
        )}
        {!balanceError && isPending && (
          <div style={{ padding: "10px 12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, color: "var(--text-2)", display: "grid", gap: 6 }}>
            <div>
              <strong style={{ color: "var(--text)" }}>On-chain status:</strong> {pendingActionLabel}
              {pendingWithdrawDisplay ? ` (${pendingWithdrawDisplay})` : ""}
            </div>
            <div>{pendingMessage}</div>
            {pendingAgeSlots !== null && (
              <div style={{ color: "var(--text-3)" }}>
                Pending age: {pendingAgeSlots} slots. Recovery threshold: {pendingRecoveryThresholdSlots} slots.
              </div>
            )}
            {pendingAssessment && <div style={{ color: "var(--text-3)" }}>{pendingAssessment}</div>}
            {canRecoverPendingAction && (
              <div>
                <button
                  onClick={() => handleBalanceAction("recover")}
                  disabled={balanceAction !== ""}
                  style={{
                    background: "var(--text)",
                    color: "var(--bg)",
                    border: "none",
                    borderRadius: 9,
                    padding: "10px 14px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    cursor: balanceAction !== "" ? "not-allowed" : "pointer",
                  }}
                >
                  {balanceAction === "recover" ? "RECOVERING..." : "RECOVER STALE ACTION"}
                </button>
              </div>
            )}
          </div>
        )}
        {!balanceError && privateBalanceError && !isPending && (
          <div style={{ padding: "9px 12px", background: "var(--red-dim)", border: "1px solid var(--red-border)", borderRadius: 8, fontSize: 11, color: "var(--red)" }}>
            {privateBalanceError}
          </div>
        )}
      </div>

      {position && (
        <div className="market-position-card" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", marginBottom: 12 }}>
          <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 9 }}>MY PRIVATE POSITION</p>
          {decryptedPosition ? (
            <div className="market-position-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 16, color: decryptedPosition.isYes ? "var(--cyan)" : "var(--red)" }}>
                {decryptedPosition.isYes ? "YES" : "NO"}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{decryptedPosition.stakeSol.toFixed(3)} SOL</span>
              <span className="pill" style={{ background: "transparent", color: "var(--text-3)", border: "1px solid var(--border)", fontSize: 9 }}>
                {position.status === 0 ? "PENDING" : position.status === 1 ? "ACTIVE" : position.status === 2 ? "CLAIMED" : "REJECTED"}
              </span>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-2)" }}>
              Position exists, but this browser cannot decrypt it yet. Use the same local private key context that created the bet.
            </p>
          )}
        </div>
      )}

      {canBet && !showBet && (
        <button
          onClick={() => setShowBet(true)}
          style={{
            width: "100%",
            background: "var(--text)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 11,
            padding: "14px",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.08em",
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          PLACE PRIVATE BET
        </button>
      )}

      {showBet && (
        <Suspense fallback={null}>
          <PlaceBetModal
            market={market}
            onClose={() => setShowBet(false)}
            onSuccess={() => {
              setShowBet(false);
              fetchMarket();
            }}
          />
        </Suspense>
      )}

      {pastEnd && market.status < 3 && (
        <Suspense fallback={null}>
          <ResolutionPanel market={market} onResolved={fetchMarket} />
        </Suspense>
      )}

      {market.status === 3 && market.resultPublished && (
        <div
          style={{
            background: market.yesWins ? "var(--cyan-dim)" : "var(--red-dim)",
            border: `1px solid ${market.yesWins ? "var(--cyan-border)" : "var(--red-border)"}`,
            borderRadius: 12,
            padding: "24px",
            textAlign: "center",
            marginTop: 12,
          }}
        >
          <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 28, letterSpacing: "-0.01em", color: market.yesWins ? "var(--cyan)" : "var(--red)", marginBottom: 10 }}>
            {market.yesWins ? "YES WON" : "NO WON"}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>
            Outcome is public. Aggregated stake totals remain encrypted and payouts are credited to private VEIL balances.
          </p>

          {position && (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              {canClaim && (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  style={{
                    background: claiming ? "var(--bg-input)" : "var(--text)",
                    color: claiming ? "var(--text-3)" : "var(--bg)",
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 18px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    cursor: claiming ? "not-allowed" : "pointer",
                  }}
                >
                  {claiming ? "CLAIMING..." : "CLAIM TO PRIVATE BALANCE"}
                </button>
              )}

              {!canClaim && position.status === 1 && decryptedPosition && !userWon && (
                <p style={{ fontSize: 12, color: "var(--text-3)" }}>
                  This private position did not win.
                </p>
              )}

              {position.status === 2 && (
                <p style={{ fontSize: 12, color: "var(--green)" }}>
                  Claimed into your private balance.
                </p>
              )}

              {claimError && (
                <div style={{ width: "100%", maxWidth: 360, padding: "9px 12px", background: "var(--red-dim)", border: "1px solid var(--red-border)", borderRadius: 8, fontSize: 11, color: "var(--red)" }}>
                  {claimError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


