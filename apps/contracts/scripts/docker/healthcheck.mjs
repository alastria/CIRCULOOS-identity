#!/usr/bin/env node
/**
 * Docker health check script for Hardhat node
 * Used by Docker HEALTHCHECK to verify RPC is responding
 * Verifies that the RPC is actually responding, not just listening
 */

const RPC_URL = process.env.HARDHAT_RPC || 'http://127.0.0.1:8545'

async function checkHealth() {
  try {
    // Test RPC with eth_blockNumber
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: []
      })
    })

    if (!response.ok) {
      console.error(`RPC returned status ${response.status}`)
      process.exit(1)
    }

    const data = await response.json()
    
    if (data.error) {
      console.error(`RPC error: ${data.error.message}`)
      process.exit(1)
    }

    if (!data.result) {
      console.error('RPC response missing result')
      process.exit(1)
    }

    // Success
    process.exit(0)
  } catch (error) {
    console.error(`Health check failed: ${error.message}`)
    process.exit(1)
  }
}

// Timeout after 5 seconds
const timeout = setTimeout(() => {
  console.error('Health check timeout')
  process.exit(1)
}, 5000)

checkHealth().finally(() => {
  clearTimeout(timeout)
})

