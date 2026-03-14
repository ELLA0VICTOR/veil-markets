import { useState, useEffect } from "react";

function pad(n) {
  return String(n).padStart(2, "0");
}

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

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return (
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
        {days}d {pad(hours)}h {pad(minutes)}m
      </span>
    );
  }

  const isUrgent = diff < 3600_000; // < 1 hour

  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: isUrgent ? "var(--pending)" : "var(--text-secondary)",
      }}
    >
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}
