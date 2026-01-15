import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

const { getSelectors, FacetCutAction } = require('../libraries/diamond.js')

interface DeployOptions {
  withInit?: boolean
  envFile?: string
  environment?: 'local' | 'test' | 'dev' | 'docker'
}

interface Checkpoint {
  status: 'deployment_pending' | 'ready'
  diamondAddress?: string
  deployedAt?: string
  network?: string
  chainId?: number
}

export async function deployDiamond(options: DeployOptions = {}) {
  const { withInit = false, envFile, environment } = options

  const accounts = await ethers.getSigners()
  const contractOwner = accounts[0]
  const network = await ethers.provider.getNetwork()

  // Detect environment if not provided (use network name from Hardhat config)
  const networkName = (network as any).name || 'hardhat'
  const detectedEnv = (process.env.DEPLOY_ENV as 'local' | 'test' | 'dev' | 'docker') || environment || detectEnvironment(networkName)

  console.log(`\n🚀 Deploying Diamond to network: ${networkName} (chainId: ${network.chainId})`)
  console.log(`🌍 Environment: ${detectedEnv}`)
  console.log(`📝 Deployer: ${contractOwner.address}`)
  console.log(`🔧 With Init: ${withInit ? 'Yes' : 'No'}\n`)

  // Set checkpoint to deployment_pending
  await updateCheckpoint(detectedEnv, {
    status: 'deployment_pending',
    network: networkName,
    chainId: network.chainId
  })

  // 1. Deploy DiamondCutFacet
  console.log('📦 Deploying DiamondCutFacet...')
  const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet')
  const diamondCutFacet = await DiamondCutFacet.deploy()
  await diamondCutFacet.deployed()
  console.log(`✅ DiamondCutFacet deployed: ${diamondCutFacet.address}`)

  // 2. Deploy Diamond
  console.log('💎 Deploying Diamond...')
  const Diamond = await ethers.getContractFactory('Diamond')
  const diamond = await Diamond.deploy(contractOwner.address, diamondCutFacet.address)
  await diamond.deployed()
  console.log(`✅ Diamond deployed: ${diamond.address}`)

  // 3. Deploy DiamondInit (only if withInit)
  let diamondInit
  if (withInit) {
    console.log('🔧 Deploying DiamondInit...')
    const DiamondInit = await ethers.getContractFactory('DiamondInit')
    diamondInit = await DiamondInit.deploy()
    await diamondInit.deployed()
    console.log(`✅ DiamondInit deployed: ${diamondInit.address}`)
  }

  // 4. Deploy Facets
  const FacetNames = [
    'DiamondLoupeFacet',
    'OwnershipFacet',
    'TrustedIssuerFacet',
    'CredentialStatusFacet',
    'AttestationBatchFacet'
  ]
  const cut = []

  console.log('📦 Deploying Facets...')
  for (const FacetName of FacetNames) {
    const Facet = await ethers.getContractFactory(FacetName)
    const facet = await Facet.deploy()
    await facet.deployed()
    console.log(`✅ ${FacetName} deployed: ${facet.address}`)

    cut.push({
      facetAddress: facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
    })
  }

  // 5. Execute Diamond Cut
  console.log('\n🔨 Executing Diamond Cut...')
  const diamondCut = await ethers.getContractAt('IDiamondCut', diamond.address)

  let initAddress = ethers.constants.AddressZero
  let initCalldata = '0x'

  if (withInit && diamondInit) {
    initAddress = diamondInit.address
    initCalldata = diamondInit.interface.encodeFunctionData('init')
  }

  const tx = await diamondCut.diamondCut(cut, initAddress, initCalldata)
  console.log(`📝 Diamond cut tx: ${tx.hash}`)

  const receipt = await tx.wait()
  if (!receipt.status) {
    throw Error(`❌ Diamond upgrade failed: ${tx.hash}`)
  }
  console.log('✅ Completed diamond cut\n')

  // 5.5 Add Deployer as Trusted Issuer (if withInit)
  if (withInit) {
    console.log('🔑 Adding Deployer as Trusted Issuer...')
    const trustedIssuerFacet = await ethers.getContractAt('TrustedIssuerFacet', diamond.address)
    const txAdd = await trustedIssuerFacet.addTrustedIssuer(contractOwner.address)
    await txAdd.wait()
    console.log(`✅ Deployer added as Trusted Issuer: ${contractOwner.address}`)
  }

  // 6. Save Diamond address to env files for all services
  await saveDiamondAddressToAllServices(diamond.address, detectedEnv)

  // 6.5 Save to shared config (for Docker environments)
  await saveToSharedConfig(diamond.address, contractOwner.address, network)

  // 7. Update checkpoint to ready
  await updateCheckpoint(detectedEnv, {
    status: 'ready',
    diamondAddress: diamond.address,
    deployedAt: new Date().toISOString(),
    network: network.name,
    chainId: network.chainId
  })

  console.log(`\n🎉 Diamond deployment complete!`)
  console.log(`📍 Diamond Address: ${diamond.address}`)
  console.log(`✅ Checkpoint: ready\n`)

  return diamond.address
}

function detectEnvironment(networkName: string): 'local' | 'test' | 'dev' | 'docker' {
  if (networkName === 'test') return 'test'
  if (networkName === 'dev') return 'dev'
  return 'local'
}

async function updateCheckpoint(environment: 'local' | 'test' | 'dev' | 'docker', checkpoint: Partial<Checkpoint>) {
  try {
    // From smart-contracts/scripts/deploy -> go up 3 levels to reach project root
    const rootDir = path.resolve(__dirname, '../../..')
    const checkpointPath = path.join(rootDir, `.checkpoint.${environment}.json`)

    // Ensure directory exists
    const checkpointDir = path.dirname(checkpointPath)
    if (!fs.existsSync(checkpointDir)) {
      fs.mkdirSync(checkpointDir, { recursive: true })
    }

    const existing: Checkpoint = fs.existsSync(checkpointPath)
      ? JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'))
      : { status: 'deployment_pending' }

    const updated: Checkpoint = { ...existing, ...checkpoint }
    fs.writeFileSync(checkpointPath, JSON.stringify(updated, null, 2), 'utf-8')
    console.log(`📋 Checkpoint updated: ${updated.status}`)
  } catch (error) {
    console.warn(`⚠️  Could not update checkpoint:`, error)
  }
}

/**
 * Save Diamond config to shared Docker volume
 * This allows services to read the Diamond address without needing env var propagation
 */
async function saveToSharedConfig(diamondAddress: string, ownerAddress: string, network: any) {
  const sharedConfigPath = process.env.SHARED_CONFIG_PATH || '/shared/diamond-config.json'

  try {
    const config = {
      diamondAddress,
      ownerAddress,
      chainId: Number(network.chainId),
      networkName: network.name || 'hardhat',
      deployedAt: new Date().toISOString()
    }

    // Ensure directory exists
    const configDir = path.dirname(sharedConfigPath)
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    fs.writeFileSync(sharedConfigPath, JSON.stringify(config, null, 2), 'utf-8')
    console.log(`💾 Saved shared config to ${sharedConfigPath}`)
  } catch (error) {
    // This is expected to fail in non-Docker environments where /shared doesn't exist
    console.log(`ℹ️  Shared config not saved (expected in non-Docker environments)`)
  }
}

async function saveDiamondAddressToAllServices(diamondAddress: string, environment: 'local' | 'test' | 'dev' | 'docker') {
  // From smart-contracts/scripts/deploy -> go up 3 levels to reach project root
  const rootDir = path.resolve(__dirname, '../../..')

  // Services that need DIAMOND_ADDRESS
  const services = [
    { name: 'smart-contracts', path: rootDir },
    { name: 'issuer', path: path.join(rootDir, 'backend/issuer') },
    { name: 'verifier', path: path.join(rootDir, 'backend/verifier') },
    { name: 'frontend', path: path.join(rootDir, 'frontend') }
  ]

  // Determine .env file name based on environment
  const envFileName = (environment === 'test' || environment === 'docker') ? '.env.docker' : environment === 'dev' ? '.env' : '.env.local'

  for (const service of services) {
    const envPath = path.join(service.path, envFileName)
    await saveDiamondAddress(diamondAddress, envPath, service.name)

    // For docker environment, also update .env file (which is what containers read)
    // This ensures containers can reload the variable without full restart
    if (environment === 'docker') {
      const envPathMain = path.join(service.path, '.env')
      await saveDiamondAddress(diamondAddress, envPathMain, service.name)
    }
  }
}

async function saveDiamondAddress(diamondAddress: string, envFilePath: string, serviceName: string) {
  try {
    const envPath = path.resolve(envFilePath)

    // Ensure directory exists
    const envDir = path.dirname(envPath)
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true })
    }

    let envContent = ''

    // Read existing .env file if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8')
    }

    // Determine env variable name based on service
    let envVarName = 'DIAMOND_ADDRESS'
    if (serviceName === 'frontend' || serviceName === 'web') {
      envVarName = 'NEXT_PUBLIC_DIAMOND_ADDRESS'
    }

    // Update or add DIAMOND_ADDRESS (or specific var)
    const diamondAddressRegex = new RegExp(`^${envVarName}=.*$`, 'm')
    if (diamondAddressRegex.test(envContent)) {
      envContent = envContent.replace(diamondAddressRegex, `${envVarName}=${diamondAddress}`)
    } else {
      // Add at the beginning after comment if exists
      if (envContent.trim().startsWith('#')) {
        const lines = envContent.split('\n')
        const commentLine = lines[0]
        envContent = `${commentLine}\n${envVarName}=${diamondAddress}\n${lines.slice(1).join('\n')}`
      } else {
        envContent = `${envVarName}=${diamondAddress}\n${envContent}`
      }
    }

    fs.writeFileSync(envPath, envContent, 'utf-8')
    console.log(`💾 Saved ${envVarName} to ${serviceName}/${path.basename(envPath)}`)
  } catch (error) {
    console.warn(`⚠️  Could not save ${envFilePath}:`, error)
  }
}

if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2)
  const withInit = args.includes('--init') || args.includes('-i') || process.env.DEPLOY_INIT === 'true'

  // Environment will be detected from network name in deployDiamond
  deployDiamond({ withInit })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Deployment failed:', error)
      process.exit(1)
    })
}

