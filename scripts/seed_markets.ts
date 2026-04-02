import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import fetch from "node-fetch";
import { randomBytes } from "crypto";
import {
  ARCIUM_PROGRAM_ID,
  getComputationAccounts,
  waitForComputation,
} from "./arcium_helpers.js";

const GAMMA_API = "https://gamma-api.polymarket.com";

async function waitForMarketOpen(
  program: any,
  marketPda: anchor.web3.PublicKey,
  maxWaitMs = 120_000
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const market = await program.account.market.fetch(marketPda);
    if (market.status === 1) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error("Timed out waiting for market to open");
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program: any = anchor.workspace.VeilMarkets;
  const payer = provider.wallet as anchor.Wallet;

  console.log("Fetching active Polymarket markets...");
  const res = await fetch(`${GAMMA_API}/markets?active=true&closed=false&limit=50`);
  if (!res.ok) {
    throw new Error(`Polymarket API error: ${res.status}`);
  }
  const allMarkets = (await res.json()) as any[];

  const binaryMarkets = allMarkets
    .filter((market: any) => {
      try {
        const outcomes = JSON.parse(market.outcomes || "[]");
        return (
          outcomes.length === 2 &&
          outcomes[0].toLowerCase() === "yes" &&
          outcomes[1].toLowerCase() === "no" &&
          market.active &&
          !market.closed &&
          !market.resolved
        );
      } catch {
        return false;
      }
    })
    .sort((a: any, b: any) => parseFloat(b.volume) - parseFloat(a.volume))
    .slice(0, 4);

  if (binaryMarkets.length === 0) {
    throw new Error("No active binary markets found on Polymarket");
  }

  console.log(`Found ${binaryMarkets.length} markets to seed`);

  for (const pm of binaryMarkets) {
    console.log(`\nSeeding: \"${pm.question.slice(0, 60)}...\"\n`);

    const questionBytes = new Uint8Array(280);
    const encodedQuestion = new TextEncoder().encode(pm.question.slice(0, 280));
    questionBytes.set(encodedQuestion);

    const endTime = new anchor.BN(
      Math.floor(new Date(pm.endDate).getTime() / 1000).toString()
    );

    const conditionIdHex = pm.conditionId.startsWith("0x")
      ? pm.conditionId.slice(2)
      : pm.conditionId;
    const conditionIdBytes = Buffer.from(conditionIdHex.padEnd(64, "0"), "hex");
    const conditionIdArray = Array.from(conditionIdBytes.slice(0, 32));

    const computationOffset = new anchor.BN(randomBytes(8));
    const initialPoolLamports = new anchor.BN(0);

    const [marketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        payer.publicKey.toBuffer(),
        computationOffset.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const arciumAccounts = getComputationAccounts(
      program.programId,
      "init_market_state",
      computationOffset
    );

    try {
      const tx = await program.methods
        .createMarket(
          computationOffset,
          Array.from(questionBytes),
          endTime,
          initialPoolLamports,
          true,
          conditionIdArray
        )
        .accounts({
          creator: payer.publicKey,
          market: marketPda,
          ...arciumAccounts,
          arciumProgram: ARCIUM_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

      console.log(`  Created tx: ${tx}`);
      console.log("  Waiting for MPC init_market_state...");

      await waitForComputation(
        provider,
        computationOffset,
        program.programId,
        "confirmed"
      );

      await waitForMarketOpen(program, marketPda);
      console.log(`  Market OPEN: ${marketPda.toBase58()}`);
      console.log(`    Volume: $${parseFloat(pm.volume).toLocaleString()}`);
      console.log(`    End: ${new Date(pm.endDate).toLocaleDateString()}`);
    } catch (error) {
      console.error(`  Failed to seed market: ${error}`);
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("\nSeed script complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


