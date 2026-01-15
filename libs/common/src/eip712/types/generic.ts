/**
 * Generic Credential Schema (Legacy)
 *
 * Backward-compatible schema for credentials without a specific type.
 * Uses JSON stringified credentialSubject for maximum compatibility.
 */

import { registerCredentialType } from '../registry'
import { DIDUtils } from '../../utils/did'

registerCredentialType({
  id: 'generic',
  displayName: 'Credencial Genérica',
  description: 'Credencial verificable estándar',
  icon: '',
  version: '1.0.0',

  schema: {
    // =========================================================================
    // ISSUANCE SCHEMA - Legacy format
    // =========================================================================
    issuance: {
      primaryType: 'Credential',

      types: {
        Credential: [
          { name: 'id', type: 'string' },
          { name: 'issuer', type: 'string' },
          { name: 'issuanceDate', type: 'string' },
          { name: 'expirationDate', type: 'string' },
          { name: 'credentialSubject', type: 'string' }, // JSON string for compatibility
        ],
      },

      messageBuilder: (vc: any) => {
        const issuerString = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id || ''

        return {
          id: vc.id || '',
          issuer: issuerString,
          issuanceDate: vc.validFrom || vc.issuanceDate || '',
          expirationDate: vc.validUntil || vc.expirationDate || '',
          credentialSubject: JSON.stringify(vc.credentialSubject || {}),
        }
      }
    },

    // =========================================================================
    // CLAIM SCHEMA - Legacy format
    // =========================================================================
    claim: {
      primaryType: 'CredentialClaim',

      types: {
        CredentialClaim: [
          { name: 'token', type: 'string' },
          { name: 'holder', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },

      messageBuilder: (_credentialPreview: any, holderAddress: string, token: string) => {
        // Normalize holder address: extract plain Ethereum address from DID if needed
        const normalizedHolder = DIDUtils.normalizeAddress(holderAddress) || '0x0000000000000000000000000000000000000000'

        return {
          token,
          holder: normalizedHolder as any,
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
        }
      }
    },

    // =========================================================================
    // PRESENTATION SCHEMA - Legacy format
    // =========================================================================
    presentation: {
      primaryType: 'VerifiablePresentation',

      types: {
        VerifiablePresentation: [
          { name: 'holder', type: 'address' },
          { name: 'vcHash', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },

      messageBuilder: (_vc: any, holderAddress: string, vcHash: string) => {
        // Normalize holder address: extract plain Ethereum address from DID if needed
        const normalizedHolder = DIDUtils.normalizeAddress(holderAddress) || '0x0000000000000000000000000000000000000000'

        return {
          holder: normalizedHolder as any,
          vcHash,
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
        }
      }
    }
  }
})
