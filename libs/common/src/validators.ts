import { z } from 'zod'

export const VCSubject = z.object({
  id: z.string().optional(),
  name: z.string().optional()
})

export const VerifiableCredential = z.object({
  '@context': z.array(z.string()),
  id: z.string(),
  type: z.array(z.string()),
  issuer: z.string(),
  issuanceDate: z.string(),
  expirationDate: z.string().optional(),
  credentialSubject: z.any()
})

export const VerifiablePresentation = z.object({
  '@context': z.array(z.string()),
  type: z.array(z.string()),
  verifiableCredential: z.array(z.any()),
  holder: z.string().optional()
})
