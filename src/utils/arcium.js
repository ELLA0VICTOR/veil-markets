import { x25519 } from "@noble/curves/ed25519";

const U64_MAX = (1n << 64n) - 1n;

let arciumCryptoModulePromise = null;

function ensureBrowserProcessShim() {
  if (typeof globalThis === "undefined") return;

  const existing = globalThis.process ?? {};
  if (typeof existing.browser !== "boolean") {
    existing.browser = true;
  }
  if (typeof existing.version !== "string") {
    existing.version = "v18.0.0";
  }
  globalThis.process = existing;

  if (typeof globalThis.global === "undefined") {
    globalThis.global = globalThis;
  }
}

async function getArciumCrypto() {
  if (!arciumCryptoModulePromise) {
    ensureBrowserProcessShim();
    arciumCryptoModulePromise = import("@arcium-hq/client").then((module) => ({
      RescueCipher: module.RescueCipher,
      CSplRescueCipher: module.CSplRescueCipher,
      x25519: module.x25519,
    }));
  }

  return arciumCryptoModulePromise;
}

async function getRescueCipher() {
  const { RescueCipher } = await getArciumCrypto();
  return RescueCipher;
}

// Convert 16 random bytes to u128 (little-endian)
function bytesToU128(bytes) {
  let result = 0n;
  for (let i = 0; i < 16; i++) {
    result |= BigInt(bytes[i]) << BigInt(i * 8);
  }
  return result;
}

// Convert u128 bigint to Uint8Array(16) little-endian
function u128ToBytes(value) {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  }
  return bytes;
}

function coerceToByteArray(value) {
  if (value == null) return new Uint8Array();
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
    );
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value.slice(0));
  }
  if (typeof value.toBytes === "function") {
    return Uint8Array.from(value.toBytes());
  }
  if (typeof value.toBuffer === "function") {
    return Uint8Array.from(value.toBuffer());
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }
  try {
    return Uint8Array.from(Array.from(value));
  } catch {
    return new Uint8Array();
  }
}

function normalizeFixedBytes(value, expectedLength, label) {
  const bytes = coerceToByteArray(value);

  if (bytes.length !== expectedLength) {
    throw new Error(`${label} must be ${expectedLength} bytes (found ${bytes.length})`);
  }

  return bytes;
}

function normalizeCipherBlock(value) {
  return Array.from(normalizeFixedBytes(value, 32, "ciphertext"));
}

function normalizeU64(value) {
  const normalized = BigInt(value?.toString?.() ?? value);
  if (normalized < 0n || normalized > U64_MAX) {
    throw new Error("Decrypted value is out of the valid u64 range");
  }
  return normalized;
}

function nonceCandidates(nonce) {
  const current = BigInt(nonce);
  const candidates = [{ label: "stored", bytes: u128ToBytes(current) }];
  if (current > 0n) {
    candidates.push({ label: "storedMinusOne", bytes: u128ToBytes(current - 1n) });
  }
  return candidates;
}

async function deriveSharedSecret(privateKey, publicKey) {
  const { x25519: arciumX25519 } = await getArciumCrypto();
  const normalizedPrivateKey = normalizeFixedBytes(privateKey, 32, "privateKey");
  const normalizedPublicKey = normalizeFixedBytes(publicKey, 32, "publicKey");
  return arciumX25519.getSharedSecret(normalizedPrivateKey, normalizedPublicKey);
}

/**
 * Encrypt a vote using a caller-supplied user private key.
 */
export async function encryptVoteWithPrivateKey(
  is_yes,
  stakeLamports,
  mxePublicKey,
  privateKey
) {
  console.log("[arcium] encryptVote:input", {
    is_yes,
    stakeLamports: stakeLamports?.toString?.() ?? stakeLamports,
    mxePublicKeyType: mxePublicKey?.constructor?.name,
    mxePublicKeyLength: mxePublicKey?.length,
    mxePublicKeyPreview:
      mxePublicKey && typeof mxePublicKey.slice === "function"
        ? Array.from(mxePublicKey.slice(0, 4))
        : null,
  });
  const RescueCipher = await getRescueCipher();
  const publicKey = x25519.getPublicKey(privateKey);
  const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);

  // VoteInput struct fields in order: is_yes (bool), stake (u64)
  const plaintext = [BigInt(is_yes ? 1 : 0), BigInt(stakeLamports)];

  // Generate nonce: 16 random bytes as u128
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = bytesToU128(nonceBytes);

  const ciphertexts = cipher.encrypt(plaintext, nonceBytes);

  console.log("[arcium] encryptVote:output", {
    privateKeyLength: privateKey?.length,
    publicKeyLength: publicKey?.length,
    sharedSecretLength: sharedSecret?.length,
    nonce: nonce.toString(),
    ciphertextCount: ciphertexts?.length,
  });

  return {
    ciphertexts, // Array of Uint8Array[32] — one per field
    nonce, // u128 as BigInt
    nonceBytes, // Uint8Array(16)
    publicKey: Array.from(publicKey), // [u8;32]
    privateKey, // Keep for potential future use
    sharedSecret, // Keep for decryption
  };
}

/**
 * Backward-compatible helper that generates an ephemeral keypair for one-shot encryption.
 */
export async function encryptVote(is_yes, stakeLamports, mxePublicKey) {
  const privateKey = x25519.utils.randomPrivateKey();
  return encryptVoteWithPrivateKey(is_yes, stakeLamports, mxePublicKey, privateKey);
}

/**
 * Decrypt the result from resolve_market MPC circuit.
 * @param {Uint8Array} resolverPrivateKey - Resolver's x25519 private key
 * @param {number[]} encryptionKey - [u8;32] from SharedEncryptedStruct
 * @param {bigint} nonce - u128 nonce from SharedEncryptedStruct
 * @param {(number[][]|Uint8Array[])} ciphertexts - [[u8;32], [u8;32], [u8;32]] ciphertexts
 * @returns {{ totalYes: bigint, totalNo: bigint, yesWins: boolean }}
 */
export async function decryptMarketResult(
  resolverPrivateKey,
  encryptionKey,
  nonce,
  ciphertexts
) {
  const RescueCipher = await getRescueCipher();
  const sharedSecret = x25519.getSharedSecret(
    resolverPrivateKey,
    new Uint8Array(encryptionKey)
  );
  const cipher = new RescueCipher(sharedSecret);

  const outputNonce = u128ToBytes(BigInt(nonce));

  const cts = ciphertexts.map((ct) => Array.from(ct));
  const plaintext = cipher.decrypt(cts, outputNonce);

  return {
    totalYes: plaintext[0], // BigInt — lamports
    totalNo: plaintext[1], // BigInt — lamports
    yesWins: plaintext[2] > 0n, // bool
  };
}

export async function decryptSharedU64(
  privateKey,
  encryptionKey,
  nonce,
  ciphertext,
  { extraPublicKeys = [] } = {}
) {
  const { RescueCipher, CSplRescueCipher } = await getArciumCrypto();
  const normalizedCiphertext = normalizeCipherBlock(ciphertext);
  const keyCandidates = [];
  const seenKeys = new Set();

  function pushKeyCandidate(label, value, { optional = false } = {}) {
    if (value == null) return;
    try {
      const bytes = normalizeFixedBytes(value, 32, label);
      const fingerprint = Array.from(bytes).join(",");
      if (seenKeys.has(fingerprint)) return;
      seenKeys.add(fingerprint);
      keyCandidates.push({ label, bytes });
    } catch (error) {
      if (!optional) throw error;
      console.warn("[arcium] decryptSharedU64:skipKeyCandidate", {
        label,
        message: error?.message || String(error),
      });
    }
  }

  pushKeyCandidate("outputKey", encryptionKey);
  extraPublicKeys.forEach((entry, index) => {
    pushKeyCandidate(entry?.label || `extraKey${index + 1}`, entry?.bytes ?? entry, {
      optional: true,
    });
  });
  const attempts = [];

  for (const keyCandidate of keyCandidates) {
    for (const nonceCandidate of nonceCandidates(nonce)) {
      for (const cipherCandidate of [
        { label: "RescueCipher", Cipher: RescueCipher },
        { label: "CSplRescueCipher", Cipher: CSplRescueCipher },
      ]) {
        try {
          const sharedSecret = await deriveSharedSecret(privateKey, keyCandidate.bytes);
          const cipher = new cipherCandidate.Cipher(sharedSecret);
          const plaintext = cipher.decrypt([normalizedCiphertext], nonceCandidate.bytes);
          const value = normalizeU64(plaintext[0]);
          console.log("[arcium] decryptSharedU64:success", {
            strategy: `${cipherCandidate.label}:${keyCandidate.label}:${nonceCandidate.label}`,
            nonce: nonce?.toString?.() ?? nonce,
            value: value.toString(),
          });
          return value;
        } catch (error) {
          attempts.push({
            strategy: `${cipherCandidate.label}:${keyCandidate.label}:${nonceCandidate.label}`,
            message: error?.message || String(error),
            stack: error?.stack || "(no stack)",
          });
        }
      }
    }
  }

  const error = new Error(
    attempts
      .map((attempt) => `${attempt.strategy}: ${attempt.message}`)
      .join(" | ")
  );
  attempts.forEach((attempt) => {
    console.error("[arcium] decryptSharedU64:attemptFailed", attempt);
  });
  console.error("[arcium] decryptSharedU64:error:message", error.message);
  console.error("[arcium] decryptSharedU64:error:stack", error.stack);
  console.error("[arcium] decryptSharedU64:error", {
    privateKeyLength: privateKey?.length,
    encryptionKeyLength: encryptionKey?.length,
    nonce: nonce?.toString?.() ?? nonce,
    ciphertextLength: ciphertext?.length,
    attempts,
    error,
  });
  throw error;
}

export async function decryptStoredVote(
  privateKey,
  mxePublicKey,
  nonce,
  voteIsYesCiphertext,
  voteStakeCiphertext
) {
  const RescueCipher = await getRescueCipher();
  const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);
  const outputNonce = u128ToBytes(BigInt(nonce));
  const plaintext = cipher.decrypt(
    [Array.from(voteIsYesCiphertext), Array.from(voteStakeCiphertext)],
    outputNonce
  );
  return {
    isYes: plaintext[0] > 0n,
    stakeLamports: plaintext[1],
  };
}

/**
 * Generate an x25519 keypair for use as resolver identity.
 * @returns {{ privateKey: Uint8Array, publicKey: Uint8Array }}
 */
export function generateResolverKeypair() {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

