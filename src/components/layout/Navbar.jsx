import WalletButton from "./WalletButton";
import { navigate } from "../../utils/navigation";

// Lock SVG icon
function LockIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="7" width="10" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M4 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="7" cy="11.5" r="1" fill="currentColor"/>
    </svg>
  );
}

export default function Navbar() {
  return (
    <nav
      style={{
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        background: "rgba(7,7,7,0.85)",
        borderBottom: "1px solid var(--border-subtle)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
      className="slide-down"
    >
      <div
        style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}
        className="flex items-center justify-between h-16"
      >
        {/* Logo */}
        <button
          onClick={() => navigate("#/")}
          className="flex flex-col items-start gap-0 no-select"
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: "0.25em",
              color: "var(--text-primary)",
              lineHeight: 1,
            }}
          >
            VEIL
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.15em",
              color: "var(--text-muted)",
              lineHeight: 1,
              marginTop: 3,
            }}
          >
            ENCRYPTED PREDICTION MARKETS
          </span>
        </button>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Encrypted badge */}
          <div
            className="hidden sm:flex items-center gap-1.5"
            style={{
              background: "rgba(163, 255, 18, 0.06)",
              border: "1px solid rgba(163,255,18,0.15)",
              borderRadius: 6,
              padding: "5px 10px",
              color: "var(--accent)",
            }}
          >
            <LockIcon />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
              }}
            >
              MPC ENCRYPTED
            </span>
          </div>

          <WalletButton />
        </div>
      </div>
    </nav>
  );
}
