const STORAGE_KEY = "veil.hiddenMarkets";
const LEGACY_STORAGE_KEY = "veil.archivedMarkets";

function normalizeIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === "string" && id.length > 0);
}

function readHiddenIds() {
  try {
    const hiddenRaw = window.localStorage.getItem(STORAGE_KEY);
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);

    const hiddenIds = hiddenRaw ? normalizeIds(JSON.parse(hiddenRaw)) : [];
    const legacyIds = legacyRaw ? normalizeIds(JSON.parse(legacyRaw)) : [];

    return [...new Set([...hiddenIds, ...legacyIds])];
  } catch {
    return [];
  }
}

function writeHiddenIds(ids) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("veil:hidden-markets-updated"));
  window.dispatchEvent(new CustomEvent("veil:archived-markets-updated"));
}

export function getHiddenMarketIds() {
  return readHiddenIds();
}

export function isMarketHidden(marketId) {
  return readHiddenIds().includes(marketId);
}

export function hideMarketFromDashboard(marketId) {
  const ids = new Set(readHiddenIds());
  ids.add(marketId);
  writeHiddenIds([...ids]);
}

export function showMarketOnDashboard(marketId) {
  const ids = readHiddenIds().filter((id) => id !== marketId);
  writeHiddenIds(ids);
}

// Backwards-compatible aliases while the rest of the UI migrates away from "archive".
export const getArchivedMarketIds = getHiddenMarketIds;
export const isMarketArchived = isMarketHidden;
export const archiveMarket = hideMarketFromDashboard;
export const unarchiveMarket = showMarketOnDashboard;
