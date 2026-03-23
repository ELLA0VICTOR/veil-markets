import { useState, useEffect, useRef } from "react";

function useCountUp(target, dur = 1600, active = false) {
  const [v, setV] = useState(0);
  const r = useRef(null);
  useEffect(() => {
    if (!active || !target) return;
    const s = Date.now();
    const tick = () => {
      const p = Math.min((Date.now()-s)/dur, 1);
      const e = 1 - Math.pow(1-p, 4);
      setV(target * e);
      if (p < 1) r.current = requestAnimationFrame(tick); else setV(target);
    };
    r.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(r.current);
  }, [target, dur, active]);
  return v;
}

function ChainIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4 8L8 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M4.5 9L3.5 10C2.7 10.8 1 10.8 1 9L3 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 3L8.5 2C9.3 1.2 11 1.2 11 3L9 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function AnimatedReveal({ visible, onClose, totalYes, totalNo, yesWins, isPolymarket, question }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!visible) { setPhase(0); return; }
    const t1 = setTimeout(() => setPhase(1), 80);
    const t2 = setTimeout(() => setPhase(2), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible]);

  const ySOL = totalYes ? Number(totalYes)/1e9 : 0;
  const nSOL = totalNo  ? Number(totalNo)/1e9  : 0;
  const tot  = ySOL + nSOL;
  const aY   = useCountUp(ySOL, 1600, phase >= 1);
  const aN   = useCountUp(nSOL, 1600, phase >= 1);
  const aT   = useCountUp(tot,  1600, phase >= 1);

  if (!visible) return null;

  const wColor = yesWins ? "var(--cyan)" : "var(--red)";
  const wLabel = yesWins ? "YES WINS"   : "NO WINS";
  const wGlow  = yesWins ? "glow-yes"   : "glow-no";

  return (
    <div
      className="animated-reveal-overlay grid-bg"
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 400ms ease both" }}
      onClick={onClose}
    >
      <div className="animated-reveal-card" style={{ width: "100%", maxWidth: 520, padding: "48px 32px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>

        <p style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.22em", marginBottom: 14 }}>ENCRYPTED VOTES REVEALED</p>

        {question && <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 36, maxWidth: 400, margin: "0 auto 36px" }}>{question}</p>}

        {phase >= 1 && (
          <div style={{ marginBottom: 32, animation: "fadeUp 500ms ease both" }}>
            {/* YES */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <span style={{ fontSize: 10, color: "var(--cyan)", letterSpacing: "0.14em" }}>YES</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 22, color: "var(--cyan)" }}>{aY.toFixed(3)} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-3)" }}>SOL</span></span>
              </div>
              <div style={{ height: 5, background: "var(--bg-card)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "var(--cyan)", borderRadius: 99, width: tot > 0 ? `${(ySOL/tot)*100}%` : "0%", transition: "width 1.8s cubic-bezier(0.16,1,0.3,1)" }} />
              </div>
            </div>
            {/* NO */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <span style={{ fontSize: 10, color: "var(--red)", letterSpacing: "0.14em" }}>NO</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 22, color: "var(--red)" }}>{aN.toFixed(3)} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-3)" }}>SOL</span></span>
              </div>
              <div style={{ height: 5, background: "var(--bg-card)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "var(--red)", borderRadius: 99, width: tot > 0 ? `${(nSOL/tot)*100}%` : "0%", transition: "width 1.8s cubic-bezier(0.16,1,0.3,1) 100ms" }} />
              </div>
            </div>
            {/* Total */}
            <div style={{ paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em" }}>TOTAL POOL</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18 }}>{aT.toFixed(3)} <span style={{ fontSize: 11, color: "var(--text-3)" }}>SOL</span></span>
            </div>
          </div>
        )}

        {phase >= 2 && (
          <div style={{ padding: "22px 24px", borderRadius: 14, border: `1px solid ${wColor}`, background: yesWins ? "var(--cyan-dim)" : "var(--red-dim)", animation: `${wGlow} 2.5s infinite, fadeIn 400ms ease both`, marginBottom: 20 }}>
            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 40, letterSpacing: "-0.01em", color: wColor, lineHeight: 1 }}>{wLabel}</p>
          </div>
        )}

        {phase >= 2 && isPolymarket && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 20, animation: "fadeIn 400ms ease both" }}>
            <ChainIcon /> RESULT VERIFIED BY POLYMARKET ORACLE
          </div>
        )}

        {phase >= 2 && (
          <div style={{ animation: "fadeIn 400ms ease both" }}>
            <button onClick={onClose} style={{ background: "var(--text)", border: "none", borderRadius: 8, padding: "10px 28px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--bg)", cursor: "pointer", transition: "opacity 150ms" }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              CONTINUE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
