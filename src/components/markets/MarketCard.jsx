import { navigate } from "../../utils/navigation";
import StatusBadge from "../ui/StatusBadge";
import CountdownTimer from "../ui/CountdownTimer";
import OracleTag from "../ui/OracleTag";

// People SVG icon
function PeopleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="4.5" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1.5 9.5C1.5 7.843 2.843 6.5 4.5 6.5C6.157 6.5 7.5 7.843 7.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="8.5" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M8.5 6.5C9.329 6.5 10.5 7.121 10.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export default function MarketCard({ market, index }) {
  const isSettled = market.status === 3;
  const isOpen = market.status === 1;

  return (
    <article
      className="card-animate"
      style={{ "--i": index }}
      onClick={() => navigate(`#/market/${market.publicKey}`)}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: "20px",
          cursor: "pointer",
          transition: "all 200ms ease",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          animationDelay: `calc(${index} * 80ms)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow =
            "0 0 24px rgba(163, 255, 18, 0.06), 0 0 0 1px var(--border-accent)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {/* Top row: status + oracle */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <StatusBadge status={market.status} />
          <OracleTag isPolymarket={market.isPolymarket} />
        </div>

        {/* Question */}
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 15,
            color: "var(--text-primary)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            flex: 1,
          }}
        >
          {market.question}
        </h3>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <div
            style={{
              background: "var(--bg-elevated)",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--text-muted)",
                letterSpacing: "0.1em",
                marginBottom: 2,
              }}
            >
              PRIZE POOL
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 15,
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              {market.totalSolPool} SOL
            </p>
          </div>

          <div
            style={{
              background: "var(--bg-elevated)",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--text-muted)",
                letterSpacing: "0.1em",
                marginBottom: 2,
              }}
            >
              {isOpen || market.status === 0 ? "ENDS" : "ENDED"}
            </p>
            <CountdownTimer endTime={market.endTime} />
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <PeopleIcon />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--text-secondary)",
              }}
            >
              {market.voteCount} vote{market.voteCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Settled result badge */}
          {isSettled && market.resultPublished && (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 12,
                color: market.yesWins ? "var(--yes-color)" : "var(--no-color)",
                background: market.yesWins ? "var(--yes-dim)" : "var(--no-dim)",
                border: `1px solid ${market.yesWins ? "rgba(0,180,255,0.25)" : "rgba(255,61,61,0.25)"}`,
                borderRadius: 6,
                padding: "3px 8px",
                letterSpacing: "0.06em",
              }}
            >
              {market.yesWins ? "YES WON" : "NO WON"}
            </span>
          )}

          {/* Category for Polymarket */}
          {market.polymarketCategory && !isSettled && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-muted)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              {market.polymarketCategory}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
