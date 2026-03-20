import { Suspense, lazy, useState } from "react";
import { useMarkets } from "../../hooks/useMarkets";
import MarketCard from "./MarketCard";

const CreateMarketModal = lazy(() => import("./CreateMarketModal"));

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function RefreshIcon({ spinning }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
      style={{ animation: spinning ? "spin 0.9s linear infinite" : "none" }}>
      <path d="M11.5 6.5A5 5 0 012 4M1.5 6.5A5 5 0 0011 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M1.5 2v2.5H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.5 11v-2.5H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function LockShieldIcon() {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
      <path d="M9 1L1 4.5V10C1 14.418 4.582 18.368 9 19C13.418 18.368 17 14.418 17 10V4.5L9 1Z"
        stroke="var(--accent)" strokeWidth="1.2" fill="rgba(129,140,248,0.06)" strokeLinejoin="round"/>
      <path d="M6 10L8 12L12 8" stroke="var(--accent-bright)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const FILTERS = ["all", "open", "settled"];

export default function MarketList() {
  const { markets, loading, error, refetch } = useMarkets();
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");

  const filtered = markets.filter((m) => {
    if (filter === "open")    return m.status === 1;
    if (filter === "settled") return m.status === 3;
    return true;
  });

  const totalSOL = markets.reduce((acc, m) => acc + m.totalSolPoolLamports / 1e9, 0);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px 60px" }}>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: "52px 0 40px",
        animation: "fadeUp 600ms cubic-bezier(0.16, 1, 0.3, 1) both",
      }}>
        {/* Eyebrow */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "var(--accent-dim)",
          border: "1px solid rgba(129, 140, 248, 0.2)",
          borderRadius: 99,
          padding: "5px 12px",
          marginBottom: 20,
        }}>
          <LockShieldIcon />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent-bright)", letterSpacing: "0.12em" }}>
            END-TO-END ENCRYPTED · POWERED BY ARCIUM MPC
          </span>
        </div>

        <h1 style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "clamp(28px, 4vw, 42px)",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          marginBottom: 12,
          background: "linear-gradient(135deg, #F1F5F9 30%, #A5B4FC 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          Prediction Markets,<br/>Privately.
        </h1>

        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: 15,
          color: "var(--text-secondary)",
          marginBottom: 32,
          maxWidth: 480,
          lineHeight: 1.65,
        }}>
          Bet YES or NO on real-world events. Your vote direction stays encrypted until resolution — nobody sees the odds until markets close.
        </p>

        {/* Stats row */}
        {!loading && markets.length > 0 && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            {[
              { label: "Total Markets", value: markets.length },
              { label: "SOL Locked", value: `${totalSOL.toFixed(2)} SOL` },
              { label: "Privacy Layer", value: "Arcium MPC" },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                padding: "10px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.12em" }}>{label.toUpperCase()}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 20,
        animation: "fadeUp 600ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both",
      }}>
        {/* Filter pills */}
        <div style={{
          display: "flex",
          gap: 3,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 10,
          padding: 3,
        }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? "var(--bg-elevated)" : "transparent",
                border: filter === f ? "1px solid var(--border-strong)" : "1px solid transparent",
                borderRadius: 7,
                padding: "5px 14px",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                color: filter === f ? "var(--text-primary)" : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 150ms ease",
                textTransform: "uppercase",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleRefresh}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 9,
              padding: "8px 11px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 150ms ease",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <RefreshIcon spinning={refreshing} />
          </button>

          <button
            onClick={() => setShowCreate(true)}
            style={{
              background: "linear-gradient(135deg, #818CF8, #6366F1)",
              border: "none",
              borderRadius: 9,
              padding: "8px 16px",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
              transition: "all 160ms ease",
              boxShadow: "0 2px 12px rgba(129, 140, 248, 0.28)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(129, 140, 248, 0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(129, 140, 248, 0.28)"; }}
          >
            <PlusIcon />
            New Market
          </button>
        </div>
      </div>

      {/* ── Divider ──────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, var(--border-default), transparent)", marginBottom: 24 }} />

      {/* ── Loading skeletons ─────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 14,
              padding: 20,
              height: 210,
              animation: `fadeUp 500ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms both`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <div className="skeleton" style={{ height: 18, width: "35%" }} />
                <div className="skeleton" style={{ height: 18, width: "28%" }} />
              </div>
              <div className="skeleton" style={{ height: 14, width: "95%", marginBottom: 7 }} />
              <div className="skeleton" style={{ height: 14, width: "80%", marginBottom: 20 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div className="skeleton" style={{ height: 56 }} />
                <div className="skeleton" style={{ height: 56 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: "var(--no-dim)",
          border: "1px solid var(--no-border)",
          borderRadius: 10,
          padding: "14px 18px",
          color: "var(--no-color)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        }}>
          {error}
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="fade-in" style={{ textAlign: "center", padding: "80px 24px" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-muted)", marginBottom: 8 }}>
            No markets {filter !== "all" ? `(${filter})` : "yet"}
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)" }}>
            {filter === "all" ? "Create one or import from Polymarket to get started" : `No ${filter} markets at the moment`}
          </p>
        </div>
      )}

      {/* ── Grid ──────────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {filtered.map((market, i) => (
            <MarketCard key={market.publicKey} market={market} index={i} />
          ))}
        </div>
      )}

      {/* ── Create modal ──────────────────────────────────────────────── */}
      {showCreate && (
        <Suspense fallback={null}>
          <CreateMarketModal
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); refetch(); }}
          />
        </Suspense>
      )}
    </div>
  );
}
