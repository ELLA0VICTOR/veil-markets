import { useState } from "react";
import { usePolymarketFeed } from "../../hooks/usePolymarketFeed";

// Check icon
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function PolymarketBrowser({ selected, onSelect }) {
  const { markets, loading, error } = usePolymarketFeed(30);
  const [search, setSearch] = useState("");

  const filtered = markets.filter(
    (m) =>
      !search ||
      m.question.toLowerCase().includes(search.toLowerCase()) ||
      (m.category || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ height: 36, marginBottom: 10 }} />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "12px 16px", background: "rgba(255,61,61,0.08)", border: "1px solid rgba(255,61,61,0.2)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no-color)" }}>
        Failed to load Polymarket: {error}
      </div>
    );
  }

  return (
    <div>
      <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
        SELECT A POLYMARKET MARKET
      </label>

      {/* Search */}
      <input
        type="text"
        placeholder="Search markets..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 8,
          padding: "8px 12px", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: 13,
          outline: "none", marginBottom: 10,
        }}
        onFocus={(e) => e.target.style.borderColor = "var(--border-accent)"}
        onBlur={(e) => e.target.style.borderColor = "var(--border-default)"}
      />

      {/* Market list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
        {filtered.length === 0 && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
            No markets found
          </p>
        )}
        {filtered.map((m) => {
          const isSelected = selected?.conditionId === m.conditionId;
          return (
            <button
              key={m.conditionId}
              onClick={() => onSelect(m)}
              style={{
                background: isSelected ? "var(--accent-dim)" : "var(--bg-surface)",
                border: `1px solid ${isSelected ? "var(--border-accent)" : "var(--border-default)"}`,
                borderRadius: 8, padding: "10px 12px",
                textAlign: "left", cursor: "pointer", transition: "all 150ms ease",
                display: "flex", alignItems: "flex-start", gap: 10,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "var(--border-accent)";
                  e.currentTarget.style.background = "rgba(163,255,18,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.background = "var(--bg-surface)";
                }
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: isSelected ? "var(--accent)" : "var(--text-primary)", lineHeight: 1.4, marginBottom: 4 }}>
                  {m.question}
                </p>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {m.category && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                      {m.category}
                    </span>
                  )}
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
                    Vol: ${m.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
                    Ends {m.endDate.toLocaleDateString()}
                  </span>
                </div>
              </div>
              {isSelected && (
                <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}>
                  <CheckIcon />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected preview */}
      {selected && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--accent-dim)", border: "1px solid var(--border-accent)", borderRadius: 8 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.08em", marginBottom: 4 }}>SELECTED</p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4 }}>{selected.question}</p>
        </div>
      )}
    </div>
  );
}
