import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8787);
const UPSTREAM = process.env.POLYMARKET_UPSTREAM || "https://gamma-api.polymarket.com";
const ALLOW_ORIGIN = process.env.POLYMARKET_ALLOW_ORIGIN || "*";

function writeJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function handleOptions(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end();
}

async function proxyPolymarket(req, res, pathname, search) {
  let upstreamPath = pathname.replace(/^\/api\/polymarket/, "") || "/";
  let upstreamSearch = search;

  if (upstreamPath.startsWith("/markets/")) {
    const conditionId = upstreamPath.slice("/markets/".length);
    upstreamPath = "/markets";
    upstreamSearch = `?condition_ids=${encodeURIComponent(conditionId)}`;
  }

  const upstreamUrl = `${UPSTREAM}${upstreamPath}${upstreamSearch}`;

  const upstreamRes = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "veil-markets-proxy/1.0",
    },
  });

  const text = await upstreamRes.text();
  let responseBody = text;

  if (upstreamPath === "/markets" && upstreamSearch.startsWith("?condition_ids=") && upstreamRes.ok) {
    try {
      const parsed = JSON.parse(text);
      responseBody = JSON.stringify(Array.isArray(parsed) ? parsed[0] ?? null : parsed);
    } catch {
      responseBody = text;
    }
  }
  const cacheControl = upstreamPath.startsWith("/markets/")
    ? "public, s-maxage=30, stale-while-revalidate=60"
    : "public, s-maxage=20, stale-while-revalidate=60";

  res.writeHead(upstreamRes.status, {
    "Content-Type": upstreamRes.headers.get("content-type") || "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": cacheControl,
  });
  res.end(responseBody);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  try {
    if (req.method === "OPTIONS") {
      handleOptions(res);
      return;
    }

    if (req.method !== "GET") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    if (url.pathname === "/health") {
      writeJson(res, 200, { ok: true, upstream: UPSTREAM });
      return;
    }

    if (url.pathname === "/api/polymarket/markets" || url.pathname.startsWith("/api/polymarket/markets/")) {
      await proxyPolymarket(req, res, url.pathname, url.search);
      return;
    }

    writeJson(res, 404, { error: "Not found" });
  } catch (error) {
    writeJson(res, 502, {
      error: "Proxy request failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, () => {
  console.log(`VEIL Polymarket proxy listening on http://localhost:${PORT}`);
});
