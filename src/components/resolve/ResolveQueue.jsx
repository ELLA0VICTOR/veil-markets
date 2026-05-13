import { useMemo } from "react";
import { useMarkets } from "../../hooks/useMarkets";
import { useWallet } from "../../hooks/useWallet";
import MarketCard from "../markets/MarketCard";

export default function ResolveQueue() {
  const { markets, loading, error } = useMarkets();
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58();
  const creatorMarkets = useMemo(
    () =>
      walletAddress
        ? markets
            .filter((market) => market.lifecycle === "awaiting-resolution" && market.creator === walletAddress)
            .sort((a, b) => a.endTime.getTime() - b.endTime.getTime())
        : [],
    [markets, walletAddress]
  );

  return (
    <main className="page-shell">
      <section className="page-heading anim-up">
        <div>
          <p className="page-kicker">CREATOR QUEUE</p>
          <h1>Resolve Markets</h1>
          <p>
            Only markets created by the connected wallet appear here. Open a market card to publish the outcome through the private resolution flow.
          </p>
        </div>
      </section>

      {!connected && (
        <div className="panel-muted anim-in">
          Connect the creator wallet to see markets that need resolution.
        </div>
      )}

      {connected && loading && <div className="panel-muted anim-in">Checking your creator queue...</div>}
      {connected && error && <div className="panel-error anim-in">{error}</div>}

      {connected && !loading && !error && creatorMarkets.length === 0 && (
        <div className="empty-panel anim-in">
          <h3>No markets to resolve</h3>
          <p>Your creator-only resolution queue is clear.</p>
        </div>
      )}

      {connected && !loading && !error && creatorMarkets.length > 0 && (
        <div className="market-grid resolve-grid">
          {creatorMarkets.map((market, index) => (
            <MarketCard key={market.publicKey} market={market} index={index} />
          ))}
        </div>
      )}
    </main>
  );
}
