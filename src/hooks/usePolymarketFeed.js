import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPolymarketMarkets } from "../utils/polymarket";

const POLL_INTERVAL = 60_000;
const CACHE_KEY = "veil.polymarketFeed";
const CACHE_TTL_MS = 20 * 60 * 1000;

function hydrateCachedMarkets(limit) {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const cached = JSON.parse(raw);
    if (!cached?.savedAt || Date.now() - cached.savedAt > CACHE_TTL_MS) return [];
    return cached.markets
      .map((market) => ({ ...market, endDate: new Date(market.endDate) }))
      .filter((market) => market.endDate > new Date())
      .slice(0, limit);
  } catch {
    return [];
  }
}

function cacheMarkets(markets) {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        markets: markets.map((market) => ({
          ...market,
          endDate: market.endDate.toISOString(),
        })),
      })
    );
  } catch {
    // Cache is a speed boost only; ignore storage failures.
  }
}

export function usePolymarketFeed(limit = 20) {
  const [markets, setMarkets] = useState(() => hydrateCachedMarkets(limit));
  const [loading, setLoading] = useState(() => hydrateCachedMarkets(limit).length === 0);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchMarkets = useCallback(async () => {
    try {
      setError(null);
      const now = new Date();
      const data = await fetchPolymarketMarkets(limit, 0);

      // Filter out markets that have already ended
      const activeOnly = data
        .filter((m) => m.endDate > now && m.active && !m.closed && !m.resolved)
        .sort((a, b) => b.volume - a.volume);

      cacheMarkets(activeOnly);
      setMarkets(activeOnly);
    } catch (err) {
      const cached = hydrateCachedMarkets(limit);
      if (cached.length > 0) {
        setMarkets(cached);
        setError(null);
      } else {
        setError(err.message || "Failed to fetch Polymarket markets");
      }
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchMarkets();
    intervalRef.current = setInterval(fetchMarkets, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchMarkets]);

  return { markets, loading, error, refetch: fetchMarkets };
}
