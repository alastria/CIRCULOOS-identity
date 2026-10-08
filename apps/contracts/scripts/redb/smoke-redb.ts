/**
 * A4.6 — Optional smoke test on Red-B: the issuer backend key (through Web3Signer) records a
 * SYNTHETIC credential hash and revokes it. Two permanent records of a hash that is no real
 * credential: run only with explicit go-ahead (decision D7).
 *
 *   EXPECTED_CHAIN_ID=2020 REDB_RPC_URL=… WEB3SIGNER_URL=… BACKEND_ADDRESS=0x… MANIFEST_PATH=… \
 *     pnpm hardhat run --network redb scripts/redb/smoke-redb.ts
 */
import { ethers } from 'hardhat'
import { appendTransactions, assertChainId, readManifest, requireEnv, txOverrides, web3signer } from './lib/redb'

async function main() {
  await assertChainId()
  const manifest = readManifest()
  const backend = web3signer(requireEnv('BACKEND_ADDRESS'))
  const status = await ethers.getContractAt('CredentialStatusFacet', manifest.diamondAddress, backend)
  const overrides = await txOverrides()

  const label = `circuloos-identity-redb-smoke:${manifest.diamondAddress}:${new Date().toISOString()}`
  const hash = ethers.utils.id(label)
  console.log(`[smoke-redb] synthetic hash ${hash} = keccak256("${label}")`)

  const recorded = await (await status.recordIssuance(hash, backend.address, overrides)).wait()
  const afterRecord = await status.getCredentialStatus(hash)
  if (!afterRecord.issued || afterRecord.issuer.toLowerCase() !== backend.address.toLowerCase()) {
    throw new Error('recorded credential status is not as expected')
  }
  console.log(`[smoke-redb] recorded (tx ${recorded.transactionHash})`)

  const revoked = await (await status.revokeCredential(hash, overrides)).wait()
  if (!(await status.isRevoked(hash))) throw new Error('credential is not revoked after revokeCredential')
  console.log(`[smoke-redb] revoked (tx ${revoked.transactionHash})`)

  appendTransactions([
    { step: `smoke recordIssuance ${hash} (${label})`, hash: recorded.transactionHash },
    { step: `smoke revokeCredential ${hash}`, hash: revoked.transactionHash },
  ])
  console.log('[smoke-redb] passed')
}

main().catch((err) => {
  console.error('[smoke-redb] FAILED:', err)
  // Set the exit code instead of exiting abruptly: that aborts Node on Windows while sockets close
  process.exitCode = 1
})
