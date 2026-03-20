import WalletButton from "./WalletButton";
import { navigate } from "../../utils/navigation";

function ShieldIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
      <path d="M6 1L1 3.5V7C1 10 3.5 12.5 6 13C8.5 12.5 11 10 11 7V3.5L6 1Z"
        stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>
      <path d="M4 7L5.5 8.5L8 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Navbar() {
  return (
    <nav
      className="anim-down"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        borderBottom: "1px solid var(--border)",
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "0 24px",
        height: 58,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        {/* Logo */}
        <button
          onClick={() => navigate("#/")}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
        >
          <div style={{
            width: 28, height: 28,
            border: "1px solid var(--border-hover)",
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--bg-card)",
          }}>
            <ShieldIcon />
          </div>
          <span style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: "0.04em",
            color: "var(--text)",
          }}>
            VEIL
          </span>
        </button>

        {/* Center nav hint */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div className="pill" style={{
            background: "var(--green-dim)",
            border: "1px solid var(--green-border)",
            color: "var(--green)",
            fontSize: 9,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse-dot 1.8s infinite" }} />
            DEVNET
          </div>
          <div className="pill" style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--text-2)",
            fontSize: 9,
          }}>
            <ShieldIcon />
            ARCIUM MPC
          </div>
        </div>

        <WalletButton />
      </div>
    </nav>
  );
}
