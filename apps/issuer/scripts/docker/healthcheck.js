#!/usr/bin/env node
/**
 * Docker health check script for Issuer service
 * Verifies that the service is responding to HTTP requests
 */

const http = require('http')

const PORT = process.env.HTTP_PORT || 3001
const HOST = process.env.HTTP_HOST || '127.0.0.1'

const options = {
  host: HOST === '0.0.0.0' ? '127.0.0.1' : HOST,
  port: PORT,
  path: '/health',
  timeout: 2000
}

const request = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`)
  if (res.statusCode === 200) {
    process.exit(0)
  } else {
    process.exit(1)
  }
})

request.on('error', (err) => {
  console.error(`ERROR: ${err.message}`)
  process.exit(1)
})

request.end()
