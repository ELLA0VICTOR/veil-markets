export default function StatusBadge({ status }) {
  const map = {
    0: { label: "INIT",      bg: "var(--amber-dim)",  color: "var(--amber)", border: "var(--amber-border)" },
    1: { label: "LIVE",      bg: "var(--green-dim)",  color: "var(--green)", border: "var(--green-border)", dot: true },
    2: { label: "RESOLVING", bg: "var(--amber-dim)",  color: "var(--amber)", border: "var(--amber-border)", blink: true },
    3: { label: "SETTLED",   bg: "transparent",        color: "var(--text-3)", border: "var(--border)" },
  };
  const c = map[status] ?? map[0];
  return (
    <span className="pill" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {(c.dot || c.blink) && (
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.color, display: "inline-block", flexShrink: 0, animation: c.blink ? "pulse-dot 1.2s infinite" : "none" }} />
      )}
      {c.label}
    </span>
  );
}
