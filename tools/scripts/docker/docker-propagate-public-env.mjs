#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const sharedPath = join(root, '.env.shared')
const webEnv = join(root, 'apps/web/.env')
const webEnvLocal = join(root, 'apps/web/.env.local')

function parseEnv(content) {
  const map = new Map()
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)=(.*)$/)
    if (m) map.set(m[1], m[2])
  }
  return map
}

function readMap(path) {
  if (!existsSync(path)) return new Map()
  return parseEnv(readFileSync(path, 'utf8'))
}

function writeMap(path, map) {
  const lines = []
  for (const [k, v] of map) lines.push(`${k}=${v}`)
  writeFileSync(path, lines.join('\n') + '\n', 'utf8')
}

if (!existsSync(sharedPath)) {
  console.log(`.env.shared not found at ${sharedPath}, skipping propagation`)
  process.exit(0)
}

const shared = readMap(sharedPath)

// derive public values
const defaults = new Map()
defaults.set('NEXT_PUBLIC_ISSUER_URL', 'http://localhost:3001')
defaults.set('NEXT_PUBLIC_VERIFIER_URL', 'http://localhost:4001')
if (shared.has('EIP712_DOMAIN_NAME')) defaults.set('NEXT_PUBLIC_EIP712_DOMAIN_NAME', shared.get('EIP712_DOMAIN_NAME'))
if (shared.has('EIP712_DOMAIN_VERSION')) defaults.set('NEXT_PUBLIC_EIP712_DOMAIN_VERSION', shared.get('EIP712_DOMAIN_VERSION'))
if (shared.has('CHAIN_ID')) {
  defaults.set('NEXT_PUBLIC_EIP712_CHAIN_ID', shared.get('CHAIN_ID'))
  defaults.set('NEXT_PUBLIC_CHAIN_ID', shared.get('CHAIN_ID'))
}
if (shared.has('EIP712_VERIFYING_CONTRACT')) defaults.set('NEXT_PUBLIC_EIP712_VERIFYING_CONTRACT', shared.get('EIP712_VERIFYING_CONTRACT'))

// ensure web env exists (copy example if missing)
const webExample = join(root, 'apps/web/.env.example')
if (!existsSync(webEnv) && existsSync(webExample)) {
  copyFileSync(webExample, webEnv)
  console.log(`created ${webEnv} from ${webExample}`)
}
if (!existsSync(webEnvLocal) && existsSync(webExample)) {
  copyFileSync(webExample, webEnvLocal)
  console.log(`created ${webEnvLocal} from ${webExample}`)
}

// merge defaults into web env files
const webMap = readMap(webEnv)
for (const [k, v] of defaults) webMap.set(k, v)
writeMap(webEnv, webMap)
console.log(`updated ${webEnv}`)

const webLocalMap = readMap(webEnvLocal)
for (const [k, v] of defaults) webLocalMap.set(k, v)
writeMap(webEnvLocal, webLocalMap)
console.log(`updated ${webEnvLocal}`)

console.log('docker-propagate-public-env: done')
