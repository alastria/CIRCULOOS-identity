/**
 * Circuloos Marketplace Credential Schema
 *
 * Optimized EIP-712 schema for circuloos-marketplace credentials.
 * Provides beautiful UX with human-readable fields instead of JSON strings.
 */

import { registerCredentialType } from '../registry'
import { formatDate, extractIssuerAddress, formatIssuerName } from '../utils'
import { DIDUtils } from '../../utils/did'

registerCredentialType({
  id: 'circuloos-marketplace',
  displayName: 'Circuloos Marketplace',
  description: 'Credencial de acceso al marketplace de Circuloos',
  icon: '',
  version: '1.0.0',

  schema: {
    // =========================================================================
    // ISSUANCE SCHEMA - When issuer signs the credential
    // =========================================================================
    issuance: {
      primaryType: 'CirculoosMarketplaceCredential',

      types: {
        CirculoosMarketplaceCredential: [
          // Action header
          { name: 'action', type: 'string' },

          // Credential metadata
          { name: 'credentialType', type: 'string' },
          { name: 'credentialId', type: 'string' },

          // Holder data (EXPANDED - not JSON!)
          { name: 'holderAddress', type: 'address' },
          { name: 'holderName', type: 'string' },
          { name: 'holderEmail', type: 'string' },
          { name: 'companyName', type: 'string' },

          // Issuer data
          { name: 'issuerDID', type: 'string' },
          { name: 'issuerName', type: 'string' },

          // Validity period
          { name: 'issuedAt', type: 'string' },
          { name: 'expiresAt', type: 'string' },
        ],
      },

      messageBuilder: (vc: any) => {
        const issuerString = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id || ''

        // Normalize holderAddress: extract plain Ethereum address from DID if needed
        const rawHolderAddress = vc.credentialSubject?.holderAddress || vc.credentialSubject?.id || ''
        const normalizedHolderAddress = DIDUtils.normalizeAddress(rawHolderAddress) || '0x0000000000000000000000000000000000000000'

        return {
          action: 'Emitir credencial de acceso al marketplace',
          credentialType: 'Circuloos Marketplace',
          credentialId: vc.id || '',

          // Expand credentialSubject fields - use normalized address
          holderAddress: normalizedHolderAddress as any,
          holderName: vc.credentialSubject?.name || '',
          holderEmail: vc.credentialSubject?.email || '',
          companyName: vc.credentialSubject?.companyName || '',

          issuerDID: issuerString,
          issuerName: formatIssuerName(issuerString, 'Circuloos'),

          issuedAt: formatDate(vc.validFrom || vc.issuanceDate),
          expiresAt: formatDate(vc.validUntil || vc.expirationDate),
        }
      }
    },

    // =========================================================================
    // CLAIM SCHEMA - When holder claims the credential
    // =========================================================================
    claim: {
      primaryType: 'CirculoosMarketplaceClaim',

      types: {
        CirculoosMarketplaceClaim: [
          { name: 'action', type: 'string' },
          { name: 'credentialType', type: 'string' },
          { name: 'issuerName', type: 'string' },
          { name: 'holderAddress', type: 'address' },
          { name: 'holderName', type: 'string' },
          { name: 'issuedAt', type: 'string' },
          { name: 'claimToken', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },

      messageBuilder: (credentialPreview: any, holderAddress: string, token: string) => {
        // Normalize holderAddress: extract plain Ethereum address from DID if needed
        const normalizedHolderAddress = DIDUtils.normalizeAddress(holderAddress) || '0x0000000000000000000000000000000000000000'

        return {
          action: 'Reclamar mi credencial de acceso',
          credentialType: 'Circuloos Marketplace',
          issuerName: credentialPreview.issuerName || 'Circuloos',
          holderAddress: normalizedHolderAddress as any,
          holderName: credentialPreview.holderName || credentialPreview.name || '',
          issuedAt: formatDate(credentialPreview.issuedAt || credentialPreview.validFrom),
          claimToken: token,
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
        }
      }
    },

    // =========================================================================
    // PRESENTATION SCHEMA - When holder presents the credential
    // =========================================================================
    presentation: {
      primaryType: 'CirculoosMarketplacePresentation',

      types: {
        CirculoosMarketplacePresentation: [
          { name: 'action', type: 'string' },
          { name: 'credentialType', type: 'string' },
          { name: 'holderName', type: 'string' },
          { name: 'holderAddress', type: 'address' },
          { name: 'companyName', type: 'string' },
          { name: 'issuerName', type: 'string' },
          { name: 'issuedDate', type: 'string' },
          { name: 'verifierAddress', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },

      messageBuilder: (vc: any, holderAddress: string, verifierAddress?: string) => {
        // Normalize addresses: extract plain Ethereum address from DID if needed
        const normalizedHolderAddress = DIDUtils.normalizeAddress(holderAddress) || '0x0000000000000000000000000000000000000000'
        const normalizedVerifierAddress = DIDUtils.normalizeAddress(verifierAddress || '') || '0x0000000000000000000000000000000000000000'

        return {
          action: 'Presentar mi credencial para verificación',
          credentialType: 'Circuloos Marketplace',
          holderName: vc.credentialSubject?.name || '',
          holderAddress: normalizedHolderAddress as any,
          companyName: vc.credentialSubject?.companyName || '',
          issuerName: formatIssuerName(vc.issuer, 'Circuloos'),
          issuedDate: formatDate(vc.validFrom || vc.issuanceDate),
          verifierAddress: normalizedVerifierAddress as any,
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
        }
      }
    }
  }
})
