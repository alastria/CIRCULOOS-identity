/**
 * Circuloos Employee Credential Schema
 *
 * The issuer signs the holder AND the organisation (legal name, tax ID, country) as a
 * nested struct, plus the exact ISO validity timestamps — altering any of them breaks
 * the signature. Unlike the marketplace schema, dates are not reformatted for display:
 * a locale/timezone-dependent string would make signer and verifier disagree.
 */

import { registerCredentialType } from '../registry'
import { formatIssuerName, subjectAddress } from '../utils'
import { DIDUtils } from '../../utils/did'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function organizationOf(source: any) {
  const org = source?.credentialSubject?.worksFor ?? source?.worksFor ?? source?.organization ?? {}
  return {
    legalName: org.legalName || '',
    taxID: org.taxID || '',
    addressCountry: org.addressCountry || '',
  }
}

registerCredentialType({
  id: 'circuloos-employee',
  displayName: 'Circuloos Employee',
  description: 'Credencial de empleado de una organización del consorcio Circuloos',
  icon: '',
  version: '1.0.0',

  schema: {
    issuance: {
      primaryType: 'CirculoosEmployeeCredential',
      types: {
        CirculoosEmployeeCredential: [
          { name: 'action', type: 'string' },
          { name: 'credentialType', type: 'string' },
          { name: 'credentialId', type: 'string' },
          { name: 'holder', type: 'address' },
          { name: 'worksFor', type: 'Organization' },
          { name: 'issuerDID', type: 'string' },
          { name: 'validFrom', type: 'string' },
          { name: 'validUntil', type: 'string' },
        ],
        Organization: [
          { name: 'legalName', type: 'string' },
          { name: 'taxID', type: 'string' },
          { name: 'addressCountry', type: 'string' },
        ],
      },
      messageBuilder: (vc: any) => {
        const issuerString = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id || ''
        return {
          action: 'Emitir credencial de empleado',
          credentialType: 'Circuloos Employee',
          credentialId: vc.id || '',
          holder: subjectAddress(vc.credentialSubject) as any,
          worksFor: organizationOf(vc),
          issuerDID: issuerString,
          validFrom: vc.validFrom || '',
          validUntil: vc.validUntil || '',
        }
      },
    },

    claim: {
      primaryType: 'CirculoosEmployeeClaim',
      types: {
        CirculoosEmployeeClaim: [
          { name: 'action', type: 'string' },
          { name: 'credentialType', type: 'string' },
          { name: 'issuerName', type: 'string' },
          { name: 'holderAddress', type: 'address' },
          { name: 'organization', type: 'string' },
          { name: 'claimToken', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
      messageBuilder: (credentialPreview: any, holderAddress: string, token: string) => ({
        action: 'Reclamar mi credencial de empleado',
        credentialType: 'Circuloos Employee',
        issuerName: credentialPreview?.issuerName || 'Circuloos',
        holderAddress: (DIDUtils.normalizeAddress(holderAddress) || ZERO_ADDRESS) as any,
        organization: organizationOf(credentialPreview).legalName,
        claimToken: token,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      }),
    },

    // Placeholder presentation schema for the registry contract; the login flow
    // (challenge, audience, holder binding) is defined in plan phase A3.
    presentation: {
      primaryType: 'CirculoosEmployeePresentation',
      types: {
        CirculoosEmployeePresentation: [
          { name: 'action', type: 'string' },
          { name: 'credentialType', type: 'string' },
          { name: 'credentialId', type: 'string' },
          { name: 'holderAddress', type: 'address' },
          { name: 'organizationTaxID', type: 'string' },
          { name: 'issuerName', type: 'string' },
          { name: 'verifierAddress', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
      messageBuilder: (vc: any, holderAddress: string, verifierAddress?: string) => ({
        action: 'Presentar mi credencial de empleado',
        credentialType: 'Circuloos Employee',
        credentialId: vc?.id || '',
        holderAddress: (DIDUtils.normalizeAddress(holderAddress) || ZERO_ADDRESS) as any,
        organizationTaxID: organizationOf(vc).taxID,
        issuerName: formatIssuerName(vc?.issuer, 'Circuloos'),
        verifierAddress: (DIDUtils.normalizeAddress(verifierAddress || '') || ZERO_ADDRESS) as any,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      }),
    },
  },
})
