import { useState, useEffect } from "react";
const pad = (n) => String(n).padStart(2, "0");

export default function CountdownTimer({ endTime, onExpired }) {
  const [diff, setDiff] = useState(0);
  useEffect(() => {
    const tick = () => {
      const ms = new Date(endTime).getTime() - Date.now();
      setDiff(Math.max(0, ms));
      if (ms <= 0 && onExpired) onExpired();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime, onExpired]);

  if (diff <= 0) return <span style={{ color: "var(--text-3)", fontSize: 12 }}>Ended</span>;

  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const urgent = diff < 3_600_000;

  return (
    <span style={{ color: urgent ? "var(--amber)" : "var(--text-2)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
      {d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(sec)}`}
    </span>
  );
}
