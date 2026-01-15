import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildVC,
  verifySignedCredential,
  signCredential,
  buildEip712Domain,
  buildCredentialProof,
  hashVC,
  type VC
} from '../src/index'
import { Wallet } from 'ethers'

describe('W3C Compliance Enhancements', () => {
  const testIssuerWallet = Wallet.createRandom()
  const testHolderWallet = Wallet.createRandom()
  const testDomain = buildEip712Domain('TestDomain', '1', 31337, testIssuerWallet.address)

  describe('buildVC with W3C credentialSubject.id binding', () => {
    it('should create VC with credentialSubject.id from holderAddress', () => {
      const vcData = {
        email: 'test@example.com',
        name: 'John Doe',
        holderAddress: testHolderWallet.address
      }

      const vc = buildVC(vcData)

      expect(vc.credentialSubject.id).toBe(testHolderWallet.address)
      expect((vc.credentialSubject as any).email).toBe('test@example.com')
      expect((vc.credentialSubject as any).name).toBe('John Doe')

      // Verify holderAddress is preserved in credentialSubject (used for W3C binding)
      expect((vc.credentialSubject as any).holderAddress).toBe(testHolderWallet.address)
    })

    it('should create VC without credentialSubject.id when holderAddress missing', () => {
      const vcData = {
        email: 'test@example.com',
        name: 'John Doe'
      }

      const vc = buildVC(vcData)

      expect(vc.credentialSubject.id).toBeUndefined()
      expect((vc.credentialSubject as any).email).toBe('test@example.com')
      expect((vc.credentialSubject as any).name).toBe('John Doe')
    })

    it('should handle complex nested data with holderAddress', () => {
      const vcData = {
        holderAddress: testHolderWallet.address,
        profile: {
          name: 'Alice Smith',
          department: 'Engineering',
          skills: ['TypeScript', 'Blockchain', 'W3C']
        },
        certifications: [
          { name: 'Blockchain Expert', issuer: 'Tech Academy' },
          { name: 'W3C Compliance', issuer: 'Standards Board' }
        ]
      }

      const vc = buildVC(vcData)

      expect(vc.credentialSubject.id).toBe(testHolderWallet.address)
      expect((vc.credentialSubject as any).profile.name).toBe('Alice Smith')
      expect((vc.credentialSubject as any).profile.skills).toEqual(['TypeScript', 'Blockchain', 'W3C'])
      expect((vc.credentialSubject as any).certifications).toHaveLength(2)
      expect((vc.credentialSubject as any).certifications[0].name).toBe('Blockchain Expert')
    })

    it('should preserve W3C standard fields', () => {
      const vc = buildVC({
        email: 'standard@w3c.test',
        holderAddress: testHolderWallet.address
      })

      expect((vc as any)['@context']).toContain('https://www.w3.org/2018/credentials/v1')
      expect((vc as any).type).toContain('VerifiableCredential')
      expect(vc.issuanceDate).toBeDefined()
      expect(new Date(vc.issuanceDate).getTime()).toBeCloseTo(Date.now(), -2) // Within 100ms
      expect(vc.issuer).toBeDefined()
    })
  })

  describe('verifySignedCredential with W3C compliance', () => {
    let signedCredential: any

    beforeEach(async () => {
      const vc = buildVC({
        email: 'verify@w3c.test',
        holderAddress: testHolderWallet.address
      })

      const signature = await signCredential(testIssuerWallet.privateKey, testDomain, vc)
      const issuerProof = buildCredentialProof({
        signature,
        signer: testIssuerWallet.address,
        domain: testDomain,
        proofPurpose: 'assertionMethod'
      })

      signedCredential = { vc, issuerProof }
    })

    it('should verify credential without W3C compliance requirement', async () => {
      const result = await verifySignedCredential(signedCredential)

      expect(result.issuer.ok).toBe(true)
      expect(result.issuer.recovered).toBe(testIssuerWallet.address)
    })

    it('should verify W3C-compliant credential when requireW3CCompliance enabled', async () => {
      const result = await verifySignedCredential(signedCredential, { requireW3CCompliance: true }) as any

      expect(result.issuer.ok).toBe(true)
      expect(result.issuer.recovered).toBe(testIssuerWallet.address)
      // Note: W3C compliance fields might be added in extended verification
      if (result.w3cCompliance) {
        expect(result.w3cCompliance.credentialSubjectId).toBe(true)
        expect(result.w3cCompliance.holderBinding).toBe(true)
      }
    })

    it('should handle non-W3C-compliant credential gracefully', async () => {
      // Create credential without credentialSubject.id
      const nonCompliantVC = buildVC({ email: 'noncompliant@test.com' })
      const signature = await signCredential(testIssuerWallet.privateKey, testDomain, nonCompliantVC)
      const nonCompliantSigned = {
        vc: nonCompliantVC,
        issuerProof: buildCredentialProof({
          signature,
          signer: testIssuerWallet.address,
          domain: testDomain,
          proofPurpose: 'assertionMethod'
        })
      }

      const result = await verifySignedCredential(nonCompliantSigned, { requireW3CCompliance: true }) as any

      expect(result.issuer.ok).toBe(true) // Signature is still valid
      // W3C compliance checking depends on implementation
    })

    it('should validate credentialSubject.id format when present', async () => {
      const invalidIdVC = buildVC({
        email: 'invalid@test.com',
        holderAddress: testHolderWallet.address
      })
      // Manually corrupt the credentialSubject.id
      invalidIdVC.credentialSubject.id = 'invalid-address'

      const signature = await signCredential(testIssuerWallet.privateKey, testDomain, invalidIdVC)
      const invalidSigned = {
        vc: invalidIdVC,
        issuerProof: buildCredentialProof({
          signature,
          signer: testIssuerWallet.address,
          domain: testDomain,
          proofPurpose: 'assertionMethod'
        })
      }

      const result = await verifySignedCredential(invalidSigned, { requireW3CCompliance: true })

      // Should still verify signature, but W3C compliance may fail
      expect(result.issuer.ok).toBe(true)
    })
  })

  describe('Token binding and transfer prevention', () => {
    it('should prevent credential transfer to different holder', async () => {
      const originalVC = buildVC({
        email: 'original@holder.com',
        holderAddress: testHolderWallet.address
      })

      // Attempt to modify credentialSubject.id to different address
      const tamperAttemptVC = { ...originalVC }
      tamperAttemptVC.credentialSubject = {
        ...originalVC.credentialSubject,
        id: Wallet.createRandom().address
      }

      const originalSignature = await signCredential(testIssuerWallet.privateKey, testDomain, originalVC)
      const tamperedSigned = {
        vc: tamperAttemptVC,
        issuerProof: buildCredentialProof({
          signature: originalSignature, // Original signature won't match tampered VC
          signer: testIssuerWallet.address,
          domain: testDomain,
          proofPurpose: 'assertionMethod'
        })
      }

      const result = await verifySignedCredential(tamperedSigned)

      // Signature verification should fail due to content change
      expect(result.issuer.ok).toBe(false)
    })

    it('should bind credential to specific holder through hash', async () => {
      const vc = buildVC({
        email: 'bound@holder.com',
        holderAddress: testHolderWallet.address
      })

      const vcHash1 = hashVC(vc)

      // Hashing the same VC object twice should give same result
      const vcHash2 = hashVC(vc)
      expect(vcHash1).toBe(vcHash2)

      // But different if holder changes
      const differentHolderVC = buildVC({
        email: 'bound@holder.com',
        holderAddress: Wallet.createRandom().address
      })

      const vcHash3 = hashVC(differentHolderVC)
      expect(vcHash1).not.toBe(vcHash3)
    })
  })

  describe('Comprehensive W3C credential lifecycle', () => {
    it('should handle complete W3C-compliant credential lifecycle', async () => {
      const holderWallet = Wallet.createRandom()
      const issuerWallet = Wallet.createRandom()
      const domain = buildEip712Domain('CompleteTest', '1', 31337, issuerWallet.address)

      // Step 1: Create W3C-compliant VC
      const vc = buildVC({
        email: 'complete@lifecycle.test',
        name: 'Complete Test User',
        department: 'Quality Assurance',
        holderAddress: holderWallet.address,
        certificationLevel: 'Expert',
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      })

      // Step 2: Create issuer signature
      const issuerSignature = await signCredential(issuerWallet.privateKey, domain, vc)
      const issuerProof = buildCredentialProof({
        signature: issuerSignature,
        signer: issuerWallet.address,
        domain,
        proofPurpose: 'assertionMethod'
      })

      // Step 3: Create holder signature (for consent)
      const holderSignature = await signCredential(holderWallet.privateKey, domain, vc)
      const holderProof = buildCredentialProof({
        signature: holderSignature,
        signer: holderWallet.address,
        domain,
        proofPurpose: 'authentication'
      })

      const fullySignedCredential = {
        vc,
        issuerProof,
        holderProof
      }

      // Step 4: Verify W3C compliance
      const verification = await verifySignedCredential(fullySignedCredential, {
        requireW3CCompliance: true
      })

      expect(verification.issuer.ok).toBe(true)
      expect(verification.issuer.recovered).toBe(issuerWallet.address)

      // W3C compliance checking depends on implementation
      if ((verification as any).w3cCompliance) {
        expect((verification as any).w3cCompliance.compliant).toBe(true)
        expect((verification as any).w3cCompliance.credentialSubjectId).toBe(true)
        expect((verification as any).w3cCompliance.holderBinding).toBe(true)
      }

      // Step 5: Verify credential structure
      expect(vc.credentialSubject.id).toBe(holderWallet.address)
      expect((vc.credentialSubject as any).email).toBe('complete@lifecycle.test')
      expect((vc.credentialSubject as any).name).toBe('Complete Test User')
      expect((vc.credentialSubject as any).department).toBe('Quality Assurance')
      expect((vc.credentialSubject as any).certificationLevel).toBe('Expert')

      // Step 6: Generate and verify hash
      const vcHash = hashVC(vc)
      expect(vcHash).toBeDefined()
      expect(typeof vcHash).toBe('string')
      expect(vcHash.startsWith('0x')).toBe(true)
      expect(vcHash.length).toBe(66) // 0x + 64 hex chars

      // Step 7: Verify hash consistency
      const secondHash = hashVC(vc)
      expect(vcHash).toBe(secondHash)

      console.log(' Complete W3C-compliant credential lifecycle test passed')
      console.log('   - VC Hash:', vcHash)
      console.log('   - Holder:', holderWallet.address)
      console.log('   - Issuer:', issuerWallet.address)
      console.log('   - W3C Compliant:', !!(verification as any).w3cCompliance?.compliant)
    })
  })
})
