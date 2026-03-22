const anchor = require("@coral-xyz/anchor");
const { getArciumProgram, getRecoveryClusterAccAddress } = require("./node_modules/@arcium-hq/client/build/index.cjs");
const rpc = "https://devnet.helius-rpc.com/?api-key=c43dba9b-10c3-46cf-8d09-74a514c07108";
const connection = new anchor.web3.Connection(rpc, "confirmed");
const dummyWallet = {
  publicKey: new anchor.web3.PublicKey("8CfGPYHD7ZgjxGGeATRj5VzdUGat5QsX6sttAANTXGDN"),
  signTransaction: async (tx) => tx,
  signAllTransactions: async (txs) => txs,
};
const provider = new anchor.AnchorProvider(connection, dummyWallet, {});
const program = getArciumProgram(provider);
(async()=>{
  const recoveryPda = getRecoveryClusterAccAddress(new anchor.web3.PublicKey("bJ9U7u1ucVuiRPmusoaKiHj7jNyKy9FLQ57tTjE62e7"));
  console.log("recoveryCluster", recoveryPda.toBase58());
  const recovery = await program.account.recoveryCluster.fetch(recoveryPda);
  console.dir(recovery, {depth:10});
})().catch(err=>{console.error(err); process.exit(1);});
