import { useState, useEffect, useRef } from "react";

function useCountUp(target, duration = 2000, active = false) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active || !target) return;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, active]);

  return value;
}

// Chain link SVG icon
function ChainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.5 8.5L8.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6.5 9.5L5.5 10.5A2.828 2.828 0 011.5 6.5L3.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 4.5L8.5 3.5A2.828 2.828 0 0112.5 7.5L10.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function AnimatedReveal({
  visible,
  onClose,
  totalYes,      // BigInt lamports
  totalNo,       // BigInt lamports
  yesWins,       // boolean
  isPolymarket,  // boolean
  question,
}) {
  const [phase, setPhase] = useState(0); // 0=hidden, 1=bars, 2=winner

  useEffect(() => {
    if (!visible) {
      const reset = setTimeout(() => setPhase(0), 0);
      return () => clearTimeout(reset);
    }
    const reset = setTimeout(() => setPhase(0), 0);
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 2500);
    return () => {
      clearTimeout(reset);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible]);

  const yesSOL = totalYes ? Number(totalYes) / 1e9 : 0;
  const noSOL = totalNo ? Number(totalNo) / 1e9 : 0;
  const totalSOL = yesSOL + noSOL;

  const animatedYes = useCountUp(yesSOL, 1800, phase >= 1);
  const animatedNo = useCountUp(noSOL, 1800, phase >= 1);
  const animatedTotal = useCountUp(totalSOL, 1800, phase >= 1);

  if (!visible) return null;

  const winnerColor = yesWins ? "var(--yes-color)" : "var(--no-color)";
  const winnerLabel = yesWins ? "YES WINS" : "NO WINS";
  const winnerGlowAnim = yesWins ? "pulse-glow-yes 2s infinite" : "pulse-glow-no 2s infinite";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(7,7,7,0.97)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(20px)",
        animation: "fadeIn 400ms ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          padding: "48px 32px",
          textAlign: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "var(--text-muted)",
            marginBottom: 12,
          }}
        >
          ENCRYPTED VOTES REVEALED
        </p>

        {/* Question */}
        {question && (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 40,
              lineHeight: 1.5,
            }}
          >
            {question}
          </p>
        )}

        {/* Bars */}
        {phase >= 1 && (
          <div style={{ marginBottom: 40 }}>
            {/* YES */}
            <div style={{ marginBottom: 24 }}>
              <div className="flex justify-between items-end" style={{ marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    color: "var(--yes-color)",
                  }}
                >
                  YES
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 22,
                    color: "var(--yes-color)",
                    animation: "count-up 600ms ease-out",
                  }}
                >
                  {animatedYes.toFixed(3)} SOL
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: "var(--bg-elevated)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 4,
                    background: "var(--yes-color)",
                    width: totalSOL > 0 ? `${(yesSOL / totalSOL) * 100}%` : "0%",
                    transition: "width 2s cubic-bezier(0.16, 1, 0.3, 1)",
                    boxShadow: "0 0 12px rgba(0,180,255,0.4)",
                  }}
                />
              </div>
            </div>

            {/* NO */}
            <div>
              <div className="flex justify-between items-end" style={{ marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    color: "var(--no-color)",
                  }}
                >
                  NO
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 22,
                    color: "var(--no-color)",
                    animation: "count-up 600ms ease-out 200ms both",
                  }}
                >
                  {animatedNo.toFixed(3)} SOL
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: "var(--bg-elevated)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 4,
                    background: "var(--no-color)",
                    width: totalSOL > 0 ? `${(noSOL / totalSOL) * 100}%` : "0%",
                    transition: "width 2s cubic-bezier(0.16, 1, 0.3, 1) 200ms",
                    boxShadow: "0 0 12px rgba(255,61,61,0.4)",
                  }}
                />
              </div>
            </div>

            {/* Total */}
            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
                TOTAL POOL
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--text-primary)" }}>
                {animatedTotal.toFixed(3)} SOL
              </span>
            </div>
          </div>
        )}

        {/* Winner reveal */}
        {phase >= 2 && (
          <div
            style={{
              padding: "24px 32px",
              borderRadius: 16,
              border: `2px solid ${winnerColor}`,
              background: yesWins ? "var(--yes-dim)" : "var(--no-dim)",
              animation: `${winnerGlowAnim}, fadeIn 400ms ease-out`,
              marginBottom: 24,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 40,
                color: winnerColor,
                letterSpacing: "0.1em",
              }}
            >
              {winnerLabel}
            </p>
          </div>
        )}

        {/* Oracle attribution */}
        {phase >= 2 && isPolymarket && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
              marginBottom: 24,
              animation: "fadeIn 400ms ease-out",
            }}
          >
            <ChainIcon />
            RESULT VERIFIED BY POLYMARKET ORACLE
          </div>
        )}

        {/* Close */}
        {phase >= 2 && (
          <div style={{ animation: "fadeIn 400ms ease-out" }}>
            <button
              onClick={onClose}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                padding: "10px 24px",
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-accent)";
                e.currentTarget.style.color = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-default)";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
