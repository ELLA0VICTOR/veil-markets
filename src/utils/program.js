import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "../idl/veil_markets.json";
import { PROGRAM_ID } from "./constants.js";

export function getProgramId() {
  return new PublicKey(PROGRAM_ID);
}

export function createReadonlyWallet() {
  return {
    publicKey: PublicKey.default,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };
}

export function createReadonlyProvider(connection, commitment = "confirmed") {
  return new AnchorProvider(connection, createReadonlyWallet(), { commitment });
}

export function createVeilProgram(provider) {
  return new Program(
    {
      ...idl,
      address: PROGRAM_ID,
      metadata: {
        ...(idl.metadata ?? {}),
        address: PROGRAM_ID,
      },
    },
    provider
  );
}

export async function fetchAllDecodableAccounts(program, accountName, commitment = "confirmed") {
  const rawAccounts = await program.provider.connection.getProgramAccounts(program.programId, {
    commitment,
  });

  const decoded = [];
  for (const { pubkey, account } of rawAccounts) {
    try {
      const parsed = program.coder.accounts.decode(accountName, account.data);
      decoded.push({ publicKey: pubkey, account: parsed });
    } catch {
      // Skip legacy or unrelated accounts that no longer match the active IDL.
    }
  }

  return decoded;
}
