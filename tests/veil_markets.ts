import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RescueCipher } from "@arcium-hq/client";
import { x25519 } from "@noble/curves/ed25519";
import { randomBytes } from "crypto";
import { assert } from "chai";
import {
  ARCIUM_PROGRAM_ID,
  getComputationAccounts,
  getInitCompDefAccounts,
  getMxePublicKeyWithRetry,
  waitForComputation,
} from "../scripts/arcium_helpers";

function encodeQuestion(text: string): number[] {
  const bytes = new Uint8Array(280);
  const encoded = new TextEncoder().encode(text.slice(0, 280));
  bytes.set(encoded);
  return Array.from(bytes);
}

function bytesToU128(bytes: Uint8Array): bigint {
  let result = 0n;
  for (let i = 0; i < 16; i += 1) {
    result |= BigInt(bytes[i]) << BigInt(i * 8);
  }
  return result;
}

function u128ToBytes(value: bigint): Uint8Array {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  }
  return bytes;
}

describe("VEIL Markets", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program: any = anchor.workspace.VeilMarkets;
  const connection = provider.connection;
  const payer = provider.wallet as anchor.Wallet;
  const walletB = anchor.web3.Keypair.generate();

  let marketPda: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;
  let positionAPda: anchor.web3.PublicKey;
  let positionBPda: anchor.web3.PublicKey;
  let computationOffset: anchor.BN;

  before(async () => {
    const sig = await connection.requestAirdrop(
      walletB.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig, "confirmed");
  });

  async function initCompDef(circuitName: "init_market_state" | "add_vote" | "resolve_market") {
    const accounts = getInitCompDefAccounts(program.programId, payer.publicKey, circuitName);
    const instructionMap = {
      init_market_state: "initInitMarketStateCompDef",
      add_vote: "initAddVoteCompDef",
      resolve_market: "initResolveMarketCompDef",
    } as const;

    try {
      await (program.methods as any)[instructionMap[circuitName]]()
        .accountsPartial(accounts)
        .rpc({ commitment: "confirmed" });
    } catch (error) {
      const message = `${error}`;
      if (
        !message.includes("already in use") &&
        !message.includes("custom program error: 0x0") &&
        !message.includes("ConstraintAddress")
      ) {
        throw error;
      }
    }
  }

  it("initializes init_market_state comp def", async () => {
    await initCompDef("init_market_state");
    console.log("init_market_state comp def initialized");
  });

  it("initializes add_vote comp def", async () => {
    await initCompDef("add_vote");
    console.log("add_vote comp def initialized");
  });

  it("initializes resolve_market comp def", async () => {
    await initCompDef("resolve_market");
    console.log("resolve_market comp def initialized");
  });

  it("creates a custom market and awaits MPC init", async () => {
    computationOffset = new anchor.BN(randomBytes(8));

    const endTime = new anchor.BN(Math.floor(Date.now() / 1000) + 30);
    const question = encodeQuestion("Will this VEIL test pass successfully?");

    [marketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        payer.publicKey.toBuffer(),
        computationOffset.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      program.programId
    );

    const arciumAccounts = getComputationAccounts(
      program.programId,
      "init_market_state",
      computationOffset
    );

    const tx = await program.methods
      .createMarket(
        computationOffset,
        question,
        endTime,
        false,
        Array.from(new Uint8Array(32))
      )
      .accounts({
        creator: payer.publicKey,
        market: marketPda,
        vault: vaultPda,
        ...arciumAccounts,
        createMarketCallbackProgram: program.programId,
        arciumProgram: ARCIUM_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log(`Market created, tx: ${tx}`);
    await waitForComputation(provider, computationOffset, program.programId, "confirmed");

    const marketAccount = await program.account.market.fetch(marketPda);
    assert.equal(marketAccount.status, 1, "Market should be OPEN (status=1)");
    assert.equal(marketAccount.isPolymarket, false, "Should be a custom market");
  });

  it("wallet A places YES vote (0.5 SOL) via Arcium MPC", async () => {
    const stakeLamports = 500_000_000n;
    const mxePublicKey = await getMxePublicKeyWithRetry(provider, program.programId);

    const privateKey = x25519.utils.randomPrivateKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
    const cipher = new RescueCipher(sharedSecret);

    const nonceBytes = randomBytes(16);
    const nonce = bytesToU128(nonceBytes);
    const plaintext = [1n, stakeLamports];
    const ciphertexts = cipher.encrypt(plaintext, nonceBytes);

    const voteComputationOffset = new anchor.BN(randomBytes(8));

    [positionAPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        payer.publicKey.toBuffer(),
      ],
      program.programId
    );

    const arciumAccounts = getComputationAccounts(
      program.programId,
      "add_vote",
      voteComputationOffset
    );

    const tx = await program.methods
      .placeVote(
        voteComputationOffset,
        nonce,
        Array.from(ciphertexts[0]),
        Array.from(ciphertexts[1]),
        Array.from(publicKey),
        new anchor.BN(stakeLamports.toString()),
        true
      )
      .accounts({
        voter: payer.publicKey,
        market: marketPda,
        vault: vaultPda,
        position: positionAPda,
        ...arciumAccounts,
        addVoteCallbackProgram: program.programId,
        arciumProgram: ARCIUM_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log(`Wallet A vote tx: ${tx}`);
    await waitForComputation(
      provider,
      voteComputationOffset,
      program.programId,
      "confirmed"
    );

    const marketAccount = await program.account.market.fetch(marketPda);
    assert.equal(marketAccount.voteCount, 1);
    assert.equal(
      marketAccount.totalSolPool.toString(),
      (50_000_000 + 500_000_000).toString()
    );
  });

  it("wallet B places NO vote (0.3 SOL) via Arcium MPC", async () => {
    const stakeLamports = 300_000_000n;
    const mxePublicKey = await getMxePublicKeyWithRetry(provider, program.programId);

    const privateKey = x25519.utils.randomPrivateKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
    const cipher = new RescueCipher(sharedSecret);

    const nonceBytes = randomBytes(16);
    const nonce = bytesToU128(nonceBytes);
    const plaintext = [0n, stakeLamports];
    const ciphertexts = cipher.encrypt(plaintext, nonceBytes);

    const voteComputationOffset = new anchor.BN(randomBytes(8));

    [positionBPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        walletB.publicKey.toBuffer(),
      ],
      program.programId
    );

    const walletBProvider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(walletB),
      { commitment: "confirmed" }
    );
    const programB: any = new Program(program.idl, walletBProvider);

    const arciumAccounts = getComputationAccounts(
      program.programId,
      "add_vote",
      voteComputationOffset
    );

    const tx = await programB.methods
      .placeVote(
        voteComputationOffset,
        nonce,
        Array.from(ciphertexts[0]),
        Array.from(ciphertexts[1]),
        Array.from(publicKey),
        new anchor.BN(stakeLamports.toString()),
        false
      )
      .accounts({
        voter: walletB.publicKey,
        market: marketPda,
        vault: vaultPda,
        position: positionBPda,
        ...arciumAccounts,
        addVoteCallbackProgram: program.programId,
        arciumProgram: ARCIUM_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log(`Wallet B vote tx: ${tx}`);
    await waitForComputation(
      provider,
      voteComputationOffset,
      program.programId,
      "confirmed"
    );

    const marketAccount = await program.account.market.fetch(marketPda);
    assert.equal(marketAccount.voteCount, 2);
  });

  it("waits for market end_time and resolves via MPC", async () => {
    await new Promise((resolve) => setTimeout(resolve, 35_000));

    const resolverPrivateKey = x25519.utils.randomPrivateKey();
    const resolverPublicKey = x25519.getPublicKey(resolverPrivateKey);
    const resolveComputationOffset = new anchor.BN(randomBytes(8));

    const arciumAccounts = getComputationAccounts(
      program.programId,
      "resolve_market",
      resolveComputationOffset
    );

    const tx = await program.methods
      .resolveMarket(resolveComputationOffset, Array.from(resolverPublicKey))
      .accounts({
        resolver: payer.publicKey,
        market: marketPda,
        ...arciumAccounts,
        resolveMarketCallbackProgram: program.programId,
        arciumProgram: ARCIUM_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log(`Resolve tx: ${tx}`);
    await waitForComputation(
      provider,
      resolveComputationOffset,
      program.programId,
      "confirmed"
    );

    const marketAccount = await program.account.market.fetch(marketPda);
    assert.equal(marketAccount.status, 2, "Should be RESOLVING (status=2)");

    const encryptionKey = new Uint8Array(
      marketAccount.resultEncryptionKey as number[]
    );
    const resultNonce = BigInt(marketAccount.resultNonce.toString());
    const ciphertexts = [
      new Uint8Array(marketAccount.resultCtTotalYes as number[]),
      new Uint8Array(marketAccount.resultCtTotalNo as number[]),
      new Uint8Array(marketAccount.resultCtYesWins as number[]),
    ];

    const sharedSecret = x25519.getSharedSecret(
      resolverPrivateKey,
      encryptionKey
    );
    const cipher = new RescueCipher(sharedSecret);
    const outputNonce = u128ToBytes(resultNonce + 1n);
    const plaintext = cipher.decrypt(ciphertexts.map((ct) => Array.from(ct)), outputNonce);

    const totalYes = plaintext[0];
    const totalNo = plaintext[1];
    const yesWins = plaintext[2] > 0n;

    assert.equal(totalYes.toString(), "500000000", "YES total should be 0.5 SOL");
    assert.equal(totalNo.toString(), "300000000", "NO total should be 0.3 SOL");
    assert.equal(yesWins, true, "YES should win (more SOL)");

    await program.methods
      .publishResult(
        true,
        new anchor.BN(totalYes.toString()),
        new anchor.BN(totalNo.toString())
      )
      .accounts({
        authority: payer.publicKey,
        market: marketPda,
      })
      .rpc({ commitment: "confirmed" });

    const finalMarket = await program.account.market.fetch(marketPda);
    assert.equal(finalMarket.status, 3, "Market should be SETTLED (status=3)");
    assert.equal(finalMarket.resultPublished, true);
    assert.equal(finalMarket.yesWins, true);
  });

  it("wallet A (YES winner) claims winnings successfully", async () => {
    const voterBalanceBefore = await connection.getBalance(payer.publicKey);

    await program.methods
      .claimWinnings()
      .accounts({
        voter: payer.publicKey,
        market: marketPda,
        vault: vaultPda,
        position: positionAPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    const voterBalanceAfter = await connection.getBalance(payer.publicKey);
    const received = voterBalanceAfter - voterBalanceBefore;

    assert.isAbove(received, 0, "Wallet A should receive SOL");

    const position = await program.account.position.fetch(positionAPda);
    assert.equal(position.hasClaimed, true);
  });

  it("wallet B (NO loser) fails to claim winnings", async () => {
    const walletBProvider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(walletB),
      { commitment: "confirmed" }
    );
    const programB: any = new Program(program.idl, walletBProvider);

    try {
      await programB.methods
        .claimWinnings()
        .accounts({
          voter: walletB.publicKey,
          market: marketPda,
          vault: vaultPda,
          position: positionBPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

      assert.fail("Wallet B should NOT be able to claim");
    } catch (error: any) {
      assert.include(`${error.message}`, "NotAWinner");
    }
  });
});


