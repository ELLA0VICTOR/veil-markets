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
  const [warming, setWarming] = useState(false);
  const intervalRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  const fetchMarkets = useCallback(async () => {
    try {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      setError(null);
      const now = new Date();
      const data = await fetchPolymarketMarkets(limit, 0);

      // Filter out markets that have already ended
      const activeOnly = data
        .filter((m) => m.endDate > now && m.active && !m.closed && !m.resolved)
        .sort((a, b) => b.volume - a.volume);

      cacheMarkets(activeOnly);
      setMarkets(activeOnly);
      setWarming(false);
    } catch {
      const cached = hydrateCachedMarkets(limit);
      if (cached.length > 0) {
        setMarkets(cached);
        setError(null);
        setWarming(false);
      } else {
        setError(null);
        setWarming(true);
        retryTimeoutRef.current = window.setTimeout(fetchMarkets, 4500);
      }
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchMarkets();
    intervalRef.current = setInterval(fetchMarkets, POLL_INTERVAL);
    return () => {
      clearInterval(intervalRef.current);
      if (retryTimeoutRef.current) window.clearTimeout(retryTimeoutRef.current);
    };
  }, [fetchMarkets]);

  return { markets, loading, error, warming, refetch: fetchMarkets };
}
