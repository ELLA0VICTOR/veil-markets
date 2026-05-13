import { Suspense, lazy, useState, useEffect } from "react";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";

const MarketList = lazy(() => import("./components/markets/MarketList"));
const MarketDetail = lazy(() => import("./components/markets/MarketDetail"));
const Leaderboard = lazy(() => import("./components/leaderboard/Leaderboard"));
const History = lazy(() => import("./components/history/History"));
const ResolveQueue = lazy(() => import("./components/resolve/ResolveQueue"));
const FAQ = lazy(() => import("./components/faq/FAQ"));

function useHashRouter() {
  const [path, setPath] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const h = () => setPath(window.location.hash || "#/");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return path;
}

function Fallback() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
      <div className="skeleton" style={{ height: 24, width: "30%", marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 180, borderRadius: 12 }} />
    </div>
  );
}

export default function App() {
  const path = useHashRouter();
  const marketMatch = path.match(/^#\/market\/([A-Za-z0-9]+)$/);
  const activePage = marketMatch
    ? "markets"
    : path === "#/leaderboard"
      ? "leaderboard"
      : path === "#/history"
        ? "history"
        : path === "#/resolve"
          ? "resolve"
          : path === "#/faq"
            ? "faq"
            : "markets";

  return (
    <div className="grid-bg" style={{ minHeight: "100vh" }}>
      <Navbar activePage={activePage} />
      <Suspense fallback={<Fallback />}>
        {marketMatch ? (
          <MarketDetail marketPubkey={marketMatch[1]} />
        ) : path === "#/leaderboard" ? (
          <Leaderboard />
        ) : path === "#/history" ? (
          <History />
        ) : path === "#/resolve" ? (
          <ResolveQueue />
        ) : path === "#/faq" ? (
          <FAQ />
        ) : (
          <MarketList />
        )}
      </Suspense>
      <Footer />
    </div>
  );
}
