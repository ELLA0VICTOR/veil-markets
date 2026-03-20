function ChainIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M4 7L7 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M4.5 8L3.5 9C2.7 9.8 1 9.8 1 8L3 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.5 3L7.5 2C8.3 1.2 10 1.2 10 3L8 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M6.5 1.5L8.5 3.5L3 9H1V7L6.5 1.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function OracleTag({ isPolymarket }) {
  if (isPolymarket) {
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "var(--accent-dim)",
        color: "var(--accent-bright)",
        border: "1px solid rgba(129, 140, 248, 0.2)",
        borderRadius: 99,
        padding: "3px 8px",
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.07em",
      }}>
        <ChainIcon />
        Polymarket Oracle
      </span>
    );
  }

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      background: "rgba(255,255,255,0.03)",
      color: "var(--text-muted)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 99,
      padding: "3px 8px",
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      letterSpacing: "0.07em",
    }}>
      <PencilIcon />
      Manual
    </span>
  );
}
