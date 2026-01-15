#!/usr/bin/env node
/**
 * Deploy smart contracts to Hardhat node running in Docker
 * This script should be run AFTER docker compose up to deploy contracts
 * and update .env.shared with the deployed addresses
 */

import { spawn } from 'child_process'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

console.log('🚀 Deploying contracts to Hardhat Docker...\n')

/**
 * Execute a command and capture output
 */
function execCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'inherit'],
      cwd: rootDir,
      env: { ...process.env, HARDHAT_NETWORK: 'localhost' }
    })

    let output = ''
    proc.stdout.on('data', (data) => {
      const text = data.toString()
      process.stdout.write(text)
      output += text
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`))
      } else {
        resolve(output)
      }
    })

    proc.on('error', reject)
  })
}

/**
 * Deploy TrustedIssuerRegistry
 */
async function deployTrustedRegistry() {
  console.log('📜 Deploying TrustedIssuerRegistry...')
  const output = await execCommand('docker', [
    'compose',
    'exec',
    '-T',
    'hardhat',
    'pnpm',
    'run',
    'deploy:registry'
  ])

  const match = output.match(/TrustedIssuerRegistry deployed at:\s*(0x[a-fA-F0-9]{40})/i)
  if (!match) {
    throw new Error('Could not find TrustedIssuerRegistry address in output')
  }

  const address = match[1]
  console.log(`✅ TrustedIssuerRegistry: ${address}\n`)
  return address
}

/**
 * Deploy other registries (Credential, Revocation, Proof)
 */
async function deployRegistries() {
  console.log('📜 Deploying Credential/Revocation/Proof registries...')
  const output = await execCommand('docker', [
    'compose',
    'exec',
    '-T',
    'hardhat',
    'pnpm',
    'run',
    'deploy:registries'
  ])

  const credMatch = output.match(/CredentialRegistry deployed at:\s*(0x[a-fA-F0-9]{40})/i)
  const revMatch = output.match(/RevocationRegistry deployed at:\s*(0x[a-fA-F0-9]{40})/i)
  const proofMatch = output.match(/ProofRegistry deployed at:\s*(0x[a-fA-F0-9]{40})/i)

  if (!credMatch || !revMatch || !proofMatch) {
    throw new Error('Could not find all registry addresses in output')
  }

  const addresses = {
    credential: credMatch[1],
    revocation: revMatch[1],
    proof: proofMatch[1]
  }

  console.log(`✅ CredentialRegistry: ${addresses.credential}`)
  console.log(`✅ RevocationRegistry: ${addresses.revocation}`)
  console.log(`✅ ProofRegistry: ${addresses.proof}\n`)

  return addresses
}

/**
 * Update .env.shared with deployed addresses
 */
function updateEnvShared(trustedRegistry, registries) {
  const envPath = join(rootDir, '.env.shared')
  let envContent = readFileSync(envPath, 'utf8')

  // Update or add addresses
  const updates = {
    'EIP712_VERIFYING_CONTRACT': trustedRegistry,
    'CREDENTIAL_REGISTRY_ADDRESS': registries.credential,
    'REVOCATION_REGISTRY_ADDRESS': registries.revocation,
    'PROOF_REGISTRY_ADDRESS': registries.proof,
    'TRUSTED_ISSUER_REGISTRY_ADDRESS': trustedRegistry
  }

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'gm')
    const commentRegex = new RegExp(`^# ${key}=.*$`, 'gm')

    if (regex.test(envContent)) {
      // Update existing value
      envContent = envContent.replace(regex, `${key}=${value}`)
    } else if (commentRegex.test(envContent)) {
      // Uncomment and update
      envContent = envContent.replace(commentRegex, `${key}=${value}`)
    } else {
      // Add at the end of smart contract section
      const marker = '# Smart Contract Addresses'
      if (envContent.includes(marker)) {
        envContent = envContent.replace(
          marker,
          `${marker}\n${key}=${value}`
        )
      } else {
        envContent += `\n${key}=${value}\n`
      }
    }
  }

  writeFileSync(envPath, envContent, 'utf8')
  console.log('✅ Updated .env.shared with contract addresses\n')
}

/**
 * Main execution
 */
async function main() {
  try {
    // Deploy contracts
    const trustedRegistry = await deployTrustedRegistry()
    const registries = await deployRegistries()

    // Update .env.shared
    updateEnvShared(trustedRegistry, registries)

    console.log('🎉 All contracts deployed successfully!\n')
    console.log('Contract addresses have been saved to .env.shared')
    console.log('\n📝 Next steps:')
    console.log('1. Restart services to load new addresses: pnpm docker:stop && pnpm docker:start')
    console.log('2. Or rebuild if you modified code: pnpm docker:build && pnpm docker:start\n')
    console.log('🔐 Security note:')
    console.log(`The deployer account (0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266) is automatically`)
    console.log('registered as a trusted issuer in the TrustedIssuerRegistry.\n')

  } catch (error) {
    console.error('❌ Error deploying contracts:', error.message)
    process.exit(1)
  }
}

main()
