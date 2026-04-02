/**
 * init_comp_defs.ts
 *
 * Run once after deploying the veil_markets program to initialize the
 * all computation definition accounts on-chain.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  CLUSTER_OFFSET,
  CircuitName,
  getInitCompDefAccounts,
} from "./arcium_helpers.js";

async function initCompDef(
  provider: anchor.AnchorProvider,
  program: Program<any>,
  payer: anchor.web3.PublicKey,
  circuitName: CircuitName
) {
  const accounts = await getInitCompDefAccounts(
    provider,
    program.programId,
    payer,
    circuitName
  );

  console.log(`Initializing comp def for: ${circuitName}`);
  console.log(`  MXE account:     ${accounts.mxeAccount.toBase58()}`);
  console.log(`  CompDef account: ${accounts.compDefAccount.toBase58()}`);
  console.log(`  LUT account:     ${accounts.addressLookupTable.toBase58()}`);

  const instructionMap: Record<CircuitName, string> = {
    init_market_state: "initInitMarketStateCompDef",
    init_user_balance: "initInitUserBalanceCompDef",
    deposit_balance: "initDepositBalanceCompDef",
    withdraw_balance: "initWithdrawBalanceCompDef",
    add_vote: "initAddVoteCompDef",
    resolve_market: "initResolveMarketCompDef",
    claim_payout: "initClaimPayoutCompDef",
  };

  const methodName = instructionMap[circuitName];

  try {
    const tx = await (program.methods as Record<string, () => any>)[methodName]()
      .accountsPartial(accounts)
      .rpc({ commitment: "confirmed" });

    console.log(`  Done. tx: ${tx}\n`);
  } catch (error) {
    const message = `${error}`;
    if (
      message.includes("already in use") ||
      message.includes("custom program error: 0x0") ||
      message.includes("ConstraintAddress")
    ) {
      console.log("  Skipping because this comp def appears to be initialized already.\n");
      return;
    }
    throw error;
  }
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeilMarkets as Program<any>;
  const payer = (provider.wallet as anchor.Wallet).publicKey;

  console.log("=== VEIL Markets - Initialize Computation Definitions ===\n");
  console.log(`Payer: ${payer.toBase58()}`);
  console.log(`Program: ${program.programId.toBase58()}`);
  console.log(`Cluster offset: ${CLUSTER_OFFSET}\n`);

  await initCompDef(provider, program, payer, "init_market_state");
  await initCompDef(provider, program, payer, "init_user_balance");
  await initCompDef(provider, program, payer, "deposit_balance");
  await initCompDef(provider, program, payer, "withdraw_balance");
  await initCompDef(provider, program, payer, "add_vote");
  await initCompDef(provider, program, payer, "resolve_market");
  await initCompDef(provider, program, payer, "claim_payout");

  console.log("=== All computation definitions initialized. ===");
  console.log("You can now create markets and place bets.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
