import { useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { decryptMarketResult, generateResolverKeypair } from "../utils/arcium";
import {
  getMxePublicKeyWithRetry,
  waitForArciumComputation,
} from "../utils/arciumAccounts";
import { getProgramId } from "../utils/program";

export function useArcium() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  /**
   * Get the MXE public key for the current cluster
   */
  const getMxePublicKey = useCallback(async () => {
    if (!wallet) throw new Error("Wallet not connected");
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    const key = await getMxePublicKeyWithRetry(provider);
    console.log("[useArcium] MXE public key fetched", {
      length: key?.length,
      preview: key ? Array.from(key.slice(0, 4)) : null,
    });
    return key;
  }, [connection, wallet]);

  /**
   * Encrypt a vote for submission
   * @param {boolean} isYes
   * @param {number} lamports
   * @returns {{ ciphertexts, nonce, publicKey, privateKey }}
   */
  const encryptVoteForSubmission = useCallback(
    async (isYes, lamports) => {
      console.log("[useArcium] encryptVoteForSubmission:start", {
        isYes,
        lamports,
      });
      const response = await fetch("/api/arcium/encrypt-vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          programId: getProgramId().toBase58(),
          isYes,
          stakeLamports: String(lamports),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `Encrypt vote failed (${response.status})`);
      }

      const body = await response.json();
      const payload = {
        nonce: new BN(body.nonce),
        publicKey: body.publicKey,
        ciphertexts: body.ciphertexts.map((ct) => Uint8Array.from(ct)),
      };
      console.log("[useArcium] encryptVoteForSubmission:done", {
        nonce: payload?.nonce?.toString?.() ?? payload?.nonce,
        ciphertextCount: payload?.ciphertexts?.length,
        voterPubkeyLen: payload?.publicKey?.length,
      });
      return payload;
    },
    [getMxePublicKey]
  );

  /**
   * Decrypt a resolution result
   */
  const decryptResolutionResult = useCallback(
    async (resolverPrivKey, encKey, nonce, cts) => {
      return decryptMarketResult(resolverPrivKey, encKey, nonce, cts);
    },
    []
  );

  /**
   * Await computation finalization
   * @param {number|BN} computationOffset
   */
  const awaitComputation = useCallback(
    async (computationOffset) => {
      if (!wallet) throw new Error("Wallet not connected");
      const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });
      console.log("[useArcium] awaitComputation:start", {
        computationOffset: computationOffset?.toString?.() ?? computationOffset,
      });
      return waitForArciumComputation(provider, computationOffset, "confirmed");
    },
    [connection, wallet]
  );

  /**
   * Generate a fresh resolver keypair
   */
  const newResolverKeypair = useCallback(() => {
    return generateResolverKeypair();
  }, []);

  return {
    getMxePublicKey,
    encryptVoteForSubmission,
    decryptResolutionResult,
    awaitComputation,
    newResolverKeypair,
  };
}
