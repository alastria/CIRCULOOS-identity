import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
// Stub IssuanceService so tests don't depend on OTP/signature flow.
// Updated: the service now receives an IStorageAdapter as `storage` (saveIssuance/loadIssuance/
// saveVC/loadVC) instead of a FileStore `store` (writeAtomic/loadAll), and the on-chain receipt is
// persisted with saveVC(`${vcId}.onchain`, { txHash, blockNumber }).
vi.mock('../src/services/issuanceService', () => {
  const { buildVC } = require('@circuloos/common')
  const { constants } = require('ethers')
  return {
    IssuanceService: class {
      storage: any
      hmacSecret: string | undefined
      otpExpirySeconds: number | undefined
      constructor(opts: any) {
        this.storage = opts.storage
        this.hmacSecret = opts.hmacSecret
        this.otpExpirySeconds = opts.otpExpirySeconds
      }
      async prepare(email: string, holderAddress?: string, companyName?: string) {
        const id = `issuance_${Date.now()}_test`
        const otp = '000000'
        const token = 'tok_test'
        const draft = buildVC({ name: 'test' })
        const domain = {
          name: 'TrustedIssuerRegistry',
          version: '1.0',
          chainId: 31337,
          verifyingContract: constants.AddressZero
        }
        await this.storage.saveIssuance(id, { id, draft, domain, otpHash: 'hash', token, otp })
        return { id, token, otp, domain }
      }
      async mint(id: string, signature?: string, signer?: string, domainOverride?: any) {
        // write signed VC placeholder
        const vc = { id: `vc_${Date.now()}` }
        await this.storage.saveVC(vc.id, { vc, issuerProof: { verificationMethod: signer || '0x1' } })
        return { ok: true }
      }
      async finalize(id: string, otpOrObj: any) {
        // read the saved VC to get id
        const issuance = await this.storage.loadIssuance(id)
        const vc = issuance?.draft || { id: `vc_${Date.now()}` }
        const vcId = vc.id
        // simulate on-chain receipt write
        await this.storage.saveVC(`${vcId}.onchain`, { txHash: '0xdeadbeef', blockNumber: 1 })
        return { vcId }
      }
    }
  }
})

import server from '../src/index'
import * as common from '@circuloos/common'
import { Wallet } from 'ethers'
import { authCookies } from './helpers/auth-cookie.helper'

describe('issuer on-chain integration (mocked)', () => {
  beforeAll(async () => {
    // start server on ephemeral port
    await server.listen({ port: 0 })
  })

  afterAll(async () => {
    await server.close()
  })

  it('prepare -> mint -> finalize writes onchain receipt', async () => {
    const holderWallet = Wallet.createRandom()
    const issuerWallet = Wallet.createRandom()
    const storage = (server as any).storage
    // Issue routes moved under /api/v1/issue and require a JWT session cookie
    const issuerCookies = authCookies(issuerWallet.address, 'issuer')
    const holderCookies = authCookies(holderWallet.address, 'holder')

    // prepare
    const prepareRes = await server.inject({ method: 'POST', url: '/api/v1/issue/prepare', cookies: issuerCookies, payload: { email: 'test@example.com', holderAddress: holderWallet.address } })
    expect(prepareRes.statusCode).toBe(200)
    const { id, token, otp } = JSON.parse(prepareRes.payload)

    // simulate mint: load the stored draft VC and sign that exact VC
    const prepareBody = JSON.parse(prepareRes.payload)
    const domain = prepareBody.domain
    const issuance = await storage.loadIssuance(id)
    const vc = issuance.draft
    const signed = await common.signCredentialWithProof(issuerWallet.privateKey, domain, vc, 'assertionMethod')
    const issuerSignature = (signed as any).proof?.signature || '0x01'
    const issuerSigner = issuerWallet.address
    const mintRes = await server.inject({ method: 'POST', url: `/api/v1/issue/mint`, cookies: issuerCookies, payload: { id, signature: issuerSignature, signer: issuerSigner, domain } })
    expect(mintRes.statusCode).toBe(200)

    // finalize: holder signs and provides OTP
    const holderSignature = await common.signCredential(holderWallet.privateKey, domain, vc)
    const finalizeRes = await server.inject({ method: 'POST', url: `/api/v1/issue/finalize`, cookies: holderCookies, payload: { id, token, otp, signature: holderSignature, signer: holderWallet.address, domain } })
    expect(finalizeRes.statusCode).toBe(200)
    const finalizeBody = JSON.parse(finalizeRes.payload)
    const vcId = finalizeBody.vcId
    expect(vcId).toBe(vc.id)

    // check onchain receipt persisted in storage under `<vcId>.onchain`
    const receipt = await storage.loadVC(`${vcId}.onchain`)
    expect(receipt).toEqual({ txHash: '0xdeadbeef', blockNumber: 1 })
  })
})
