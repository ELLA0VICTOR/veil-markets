const GAMMA_API = "https://gamma-api.polymarket.com";

// Fetch active binary YES/NO markets from Polymarket
export async function fetchPolymarketMarkets(limit = 20, offset = 0) {
  const url = `${GAMMA_API}/markets?active=true&closed=false&limit=${limit}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
  const data = await res.json();

  return data
    .filter((m) => {
      try {
        const outcomes = JSON.parse(m.outcomes || "[]");
        return (
          outcomes.length === 2 &&
          outcomes[0].toLowerCase() === "yes" &&
          outcomes[1].toLowerCase() === "no"
        );
      } catch {
        return false;
      }
    })
    .map(normalizePolymarket);
}

// Fetch a single market by conditionId
export async function fetchPolymarketMarket(conditionId) {
  const res = await fetch(`${GAMMA_API}/markets/${conditionId}`);
  if (!res.ok) throw new Error(`Market not found: ${conditionId}`);
  const data = await res.json();
  return normalizePolymarket(data);
}

// Check resolution status of a Polymarket market
export async function checkPolymarketResolution(conditionId) {
  try {
    const market = await fetchPolymarketMarket(conditionId);
    if (!market.resolved && !market.closed) {
      return {
        resolved: false,
        yesWins: null,
        outcomePrices: market.outcomePrices,
        question: market.question,
      };
    }
    const outcomePrices = JSON.parse(market.outcomePrices || '["0.5","0.5"]');
    const yesPrice = parseFloat(outcomePrices[0]);
    return {
      resolved: true,
      yesWins: yesPrice >= 0.99,
      totalVolume: market.volume,
      outcomePrices: market.outcomePrices,
    };
  } catch (err) {
    throw new Error(`Failed to check resolution: ${err.message}`);
  }
}

// Convert Polymarket conditionId "0xabc..." to [u8; 32] bytes array
export function conditionIdToBytes(conditionId) {
  const hex = conditionId.startsWith("0x")
    ? conditionId.slice(2)
    : conditionId;
  const padded = hex.padEnd(64, "0");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(padded.substr(i * 2, 2), 16);
  }
  return Array.from(bytes);
}

// Convert [u8; 32] bytes back to hex conditionId string
export function bytesToConditionId(bytes) {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

// Check if bytes represent an all-zero conditionId (custom market)
export function isZeroConditionId(bytes) {
  return Array.from(bytes).every((b) => b === 0);
}

// Normalize Polymarket API response to consistent shape
function normalizePolymarket(m) {
  return {
    conditionId: m.conditionId,
    question: m.question,
    slug: m.slug,
    endDate: new Date(m.endDate),
    active: m.active,
    closed: m.closed,
    resolved: m.resolved,
    outcomes: JSON.parse(m.outcomes || '["Yes","No"]'),
    outcomePrices: m.outcomePrices,
    volume: parseFloat(m.volume || "0"),
    liquidity: parseFloat(m.liquidity || "0"),
    category: m.category || "General",
  };
}
