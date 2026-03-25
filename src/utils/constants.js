export const PROGRAM_ID =
  import.meta.env.VITE_PROGRAM_ID || "CcVVkss7EtMLDpgcC9CMZbz7VadGRqEUTcLgdHeUKdHF";
export const CLUSTER_OFFSET = 456;
export const RPC_ENDPOINT =
  import.meta.env.VITE_RPC_ENDPOINT || "https://api.devnet.solana.com";
export const POLYMARKET_API =
  import.meta.env.VITE_POLYMARKET_API_BASE || "/api/polymarket";
export const BACKEND_API_BASE = (import.meta.env.VITE_BACKEND_API_BASE || "").replace(/\/$/, "");
export const ARCIUM_API_BASE = (
  import.meta.env.VITE_ARCIUM_API_BASE ||
  BACKEND_API_BASE
).replace(/\/$/, "");
export const MIN_BET_SOL = 0.01;
export const DEFAULT_INITIAL_POOL_SOL = 0;
export const MARKET_SEED = "market";
export const VAULT_SEED = "vault";
export const POSITION_SEED = "position";
export const ARCIUM_PROGRAM_ID = "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ";

export function withApiBase(base, path) {
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
