#!/usr/bin/env node
/**
 * Initialize filestore directory structure for issuer and verifier services.
 * This ensures that all necessary directories exist before services start.
 * 
 * Usage: node scripts/core/init-filestore.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// Load environment variables from .env file if present
const envPath = path.join(rootDir, '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim()
    }
  })
}

// Get filestore base directories from environment or defaults
const issuerFilestore = process.env.FILESTORE_BASE_DIR || './apps/issuer/tmp-filestore-w3c'
const verifierFilestore = process.env.FILESTORE_BASE_DIR 
  ? (process.env.FILESTORE_BASE_DIR.includes('issuer') 
      ? process.env.FILESTORE_BASE_DIR.replace('issuer', 'verifier').replace('tmp-filestore-w3c', 'tmp-filestore')
      : './apps/verifier/tmp-filestore')
  : './apps/verifier/tmp-filestore'

// Convert relative paths to absolute
const issuerPath = path.isAbsolute(issuerFilestore) 
  ? issuerFilestore 
  : path.join(rootDir, issuerFilestore)
const verifierPath = path.isAbsolute(verifierFilestore)
  ? verifierFilestore
  : path.join(rootDir, verifierFilestore)

console.log('[init-filestore] Initializing filestore directories...')
console.log('[init-filestore] Issuer base:', issuerPath)
console.log('[init-filestore] Verifier base:', verifierPath)

// Issuer directories
const issuerDirs = [
  path.join(issuerPath, 'issuances'),
  path.join(issuerPath, 'vcs'),
]

// Verifier directories
const verifierDirs = [
  path.join(verifierPath, 'trusted-issuers'),
  path.join(verifierPath, 'hybrid-state'),
  path.join(verifierPath, 'onchain'),
  path.join(verifierPath, 'onchain', 'issued'),
]

// Create all directories
const allDirs = [...issuerDirs, ...verifierDirs]
let created = 0
let existed = 0

for (const dir of allDirs) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log('[init-filestore] ✓ Created:', dir)
      created++
      
      // Create .gitkeep file to preserve directory in git
      const gitkeepPath = path.join(dir, '.gitkeep')
      fs.writeFileSync(gitkeepPath, '# This file preserves the directory structure\n')
    } else {
      existed++
    }
  } catch (error) {
    console.error('[init-filestore] ✗ Failed to create:', dir, error.message)
    process.exit(1)
  }
}

// Create initial state files for verifier if they don't exist
const initialStates = [
  {
    path: path.join(verifierPath, 'hybrid-state', 'credential-index.json'),
    content: { lastProcessedBlock: 0, records: [] }
  },
  {
    path: path.join(verifierPath, 'hybrid-state', 'revocation-index.json'),
    content: { lastProcessedBlock: 0, records: [] }
  },
]

for (const { path: filePath, content } of initialStates) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n')
      console.log('[init-filestore] ✓ Created initial state:', filePath)
      created++
    }
  } catch (error) {
    console.error('[init-filestore] ✗ Failed to create state file:', filePath, error.message)
  }
}

console.log(`[init-filestore] Done! Created ${created} new items, ${existed} already existed.`)
console.log('[init-filestore] Filestore structure is ready.')
