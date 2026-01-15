/**
 * EIP-712 Schema Registry System
 *
 * Modular, scalable system for managing different credential types
 * with optimized UX for signature display.
 */

// Core registry
export * from './registry'
export * from './utils'
export * from './helpers'

// Credential type schemas (auto-registers on import)
export * from './types'
