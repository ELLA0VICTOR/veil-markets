import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "../../hooks/useWallet";

export default function WalletButton() {
  const { connected, connecting, disconnect, shortAddress, balance } = useWallet();
  const { setVisible } = useWalletModal();

  if (connecting) {
    return (
      <button
        disabled
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 8,
          padding: "8px 16px",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          color: "var(--text-secondary)",
          cursor: "not-allowed",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--pending)",
            animation: "blink 1s infinite",
            display: "inline-block",
          }}
        />
        Connecting...
      </button>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        {balance !== null && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            {balance.toFixed(3)} SOL
          </span>
        )}
        <button
          onClick={() => disconnect()}
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: "8px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--accent)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 150ms ease",
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
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "inline-block",
            }}
          />
          {shortAddress}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      style={{
        background: "var(--accent)",
        border: "none",
        borderRadius: 8,
        padding: "9px 18px",
        fontFamily: "var(--font-body)",
        fontSize: 14,
        fontWeight: 500,
        color: "#070707",
        cursor: "pointer",
        transition: "all 150ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.88";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      Connect Wallet
    </button>
  );
}
