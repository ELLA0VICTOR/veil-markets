import { useState } from "react";
import { usePolymarketFeed } from "../../hooks/usePolymarketFeed";

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2.5 6.5L5 9.5L10.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}>
      <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8.5 8.5L11.5 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

export default function PolymarketBrowser({ selected, onSelect }) {
  const { markets, loading, error } = usePolymarketFeed(30);
  const [search, setSearch] = useState("");

  const filtered = markets.filter((m) =>
    !search ||
    m.question.toLowerCase().includes(search.toLowerCase()) ||
    (m.category || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="skeleton" style={{ height: 38 }} />
      {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 64 }} />)}
    </div>
  );

  if (error) return (
    <div style={{ padding: "12px 14px", background: "var(--no-dim)", border: "1px solid var(--no-border)", borderRadius: 9, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--no-color)" }}>
      Failed to load Polymarket: {error}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.14em" }}>
        SELECT A MARKET
      </p>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <SearchIcon />
        <input
          type="text"
          placeholder="Search markets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            background: "var(--bg-base)",
            border: "1px solid var(--border-default)",
            borderRadius: 9,
            padding: "9px 12px 9px 32px",
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            outline: "none",
          }}
          onFocus={(e)  => e.target.style.borderColor = "var(--border-accent)"}
          onBlur={(e)   => e.target.style.borderColor = "var(--border-default)"}
        />
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 264, overflowY: "auto" }}>
        {filtered.length === 0 && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
            No markets found
          </p>
        )}
        {filtered.map((m) => {
          const sel = selected?.conditionId === m.conditionId;
          return (
            <button
              key={m.conditionId}
              onClick={() => onSelect(m)}
              style={{
                background: sel ? "var(--accent-dim)" : "var(--bg-base)",
                border: `1px solid ${sel ? "rgba(129,140,248,0.3)" : "var(--border-subtle)"}`,
                borderRadius: 9,
                padding: "10px 12px",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 150ms ease",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
              onMouseEnter={(e) => { if (!sel) { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.background = "var(--bg-surface)"; } }}
              onMouseLeave={(e) => { if (!sel) { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.background = "var(--bg-base)"; } }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: sel ? "var(--accent-bright)" : "var(--text-primary)", lineHeight: 1.45, marginBottom: 5 }}>
                  {m.question}
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {m.category && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>{m.category}</span>
                  )}
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
                    ${m.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })} vol
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
                    {m.endDate.toLocaleDateString()}
                  </span>
                </div>
              </div>
              {sel && <span style={{ color: "var(--accent-bright)", flexShrink: 0, marginTop: 1 }}><CheckIcon /></span>}
            </button>
          );
        })}
      </div>

      {selected && (
        <div style={{ padding: "10px 13px", background: "var(--accent-dim)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: 9 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent-bright)", letterSpacing: "0.1em", marginBottom: 4 }}>SELECTED</p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-primary)", lineHeight: 1.4 }}>{selected.question}</p>
        </div>
      )}
    </div>
  );
}
