import { x25519 } from "@noble/curves/ed25519";
import { PROGRAM_ID } from "./constants.js";

const STORAGE_PREFIX = "veil:user-cipher-key";

function storageKey(walletAddress) {
  return `${STORAGE_PREFIX}:${PROGRAM_ID}:${walletAddress}`;
}

export function getOrCreateUserCipherKeypair(walletAddress) {
  if (!walletAddress) {
    throw new Error("walletAddress is required");
  }

  const key = storageKey(walletAddress);
  const existing = localStorage.getItem(key);

  if (existing) {
    const parsed = JSON.parse(existing);
    const privateKey = Uint8Array.from(parsed.privateKey);
    const publicKey = x25519.getPublicKey(privateKey);
    return { privateKey, publicKey };
  }

  const privateKey = x25519.utils.randomPrivateKey();
  localStorage.setItem(
    key,
    JSON.stringify({
      privateKey: Array.from(privateKey),
    })
  );

  return {
    privateKey,
    publicKey: x25519.getPublicKey(privateKey),
  };
}

export function hasUserCipherKeypair(walletAddress) {
  return Boolean(walletAddress && localStorage.getItem(storageKey(walletAddress)));
}

export function clearUserCipherKeypair(walletAddress) {
  if (!walletAddress) return;
  localStorage.removeItem(storageKey(walletAddress));
}
