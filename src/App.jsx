import { useState, useEffect } from "react";
import Navbar from "./components/layout/Navbar";
import MarketList from "./components/markets/MarketList";
import MarketDetail from "./components/markets/MarketDetail";

// Simple hash-based router (no react-router dependency)
function useHashRouter() {
  const [path, setPath] = useState(() => window.location.hash || "#/");

  useEffect(() => {
    const handler = () => setPath(window.location.hash || "#/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  return path;
}

export default function App() {
  const path = useHashRouter();

  // Route: #/market/:pubkey
  const marketMatch = path.match(/^#\/market\/([A-Za-z0-9]+)$/);

  return (
    <div className="min-h-screen dot-grid" style={{ background: "var(--bg-base)" }}>
      <Navbar />
      <main>
        {marketMatch ? (
          <MarketDetail marketPubkey={marketMatch[1]} />
        ) : (
          <MarketList />
        )}
      </main>
    </div>
  );
}
