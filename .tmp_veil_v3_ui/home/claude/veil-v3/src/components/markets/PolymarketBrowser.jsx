import { useState } from "react";
import { usePolymarketFeed } from "../../hooks/usePolymarketFeed";

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none" }}>
      <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7.5 7.5L10.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export default function PolymarketBrowser({ selected, onSelect }) {
  const { markets, loading, error } = usePolymarketFeed(30);
  const [search, setSearch] = useState("");

  const filtered = markets.filter((m) =>
    !search || m.question.toLowerCase().includes(search.toLowerCase()) ||
    (m.category||"").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div className="skeleton" style={{ height: 36 }} />
      {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
    </div>
  );
  if (error) return (
    <div style={{ padding: "10px 12px", background: "var(--red-dim)", border: "1px solid var(--red-border)", borderRadius: 8, fontSize: 11, color: "var(--red)" }}>
      {error}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em" }}>SELECT A MARKET</p>
      <div style={{ position: "relative" }}>
        <SearchIcon />
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px 8px 28px", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12, outline: "none" }}
          onFocus={(e) => e.target.style.borderColor = "var(--border-focus)"}
          onBlur={(e)  => e.target.style.borderColor = "var(--border)"}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 256, overflowY: "auto" }}>
        {filtered.length === 0 && <p style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 0" }}>No markets found</p>}
        {filtered.map((m) => {
          const sel = selected?.conditionId === m.conditionId;
          return (
            <button key={m.conditionId} onClick={() => onSelect(m)} style={{
              background: sel ? "var(--bg-active)" : "var(--bg-input)",
              border: `1px solid ${sel ? "var(--border-hover)" : "var(--border)"}`,
              borderRadius: 8, padding: "9px 11px", textAlign: "left", cursor: "pointer", transition: "all 140ms",
            }}
              onMouseEnter={(e) => { if (!sel) e.currentTarget.style.borderColor = "var(--border-hover)"; }}
              onMouseLeave={(e) => { if (!sel) e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text)", lineHeight: 1.4, marginBottom: 4 }}>{m.question}</p>
              <div style={{ display: "flex", gap: 10 }}>
                {m.category && <span style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.07em" }}>{m.category}</span>}
                <span style={{ fontSize: 9, color: "var(--text-3)" }}>${m.volume.toLocaleString(undefined,{maximumFractionDigits:0})} vol</span>
                <span style={{ fontSize: 9, color: "var(--text-3)" }}>{m.endDate.toLocaleDateString()}</span>
              </div>
            </button>
          );
        })}
      </div>
      {selected && (
        <div style={{ padding: "9px 11px", background: "var(--bg-active)", border: "1px solid var(--border-hover)", borderRadius: 8 }}>
          <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.1em", marginBottom: 4 }}>SELECTED</p>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>{selected.question}</p>
        </div>
      )}
    </div>
  );
}
