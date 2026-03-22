const anchor = require("@coral-xyz/anchor");
const { getArciumProgram, getComputationAccAddress } = require("./node_modules/@arcium-hq/client/build/index.cjs");
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
  const offset = new anchor.BN("2192173172451587104");
  const pda = getComputationAccAddress(456, offset);
  console.log("computation", pda.toBase58());
  const acc = await program.account.computationAccount.fetch(pda);
  console.dir(acc, {depth:10});
})().catch(err=>{console.error(err); process.exit(1);});
