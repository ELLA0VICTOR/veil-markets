import { Suspense, lazy, useState } from "react";
import { useMarkets } from "../../hooks/useMarkets";
import { usePolymarketFeed } from "../../hooks/usePolymarketFeed";
import MarketCard from "./MarketCard";

const CreateMarketModal = lazy(() => import("./CreateMarketModal"));

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon({ spinning }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ animation: spinning ? "spin 0.8s linear infinite" : "none" }}
    >
      <path d="M11.6 4.95A5.15 5.15 0 0 0 3.48 3.7" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M2.9 2.35v2.55h2.58" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.4 9.05A5.15 5.15 0 0 0 10.52 10.3" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M11.1 11.65V9.1H8.52" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImportablePolymarketCard({ market, index, onImport }) {
  return (
    <article className="anim-up" style={{ "--i": index, height: "100%" }}>
      <div
        className="import-market-card"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "18px 20px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span
            className="pill"
            style={{
              fontSize: 9,
              fontWeight: 700,
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
            }}
          >
            POLYMARKET
          </span>
          <span style={{ fontSize: 9, color: "var(--text-3)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
            {market.category}
          </span>
        </div>

        <p
          style={{
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
          }}
        >
          {market.question}
        </p>

        <div className="import-market-stats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)", letterSpacing: "0.1em", marginBottom: 4 }}>
              VOLUME
            </p>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
              ${market.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)", letterSpacing: "0.1em", marginBottom: 4 }}>
              ENDS
            </p>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
              {market.endDate.toLocaleDateString()}
            </div>
          </div>
        </div>

        <button
          onClick={() => onImport(market)}
          style={{
            background: "#ffffff",
            color: "#000000",
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: 8,
            padding: "10px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            cursor: "pointer",
          }}
        >
          Import Into VEIL
        </button>
      </div>
    </article>
  );
}

const TABS = ["ALL", "LIVE", "SETTLED"];

export default function MarketList() {
  const { markets, loading, error, refetch } = useMarkets();
  const {
    markets: polymarketFeed,
    loading: polymarketLoading,
    error: polymarketError,
  } = usePolymarketFeed(6);
  const [showCreate, setShowCreate] = useState(false);
  const [createTab, setCreateTab] = useState("custom");
  const [selectedImportMarket, setSelectedImportMarket] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("ALL");
  const [flashMessage, setFlashMessage] = useState("");

  const filtered = markets.filter((market) => {
    if (tab === "LIVE") return market.status === 1;
    if (tab === "SETTLED") return market.status === 3;
    return true;
  });

  const importedConditionIds = new Set(
    markets
      .filter((market) => market.isPolymarket && market.conditionId)
      .map((market) => market.conditionId)
  );

  const importablePolymarkets =
    tab === "ALL"
      ? polymarketFeed.filter((market) => !importedConditionIds.has(market.conditionId))
      : [];

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleOpenCustomCreate = () => {
    setSelectedImportMarket(null);
    setCreateTab("custom");
    setShowCreate(true);
  };

  const handleOpenPolymarketImport = (market = null) => {
    setSelectedImportMarket(market);
    setCreateTab("polymarket");
    setShowCreate(true);
  };

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
    <div className="market-list-root" style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 24px 64px" }}>
      <div className="anim-up" style={{ marginBottom: 32 }}>
        <div className="market-list-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 26, letterSpacing: "-0.01em", marginBottom: 6 }}>
              Prediction Markets
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-2)" }}>
              Private Solana markets with live Polymarket imports and encrypted vote flow until settlement
            </p>
          </div>

          <div className="market-list-actions" style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleRefresh}
              style={{ ...btnBase, padding: "7px 11px", background: "var(--bg-card)", color: "var(--text-2)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-hover)";
                e.currentTarget.style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--text-2)";
              }}
            >
              <RefreshIcon spinning={refreshing} />
            </button>
            <button
              onClick={handleOpenCustomCreate}
              style={{ ...btnBase, padding: "7px 14px", background: "var(--text)", color: "var(--bg)", border: "none", fontWeight: 700 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.88";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              <PlusIcon /> New Market
            </button>
          </div>
        </div>

        {!loading && markets.length > 0 && (
          <div className="market-list-stats" style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            {[
              { k: "Markets", v: markets.length },
              { k: "Stake", v: "Private" },
              { k: "Open", v: markets.filter((market) => market.status === 1).length },
            ].map(({ k, v }) => (
              <div
                key={k}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em" }}>{k.toUpperCase()}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="market-tabs" style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map((tabName) => (
          <button
            key={tabName}
            onClick={() => setTab(tabName)}
            style={{
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === tabName ? "var(--text)" : "transparent"}`,
              padding: "10px 16px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: tab === tabName ? 700 : 500,
              letterSpacing: "0.08em",
              color: tab === tabName ? "var(--text)" : "var(--text-3)",
              cursor: "pointer",
              transition: "all 150ms ease",
              marginBottom: -1,
            }}
          >
            {tabName}
          </button>
        ))}
      </div>

      {flashMessage && (
        <div
          className="anim-in"
          style={{
            marginBottom: 18,
            background: "var(--green-dim)",
            border: "1px solid var(--green-border)",
            borderRadius: 10,
            padding: "12px 16px",
            color: "var(--green)",
            fontSize: 12,
          }}
        >
          {flashMessage}
        </div>
      )}

      {loading && (
        <div className="market-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "18px 20px",
                height: 200,
                animation: `fadeUp 500ms ease ${i * 60}ms both`,
              }}
            >
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

      {error && (
        <div
          style={{
            background: "var(--red-dim)",
            border: "1px solid var(--red-border)",
            borderRadius: 10,
            padding: "12px 16px",
            color: "var(--red)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && importablePolymarkets.length === 0 && (
        <div className="anim-in" style={{ textAlign: "center", padding: "64px 24px" }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, color: "var(--text-2)", marginBottom: 8 }}>
            No {tab !== "ALL" ? tab.toLowerCase() : "importable"} markets yet
          </p>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>
            {tab === "ALL"
              ? "Browse Polymarket markets here and import the ones you want on VEIL"
              : "Switch to ALL to browse markets you can import from Polymarket"}
          </p>
        </div>
      )}

      {!loading && !error && (filtered.length > 0 || importablePolymarkets.length > 0) && (
        <div className="market-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
          {filtered.map((market, index) => (
            <MarketCard key={market.publicKey} market={market} index={index} />
          ))}
          {importablePolymarkets.map((market, index) => (
            <ImportablePolymarketCard
              key={market.conditionId}
              market={market}
              index={filtered.length + index}
              onImport={handleOpenPolymarketImport}
            />
          ))}
        </div>
      )}

      {tab === "ALL" && polymarketError && (
        <div
          style={{
            marginTop: 24,
            background: "var(--red-dim)",
            border: "1px solid var(--red-border)",
            borderRadius: 10,
            padding: "12px 16px",
            color: "var(--red)",
            fontSize: 12,
          }}
        >
          {polymarketError}
        </div>
      )}

      {showCreate && (
        <Suspense fallback={null}>
          <CreateMarketModal
            initialTab={createTab}
            initialSelectedPM={selectedImportMarket}
            onClose={() => setShowCreate(false)}
            onCreated={(result) => {
              setShowCreate(false);
              setSelectedImportMarket(null);
              setCreateTab("custom");
              if (result?.source === "polymarket") {
                setTab("LIVE");
                setFlashMessage(`Imported into VEIL live markets: ${result.question}`);
                window.setTimeout(() => setFlashMessage(""), 5000);
              }
              refetch();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
