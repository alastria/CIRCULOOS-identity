#!/usr/bin/env node
import { existsSync, copyFileSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

const repoRoot = process.cwd()

const sharedExample = join(repoRoot, '.env.shared.example')
const sharedTarget = join(repoRoot, '.env.shared')
const rootExample = join(repoRoot, '.env.example')
const rootTarget = join(repoRoot, '.env')

const services = [
  'apps/issuer',
  'apps/verifier',
  'apps/web'
]

function copyIfMissing(src, dst) {
  if (!existsSync(dst) && existsSync(src)) {
    copyFileSync(src, dst)
    console.log(`created ${dst} from ${src}`)
    return true
  }
  return false
}

// copy shared
if (copyIfMissing(sharedExample, sharedTarget)) {
  // ensure root .env also exists
  copyIfMissing(rootExample, rootTarget)
}

// propagate shared to service envs where appropriate
for (const s of services) {
  const example = join(repoRoot, s, '.env.example')
  const target = join(repoRoot, s, '.env')
  copyIfMissing(example, target)
}

// For web, also ensure .env.local exists for dev convenience
const webLocalExample = join(repoRoot, 'apps/web/.env.example')
const webLocalTarget = join(repoRoot, 'apps/web/.env.local')
copyIfMissing(webLocalExample, webLocalTarget)

console.log('docker-prepare-env: done')
