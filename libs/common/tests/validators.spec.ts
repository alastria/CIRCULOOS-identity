/// <reference types="vitest" />
import { VerifiableCredential, VerifiablePresentation } from '../src/validators'

describe('validators', () => {
  console.log('[TEST] common validators tests')
  it('accepts a minimal VC shape', () => {
    const vc = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: 'urn:uuid:1',
      type: ['VerifiableCredential', 'TestCredential'],
      issuer: 'did:ethr:0x123',
      issuanceDate: new Date().toISOString(),
      credentialSubject: { name: 'Alice' }
    }
    expect(() => VerifiableCredential.parse(vc)).not.toThrow()
  })

  it('accepts a minimal VP shape', () => {
    const vp = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      verifiableCredential: [{}, {}]
    }
    expect(() => VerifiablePresentation.parse(vp)).not.toThrow()
  })
})
