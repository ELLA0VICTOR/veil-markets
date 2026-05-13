import WalletButton from "./WalletButton";
import { navigate } from "../../utils/navigation";
import { useMarkets } from "../../hooks/useMarkets";
import { useWallet } from "../../hooks/useWallet";

function MarketIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 11.5h10" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M3 10.5V7.4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M6.1 10.5V4.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M9.2 10.5V6.3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M12 10.5V3.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path
        d="M2.8 5.4 5.4 3.9 8.4 5.15 11.2 2.7"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 2.55H11.95V4.3"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const NAV_ITEMS = [
  { id: "markets", label: "Markets", href: "#/" },
  { id: "leaderboard", label: "Leaderboard", href: "#/leaderboard" },
  { id: "history", label: "History", href: "#/history" },
  { id: "faq", label: "FAQ", href: "#/faq" },
];

export default function Navbar({ activePage = "markets" }) {
  const { markets } = useMarkets();
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();
  const resolveCount = walletAddress
    ? markets.filter((market) => market.lifecycle === "awaiting-resolution" && market.creator === walletAddress).length
    : 0;
  const navItems = resolveCount > 0
    ? [
        ...NAV_ITEMS.slice(0, 3),
        { id: "resolve", label: `Resolve ${resolveCount}`, href: "#/resolve" },
        ...NAV_ITEMS.slice(3),
      ]
    : NAV_ITEMS;

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
      <div
        className="nav-inner"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => navigate("#/")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              border: "1px solid var(--border-hover)",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg-card)",
              color: "var(--text)",
            }}
          >
            <MarketIcon />
          </div>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "0.04em",
              color: "var(--text)",
            }}
          >
            VEIL
          </span>
        </button>

        <div className="nav-center" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.href)}
              className={activePage === item.id ? "top-route-tab is-active" : "top-route-tab"}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="nav-wallet">
          <WalletButton />
        </div>
      </div>
    </nav>
  );
}
