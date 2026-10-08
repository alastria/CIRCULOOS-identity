/**
 * Real-chain test harness: a throwaway `hardhat node` (from apps/contracts) on a free
 * local port, with the identity Diamond deployed from the compiled artifacts.
 *
 * Deliberately does NOT use apps/contracts/scripts/deploy/deploy-diamond.ts: that script
 * writes the Diamond address into the services' .env files and checkpoint files.
 * Local only — never points at Red-B.
 */
import { spawn, type ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as net from 'net'
import * as path from 'path'
import { ethers, Wallet } from 'ethers'

const CONTRACTS_DIR = path.resolve(__dirname, '..', '..', '..', 'contracts')
const HARDHAT_CLI = path.join(CONTRACTS_DIR, 'node_modules', 'hardhat', 'internal', 'cli', 'cli.js')
const ARTIFACTS = path.join(CONTRACTS_DIR, 'artifacts', 'contracts')

/** Hardhat's public development mnemonic; its accounts only hold funds on a local node. */
const DEV_MNEMONIC = 'test test test test test test test test test test test junk'

export function devWallet(index: number): Wallet {
  return Wallet.fromMnemonic(DEV_MNEMONIC, `m/44'/60'/0'/0/${index}`)
}

function artifact(relative: string) {
  return JSON.parse(fs.readFileSync(path.join(ARTIFACTS, relative), 'utf8'))
}

const FACETS = [
  'diamond/DiamondLoupeFacet.sol/DiamondLoupeFacet.json',
  'diamond/OwnershipFacet.sol/OwnershipFacet.json',
  'facets/TrustedIssuer/TrustedIssuerFacet.sol/TrustedIssuerFacet.json',
  'facets/CredentialStatus/CredentialStatusFacet.sol/CredentialStatusFacet.json',
  'facets/AttestationBatch/AttestationBatchFacet.sol/AttestationBatchFacet.json',
]

export interface LocalIdentityChain {
  rpcUrl: string
  chainId: number
  diamondAddress: string
  provider: ethers.providers.JsonRpcProvider
  /** Diamond with every facet's ABI, connected to the owner (account #0). */
  diamond: ethers.Contract
  stop(): Promise<void>
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
  })
}

function waitForNode(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = ''
    const onData = (chunk: Buffer) => {
      output += chunk.toString()
      if (output.includes('Started HTTP')) {
        child.stdout?.off('data', onData)
        resolve()
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', (c: Buffer) => (output += c.toString()))
    child.once('exit', (code) => reject(new Error(`hardhat node exited early (code ${code}):\n${output}`)))
  })
}

export async function startLocalIdentityChain(): Promise<LocalIdentityChain> {
  const port = await freePort()
  const rpcUrl = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [HARDHAT_CLI, 'node', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: CONTRACTS_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const stopNode = async () => {
    if (child.exitCode === null) {
      const exited = new Promise((r) => child.once('exit', r))
      child.kill()
      await exited
    }
  }

  try {
    await waitForNode(child)
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    const owner = devWallet(0).connect(provider)

    const deploy = async (relative: string, ...args: any[]) => {
      const { abi, bytecode } = artifact(relative)
      const contract = await new ethers.ContractFactory(abi, bytecode, owner).deploy(...args)
      await contract.deployed()
      return contract
    }

    const cutFacet = await deploy('diamond/DiamondCutFacet.sol/DiamondCutFacet.json')
    const diamondContract = await deploy('diamond/Diamond.sol/Diamond.json', owner.address, cutFacet.address)

    const cut = []
    const abis: any[] = [artifact('diamond/DiamondCutFacet.sol/DiamondCutFacet.json').abi]
    for (const relative of FACETS) {
      const facet = await deploy(relative)
      const selectors = Object.keys(facet.interface.functions).map((f) => facet.interface.getSighash(f))
      cut.push({ facetAddress: facet.address, action: 0, functionSelectors: selectors })
      abis.push(artifact(relative).abi)
    }
    const diamondCut = new ethers.Contract(diamondContract.address, abis[0], owner)
    await (await diamondCut.diamondCut(cut, ethers.constants.AddressZero, '0x')).wait()

    // Merge ABIs (dedupe by signature) so one Contract exposes every facet
    const seen = new Set<string>()
    const merged = abis.flat().filter((item: any) => {
      const key = `${item.type}:${item.name}:${(item.inputs || []).map((i: any) => i.type).join(',')}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return {
      rpcUrl,
      chainId: 31337,
      diamondAddress: diamondContract.address,
      provider,
      diamond: new ethers.Contract(diamondContract.address, merged, owner),
      stop: async () => {
        await stopNode()
      },
    }
  } catch (err) {
    await stopNode()
    throw err
  }
}
