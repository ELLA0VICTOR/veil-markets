import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "../../hooks/useWallet";

export default function WalletButton() {
  const { connected, connecting, disconnect, shortAddress, balance } = useWallet();
  const { setVisible } = useWalletModal();

  const baseBtn = {
    borderRadius: 10,
    fontFamily: "var(--font-body)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 180ms ease",
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "none",
    outline: "none",
  };

  if (connecting) {
    return (
      <button disabled style={{ ...baseBtn, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", padding: "8px 16px", color: "var(--text-secondary)", cursor: "not-allowed" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pending)", display: "inline-block", animation: "pulse-dot 1.2s infinite" }} />
        Connecting…
      </button>
    );
  }

  if (connected) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {balance !== null && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
            {balance.toFixed(3)} <span style={{ color: "var(--text-muted)" }}>SOL</span>
          </span>
        )}
        <button
          onClick={() => disconnect()}
          style={{
            ...baseBtn,
            padding: "7px 13px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            color: "var(--accent-bright)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-accent)";
            e.currentTarget.style.background = "var(--accent-dim)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-default)";
            e.currentTarget.style.background = "var(--bg-elevated)";
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{shortAddress}</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      style={{
        ...baseBtn,
        padding: "8px 18px",
        background: "linear-gradient(135deg, #818CF8, #6366F1)",
        color: "#fff",
        boxShadow: "0 2px 12px rgba(129, 140, 248, 0.3)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(129, 140, 248, 0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 12px rgba(129, 140, 248, 0.3)";
      }}
    >
      Connect Wallet
    </button>
  );
}
