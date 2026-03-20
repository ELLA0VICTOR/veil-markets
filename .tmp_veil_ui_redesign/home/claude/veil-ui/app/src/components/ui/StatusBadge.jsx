export default function StatusBadge({ status }) {
  const configs = {
    0: { label: "INITIALIZING", bg: "var(--pending-dim)", color: "var(--pending)", border: "var(--pending-border)" },
    1: { label: "LIVE",         bg: "var(--success-dim)",  color: "var(--success)",  border: "rgba(52,211,153,0.25)", dot: true },
    2: { label: "RESOLVING",    bg: "var(--pending-dim)", color: "var(--pending)", border: "var(--pending-border)", blink: true },
    3: { label: "SETTLED",      bg: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "var(--border-subtle)" },
  };

  const cfg = configs[status] ?? configs[0];

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
      borderRadius: 99,
      padding: "3px 9px",
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      letterSpacing: "0.1em",
      fontWeight: 500,
    }}>
      {(cfg.dot || cfg.blink) && (
        <span style={{
          width: 5, height: 5,
          borderRadius: "50%",
          background: cfg.color,
          display: "inline-block",
          animation: cfg.blink ? "pulse-dot 1.2s infinite" : "none",
          flexShrink: 0,
        }} />
      )}
      {cfg.label}
    </span>
  );
}
