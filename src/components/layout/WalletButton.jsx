import { useEffect, useMemo, useRef, useState } from "react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "../../hooks/useWallet";

export default function WalletButton() {
  const { connected, connecting, disconnect, shortAddress, balance, wallets, select } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {balance !== null && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-2)" }}>
            {balance.toFixed(3)} SOL
          </span>
        )}
        <button
          onClick={() => disconnect()}
          style={{ ...base, padding: "7px 13px", background: "#050505", color: "#ffffff" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--green)",
              display: "inline-block",
            }}
          />
          {shortAddress}
        </button>
      </div>
    );
  }

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
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
