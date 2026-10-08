/**
 * A4.5 — Read-only verification of the deployed identity Diamond. Sends no transaction.
 *
 *   EXPECTED_CHAIN_ID=2020 REDB_RPC_URL=… MANIFEST_PATH=… [EXPECTED_TRUSTED_ISSUERS=0x…,0x…] \
 *     pnpm hardhat run --network redb scripts/redb/verify-redb.ts
 *
 * Checks that every facet's on-chain bytecode equals the compiled artifact of this checkout,
 * that the Diamond routes exactly the expected selectors to each facet, the owner, the ERC-165
 * interfaces, that it is not paused, the trusted issuer list, and an unknown credential's status.
 * Exits with code 1 on any mismatch.
 */
import { artifacts, ethers } from 'hardhat'
import { FACETS, addressList, assertChainId, readManifest, selectorsOf } from './lib/redb'

const INTERFACES: Record<string, string> = {
  'ERC-165': '0x01ffc9a7',
  IDiamondCut: '0x1f931c1c',
  IDiamondLoupe: '0x48e2b093',
  'ERC-173': '0x7f5828d0',
}

async function main() {
  await assertChainId()
  const manifest = readManifest()
  const failures: string[] = []
  const check = (ok: boolean, label: string) => {
    console.log(`${ok ? '  ✔' : '  ✘'} ${label}`)
    if (!ok) failures.push(label)
  }

  // 1. Bytecode of every facet equals the compiled artifact
  const deployed: Record<string, string> = { ...Object.fromEntries(FACETS.map((n) => [n, manifest.facets[n]?.address])), DiamondCutFacet: manifest.diamondCutFacet }
  for (const [name, address] of Object.entries(deployed)) {
    const { deployedBytecode } = await artifacts.readArtifact(name)
    const code = address ? await ethers.provider.getCode(address) : '0x'
    check(code.toLowerCase() === deployedBytecode.toLowerCase(), `${name} bytecode at ${address} matches the compiled artifact`)
  }

  // 2. Selector routing: exactly the expected selectors per facet, nothing else
  const loupe = await ethers.getContractAt('DiamondLoupeFacet', manifest.diamondAddress)
  const onchain = new Map<string, Set<string>>()
  for (const f of await loupe.facets()) onchain.set(f.facetAddress.toLowerCase(), new Set(f.functionSelectors))
  for (const name of [...FACETS, 'DiamondCutFacet']) {
    const expected = selectorsOf(new ethers.utils.Interface((await artifacts.readArtifact(name)).abi))
    const routed = onchain.get(String(deployed[name]).toLowerCase()) ?? new Set()
    const same = expected.length === routed.size && expected.every((s) => routed.has(s))
    check(same, `${name}: ${expected.length} selectors routed, no more and no less`)
  }
  check(onchain.size === FACETS.length + 1, `Diamond has exactly ${FACETS.length + 1} facets (found ${onchain.size})`)

  // 3. Ownership, interfaces, pause
  const ownership = await ethers.getContractAt('OwnershipFacet', manifest.diamondAddress)
  check((await ownership.owner()).toLowerCase() === manifest.owner.toLowerCase(), `owner() is ${manifest.owner}`)
  const erc165 = await ethers.getContractAt('DiamondLoupeFacet', manifest.diamondAddress)
  for (const [label, id] of Object.entries(INTERFACES)) check(await erc165.supportsInterface(id), `supportsInterface ${label}`)
  const pausable = await ethers.getContractAt('PausableFacet', manifest.diamondAddress)
  check((await pausable.paused()) === false, 'not paused')

  // 4. Trusted issuers
  const registry = await ethers.getContractAt('TrustedIssuerFacet', manifest.diamondAddress)
  const trusted = (await registry.getTrustedIssuers(0, 1000)).map((a: string) => a.toLowerCase()).sort()
  console.log(`  ℹ trusted issuers: ${trusted.join(', ') || '(none)'}`)
  if (process.env.EXPECTED_TRUSTED_ISSUERS !== undefined) {
    const expected = addressList('EXPECTED_TRUSTED_ISSUERS').map((a) => a.toLowerCase()).sort()
    check(JSON.stringify(trusted) === JSON.stringify(expected), 'trusted issuers are exactly EXPECTED_TRUSTED_ISSUERS')
  }

  // 5. Credential status responds
  const status = await ethers.getContractAt('CredentialStatusFacet', manifest.diamondAddress)
  const unknown = await status.getCredentialStatus(ethers.utils.id('circuloos-identity-verify-unknown'))
  check(unknown.issued === false, 'getCredentialStatus(unknown hash) → not issued')

  if (failures.length) {
    console.error(`[verify-redb] ${failures.length} check(s) FAILED`)
    process.exitCode = 1
    return
  }
  console.log('[verify-redb] all checks passed')
}

main().catch((err) => {
  console.error('[verify-redb] FAILED:', err)
  // Set the exit code instead of exiting abruptly: that aborts Node on Windows while sockets close
  process.exitCode = 1
})
