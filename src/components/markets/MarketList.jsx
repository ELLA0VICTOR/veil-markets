import { useState } from "react";
import { useMarkets } from "../../hooks/useMarkets";
import MarketCard from "./MarketCard";
import CreateMarketModal from "./CreateMarketModal";

// Plus icon
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

// Refresh icon
function RefreshIcon({ spinning }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ animation: spinning ? "spin 1s linear infinite" : "none" }}
    >
      <path d="M12.5 7A5.5 5.5 0 012 4.5M1.5 7A5.5 5.5 0 0012 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M1.5 2.5V5H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.5 11.5V9H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function MarketList() {
  const { markets, loading, error, refetch } = useMarkets();
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all"); // all | open | settled

  const filtered = markets.filter((m) => {
    if (filter === "open") return m.status === 1;
    if (filter === "settled") return m.status === 3;
    return true;
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
      {/* Page header */}
      <div
        className="flex items-start justify-between gap-4 flex-wrap"
        style={{ marginBottom: 40, animation: "fadeUp 400ms ease-out" }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 32,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
              marginBottom: 8,
            }}
          >
            Markets
          </h1>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-muted)",
              letterSpacing: "0.06em",
            }}
          >
            {markets.length} market{markets.length !== 1 ? "s" : ""} — vote distribution hidden until resolution
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              padding: "9px 12px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 150ms ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-default)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <RefreshIcon spinning={refreshing} />
          </button>

          <button
            onClick={() => setShowCreate(true)}
            style={{
              background: "var(--accent)",
              border: "none",
              borderRadius: 8,
              padding: "9px 16px",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 500,
              color: "#070707",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.88";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <PlusIcon />
            Create Market
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div
        style={{ display: "flex", gap: 2, marginBottom: 28, animation: "fadeUp 400ms ease-out 60ms both" }}
      >
        {["all", "open", "settled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? "var(--bg-elevated)" : "transparent",
              border: filter === f ? "1px solid var(--border-default)" : "1px solid transparent",
              borderRadius: 6,
              padding: "6px 14px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.08em",
              color: filter === f ? "var(--text-primary)" : "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 150ms ease",
              textTransform: "uppercase",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* States */}
      {loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                padding: 20,
                height: 200,
                animation: "fadeUp 400ms ease-out forwards",
                animationDelay: `${i * 60}ms`,
                opacity: 0,
              }}
            >
              <div className="skeleton" style={{ height: 20, width: "60%", marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: "90%", marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 16, width: "75%", marginBottom: 20 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="skeleton" style={{ height: 52 }} />
                <div className="skeleton" style={{ height: 52 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "rgba(255,61,61,0.08)",
            border: "1px solid rgba(255,61,61,0.2)",
            borderRadius: 10,
            padding: "16px 20px",
            color: "var(--no-color)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
          }}
        >
          Failed to load markets: {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "80px 24px",
            animation: "fadeIn 400ms ease-out",
          }}
        >
          <p style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-muted)", marginBottom: 8 }}>
            No markets yet
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-muted)" }}>
            Create one or import from Polymarket to get started
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((market, i) => (
            <MarketCard key={market.publicKey} market={market} index={i} />
          ))}
        </div>
      )}

      {/* Create market modal */}
      {showCreate && <CreateMarketModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}
