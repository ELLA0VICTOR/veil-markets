const GAMMA_API =
  import.meta.env.VITE_POLYMARKET_API_BASE || "/api/polymarket";
const DIRECT_GAMMA_API = "https://gamma-api.polymarket.com";
const POLYMARKET_TIMEOUT_MS = Number(import.meta.env.VITE_POLYMARKET_TIMEOUT_MS || 4500);
const DISABLE_DIRECT_FALLBACK =
  import.meta.env.VITE_DISABLE_DIRECT_POLYMARKET_FALLBACK === "true";

function joinUrl(base, path) {
  return `${base.replace(/\/$/, "")}${path}`;
}

async function fetchJson(base, path, timeoutMs = POLYMARKET_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(joinUrl(base, path), { signal: controller.signal });
    if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Polymarket API timed out");
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchPolymarketJson(path) {
  try {
    return await fetchJson(GAMMA_API, path);
  } catch (err) {
    const alreadyDirect = GAMMA_API.includes("gamma-api.polymarket.com");
    if (DISABLE_DIRECT_FALLBACK || alreadyDirect) throw err;
    return fetchJson(DIRECT_GAMMA_API, path, 6500);
  }
}

// Fetch active binary YES/NO markets from Polymarket
export async function fetchPolymarketMarkets(limit = 20, offset = 0) {
  const data = await fetchPolymarketJson(
    `/markets?active=true&closed=false&limit=${limit}&offset=${offset}`
  );

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
    .map(normalizePolymarket)
    .filter((m) => m.conditionId);
}

// Fetch a single market by conditionId
export async function fetchPolymarketMarket(conditionId) {
  const data = await fetchPolymarketJson(
    `/markets?condition_ids=${encodeURIComponent(conditionId)}`
  );
  const market = Array.isArray(data) ? data[0] : data;
  if (!market) throw new Error(`Market not found: ${conditionId}`);
  const normalized = normalizePolymarket(market);
  if (!normalized.conditionId) {
    throw new Error(`Market missing condition id: ${conditionId}`);
  }
  return normalized;
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
  if (!conditionId) {
    return Array.from(new Uint8Array(32));
  }
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
  const safeQuestion = typeof m.question === "string" && m.question.trim()
    ? m.question
    : "Untitled market";
  const safeConditionId = typeof m.conditionId === "string" ? m.conditionId : null;
  const parsedEndDate = m.endDate ? new Date(m.endDate) : null;
  const safeEndDate =
    parsedEndDate && !Number.isNaN(parsedEndDate.getTime())
      ? parsedEndDate
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

  return {
    conditionId: safeConditionId,
    question: safeQuestion,
    slug: m.slug || safeQuestion.toLowerCase().replace(/\s+/g, "-"),
    endDate: safeEndDate,
    active: Boolean(m.active),
    closed: Boolean(m.closed),
    resolved: Boolean(m.resolved),
    outcomes: JSON.parse(m.outcomes || '["Yes","No"]'),
    outcomePrices: m.outcomePrices,
    volume: parseFloat(m.volume || "0"),
    liquidity: parseFloat(m.liquidity || "0"),
    category: m.category || "General",
  };
}
