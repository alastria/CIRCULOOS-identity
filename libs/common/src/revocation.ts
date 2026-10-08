/**
 * EIP-712 typed data an issuer (or admin) signs to request the revocation of a credential
 * through the issuer API. Signed with the issuance's EIP-712 domain.
 */
export const REVOCATION_PRIMARY_TYPE = 'CredentialRevocation'

export const REVOCATION_TYPES = {
  CredentialRevocation: [
    { name: 'action', type: 'string' },
    { name: 'credentialId', type: 'string' },
    { name: 'reason', type: 'string' },
  ],
}

export function buildRevocationMessage(credentialId: string, reason: string) {
  return { action: 'Revocar credencial', credentialId, reason }
}
