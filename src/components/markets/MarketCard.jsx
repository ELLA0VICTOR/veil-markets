import { useEffect, useState } from "react";
import { navigate } from "../../utils/navigation";
import StatusBadge from "../ui/StatusBadge";
import CountdownTimer from "../ui/CountdownTimer";
import OracleTag from "../ui/OracleTag";
import MarketActivityVisual from "../ui/MarketActivityVisual";

export default function MarketCard({ market, index }) {
  const [now, setNow] = useState(() => Date.now());
  const settled = market.status === 3;
  const pastEnd = now >= market.endTime.getTime();
  const open = market.status === 1 && !pastEnd;
  const awaitingResolution = !settled && (market.status === 2 || pastEnd);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <article
      className="anim-up"
      style={{ "--i": index, height: "100%" }}
      onClick={() => navigate(`#/market/${market.publicKey}`)}
    >
      <div
        className="market-card-shell"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "18px 20px",
          cursor: "pointer",
          transition: "border-color 180ms ease, transform 180ms ease",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--border-hover)";
          e.currentTarget.style.transform   = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.transform   = "translateY(0)";
        }}
      >
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <StatusBadge status={market.status} ended={awaitingResolution && market.status === 1} />
          <OracleTag isPolymarket={market.isPolymarket} />
        </div>

        {/* Question */}
        <p style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          fontSize: 14,
          color: "var(--text)",
          lineHeight: 1.45,
          flex: 1,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {market.question}
        </p>

        <MarketActivityVisual
          seedKey={`${market.publicKey}:${market.endTime.getTime()}:${market.status}`}
          label={settled ? "RESOLVED ACTIVITY" : "ENCRYPTED ACTIVITY"}
        />

        {/* Stat row */}
        <div className="market-card-stats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "POOL", value: "PRIVATE", color: "var(--text)" },
            {
              label: open || market.status === 0 ? "ENDS" : "ENDED",
              value: <CountdownTimer endTime={market.endTime} />,
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</p>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: color || "var(--text-2)", fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="market-card-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 2 }}>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            {market.voteCount} {market.voteCount === 1 ? "bet" : "bets"}
          </span>
          {settled && market.resultPublished ? (
            <span className="pill" style={{
              background: market.yesWins ? "var(--cyan-dim)" : "var(--red-dim)",
              color:      market.yesWins ? "var(--cyan)"    : "var(--red)",
              border:     `1px solid ${market.yesWins ? "var(--cyan-border)" : "var(--red-border)"}`,
              fontSize: 9, fontWeight: 700,
            }}>
              {market.yesWins ? "YES WON" : "NO WON"}
            </span>
          ) : awaitingResolution ? (
            <span
              style={{
                fontSize: 9,
                color: "var(--amber)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.08em",
              }}
            >
              AWAITING RESOLUTION
            </span>
          ) : market.polymarketCategory ? (
            <span style={{ fontSize: 9, color: "var(--text-3)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
              {market.polymarketCategory}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
