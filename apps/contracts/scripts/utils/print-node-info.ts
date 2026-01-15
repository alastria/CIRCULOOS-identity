import { ethers } from "ethers";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.HARDHAT_RPC ?? "http://127.0.0.1:8545");
  const network = await provider.getNetwork();
  const accounts = await provider.listAccounts();
  console.log(`hardhat node chainId=${network.chainId} rpc=${provider.connection.url}`);
  console.log("accounts:", accounts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
