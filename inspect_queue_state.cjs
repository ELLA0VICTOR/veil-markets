const anchor = require("@coral-xyz/anchor");
const { getMempoolAccInfo, getExecutingPoolAccInfo, getMempoolAccAddress, getExecutingPoolAccAddress } = require("./node_modules/@arcium-hq/client/build/index.cjs");
const rpc = "https://devnet.helius-rpc.com/?api-key=c43dba9b-10c3-46cf-8d09-74a514c07108";
const connection = new anchor.web3.Connection(rpc, "confirmed");
const dummyWallet = {
  publicKey: new anchor.web3.PublicKey("8CfGPYHD7ZgjxGGeATRj5VzdUGat5QsX6sttAANTXGDN"),
  signTransaction: async (tx) => tx,
  signAllTransactions: async (txs) => txs,
};
const provider = new anchor.AnchorProvider(connection, dummyWallet, {});
(async()=>{
  const mempoolPk = getMempoolAccAddress(456);
  const execpoolPk = getExecutingPoolAccAddress(456);
  const mempool = await getMempoolAccInfo(provider, mempoolPk);
  const execpool = await getExecutingPoolAccInfo(provider, execpoolPk);
  console.dir({mempool, execpool}, {depth:10});
})().catch(err=>{console.error(err); process.exit(1);});
