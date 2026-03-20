import { Suspense, lazy, useState } from "react";
import { useMarkets } from "../../hooks/useMarkets";
import MarketCard from "./MarketCard";

const CreateMarketModal = lazy(() => import("./CreateMarketModal"));

function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}
function RefreshIcon({ spinning }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ animation: spinning ? "spin 0.8s linear infinite" : "none" }}>
      <path d="M11 6.5A4.5 4.5 0 012 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M2 6.5A4.5 4.5 0 0011 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M2 2v2.5H4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 11V8.5H8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const TABS = ["ALL", "OPEN", "SETTLED"];

export default function MarketList() {
  const { markets, loading, error, refetch } = useMarkets();
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("ALL");

  const filtered = markets.filter((m) => {
    if (tab === "OPEN")    return m.status === 1;
    if (tab === "SETTLED") return m.status === 3;
    return true;
  });

  const handleRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const btnBase = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 600,
    border: "1px solid var(--border)",
    borderRadius: 7,
    cursor: "pointer",
    transition: "all 150ms ease",
    display: "flex",
    alignItems: "center",
    gap: 6,
    letterSpacing: "0.04em",
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 24px 64px" }}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="anim-up" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 26, letterSpacing: "-0.01em", marginBottom: 6 }}>
              Prediction Markets
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-2)" }}>
              Vote direction encrypted until resolution · powered by Arcium MPC
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleRefresh}
              style={{ ...btnBase, padding: "7px 11px", background: "var(--bg-card)", color: "var(--text-2)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-2)"; }}
            >
              <RefreshIcon spinning={refreshing} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              style={{ ...btnBase, padding: "7px 14px", background: "var(--cyan)", color: "#000", border: "none", fontWeight: 700 }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              <PlusIcon /> New Market
            </button>
          </div>
        </div>

        {/* Stats row */}
        {!loading && markets.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            {[
              { k: "Markets", v: markets.length },
              { k: "SOL Locked", v: `${markets.reduce((a, m) => a + m.totalSolPoolLamports / 1e9, 0).toFixed(2)} SOL` },
              { k: "Open", v: markets.filter(m => m.status === 1).length },
            ].map(({ k, v }) => (
              <div key={k} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em" }}>{k.toUpperCase()}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === t ? "var(--text)" : "transparent"}`,
              padding: "10px 16px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: tab === t ? 700 : 500,
              letterSpacing: "0.08em",
              color: tab === t ? "var(--text)" : "var(--text-3)",
              cursor: "pointer",
              transition: "all 150ms ease",
              marginBottom: -1,
            }}
          >{t}</button>
        ))}
      </div>

      {/* ── Loading ─────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", height: 200, animation: `fadeUp 500ms ease ${i * 60}ms both` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div className="skeleton" style={{ height: 18, width: "30%" }} />
                <div className="skeleton" style={{ height: 18, width: "35%" }} />
              </div>
              <div className="skeleton" style={{ height: 13, width: "92%", marginBottom: 7 }} />
              <div className="skeleton" style={{ height: 13, width: "78%", marginBottom: 20 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div className="skeleton" style={{ height: 50 }} />
                <div className="skeleton" style={{ height: 50 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && (
        <div style={{ background: "var(--red-dim)", border: "1px solid var(--red-border)", borderRadius: 10, padding: "12px 16px", color: "var(--red)", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* ── Empty ───────────────────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="anim-in" style={{ textAlign: "center", padding: "64px 24px" }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, color: "var(--text-2)", marginBottom: 8 }}>
            No {tab !== "ALL" ? tab.toLowerCase() : ""} markets yet
          </p>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>
            {tab === "ALL" ? "Create one or import from Polymarket" : `Switch to ALL to see all markets`}
          </p>
        </div>
      )}

      {/* ── Grid ────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
          {filtered.map((m, i) => <MarketCard key={m.publicKey} market={m} index={i} />)}
        </div>
      )}

      {/* ── Create modal ────────────────────────────────────────── */}
      {showCreate && (
        <Suspense fallback={null}>
          <CreateMarketModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />
        </Suspense>
      )}
    </div>
  );
}
