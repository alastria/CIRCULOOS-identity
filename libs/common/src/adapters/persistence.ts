export type IssuanceAudit = {
  vcId: string
  issuedAt: string
  issuer: string
}

export interface PersistenceAdapter {
  loadIssuanceAudits(): Promise<IssuanceAudit[]>
  appendIssuanceAudit(audit: IssuanceAudit): Promise<void>
  getRevocationStatus(vcId: string): Promise<boolean>
  setRevoked(vcId: string): Promise<void>
}
