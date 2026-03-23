const anchor = require("@coral-xyz/anchor");
const { getMempoolAccAddress, getExecutingPoolAccAddress } = require("./node_modules/@arcium-hq/client/build/index.cjs");
const rpc = "https://devnet.helius-rpc.com/?api-key=c43dba9b-10c3-46cf-8d09-74a514c07108";
const connection = new anchor.web3.Connection(rpc, "confirmed");
(async()=>{
  const mempool = getMempoolAccAddress(456);
  const execpool = getExecutingPoolAccAddress(456);
  console.log("mempool", mempool.toBase58());
  console.log("execpool", execpool.toBase58());
  const mempoolInfo = await connection.getAccountInfo(mempool);
  const execpoolInfo = await connection.getAccountInfo(execpool);
  console.log("mempoolExists", !!mempoolInfo, mempoolInfo && {owner:mempoolInfo.owner.toBase58(), len:mempoolInfo.data.length});
  console.log("execpoolExists", !!execpoolInfo, execpoolInfo && {owner:execpoolInfo.owner.toBase58(), len:execpoolInfo.data.length});
})().catch(err=>{console.error(err); process.exit(1);});
