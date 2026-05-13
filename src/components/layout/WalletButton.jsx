import { useEffect, useMemo, useRef, useState } from "react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "../../hooks/useWallet";

function WalletGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M2.2 3.7h8.2c.8 0 1.4.6 1.4 1.4v3.8c0 .8-.6 1.4-1.4 1.4H2.2c-.8 0-1.4-.6-1.4-1.4V5.1c0-.8.6-1.4 1.4-1.4Z" stroke="currentColor" strokeWidth="1.15" />
      <path d="M3.2 3.7 7.9 1.5c.8-.4 1.7.2 1.7 1.1v1.1" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
      <path d="M9.2 7h1.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export default function WalletButton() {
  const { connected, connecting, disconnect, publicKey, balance, wallet, wallets, select } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const address = publicKey?.toBase58() || "";
  const leading = address.slice(0, 4);
  const trailing = address.slice(-4);
  const walletName = wallet?.adapter?.name || "Wallet";

  const availableWallets = useMemo(() => {
    const seen = new Set();
    return wallets.filter(({ adapter, readyState }) => {
      if (seen.has(adapter.name)) return false;
      seen.add(adapter.name);
      return readyState === WalletReadyState.Installed || readyState === WalletReadyState.Loadable;
    });
  }, [wallets]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  const base = {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 160ms ease",
    display: "flex",
    alignItems: "center",
    gap: 7,
    letterSpacing: "0.03em",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03)",
  };

  if (connecting) {
    return (
      <button
        disabled
        style={{
          ...base,
          background: "#050505",
          color: "var(--text-2)",
          padding: "7px 14px",
          cursor: "not-allowed",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--amber)",
            display: "inline-block",
            animation: "pulse-dot 1s infinite",
          }}
        />
        Connecting...
      </button>
    );
  }

  if (connected) {
    return (
      <div className="wallet-connected wallet-web3-connected">
        {balance !== null && (
          <span className="wallet-balance">
            {balance.toFixed(3)} SOL
          </span>
        )}
        <button
          type="button"
          title={`Disconnect ${address}`}
          onClick={() => disconnect()}
          className="wallet-address-control"
          style={{ ...base }}
        >
          <span className="wallet-glyph"><WalletGlyph /></span>
          <span className="wallet-address-text">
            <span>{leading}</span>
            <span className="wallet-address-separator">/</span>
            <span>{trailing}</span>
          </span>
          <span className="wallet-name">{walletName}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-menu-wrap" ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setMenuOpen((open) => !open)}
        style={{ ...base, padding: "7px 16px", background: "#050505", color: "#ffffff", fontWeight: 700 }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        Connect
      </button>

      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            minWidth: 180,
            background: "rgba(8,8,8,0.98)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 8,
            boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
            zIndex: 200,
          }}
        >
          {availableWallets.map(({ adapter }) => (
            <button
              key={adapter.name}
              onClick={() => {
                select(adapter.name);
                setMenuOpen(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                color: "var(--text)",
                border: "1px solid transparent",
                borderRadius: 8,
                padding: "10px 12px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-card)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <span>{adapter.name}</span>
              <span style={{ color: "var(--text-3)", fontSize: 10 }}>Wallet</span>
            </button>
          ))}
          {availableWallets.length === 0 && (
            <div style={{ padding: "10px 12px", color: "var(--text-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
              No supported wallet detected
            </div>
          )}
        </div>
      )}
    </div>
  );
}
