/**
 * EIP-712 Credential Type Registry
 *
 * Manages different credential types and their EIP-712 schemas.
 * Each credential type (e.g., circuloos-marketplace, employee-badge)
 * has its own optimized schema for better UX.
 */

import { CredentialTypeToSchemaId } from '../types'

export interface EIP712TypeDefinition {
  name: string
  type: string
}

export interface EIP712SchemaDefinition {
  primaryType: string
  types: Record<string, EIP712TypeDefinition[]>
  messageBuilder: (data: any, ...args: any[]) => any
}

export interface CredentialTypeSchema {
  // Schema for ISSUANCE (issuer signs the credential)
  issuance: EIP712SchemaDefinition

  // Schema for CLAIM (holder claims the credential)
  claim: EIP712SchemaDefinition

  // Schema for PRESENTATION (holder presents the credential)
  presentation: EIP712SchemaDefinition
}

export interface CredentialTypeMetadata {
  id: string                    // "circuloos-marketplace"
  displayName: string           // "🏪 Circuloos Marketplace"
  description: string           // "Credencial de acceso al marketplace"
  icon: string                  // "🏪"
  version: string               // "1.0.0"
  schema: CredentialTypeSchema
}

// Global registry
const CREDENTIAL_TYPES = new Map<string, CredentialTypeMetadata>()

/**
 * Register a new credential type
 */
export function registerCredentialType(metadata: CredentialTypeMetadata): void {
  if (CREDENTIAL_TYPES.has(metadata.id)) {
    console.warn(`Credential type "${metadata.id}" is already registered. Overwriting.`)
  }
  CREDENTIAL_TYPES.set(metadata.id, metadata)
}

/**
 * Get a credential type by ID
 */
export function getCredentialType(id: string): CredentialTypeMetadata | undefined {
  return CREDENTIAL_TYPES.get(id)
}

/**
 * Get all registered credential types
 */
export function getAllCredentialTypes(): CredentialTypeMetadata[] {
  return Array.from(CREDENTIAL_TYPES.values())
}

/**
 * Check if a credential type is registered
 */
export function hasCredentialType(id: string): boolean {
  return CREDENTIAL_TYPES.has(id)
}

/**
 * Get credential type from VC object (auto-detection)
 * Uses the W3C VC type array to determine which EIP-712 schema to use
 */
export function detectCredentialType(vc: any): string {
  // Check VC type array and map to schema ID
  if (Array.isArray(vc.type)) {
    for (const type of vc.type) {
      // Skip generic VerifiableCredential type
      if (type === 'VerifiableCredential') continue
      
      // Check if this type has a registered schema mapping
      const schemaId = CredentialTypeToSchemaId[type]
      if (schemaId) {
        return schemaId
      }
    }
  }

  // Check credentialSubject for explicit schema reference
  if (vc.credentialSubject?.credentialSchemaId) {
    return vc.credentialSubject.credentialSchemaId
  }

  // Check credentialSchema W3C field
  if (vc.credentialSchema?.type) {
    return vc.credentialSchema.type
  }

  // Default to circuloos-marketplace as the main schema
  return 'circuloos-marketplace'
}
