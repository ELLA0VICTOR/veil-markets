import { x25519 } from "@noble/curves/ed25519";

let rescueCipherModulePromise = null;

async function getRescueCipher() {
  if (!rescueCipherModulePromise) {
    rescueCipherModulePromise = import("@arcium-hq/client").then(
      (module) => module.RescueCipher
    );
  }

  return rescueCipherModulePromise;
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

/**
 * Encrypt a vote for submission to the add_vote MPC circuit.
 * @param {boolean} is_yes - Vote direction
 * @param {bigint} stakeLamports - Stake amount in lamports
 * @param {Uint8Array} mxePublicKey - MXE x25519 public key
 * @returns {{ ciphertexts, nonce, nonceBytes, publicKey, privateKey, sharedSecret }}
 */
export async function encryptVote(is_yes, stakeLamports, mxePublicKey) {
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
  const privateKey = x25519.utils.randomPrivateKey();
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

/**
 * Generate an x25519 keypair for use as resolver identity.
 * @returns {{ privateKey: Uint8Array, publicKey: Uint8Array }}
 */
export function generateResolverKeypair() {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

