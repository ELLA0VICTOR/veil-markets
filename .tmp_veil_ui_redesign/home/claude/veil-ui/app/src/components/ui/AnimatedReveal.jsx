import { useState, useEffect, useRef } from "react";

function useCountUp(target, duration = 1800, active = false) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (!active || !target) return;
    const start = Date.now();
    const tick  = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 4); // ease out quart
      setValue(target * e);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, active]);
  return value;
}

function ChainIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M5 8L8 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M5.5 9L4.5 10C3.6 10.9 1.5 10.9 1.5 9L3.5 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 4L8.5 3C9.4 2.1 11.5 2.1 11.5 4L9.5 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function AnimatedReveal({ visible, onClose, totalYes, totalNo, yesWins, isPolymarket, question }) {
  const [phase, setPhase] = useState(0); // 0 hidden | 1 bars | 2 winner

  useEffect(() => {
    if (!visible) { setPhase(0); return; }
    const t1 = setTimeout(() => setPhase(1), 80);
    const t2 = setTimeout(() => setPhase(2), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible]);

  const yesSOL   = totalYes ? Number(totalYes) / 1e9 : 0;
  const noSOL    = totalNo  ? Number(totalNo)  / 1e9 : 0;
  const total    = yesSOL + noSOL;

  const animYes   = useCountUp(yesSOL, 1600, phase >= 1);
  const animNo    = useCountUp(noSOL,  1600, phase >= 1);
  const animTotal = useCountUp(total,  1600, phase >= 1);

  if (!visible) return null;

  const winColor  = yesWins ? "var(--yes-color)" : "var(--no-color)";
  const winLabel  = yesWins ? "YES WINS"         : "NO WINS";
  const winGlow   = yesWins ? "glow-pulse-yes"   : "glow-pulse-no";

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(7,11,20,0.96)", backdropFilter: "blur(24px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 400ms ease both" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 560, padding: "48px 36px", textAlign: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Eyebrow */}
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "var(--text-muted)", marginBottom: 16 }}>
          ENCRYPTED VOTES REVEALED
        </p>

        {/* Question */}
        {question && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 40, maxWidth: 440, margin: "0 auto 40px" }}>
            {question}
          </p>
        )}

        {/* Bars */}
        {phase >= 1 && (
          <div style={{ marginBottom: 36, animation: "count-in 500ms ease both" }}>
            {/* YES bar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--yes-color)", letterSpacing: "0.14em" }}>YES</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, color: "var(--yes-color)", letterSpacing: "-0.01em" }}>
                  {animYes.toFixed(3)} <span style={{ fontSize: 13, opacity: 0.7 }}>SOL</span>
                </span>
              </div>
              <div style={{ height: 7, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #22D3EE, #06B6D4)", width: total > 0 ? `${(yesSOL / total) * 100}%` : "0%", transition: "width 1.8s cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: "0 0 14px rgba(34,211,238,0.45)" }} />
              </div>
            </div>

            {/* NO bar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--no-color)", letterSpacing: "0.14em" }}>NO</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, color: "var(--no-color)", letterSpacing: "-0.01em" }}>
                  {animNo.toFixed(3)} <span style={{ fontSize: 13, opacity: 0.7 }}>SOL</span>
                </span>
              </div>
              <div style={{ height: 7, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #FB7185, #E11D48)", width: total > 0 ? `${(noSOL / total) * 100}%` : "0%", transition: "width 1.8s cubic-bezier(0.16, 1, 0.3, 1) 120ms", boxShadow: "0 0 14px rgba(251,113,133,0.45)" }} />
              </div>
            </div>

            {/* Total */}
            <div style={{ paddingTop: 16, borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.12em" }}>TOTAL PRIZE POOL</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                {animTotal.toFixed(3)} <span style={{ fontSize: 12, color: "var(--text-muted)" }}>SOL</span>
              </span>
            </div>
          </div>
        )}

        {/* Winner */}
        {phase >= 2 && (
          <div style={{ padding: "24px 28px", borderRadius: 16, border: `1px solid ${winColor}`, background: yesWins ? "rgba(34,211,238,0.06)" : "rgba(251,113,133,0.06)", animation: `${winGlow} 2.5s infinite, count-in 400ms ease both`, marginBottom: 24 }}>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 44, letterSpacing: "-0.01em", color: winColor, lineHeight: 1 }}>
              {winLabel}
            </p>
          </div>
        )}

        {/* Oracle */}
        {phase >= 2 && isPolymarket && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 24, animation: "fadeIn 400ms ease both" }}>
            <ChainIcon />
            RESULT VERIFIED BY POLYMARKET ORACLE
          </div>
        )}

        {/* Close */}
        {phase >= 2 && (
          <div style={{ animation: "count-in 400ms ease both" }}>
            <button
              onClick={onClose}
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 9, padding: "10px 28px", fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", cursor: "pointer", transition: "all 150ms ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.color = "var(--accent-bright)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
