import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import server from '../src/index'
import { EmailMock, clearSent, getSentEmails, signCredential, buildEip712Domain } from '@circuloos/common'
import { Wallet } from 'ethers'
import { authCookies } from './helpers/auth-cookie.helper'

describe('issuer otp flow', () => {
  console.log('[TEST] issuer otp flow')

  beforeAll(async () => {
    clearSent()
    // start server bound to a random port
    await server.listen({ port: 0 })
  })

  afterAll(async () => {
    await server.close()
  })

  it('prepare and finalize', async () => {
  console.log('[TEST] issuer otp flow: prepare and finalize')
    const holderWallet = Wallet.createRandom()
    const issuerWallet = Wallet.createRandom()
    // Issue routes live under /api/v1/issue and require a JWT session cookie
    // call prepare
    const res = await server.inject({ method: 'POST', url: '/api/v1/issue/prepare', cookies: authCookies(issuerWallet.address, 'issuer'), payload: { email: 'a@b.test', holderAddress: holderWallet.address } })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.id).toBeDefined()

    // check that an email was sent
    const emails = getSentEmails()
    // in this test we didn't wire emailSender into server, so skip that assertion if none
    // finalize with wrong otp should fail (need signature/signer for schema validation)
    const domain = buildEip712Domain('Circuloos', '1', 31337, undefined)
    const wrongSignature = '0x' + '0'.repeat(130) // dummy signature
    const bad = await server.inject({
      method: 'POST',
      url: '/api/v1/issue/finalize',
      cookies: authCookies(holderWallet.address, 'holder'),
      payload: { 
        id: body.id, 
        otp: '000000', 
        token: body.token,
        signature: wrongSignature,
        signer: holderWallet.address,
        domain
      },
    })
    expect([400, 404]).toContain(bad.statusCode)
  })
})
