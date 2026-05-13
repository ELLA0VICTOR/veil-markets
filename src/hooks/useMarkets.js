import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { decodeQuestion } from "../utils/solana";
import { bytesToConditionId, isZeroConditionId, fetchPolymarketMarket } from "../utils/polymarket";
import { createReadonlyProvider, createVeilProgram, fetchAllDecodableAccounts } from "../utils/program";

const POLL_INTERVAL = 15_000;

function getMarketLifecycle(status, endTime, resultPublished) {
  const endMs = endTime.getTime();
  const hasEnded = Date.now() >= endMs;

  if (status === 3 || resultPublished) return "history";
  if (status === 2) return "awaiting-resolution";
  if (hasEnded) return "awaiting-resolution";
  return "live";
}

export function useMarkets() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchMarkets = useCallback(async () => {
    try {
      // Use a read-only provider if no wallet connected
      const provider = wallet
        ? new AnchorProvider(connection, wallet, { commitment: "confirmed" })
        : createReadonlyProvider(connection);

      const program = createVeilProgram(provider);

      const allAccounts = await fetchAllDecodableAccounts(program, "market");

      const enriched = await Promise.allSettled(
        allAccounts.map(async ({ publicKey, account }) => {
          const conditionIdBytes = account.polymarketConditionId;
          const isPolymarket = account.isPolymarket;
          let polymarketData = null;

          // For Polymarket markets, enrich with live data
          if (isPolymarket && !isZeroConditionId(conditionIdBytes)) {
            try {
              const conditionId = bytesToConditionId(conditionIdBytes);
              polymarketData = await fetchPolymarketMarket(conditionId);
            } catch {
              // silently fail — use on-chain data only
            }
          }

          return {
            publicKey: publicKey.toBase58(),
            creator: account.creator.toBase58(),
            question: polymarketData?.question || decodeQuestion(account.question),
            endTime: new Date(account.endTime.toNumber() * 1000),
            status: account.status,
            isPolymarket,
            conditionId: isPolymarket ? bytesToConditionId(conditionIdBytes) : null,
            voteCount: account.voteCount,
            yesWins: account.yesWins,
            resultPublished: account.resultPublished,
            stateNonce: account.stateNonce,
            stateCtYes: account.stateCtYes,
            stateCtNo: account.stateCtNo,
            resolvedNonce: account.resolvedNonce,
            resolvedCtTotalYes: account.resolvedCtTotalYes,
            resolvedCtTotalNo: account.resolvedCtTotalNo,
            resolvedCtYesWins: account.resolvedCtYesWins,
            // Polymarket live data if available
            polymarketPrices: polymarketData?.outcomePrices || null,
            polymarketVolume: polymarketData?.volume || null,
            polymarketCategory: polymarketData?.category || null,
          };
        })
      );

      const validMarkets = enriched
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value)
        .map((market) => ({
          ...market,
          lifecycle: getMarketLifecycle(market.status, market.endTime, market.resultPublished),
        }))
        .sort((a, b) => {
          if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
          return a.endTime.getTime() - b.endTime.getTime();
        });

      setMarkets(validMarkets);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to fetch markets");
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    fetchMarkets();
    intervalRef.current = setInterval(fetchMarkets, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchMarkets]);

  return { markets, loading, error, refetch: fetchMarkets };
}
