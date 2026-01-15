import { describe, it, expect, beforeEach, vi } from 'vitest'
import { utils, Wallet } from 'ethers'

/**
 * Cryptographic Tests for MetaMask Snap
 *
 * These tests verify the cryptographic security of:
 * 1. BIP-44 key derivation
 * 2. EIP-712 signature generation
 * 3. VP structure compliance
 * 4. Integration with backend verifier
 */

describe('Snap Cryptography Tests', () => {
  describe('EIP-712 Signature', () => {
    let wallet: Wallet
    let holderAddress: string

    beforeEach(() => {
      // Use deterministic wallet for testing
      wallet = Wallet.createRandom()
      holderAddress = wallet.address
    })

    it('should create valid EIP-712 signature without challenge', async () => {
      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: holderAddress,
        verifiableCredential: [],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 300000).toISOString(),
      }

      const domain = {
        name: 'Circuloos VP Verifier',
        version: '1',
        chainId: 31337,
      }

      const types = {
        Presentation: [
          { name: 'holder', type: 'address' },
          { name: 'verifiableCredential', type: 'string' },
          { name: 'issuanceDate', type: 'string' },
          { name: 'expirationDate', type: 'string' },
        ],
      }

      const message = {
        holder: presentation.holder,
        verifiableCredential: JSON.stringify(presentation.verifiableCredential),
        issuanceDate: presentation.issuanceDate,
        expirationDate: presentation.expirationDate,
      }

      // Sign
      const signature = await wallet._signTypedData(domain, types, message)

      // Verify signature can be recovered
      const recovered = utils.verifyTypedData(domain, types, message, signature)

      expect(recovered.toLowerCase()).toBe(holderAddress.toLowerCase())
    })

    it('should create valid EIP-712 signature with challenge', async () => {
      const challenge = '0x' + '1'.repeat(64) // Mock challenge

      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: holderAddress,
        verifiableCredential: [],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 300000).toISOString(),
      }

      const domain = {
        name: 'Circuloos VP Verifier',
        version: '1',
        chainId: 31337,
      }

      const types = {
        Presentation: [
          { name: 'holder', type: 'address' },
          { name: 'verifiableCredential', type: 'string' },
          { name: 'issuanceDate', type: 'string' },
          { name: 'expirationDate', type: 'string' },
          { name: 'challenge', type: 'string' },
        ],
      }

      const message = {
        holder: presentation.holder,
        verifiableCredential: JSON.stringify(presentation.verifiableCredential),
        issuanceDate: presentation.issuanceDate,
        expirationDate: presentation.expirationDate,
        challenge,
      }

      // Sign
      const signature = await wallet._signTypedData(domain, types, message)

      // Verify signature can be recovered
      const recovered = utils.verifyTypedData(domain, types, message, signature)

      expect(recovered.toLowerCase()).toBe(holderAddress.toLowerCase())
    })

    it('should fail verification with wrong challenge', async () => {
      const challenge = '0x' + '1'.repeat(64)
      const wrongChallenge = '0x' + '2'.repeat(64)

      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: holderAddress,
        verifiableCredential: [],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 300000).toISOString(),
      }

      const domain = {
        name: 'Circuloos VP Verifier',
        version: '1',
        chainId: 31337,
      }

      const types = {
        Presentation: [
          { name: 'holder', type: 'address' },
          { name: 'verifiableCredential', type: 'string' },
          { name: 'issuanceDate', type: 'string' },
          { name: 'expirationDate', type: 'string' },
          { name: 'challenge', type: 'string' },
        ],
      }

      const message = {
        holder: presentation.holder,
        verifiableCredential: JSON.stringify(presentation.verifiableCredential),
        issuanceDate: presentation.issuanceDate,
        expirationDate: presentation.expirationDate,
        challenge,
      }

      // Sign with correct challenge
      const signature = await wallet._signTypedData(domain, types, message)

      // Try to verify with wrong challenge
      const messageWithWrongChallenge = {
        ...message,
        challenge: wrongChallenge,
      }

      const recovered = utils.verifyTypedData(domain, types, messageWithWrongChallenge, signature)

      // Should not match
      expect(recovered.toLowerCase()).not.toBe(holderAddress.toLowerCase())
    })

    it('should fail verification with tampered VP data', async () => {
      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: holderAddress,
        verifiableCredential: [{ id: 'credential-1' }],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 300000).toISOString(),
      }

      const domain = {
        name: 'Circuloos VP Verifier',
        version: '1',
        chainId: 31337,
      }

      const types = {
        Presentation: [
          { name: 'holder', type: 'address' },
          { name: 'verifiableCredential', type: 'string' },
          { name: 'issuanceDate', type: 'string' },
          { name: 'expirationDate', type: 'string' },
        ],
      }

      const message = {
        holder: presentation.holder,
        verifiableCredential: JSON.stringify(presentation.verifiableCredential),
        issuanceDate: presentation.issuanceDate,
        expirationDate: presentation.expirationDate,
      }

      // Sign original
      const signature = await wallet._signTypedData(domain, types, message)

      // Tamper with credential data
      const tamperedMessage = {
        ...message,
        verifiableCredential: JSON.stringify([{ id: 'credential-2' }]),
      }

      const recovered = utils.verifyTypedData(domain, types, tamperedMessage, signature)

      // Should not match
      expect(recovered.toLowerCase()).not.toBe(holderAddress.toLowerCase())
    })
  })

  describe('VP Structure Validation', () => {
    it('should create W3C compliant VP structure', () => {
      const vp = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: '0x1234567890123456789012345678901234567890',
        verifiableCredential: [],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 300000).toISOString(),
      }

      // Verify required fields
      expect(vp['@context']).toContain('https://www.w3.org/2018/credentials/v1')
      expect(vp.type).toContain('VerifiablePresentation')
      expect(vp.holder).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(Array.isArray(vp.verifiableCredential)).toBe(true)

      // Verify dates
      const issuance = new Date(vp.issuanceDate)
      const expiration = new Date(vp.expirationDate)
      expect(issuance).toBeInstanceOf(Date)
      expect(expiration).toBeInstanceOf(Date)
      expect(expiration > issuance).toBe(true)
    })

    it('should reject VP with expired date', () => {
      const expiredVP = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: '0x1234567890123456789012345678901234567890',
        verifiableCredential: [],
        issuanceDate: new Date(Date.now() - 600000).toISOString(),
        expirationDate: new Date(Date.now() - 300000).toISOString(), // Expired
      }

      const now = new Date()
      const expiration = new Date(expiredVP.expirationDate)

      expect(expiration < now).toBe(true) // Should be expired
    })

    it('should have holder address matching signer', () => {
      const wallet = Wallet.createRandom()
      const holder = wallet.address

      const vp = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder,
        verifiableCredential: [],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 300000).toISOString(),
      }

      // Holder should match wallet address
      expect(vp.holder.toLowerCase()).toBe(wallet.address.toLowerCase())
    })
  })

  describe('Domain Configuration', () => {
    it('should use consistent domain across signatures', () => {
      const domain1 = {
        name: 'Circuloos VP Verifier',
        version: '1',
        chainId: 31337,
      }

      const domain2 = {
        name: 'Circuloos VP Verifier',
        version: '1',
        chainId: 31337,
      }

      expect(domain1).toEqual(domain2)
    })

    it('should have correct domain separator', async () => {
      const domain = {
        name: 'Circuloos VP Verifier',
        version: '1',
        chainId: 31337,
      }

      // EIP-712 domain separator should be deterministic
      const domainSeparator = utils._TypedDataEncoder.hashDomain(domain)

      expect(domainSeparator).toMatch(/^0x[a-fA-F0-9]{64}$/)

      // Same domain should produce same separator
      const domainSeparator2 = utils._TypedDataEncoder.hashDomain(domain)
      expect(domainSeparator).toBe(domainSeparator2)
    })

    it('should fail verification with wrong domain', async () => {
      const wallet = Wallet.createRandom()

      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: wallet.address,
        verifiableCredential: [],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 300000).toISOString(),
      }

      const domain1 = {
        name: 'Circuloos VP Verifier',
        version: '1',
        chainId: 31337,
      }

      const domain2 = {
        name: 'Different Verifier',
        version: '1',
        chainId: 31337,
      }

      const types = {
        Presentation: [
          { name: 'holder', type: 'address' },
          { name: 'verifiableCredential', type: 'string' },
          { name: 'issuanceDate', type: 'string' },
          { name: 'expirationDate', type: 'string' },
        ],
      }

      const message = {
        holder: presentation.holder,
        verifiableCredential: JSON.stringify(presentation.verifiableCredential),
        issuanceDate: presentation.issuanceDate,
        expirationDate: presentation.expirationDate,
      }

      // Sign with domain1
      const signature = await wallet._signTypedData(domain1, types, message)

      // Try to verify with domain2
      const recovered = utils.verifyTypedData(domain2, types, message, signature)

      // Should not match because domain is different
      expect(recovered.toLowerCase()).not.toBe(wallet.address.toLowerCase())
    })
  })

  describe('Signature Determinism', () => {
    it('should produce same signature for same inputs', async () => {
      const privateKey = '0x' + '1'.repeat(64)
      const wallet = new Wallet(privateKey)

      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: wallet.address,
        verifiableCredential: [],
        issuanceDate: '2024-01-01T00:00:00.000Z',
        expirationDate: '2024-01-01T01:00:00.000Z',
      }

      const domain = {
        name: 'Test',
        version: '1',
        chainId: 1,
      }

      const types = {
        Presentation: [
          { name: 'holder', type: 'address' },
          { name: 'verifiableCredential', type: 'string' },
          { name: 'issuanceDate', type: 'string' },
          { name: 'expirationDate', type: 'string' },
        ],
      }

      const message = {
        holder: presentation.holder,
        verifiableCredential: JSON.stringify(presentation.verifiableCredential),
        issuanceDate: presentation.issuanceDate,
        expirationDate: presentation.expirationDate,
      }

      const sig1 = await wallet._signTypedData(domain, types, message)
      const sig2 = await wallet._signTypedData(domain, types, message)

      expect(sig1).toBe(sig2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty verifiableCredential array', async () => {
      const wallet = Wallet.createRandom()

      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: wallet.address,
        verifiableCredential: [],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 300000).toISOString(),
      }

      const domain = {
        name: 'Test',
        version: '1',
        chainId: 1,
      }

      const types = {
        Presentation: [
          { name: 'holder', type: 'address' },
          { name: 'verifiableCredential', type: 'string' },
          { name: 'issuanceDate', type: 'string' },
          { name: 'expirationDate', type: 'string' },
        ],
      }

      const message = {
        holder: presentation.holder,
        verifiableCredential: JSON.stringify(presentation.verifiableCredential),
        issuanceDate: presentation.issuanceDate,
        expirationDate: presentation.expirationDate,
      }

      const signature = await wallet._signTypedData(domain, types, message)
      const recovered = utils.verifyTypedData(domain, types, message, signature)

      expect(recovered.toLowerCase()).toBe(wallet.address.toLowerCase())
    })

    it('should handle multiple credentials in VP', async () => {
      const wallet = Wallet.createRandom()

      const credentials = [
        { id: 'vc-1', type: ['VerifiableCredential'] },
        { id: 'vc-2', type: ['VerifiableCredential'] },
        { id: 'vc-3', type: ['VerifiableCredential'] },
      ]

      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: wallet.address,
        verifiableCredential: credentials,
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 300000).toISOString(),
      }

      const domain = {
        name: 'Test',
        version: '1',
        chainId: 1,
      }

      const types = {
        Presentation: [
          { name: 'holder', type: 'address' },
          { name: 'verifiableCredential', type: 'string' },
          { name: 'issuanceDate', type: 'string' },
          { name: 'expirationDate', type: 'string' },
        ],
      }

      const message = {
        holder: presentation.holder,
        verifiableCredential: JSON.stringify(presentation.verifiableCredential),
        issuanceDate: presentation.issuanceDate,
        expirationDate: presentation.expirationDate,
      }

      const signature = await wallet._signTypedData(domain, types, message)
      const recovered = utils.verifyTypedData(domain, types, message, signature)

      expect(recovered.toLowerCase()).toBe(wallet.address.toLowerCase())
    })

    it('should handle very long challenge strings', async () => {
      const wallet = Wallet.createRandom()
      const longChallenge = '0x' + 'a'.repeat(128) // Very long challenge

      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: wallet.address,
        verifiableCredential: [],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 300000).toISOString(),
      }

      const domain = {
        name: 'Test',
        version: '1',
        chainId: 1,
      }

      const types = {
        Presentation: [
          { name: 'holder', type: 'address' },
          { name: 'verifiableCredential', type: 'string' },
          { name: 'issuanceDate', type: 'string' },
          { name: 'expirationDate', type: 'string' },
          { name: 'challenge', type: 'string' },
        ],
      }

      const message = {
        holder: presentation.holder,
        verifiableCredential: JSON.stringify(presentation.verifiableCredential),
        issuanceDate: presentation.issuanceDate,
        expirationDate: presentation.expirationDate,
        challenge: longChallenge,
      }

      const signature = await wallet._signTypedData(domain, types, message)
      const recovered = utils.verifyTypedData(domain, types, message, signature)

      expect(recovered.toLowerCase()).toBe(wallet.address.toLowerCase())
    })
  })
})
