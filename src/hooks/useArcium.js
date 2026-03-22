import { useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { encryptVote, decryptMarketResult, generateResolverKeypair } from "../utils/arcium";
import {
  getMxePublicKeyWithRetry,
  waitForArciumComputation,
} from "../utils/arciumAccounts";

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
    return getMxePublicKeyWithRetry(provider);
  }, [connection, wallet]);

  /**
   * Encrypt a vote for submission
   * @param {boolean} isYes
   * @param {number} lamports
   * @returns {{ ciphertexts, nonce, publicKey, privateKey }}
   */
  const encryptVoteForSubmission = useCallback(
    async (isYes, lamports) => {
      const mxePublicKey = await getMxePublicKey();
      return encryptVote(isYes, BigInt(lamports), mxePublicKey);
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
