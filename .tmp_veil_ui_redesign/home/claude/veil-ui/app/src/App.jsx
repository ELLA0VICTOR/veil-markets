import { Suspense, lazy, useState, useEffect } from "react";
import Navbar from "./components/layout/Navbar";

const MarketList = lazy(() => import("./components/markets/MarketList"));
const MarketDetail = lazy(() => import("./components/markets/MarketDetail"));

function useHashRouter() {
  const [path, setPath] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const handler = () => setPath(window.location.hash || "#/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return path;
}

function RouteFallback() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 24px" }}>
      <div className="skeleton" style={{ height: 28, width: "28%", marginBottom: 20 }} />
      <div className="skeleton" style={{ height: 200, width: "100%", borderRadius: 12 }} />
    </main>
  );
}

export default function App() {
  const path = useHashRouter();
  const marketMatch = path.match(/^#\/market\/([A-Za-z0-9]+)$/);

  return (
    <div className="min-h-screen bg-texture" style={{ background: "var(--bg-base)" }}>
      <Navbar />
      <Suspense fallback={<RouteFallback />}>
        {marketMatch ? (
          <MarketDetail marketPubkey={marketMatch[1]} />
        ) : (
          <MarketList />
        )}
      </Suspense>
    </div>
  );
}
