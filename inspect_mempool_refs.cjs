const anchor = require("@coral-xyz/anchor");
const { getArciumProgram, getComputationsInMempool, getMempoolAccAddress } = require("./node_modules/@arcium-hq/client/build/index.cjs");
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
  const mempoolPk = getMempoolAccAddress(456);
  const refs = await getComputationsInMempool(program, mempoolPk);
  console.log("count", refs.length);
  console.dir(refs.slice(0,20), {depth:10});
  const target = "2192173172451587104";
  const found = refs.find((r) => r.computationOffset && r.computationOffset.toString() === target);
  console.log("targetFound", !!found, found || null);
})().catch(err=>{console.error(err); process.exit(1);});
