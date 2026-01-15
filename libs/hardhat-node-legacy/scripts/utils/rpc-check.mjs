#!/usr/bin/env node
import http from "node:http"
import { URL } from "node:url"

/**
 * Makes a JSON-RPC request to the specified URL
 * @param {URL} url - The RPC endpoint URL
 * @param {string} payload - JSON-RPC payload
 * @returns {Promise<{statusCode: number, body: string}>}
 */
export function jsonRpcRequest(url, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname || "/",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
        timeout: 2000,
      },
      res => {
        const chunks = []
        res.on("data", chunk => chunks.push(chunk))
        res.on("end", () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }))
      },
    )
    req.on("error", reject)
    req.on("timeout", () => {
      req.destroy(new Error("RPC request timed out"))
    })
    req.write(payload)
    req.end()
  })
}

/**
 * Checks if an RPC endpoint is available
 * @param {string} rpcUrl - The RPC endpoint URL
 * @returns {Promise<boolean>}
 */
export async function isRpcAvailable(rpcUrl) {
  try {
    const url = new URL(rpcUrl)
    const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] })
    const response = await jsonRpcRequest(url, payload)
    return response.statusCode === 200
  } catch (err) {
    return false
  }
}

/**
 * Gets the RPC URL from environment variables
 * @returns {string}
 */
export function getRpcUrl() {
  return process.env.RPC_URL
    || process.env.BLOCKCHAIN_RPC_URL
    || process.env.NEXT_PUBLIC_BLOCKCHAIN_RPC_URL
    || "http://127.0.0.1:8545"
}

