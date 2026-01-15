#!/usr/bin/env node
import { isRpcAvailable, getRpcUrl } from "./utils/rpc-check.mjs"
import { startHardhatNode, setupSignalHandlers } from "./utils/node-starter.mjs"
import process from "node:process"

const main = async () => {
  const rpcUrl = getRpcUrl()

  // Check if RPC is already running
  if (await isRpcAvailable(rpcUrl)) {
    console.log(`[hardhat-node] RPC already running at ${rpcUrl}, skipping new start.`)
    process.exit(0)
  }

  // Setup signal handlers for graceful shutdown
  setupSignalHandlers()

  // Start Hardhat node
  await startHardhatNode({ rpcUrl })
}

main().catch(err => {
  console.error("[hardhat-node] Unexpected error while preparing Hardhat node:", err)
  process.exit(1)
})
