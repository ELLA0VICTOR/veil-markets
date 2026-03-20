import { useState, useEffect } from "react";

const pad = (n) => String(n).padStart(2, "0");

export default function CountdownTimer({ endTime, onExpired }) {
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    const compute = () => {
      const ms = new Date(endTime).getTime() - Date.now();
      setDiff(Math.max(0, ms));
      if (ms <= 0 && onExpired) onExpired();
    };
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [endTime, onExpired]);

  if (diff <= 0) {
    return (
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
        Ended
      </span>
    );
  }

  const secs  = Math.floor(diff / 1000);
  const days  = Math.floor(secs / 86400);
  const hrs   = Math.floor((secs % 86400) / 3600);
  const mins  = Math.floor((secs % 3600) / 60);
  const s     = secs % 60;
  const urgent = diff < 3_600_000;

  const color = urgent ? "var(--pending)" : "var(--text-secondary)";

  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color, letterSpacing: "0.04em" }}>
      {days > 0
        ? `${days}d ${pad(hrs)}h ${pad(mins)}m`
        : `${pad(hrs)}:${pad(mins)}:${pad(s)}`}
    </span>
  );
}
