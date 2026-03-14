import { useWallet as useSolanaWallet, useConnection } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";

export function useWallet() {
  const {
    publicKey,
    connected,
    connecting,
    disconnect,
    select,
    wallet,
    wallets,
    sendTransaction,
    signTransaction,
    signAllTransactions,
  } = useSolanaWallet();

  const { connection } = useConnection();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!publicKey || !connected) {
      const reset = setTimeout(() => {
        if (!cancelled) {
          setBalance(null);
        }
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(reset);
      };
    }

    const fetch = async () => {
      try {
        const lamports = await connection.getBalance(publicKey, "confirmed");
        if (!cancelled) setBalance(lamports / 1e9);
      } catch {
        // silent
      }
    };
    fetch();
    const id = setInterval(fetch, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [publicKey, connected, connection]);

  return {
    publicKey,
    connected,
    connecting,
    disconnect,
    select,
    wallet,
    wallets,
    balance,
    sendTransaction,
    signTransaction,
    signAllTransactions,
    shortAddress: publicKey
      ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
      : null,
  };
}
