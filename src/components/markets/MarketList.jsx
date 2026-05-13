import { Suspense, lazy, useMemo, useState } from "react";
import { useMarkets } from "../../hooks/useMarkets";
import { usePolymarketFeed } from "../../hooks/usePolymarketFeed";
import MarketCard from "./MarketCard";
import MarketActivityVisual from "../ui/MarketActivityVisual";

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
          <span
            style={{
              fontSize: 9,
              color: "var(--text-3)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.08em",
            }}
          >
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

        <MarketActivityVisual
          seedKey={`${market.conditionId}:${market.endDate.getTime()}:${market.volume}`}
          label="PUBLIC ACTIVITY"
        />

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

const TAB_META = {
  ALL: {
    label: "ALL",
    description: "Live VEIL markets, importable Polymarket opportunities, and resolved outcomes in one dense view.",
    emptyTitle: "No markets yet",
    emptyBody: "Create a market or import a live Polymarket market to populate the feed.",
  },
  LIVE: {
    label: "LIVE",
    description: "Open VEIL markets plus live Polymarket markets that can be imported into VEIL.",
    emptyTitle: "No live markets right now",
    emptyBody: "Create one or import a fresh Polymarket market into VEIL.",
  },
};

function sortLiveMarkets(a, b) {
  if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
  return a.endTime.getTime() - b.endTime.getTime();
}

function sortHistoryMarkets(a, b) {
  return b.endTime.getTime() - a.endTime.getTime();
}

function matchesMarketQuery(market, query) {
  if (!query) return true;
  const text = [
    market.question,
    market.polymarketCategory,
    market.isPolymarket ? "polymarket imported" : "custom native",
    market.lifecycle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes(query);
}

function matchesImportQuery(market, query) {
  if (!query) return true;
  return [market.question, market.category, "polymarket live import"]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function sortMarketsByMode(markets, mode) {
  const next = [...markets];
  switch (mode) {
    case "ending":
      return next.sort((a, b) => a.endTime.getTime() - b.endTime.getTime());
    case "activity":
      return next.sort((a, b) => b.voteCount - a.voteCount);
    case "created":
    default:
      return next.sort((a, b) => {
        if (a.lifecycle !== b.lifecycle) {
          const order = { live: 0, "awaiting-resolution": 1, history: 2 };
          return (order[a.lifecycle] ?? 3) - (order[b.lifecycle] ?? 3);
        }
        return a.endTime.getTime() - b.endTime.getTime();
      });
  }
}

function sortImportableMarkets(markets, mode) {
  const next = [...markets];
  switch (mode) {
    case "activity":
      return next.sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0));
    case "ending":
    case "created":
    default:
      return next.sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
  }
}

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
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("created");
  const [flashMessage, setFlashMessage] = useState("");

  const importedConditionIds = useMemo(
    () =>
      new Set(
        markets
          .filter((market) => market.isPolymarket && market.conditionId)
          .map((market) => market.conditionId)
      ),
    [markets]
  );

  const importablePolymarkets = useMemo(
    () => polymarketFeed.filter((market) => !importedConditionIds.has(market.conditionId)),
    [importedConditionIds, polymarketFeed]
  );

  const liveMarkets = useMemo(
    () =>
      markets
        .filter((market) => market.lifecycle === "live")
        .sort(sortLiveMarkets),
    [markets]
  );

  const historyMarkets = useMemo(
    () =>
      markets
        .filter((market) => market.lifecycle === "history")
        .sort(sortHistoryMarkets),
    [markets]
  );

  const allVisibleMarkets = useMemo(
    () => [...liveMarkets, ...historyMarkets],
    [historyMarkets, liveMarkets]
  );

  const tabConfig = useMemo(
    () => [
      { id: "ALL", count: allVisibleMarkets.length + importablePolymarkets.length },
      { id: "LIVE", count: liveMarkets.length + importablePolymarkets.length },
    ],
    [allVisibleMarkets.length, importablePolymarkets.length, liveMarkets.length]
  );

  const visibleMarkets = allVisibleMarkets.length + importablePolymarkets.length;
  const activeMeta = TAB_META[tab];

  let displayedMarkets = [];

  switch (tab) {
    case "ALL":
      displayedMarkets = allVisibleMarkets;
      break;
    case "LIVE":
    default:
      displayedMarkets = liveMarkets;
      break;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredDisplayedMarkets = sortMarketsByMode(
    displayedMarkets.filter((market) => matchesMarketQuery(market, normalizedQuery)),
    sortMode
  );
  const filteredImportablePolymarkets = sortImportableMarkets(
    importablePolymarkets.filter((market) => matchesImportQuery(market, normalizedQuery)),
    sortMode
  );

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
              Private Solana markets, live Polymarket imports, and public resolved outcomes without exposing encrypted signals.
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
              { k: "Visible", v: visibleMarkets },
              { k: "Live", v: liveMarkets.length + importablePolymarkets.length },
              { k: "Imported", v: markets.filter((market) => market.isPolymarket).length },
              { k: "Resolved", v: historyMarkets.length },
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

      <div className="market-tabs" style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0, flexWrap: "wrap" }}>
        {tabConfig.map(({ id, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === id ? "var(--text)" : "transparent"}`,
              padding: "10px 16px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: tab === id ? 700 : 500,
              letterSpacing: "0.08em",
              color: tab === id ? "var(--text)" : "var(--text-3)",
              cursor: "pointer",
              transition: "all 150ms ease",
              marginBottom: -1,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{TAB_META[id].label}</span>
            <span
              style={{
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "1px 7px",
                fontSize: 10,
                color: tab === id ? "var(--text)" : "var(--text-3)",
              }}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      <div
        style={{
          marginBottom: 18,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 10,
        }}
        className="market-search-row"
      >
        <label className="market-search-box">
          <span>Search markets...</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search markets..."
          />
        </label>
        <select
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value)}
          className="market-sort-select"
          aria-label="Sort markets"
        >
          <option value="created">Sort: Created</option>
          <option value="activity">Sort: Activity</option>
          <option value="ending">Sort: Ending Soon</option>
        </select>
      </div>

      <div
        style={{
          marginBottom: 18,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "12px 14px",
        }}
      >
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.1em", marginBottom: 5 }}>
          {activeMeta.label}
        </p>
        <p style={{ fontSize: 12, color: "var(--text-2)" }}>{activeMeta.description}</p>
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

      {polymarketLoading && !loading && importablePolymarkets.length === 0 && (
        <div
          style={{
            marginBottom: 18,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "12px 16px",
            color: "var(--text-2)",
            fontSize: 12,
          }}
        >
          Loading fresh Polymarket ideas...
        </div>
      )}

      {!loading && !error && filteredDisplayedMarkets.length === 0 && filteredImportablePolymarkets.length === 0 && (
        <div className="anim-in" style={{ textAlign: "center", padding: "64px 24px" }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, color: "var(--text-2)", marginBottom: 8 }}>
            {activeMeta.emptyTitle}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>{activeMeta.emptyBody}</p>
        </div>
      )}

      {!loading && !error && (filteredDisplayedMarkets.length > 0 || filteredImportablePolymarkets.length > 0) && (
        <div className="market-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
          {filteredDisplayedMarkets.map((market, index) => (
            <MarketCard key={market.publicKey} market={market} index={index} />
          ))}
          {filteredImportablePolymarkets.map((market, index) => (
            <ImportablePolymarketCard
              key={market.conditionId}
              market={market}
              index={filteredDisplayedMarkets.length + index}
              onImport={handleOpenPolymarketImport}
            />
          ))}
        </div>
      )}

      {polymarketError && (
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
              setTab("LIVE");
              if (result?.source === "polymarket") {
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
