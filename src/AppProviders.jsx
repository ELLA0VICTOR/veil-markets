import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import App from "./App";
import { RPC_ENDPOINT } from "./utils/constants";

export default function AppProviders() {
  const wallets = useMemo(() => {
    const adapters = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
    const seen = new Set();

    return adapters.filter((adapter) => {
      if (seen.has(adapter.name)) return false;
      seen.add(adapter.name);
      return true;
    });
  }, []);

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <App />
      </WalletProvider>
    </ConnectionProvider>
  );
}
