import { useMemo } from "react";
import { useMarkets } from "../../hooks/useMarkets";

function shortAddress(address = "") {
  if (!address) return "Unknown";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function buildLeaderboard(markets) {
  const creatorMap = new Map();

  for (const market of markets) {
    const key = market.creator || "unknown";
    const current = creatorMap.get(key) || {
      address: key,
      markets: 0,
      live: 0,
      settled: 0,
      imported: 0,
      publicBets: 0,
      score: 0,
    };

    const settled = market.lifecycle === "history";
    const live = market.lifecycle === "live";
    const imported = Boolean(market.isPolymarket);
    const publicBets = Number(market.voteCount ?? 0);

    current.markets += 1;
    current.live += live ? 1 : 0;
    current.settled += settled ? 1 : 0;
    current.imported += imported ? 1 : 0;
    current.publicBets += publicBets;
    current.score += 40 + publicBets * 3 + (settled ? 28 : 0) + (imported ? 12 : 0);

    creatorMap.set(key, current);
  }

  return [...creatorMap.values()].sort((a, b) => b.score - a.score);
}

export default function Leaderboard() {
  const { markets, loading, error } = useMarkets();
  const leaders = useMemo(() => buildLeaderboard(markets), [markets]);
  const totalPublicBets = leaders.reduce((sum, leader) => sum + leader.publicBets, 0);

  return (
    <main className="page-shell leaderboard-page">
      <section className="page-heading anim-up">
        <div>
          <p className="page-kicker">PUBLIC ACTIVITY</p>
          <h1>Leaderboard</h1>
          <p>
            Ranked by public market creation, settlement activity, and visible participation counts. Private stake volume is not exposed while markets remain encrypted.
          </p>
        </div>
      </section>

      <section className="leaderboard-stats anim-up" style={{ "--i": 1 }}>
        <div>
          <span>Creators</span>
          <strong>{leaders.length}</strong>
        </div>
        <div>
          <span>Markets</span>
          <strong>{markets.length}</strong>
        </div>
        <div>
          <span>Public bet count</span>
          <strong>{totalPublicBets}</strong>
        </div>
      </section>

      {loading && <div className="panel-muted anim-in">Loading leaderboard...</div>}
      {error && <div className="panel-error anim-in">{error}</div>}

      {!loading && !error && leaders.length === 0 && (
        <div className="empty-panel anim-in">
          <h3>No leaderboard data yet</h3>
          <p>Create markets to start building public reputation without exposing private positions.</p>
        </div>
      )}

      {!loading && !error && leaders.length > 0 && (
        <section className="leaderboard-list">
          {leaders.map((leader, index) => (
            <article className="leaderboard-row anim-up" style={{ "--i": index + 2 }} key={leader.address}>
              <div className="leader-rank">{index + 1}</div>
              <div className="leader-main">
                <h3>{shortAddress(leader.address)}</h3>
                <p>{leader.markets} market{leader.markets === 1 ? "" : "s"} created</p>
              </div>
              <div className="leader-metrics">
                <span>{leader.live} live</span>
                <span>{leader.settled} settled</span>
                <span>{leader.imported} imported</span>
                <span>{leader.publicBets} public bets</span>
              </div>
              <div className="leader-score">{Math.round(leader.score)}</div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
