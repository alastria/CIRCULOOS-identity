#!/usr/bin/env node
import { spawn } from "node:child_process"
import process from "node:process"

let childProcess = null

/**
 * Handles process signals to gracefully shutdown the Hardhat node
 * @param {string} signal - Process signal (SIGINT, SIGTERM, SIGQUIT)
 */
export function handleSignal(signal) {
  if (childProcess && !childProcess.killed) {
    childProcess.kill(signal)
  } else {
    process.exit(0)
  }
}

/**
 * Sets up signal handlers for graceful shutdown
 */
export function setupSignalHandlers() {
  process.on("SIGINT", handleSignal)
  process.on("SIGTERM", handleSignal)
  process.on("SIGQUIT", handleSignal)
}

/**
 * Starts the Hardhat node
 * @param {Object} options - Options for starting the node
 * @param {string} [options.rpcUrl] - RPC URL to display
 * @returns {Promise<void>}
 */
export async function startHardhatNode(options = {}) {
  const { rpcUrl = "http://127.0.0.1:8545" } = options

  console.log(`
┌─────────────────────────────────────────────────────┐
│  Circuloos Hardhat Node (Local Blockchain)         │
│  RPC: ${rpcUrl.padEnd(45)}│
│  Chain ID: 31337                                    │
└─────────────────────────────────────────────────────┘
`)

  childProcess = spawn("hardhat", ["node"], { stdio: "inherit" })
  
  childProcess.on("exit", code => {
    process.exit(code ?? 0)
  })
  
  childProcess.on("error", err => {
    console.error("[hardhat-node] Failed to launch Hardhat node:", err)
    process.exit(1)
  })

  return childProcess
}

