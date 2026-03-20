import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "../../hooks/useWallet";

export default function WalletButton() {
  const { connected, connecting, disconnect, shortAddress, balance } = useWallet();
  const { setVisible } = useWalletModal();

  const base = {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    fontWeight: 600,
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 160ms ease",
    display: "flex",
    alignItems: "center",
    gap: 7,
    letterSpacing: "0.03em",
  };

  if (connecting) {
    return (
      <button disabled style={{ ...base, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-2)", padding: "7px 14px", cursor: "not-allowed" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", display: "inline-block", animation: "pulse-dot 1s infinite" }} />
        Connecting…
      </button>
    );
  }

  if (connected) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {balance !== null && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-2)" }}>
            {balance.toFixed(3)} SOL
          </span>
        )}
        <button
          onClick={() => disconnect()}
          style={{ ...base, padding: "7px 13px", background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
          {shortAddress}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      style={{ ...base, padding: "7px 16px", background: "var(--cyan)", color: "#000", fontWeight: 700 }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      Connect
    </button>
  );
}
