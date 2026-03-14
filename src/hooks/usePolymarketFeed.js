import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPolymarketMarkets } from "../utils/polymarket";

const POLL_INTERVAL = 60_000;

export function usePolymarketFeed(limit = 20) {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
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

      setMarkets(activeOnly);
    } catch (err) {
      setError(err.message || "Failed to fetch Polymarket markets");
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
