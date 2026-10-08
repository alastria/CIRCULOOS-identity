/**
 * A4.4 — Register trusted issuers on the deployed identity Diamond (permanent transactions,
 * reversible only with removeTrustedIssuer: run only with explicit go-ahead).
 *
 *   EXPECTED_CHAIN_ID=2020 REDB_RPC_URL=… WEB3SIGNER_URL=… OWNER_ADDRESS=0x… MANIFEST_PATH=… \
 *   TRUSTED_ISSUERS=0xBackendKey,0xAlastriaIssuer1,… pnpm hardhat run --network redb scripts/redb/add-trusted-issuers-redb.ts
 *
 * The issuer backend key MUST be in the list: since P14 only trusted issuers can record a
 * credential on-chain. Already-trusted addresses are skipped (idempotent).
 */
import { ethers } from 'hardhat'
import { addressList, appendTransactions, assertChainId, readManifest, requireEnv, txOverrides, web3signer } from './lib/redb'

async function main() {
  await assertChainId()
  const manifest = readManifest()
  const owner = web3signer(requireEnv('OWNER_ADDRESS'))
  const issuers = addressList('TRUSTED_ISSUERS')
  if (issuers.length === 0) throw new Error('TRUSTED_ISSUERS is empty')

  const registry = await ethers.getContractAt('TrustedIssuerFacet', manifest.diamondAddress, owner)
  const overrides = await txOverrides()
  const added: Array<{ step: string; hash: string }> = []
  for (const issuer of issuers) {
    if (await registry.isTrustedIssuer(issuer)) {
      console.log(`[trusted-issuers] ${issuer} already trusted, skipped`)
      continue
    }
    const receipt = await (await registry.addTrustedIssuer(issuer, overrides)).wait()
    added.push({ step: `addTrustedIssuer ${issuer}`, hash: receipt.transactionHash })
    console.log(`[trusted-issuers] ${issuer} added (tx ${receipt.transactionHash})`)
  }
  if (added.length) appendTransactions(added)
}

main().catch((err) => {
  console.error('[trusted-issuers] FAILED:', err)
  // Set the exit code instead of exiting abruptly: that aborts Node on Windows while sockets close
  process.exitCode = 1
})
