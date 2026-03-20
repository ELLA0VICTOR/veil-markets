function ChainIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M3.5 6.5L6.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M4 7.5L3 8.5C2.2 9.3 0.5 9.3 0.5 7.5L2.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 2.5L7 1.5C7.8 0.7 9.5 0.7 9.5 2.5L7.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M6 1.5L8.5 4L2.5 10H0V7.5L6 1.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function OracleTag({ isPolymarket }) {
  return isPolymarket ? (
    <span className="pill" style={{ background: "var(--cyan-dim)", color: "var(--cyan)", border: "1px solid var(--cyan-border)" }}>
      <ChainIcon /> Polymarket Oracle
    </span>
  ) : (
    <span className="pill" style={{ background: "transparent", color: "var(--text-3)", border: "1px solid var(--border)" }}>
      <PencilIcon /> Manual
    </span>
  );
}
