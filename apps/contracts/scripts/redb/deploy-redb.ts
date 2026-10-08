/**
 * A4.3 — Deploy the identity Diamond on Red-B (permanent transactions: run only with
 * Pablo's explicit go-ahead at the moment of execution).
 *
 *   EXPECTED_CHAIN_ID=2020 REDB_RPC_URL=… WEB3SIGNER_URL=… OWNER_ADDRESS=0x… MANIFEST_PATH=…/deployed-redb.json \
 *     pnpm hardhat run --network redb scripts/redb/deploy-redb.ts
 *
 * Unlike scripts/deploy/deploy-diamond.ts it never writes .env or checkpoint files, never
 * holds a private key (the owner signs through Web3Signer), adds no trusted issuer (that is
 * A4.4), refuses to overwrite an existing manifest, and writes the manifest only at the end.
 */
import * as fs from 'fs'
import { ethers, network } from 'hardhat'
import { FACETS, assertChainId, gitCommit, manifestPath, requireEnv, selectorsOf, txOverrides, web3signer, type Manifest } from './lib/redb'

async function main() {
  const outPath = manifestPath()
  if (fs.existsSync(outPath)) throw new Error(`Refusing to overwrite an existing manifest: ${outPath}`)

  const chainId = await assertChainId()
  const owner = web3signer(requireEnv('OWNER_ADDRESS'))
  const overrides = await txOverrides()
  const git = gitCommit()
  console.log(`[deploy-redb] network=${network.name} chainId=${chainId} owner=${owner.address} gasPrice=${overrides.gasPrice.toString()}`)
  console.log(`[deploy-redb] commit=${git.commit}${git.dirty ? ' (WORKING TREE NOT CLEAN)' : ''}`)
  if (git.dirty && process.env.ALLOW_DIRTY_TREE !== 'true') {
    throw new Error('Working tree is not clean: deploy only from a committed state (set ALLOW_DIRTY_TREE=true for rehearsals).')
  }

  const transactions: Manifest['transactions'] = []
  const deploy = async (name: string, ...args: any[]) => {
    const factory = await ethers.getContractFactory(name, owner)
    const contract = await factory.deploy(...args, overrides)
    const receipt = await contract.deployTransaction.wait()
    transactions.push({ step: `deploy ${name}`, hash: receipt.transactionHash, contract: contract.address })
    console.log(`[deploy-redb] ${name} → ${contract.address} (tx ${receipt.transactionHash})`)
    return contract
  }

  const cutFacet = await deploy('DiamondCutFacet')
  const diamond = await deploy('Diamond', owner.address, cutFacet.address)
  const diamondInit = await deploy('DiamondInit')

  const facets: Manifest['facets'] = {}
  const cut = []
  for (const name of FACETS) {
    const facet = await deploy(name)
    const selectors = selectorsOf(facet.interface)
    facets[name] = { address: facet.address, selectors }
    cut.push({ facetAddress: facet.address, action: 0, functionSelectors: selectors })
  }

  const diamondCut = await ethers.getContractAt('IDiamondCut', diamond.address, owner)
  const cutTx = await diamondCut.diamondCut(cut, diamondInit.address, diamondInit.interface.encodeFunctionData('init'), overrides)
  const cutReceipt = await cutTx.wait()
  transactions.push({ step: 'diamondCut (facets + DiamondInit.init)', hash: cutReceipt.transactionHash })
  console.log(`[deploy-redb] diamondCut applied (tx ${cutReceipt.transactionHash})`)

  const manifest: Manifest = {
    network: network.name,
    chainId,
    diamondAddress: diamond.address,
    owner: owner.address,
    diamondCutFacet: cutFacet.address,
    diamondInit: diamondInit.address,
    facets,
    git,
    deployedAt: new Date().toISOString(),
    transactions,
  }
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2))
  console.log(`[deploy-redb] manifest written to ${outPath}`)
  console.log(`[deploy-redb] DIAMOND_ADDRESS=${diamond.address}`)
}

main().catch((err) => {
  console.error('[deploy-redb] FAILED:', err)
  // Set the exit code instead of exiting abruptly: that aborts Node on Windows while sockets close
  process.exitCode = 1
})
