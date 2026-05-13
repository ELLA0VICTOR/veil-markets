import { useMemo } from "react";
import { useMarkets } from "../../hooks/useMarkets";
import MarketCard from "../markets/MarketCard";

export default function History() {
  const { markets, loading, error } = useMarkets();
  const historyMarkets = useMemo(
    () =>
      markets
        .filter((market) => market.lifecycle === "history")
        .sort((a, b) => b.endTime.getTime() - a.endTime.getTime()),
    [markets]
  );

  return (
    <main className="page-shell">
      <section className="page-heading anim-up">
        <div>
          <p className="page-kicker">GLOBAL RECORD</p>
          <h1>History</h1>
          <p>
            Resolved VEIL markets are visible here for everyone. Outcomes are public after settlement, while private stake totals remain encrypted.
          </p>
        </div>
      </section>

      {loading && <div className="panel-muted anim-in">Loading resolved markets...</div>}
      {error && <div className="panel-error anim-in">{error}</div>}

      {!loading && !error && historyMarkets.length === 0 && (
        <div className="empty-panel anim-in">
          <h3>No resolved markets yet</h3>
          <p>Settled markets will appear here after resolution.</p>
        </div>
      )}

      {!loading && !error && historyMarkets.length > 0 && (
        <div className="market-grid history-grid">
          {historyMarkets.map((market, index) => (
            <MarketCard key={market.publicKey} market={market} index={index} />
          ))}
        </div>
      )}
    </main>
  );
}
