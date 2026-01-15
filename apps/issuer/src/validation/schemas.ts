/**
 * Zod Validation Schemas
 *
 * Centralized input validation for all API endpoints
 * Provides type-safe validation and better error messages
 */

import { z, type ZodIssue } from 'zod'

// ============================================================================
// Common Schemas
// ============================================================================

export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
  .transform(addr => addr.toLowerCase())

export const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(3, 'Email too short')
  .max(255, 'Email too long')
  .transform(email => email.toLowerCase().trim())

export const signatureSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{130}$/, 'Invalid signature format (must be 65 bytes hex)')

export const eip712DomainSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().min(1).max(20),
  chainId: z.number().int().positive(),
  verifyingContract: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
})

// ============================================================================
// Credential Issuance Schemas
// ============================================================================

// Define known claim fields with validation
// SECURITY: Use .strict() to prevent data pollution attacks
const claimsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  companyName: z.string().min(1).max(200).optional(),
  // Add other known claim types here as the system evolves
  // Each field should have explicit validation
  title: z.string().min(1).max(200).optional(),
  department: z.string().min(1).max(200).optional(),
  employeeId: z.string().min(1).max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  description: z.string().max(1000).optional(),
}).strict() // SECURITY: Reject unknown properties to prevent data pollution

export const prepareCredentialSchema = z.object({
  email: emailSchema,
  holderAddress: ethereumAddressSchema,
  claims: claimsSchema
})

export const mintCredentialSchema = z.object({
  id: z.string().uuid('Invalid issuance ID'),
  signature: signatureSchema,
  signerAddress: ethereumAddressSchema,
  domain: eip712DomainSchema.optional()
})

export const finalizeClaimSchema = z.object({
  issuanceId: z.string().uuid('Invalid issuance ID'),
  token: z.string().min(32).max(512), // Claim token
  otp: z.string().regex(/^[0-9]{6}$/, 'OTP must be 6 digits'),
  signature: signatureSchema,
  holderAddress: ethereumAddressSchema,
  domain: eip712DomainSchema.optional(),
  timestamp: z.string().optional()
})

export const issueCredentialSimplifiedSchema = z.object({
  holderAddress: ethereumAddressSchema,
  email: emailSchema,
  signature: signatureSchema,
  signerAddress: ethereumAddressSchema,
  domain: eip712DomainSchema.optional(),
  claims: claimsSchema.optional() // SECURITY: Use validated claims schema
})

// ============================================================================
// Query Parameter Schemas
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export const credentialFilterSchema = z.object({
  status: z.enum(['pending', 'issued', 'claimed', 'revoked']).optional(),
  holderAddress: ethereumAddressSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
}).merge(paginationSchema)

// ============================================================================
// Revocation Schemas
// ============================================================================

export const revokeCredentialSchema = z.object({
  credentialId: z.string().min(1),
  reason: z.string().min(1).max(500).optional(),
  signature: signatureSchema
})

// ============================================================================
// Authentication Schemas
// ============================================================================

export const siwaMessageSchema = z.object({
  domain: z.string().min(1).max(255),
  address: ethereumAddressSchema,
  statement: z.string().max(1000).optional(),
  uri: z.string().url(),
  version: z.string().regex(/^[0-9]+$/),
  chainId: z.number().int().positive(),
  nonce: z.string().min(8).max(64),
  issuedAt: z.string().datetime(),
  expirationTime: z.string().datetime().optional(),
  notBefore: z.string().datetime().optional(),
  requestId: z.string().max(100).optional(),
  resources: z.array(z.string().url()).optional()
})

export const siwaVerifySchema = z.object({
  message: siwaMessageSchema,
  signature: signatureSchema
})

// ============================================================================
// Helper function to validate and parse
// ============================================================================

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`)
      throw new Error(`Validation failed: ${messages.join(', ')}`)
    }
    throw error
  }
}

export function validateInputSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`)
      return { success: false, error: messages.join(', ') }
    }
    return { success: false, error: 'Unknown validation error' }
  }
}

// ============================================================================
// Type exports for TypeScript
// ============================================================================

export type PrepareCredentialInput = z.infer<typeof prepareCredentialSchema>
export type MintCredentialInput = z.infer<typeof mintCredentialSchema>
export type FinalizeClaimInput = z.infer<typeof finalizeClaimSchema>
export type IssueCredentialSimplifiedInput = z.infer<typeof issueCredentialSimplifiedSchema>
export type RevokeCredentialInput = z.infer<typeof revokeCredentialSchema>
export type SiwaMessageInput = z.infer<typeof siwaMessageSchema>
export type SiwaVerifyInput = z.infer<typeof siwaVerifySchema>
