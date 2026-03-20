import { navigate } from "../../utils/navigation";
import StatusBadge from "../ui/StatusBadge";
import CountdownTimer from "../ui/CountdownTimer";
import OracleTag from "../ui/OracleTag";

export default function MarketCard({ market, index }) {
  const isSettled = market.status === 3;
  const isOpen    = market.status === 1;

  return (
    <article
      className="card-animate"
      style={{ "--i": index, height: "100%" }}
      onClick={() => navigate(`#/market/${market.publicKey}`)}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 14,
          padding: "20px",
          cursor: "pointer",
          transition: "all 220ms cubic-bezier(0.16, 1, 0.3, 1)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.transform = "translateY(-3px)";
          el.style.borderColor = "rgba(129, 140, 248, 0.35)";
          el.style.boxShadow = "0 0 0 1px rgba(129, 140, 248, 0.15), 0 12px 40px rgba(0,0,0,0.4), var(--glow-accent)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.transform = "translateY(0)";
          el.style.borderColor = "var(--border-default)";
          el.style.boxShadow = "none";
        }}
      >
        {/* Top accent line on hover */}
        <div style={{
          position: "absolute",
          top: 0,
          left: "10%",
          right: "10%",
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.4), transparent)",
          opacity: 0,
          transition: "opacity 220ms",
        }} className="card-top-line" />

        {/* Badges row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge status={market.status} />
          <OracleTag isPolymarket={market.isPolymarket} />
        </div>

        {/* Question */}
        <h3 style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 14.5,
          color: "var(--text-primary)",
          lineHeight: 1.45,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          flex: 1,
          letterSpacing: "-0.01em",
        }}>
          {market.question}
        </h3>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{
            background: "var(--bg-elevated)",
            borderRadius: 10,
            padding: "10px 12px",
            border: "1px solid var(--border-subtle)",
          }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 4 }}>
              PRIZE POOL
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--accent-bright)", fontWeight: 500, letterSpacing: "-0.01em" }}>
              {market.totalSolPool}
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 3 }}>SOL</span>
            </p>
          </div>

          <div style={{
            background: "var(--bg-elevated)",
            borderRadius: 10,
            padding: "10px 12px",
            border: "1px solid var(--border-subtle)",
          }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 4 }}>
              {isOpen || market.status === 0 ? "ENDS IN" : "ENDED"}
            </p>
            <CountdownTimer endTime={market.endTime} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
            {market.voteCount} {market.voteCount === 1 ? "bet" : "bets"}
          </span>

          {isSettled && market.resultPublished ? (
            <span style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.06em",
              color: market.yesWins ? "var(--yes-color)" : "var(--no-color)",
              background: market.yesWins ? "var(--yes-dim)" : "var(--no-dim)",
              border: `1px solid ${market.yesWins ? "var(--yes-border)" : "var(--no-border)"}`,
              borderRadius: 6,
              padding: "3px 8px",
            }}>
              {market.yesWins ? "YES WON" : "NO WON"}
            </span>
          ) : market.polymarketCategory && !isSettled ? (
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--text-muted)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 4,
              padding: "2px 7px",
              letterSpacing: "0.07em",
            }}>
              {market.polymarketCategory}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
