import http from "node:http";
import { URL } from "node:url";
import anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { awaitComputationFinalization, getMXEPublicKey, RescueCipher } from "@arcium-hq/client";
import { x25519 } from "@noble/curves/ed25519";

const { AnchorProvider, BN } = anchor;

const PORT = Number(process.env.PORT || 8787);
const UPSTREAM = process.env.POLYMARKET_UPSTREAM || "https://gamma-api.polymarket.com";
const ALLOW_ORIGIN = process.env.POLYMARKET_ALLOW_ORIGIN || "*";
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.VITE_RPC_ENDPOINT ||
  "https://api.devnet.solana.com";

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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end();
}

function bytesToU128(bytes) {
  let result = 0n;
  for (let i = 0; i < 16; i += 1) {
    result |= BigInt(bytes[i]) << BigInt(i * 8);
  }
  return result;
}

function createReadonlyProvider() {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  return new AnchorProvider(
    connection,
    {
      publicKey: PublicKey.default,
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
    },
    { commitment: "confirmed" }
  );
}

async function handleArciumMxePublicKey(res, searchParams) {
  const programId = searchParams.get("programId");
  if (!programId) {
    writeJson(res, 400, { error: "Missing programId" });
    return;
  }

  const provider = createReadonlyProvider();
  const key = await getMXEPublicKey(provider, new PublicKey(programId));

  if (!key) {
    writeJson(res, 404, { error: "MXE public key not set yet" });
    return;
  }

  writeJson(res, 200, {
    key: Array.from(key),
    rpc: SOLANA_RPC_URL,
  });
}

async function handleEncryptVote(req, res) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }

  let parsed;
  try {
    parsed = JSON.parse(body || "{}");
  } catch {
    writeJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const { programId, isYes, stakeLamports } = parsed ?? {};
  if (!programId || stakeLamports === undefined) {
    writeJson(res, 400, { error: "Missing programId or stakeLamports" });
    return;
  }

  const provider = createReadonlyProvider();
  const mxePublicKey = await getMXEPublicKey(provider, new PublicKey(programId));
  if (!mxePublicKey) {
    writeJson(res, 404, { error: "MXE public key not set yet" });
    return;
  }

  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);
  const plaintext = [BigInt(isYes ? 1 : 0), BigInt(stakeLamports)];
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = bytesToU128(nonceBytes);
  const ciphertexts = cipher.encrypt(plaintext, nonceBytes);

  writeJson(res, 200, {
    nonce: nonce.toString(),
    publicKey: Array.from(publicKey),
    ciphertexts: ciphertexts.map((ct) => Array.from(ct)),
  });
}

async function handleAwaitComputation(req, res) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }

  let parsed;
  try {
    parsed = JSON.parse(body || "{}");
  } catch {
    writeJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const { programId, computationOffset, commitment = "confirmed" } = parsed ?? {};
  if (!programId || computationOffset === undefined) {
    writeJson(res, 400, { error: "Missing programId or computationOffset" });
    return;
  }

  const provider = createReadonlyProvider();
  const result = await awaitComputationFinalization(
    provider,
    new BN(computationOffset),
    new PublicKey(programId),
    commitment
  );

  writeJson(res, 200, {
    ok: true,
    result: result ?? null,
  });
}

function u128ToBytes(value) {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  }
  return bytes;
}

async function handleDecryptResult(req, res) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }

  let parsed;
  try {
    parsed = JSON.parse(body || "{}");
  } catch {
    writeJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const { resolverPrivateKey, encryptionKey, nonce, ciphertexts } = parsed ?? {};
  if (!resolverPrivateKey || !encryptionKey || nonce === undefined || !ciphertexts) {
    writeJson(res, 400, { error: "Missing resolverPrivateKey, encryptionKey, nonce, or ciphertexts" });
    return;
  }

  const sharedSecret = x25519.getSharedSecret(
    Uint8Array.from(resolverPrivateKey),
    Uint8Array.from(encryptionKey)
  );
  const cipher = new RescueCipher(sharedSecret);
  const outputNonce = u128ToBytes(BigInt(nonce));
  const normalizedCiphertexts = ciphertexts.map((ct) => Array.from(ct));
  const plaintext = cipher.decrypt(normalizedCiphertexts, outputNonce);

  writeJson(res, 200, {
    totalYes: plaintext[0].toString(),
    totalNo: plaintext[1].toString(),
    yesWins: plaintext[2] > 0n,
  });
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

    if (req.method === "POST") {
      if (url.pathname === "/api/arcium/encrypt-vote") {
        await handleEncryptVote(req, res);
        return;
      }

      if (url.pathname === "/api/arcium/await-computation") {
        await handleAwaitComputation(req, res);
        return;
      }

      if (url.pathname === "/api/arcium/decrypt-result") {
        await handleDecryptResult(req, res);
        return;
      }
    }

    if (req.method !== "GET") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    if (url.pathname === "/health") {
      writeJson(res, 200, { ok: true, upstream: UPSTREAM, rpc: SOLANA_RPC_URL });
      return;
    }

    if (url.pathname === "/api/polymarket/markets" || url.pathname.startsWith("/api/polymarket/markets/")) {
      await proxyPolymarket(req, res, url.pathname, url.search);
      return;
    }

    if (url.pathname === "/api/arcium/mxe-public-key") {
      await handleArciumMxePublicKey(res, url.searchParams);
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
