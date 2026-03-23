const anchor = require("@coral-xyz/anchor");
const { getArciumProgram, getMXEAccAddress } = require("./node_modules/@arcium-hq/client/build/index.cjs");
const rpc = "https://devnet.helius-rpc.com/?api-key=c43dba9b-10c3-46cf-8d09-74a514c07108";
const connection = new anchor.web3.Connection(rpc, "confirmed");
const dummyWallet = {
  publicKey: new anchor.web3.PublicKey("8CfGPYHD7ZgjxGGeATRj5VzdUGat5QsX6sttAANTXGDN"),
  signTransaction: async (tx) => tx,
  signAllTransactions: async (txs) => txs,
};
const provider = new anchor.AnchorProvider(connection, dummyWallet, {});
const program = getArciumProgram(provider);
const programId = new anchor.web3.PublicKey("5ZekMxZUqU1Lmm5g6JqBdQDzcCLd4jHkxZu6doQG3YFP");
(async()=>{
  const pda = getMXEAccAddress(programId);
  console.log("mxe", pda.toBase58());
  const acc = await program.account.mxeAccount.fetch(pda);
  console.log("keygenOffset", acc.keygenOffset.toString());
  console.log("keyRecoveryInitOffset", acc.keyRecoveryInitOffset.toString());
  console.log("lutOffsetSlot", acc.lutOffsetSlot.toString());
  console.dir(acc.utilityPubkeys, {depth:5});
})().catch(err=>{console.error(err); process.exit(1);});
