import fetch from "node-fetch";

export const DEFAULT_RPC = process.env.HARDHAT_RPC ?? "http://127.0.0.1:8545";
export const DEFAULT_CHAIN_ID = 1337;

export async function waitForNodeReady(rpc = DEFAULT_RPC, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(rpc);
      if (res.ok) return true;
    } catch (e) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Hardhat node not ready at ${rpc}`);
}
