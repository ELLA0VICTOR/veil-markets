const STORAGE_KEY = "veil.archivedMarkets";

function readArchivedIds() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArchivedIds(ids) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("veil:archived-markets-updated"));
}

export function getArchivedMarketIds() {
  return readArchivedIds();
}

export function isMarketArchived(marketId) {
  return readArchivedIds().includes(marketId);
}

export function archiveMarket(marketId) {
  const ids = new Set(readArchivedIds());
  ids.add(marketId);
  writeArchivedIds([...ids]);
}

export function unarchiveMarket(marketId) {
  const ids = readArchivedIds().filter((id) => id !== marketId);
  writeArchivedIds(ids);
}
