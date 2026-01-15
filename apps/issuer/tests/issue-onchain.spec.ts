import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
// Stub IssuanceService so tests don't depend on OTP/signature flow.
vi.mock('../src/services/issuanceService', () => {
  const { buildVC } = require('@circuloos/common')
  const { constants } = require('ethers')
  return {
    IssuanceService: class {
      store: any
      hmacSecret: string | undefined
      otpExpirySeconds: number | undefined
      constructor(opts: any) {
        this.store = opts.store
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
        await this.store.writeAtomic(`issuances/${id}.json`, { id, draft, domain, otpHash: 'hash', token, otp })
        return { id, token, otp, domain }
      }
      async mint(id: string, signature?: string, signer?: string, domainOverride?: any) {
        // write signed VC placeholder
        const vc = { id: `vc_${Date.now()}` }
        await this.store.writeAtomic(`vcs/${vc.id}.json`, { vc, issuerProof: { verificationMethod: signer || '0x1' } })
        return { ok: true }
      }
      async finalize(id: string, otpOrObj: any) {
        // read the saved VC to get id
        const issuance = await this.store.loadAll(`issuances/${id}.json`)
        const vc = issuance?.draft || { id: `vc_${Date.now()}` }
        const vcId = vc.id
        // simulate on-chain receipt write
        await this.store.writeAtomic(`vcs/${vcId}.onchain.json`, { txHash: '0xdeadbeef', blockNumber: 1 })
        return { vcId }
      }
    }
  }
})

import server from '../src/index'
import fs from 'fs'
import path from 'path'
import * as common from '@circuloos/common'
import { Wallet } from 'ethers'

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
    // prepare
  const prepareRes = await server.inject({ method: 'POST', url: '/issue/prepare', payload: { email: 'test@example.com', holderAddress: holderWallet.address } })
    expect(prepareRes.statusCode).toBe(200)
    const { id, token, otp } = JSON.parse(prepareRes.payload)

  // simulate mint: load the stored draft VC and sign that exact VC so verification succeeds
  const prepareBody = JSON.parse(prepareRes.payload)
  const domain = prepareBody.domain
  const baseDir = (server as any).store?.baseDir || path.join(process.cwd(), 'apps', 'issuer', 'tmp-filestore')
  const issuancePath = path.join(baseDir, 'issuances', `${id}.json`)
  const issuanceRaw = fs.readFileSync(issuancePath, { encoding: 'utf8' })
  const issuance = JSON.parse(issuanceRaw)
  const vc = issuance.draft
  const signed = await common.signCredentialWithProof(process.env.ISSUER_PRIVATE_KEY || '0x' + '1'.repeat(64), domain, vc, 'assertionMethod')
  const issuerSignature = (signed as any).proof?.signature || '0x01'
  const issuerSigner = (signed as any).proof?.signer || '0x' + '1'.repeat(40)
  const mintRes = await server.inject({ method: 'POST', url: `/issue/mint`, payload: { id, signature: issuerSignature, signer: issuerSigner, domain } })
    expect(mintRes.statusCode).toBe(200)

    // finalize: holder signs and provides OTP
    const holderSignature = await common.signCredential(holderWallet.privateKey, domain, vc)
  const finalizeRes = await server.inject({ method: 'POST', url: `/issue/finalize`, payload: { id, token, otp, signature: holderSignature, signer: holderWallet.address, domain } })
    expect(finalizeRes.statusCode).toBe(200)
    const finalizeBody = JSON.parse(finalizeRes.payload)
    const vcId = finalizeBody.vcId

    // check onchain receipt file under apps/issuer/tmp-filestore/vcs/<vcId>.onchain.json
  const storageDir = path.join(baseDir, 'vcs')
  const filePath = path.join(storageDir, `${vcId}.onchain.json`)
    const exists = fs.existsSync(filePath)
    expect(exists).toBe(true)
  })
})
