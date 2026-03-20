import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

describe("veil_markets", () => {
  const program: any = anchor.workspace.VeilMarkets;

  it("initializes state", async () => {
    const state = anchor.web3.Keypair.generate();

    await program.methods
      .initialize()
      .accounts({
        authority: provider.wallet.publicKey,
        state: state.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([state])
      .rpc({ commitment: "confirmed" });

    const account = await program.account.state.fetch(state.publicKey);
    assert.equal(account.authority.toBase58(), provider.wallet.publicKey.toBase58());
  });
});
