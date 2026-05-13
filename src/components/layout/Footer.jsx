import { navigate } from "../../utils/navigation";

const PRODUCT_LINKS = [
  { label: "Markets", href: "#/" },
  { label: "Leaderboard", href: "#/leaderboard" },
  { label: "History", href: "#/history" },
  { label: "FAQ", href: "#/faq" },
];

const PRIVACY_POINTS = ["Encrypted stakes", "Private vote direction", "Public final outcomes"];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">VEIL</div>
          <p>
            Private prediction markets on Solana, powered by Arcium MPC for encrypted participation and fair settlement.
          </p>
        </div>

        <div className="footer-col">
          <h3>Product</h3>
          {PRODUCT_LINKS.map((item) => (
            <button key={item.href} type="button" onClick={() => navigate(item.href)}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="footer-col">
          <h3>Privacy</h3>
          {PRIVACY_POINTS.map((point) => (
            <span key={point}>{point}</span>
          ))}
        </div>

        <div className="footer-col">
          <h3>Network</h3>
          <span>Solana Devnet</span>
          <span>Arcium MPC</span>
          <span>Polymarket Imports</span>
        </div>
      </div>
    </footer>
  );
}
