import WalletButton from "./WalletButton";
import { navigate } from "../../utils/navigation";

function ShieldIcon() {
  return (
    <svg width="13" height="15" viewBox="0 0 13 15" fill="none">
      <path d="M6.5 1L1 3.5V7.5C1 10.538 3.4 13.38 6.5 14C9.6 13.38 12 10.538 12 7.5V3.5L6.5 1Z"
        stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
      <path d="M4 7.5L5.8 9.5L9 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Navbar() {
  return (
    <nav
      className="slide-down"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        background: "rgba(7, 11, 20, 0.82)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Subtle top gradient line */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.35), transparent)",
      }} />

      <div style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "0 28px",
        height: 62,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}>
        {/* Logo */}
        <button
          onClick={() => navigate("#/")}
          className="no-select"
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", gap: 2 }}
        >
          <span style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: "0.22em",
            background: "linear-gradient(135deg, #F1F5F9 0%, #A5B4FC 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            lineHeight: 1,
          }}>
            VEIL
          </span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            letterSpacing: "0.18em",
            color: "var(--text-muted)",
            lineHeight: 1,
          }}>
            ENCRYPTED PREDICTION MARKETS
          </span>
        </button>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* MPC badge */}
          <div
            className="no-select"
            style={{
              display: "none",
              alignItems: "center",
              gap: 5,
              padding: "5px 10px",
              background: "var(--accent-dim)",
              border: "1px solid rgba(129, 140, 248, 0.2)",
              borderRadius: 99,
              color: "var(--accent-bright)",
            }}
          >
            <ShieldIcon />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em" }}>
              ARCIUM MPC
            </span>
          </div>

          <style>{`@media(min-width:640px){.mpc-badge{display:flex!important}}`}</style>
          <div
            className="mpc-badge"
            style={{
              display: "none",
              alignItems: "center",
              gap: 5,
              padding: "5px 10px",
              background: "var(--accent-dim)",
              border: "1px solid rgba(129, 140, 248, 0.2)",
              borderRadius: 99,
              color: "var(--accent-bright)",
            }}
          >
            <ShieldIcon />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em" }}>
              ARCIUM MPC
            </span>
          </div>

          <WalletButton />
        </div>
      </div>
    </nav>
  );
}
