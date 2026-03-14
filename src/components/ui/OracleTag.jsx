// Chain link SVG icon
function ChainIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 7.5L7.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M5.5 8.5L4.5 9.5C3.395 10.605 1.5 10.5 1.5 8.5L3.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.5 3.5L7.5 2.5C8.605 1.395 10.5 1.5 10.5 3.5L8.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Pencil SVG icon for manual
function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.5 1.5L9.5 3.5L3.5 9.5H1.5V7.5L7.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function OracleTag({ isPolymarket }) {
  if (isPolymarket) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          background: "var(--accent-dim)",
          color: "var(--accent)",
          border: "1px solid rgba(163,255,18,0.18)",
          borderRadius: 20,
          padding: "3px 8px",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.06em",
          fontWeight: 500,
        }}
      >
        <ChainIcon />
        Polymarket Oracle
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "rgba(255,255,255,0.04)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 20,
        padding: "3px 8px",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.06em",
      }}
    >
      <PencilIcon />
      Manual
    </span>
  );
}
