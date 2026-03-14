export default function StatusBadge({ status }) {
  const configs = {
    0: {
      label: "INITIALIZING",
      bg: "var(--pending-dim)",
      color: "var(--pending)",
      border: "rgba(255,176,23,0.2)",
    },
    1: {
      label: "OPEN",
      bg: "var(--accent-dim)",
      color: "var(--accent)",
      border: "rgba(163,255,18,0.2)",
      dot: true,
    },
    2: {
      label: "RESOLVING",
      bg: "var(--pending-dim)",
      color: "var(--pending)",
      border: "rgba(255,176,23,0.2)",
      blink: true,
    },
    3: {
      label: "SETTLED",
      bg: "rgba(255,255,255,0.05)",
      color: "var(--text-secondary)",
      border: "rgba(255,255,255,0.08)",
    },
  };

  const cfg = configs[status] || configs[0];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        borderRadius: 20,
        padding: "3px 10px",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.08em",
        fontWeight: 500,
      }}
    >
      {(cfg.dot || cfg.blink) && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: cfg.color,
            display: "inline-block",
            animation: cfg.blink ? "blink 1.2s infinite" : "none",
          }}
        />
      )}
      {cfg.label}
    </span>
  );
}
