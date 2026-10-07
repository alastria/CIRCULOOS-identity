/**
 * Credential Type Schemas
 *
 * Auto-registers all credential types when imported.
 * Add new credential types here.
 */

// Register all credential types
import './generic'                    // Legacy/fallback schema
import './circuloos-marketplace'      // Circuloos Marketplace credential
import './circuloos-employee'         // Circuloos Employee credential (organisation)

// Export registry functions
export * from '../registry'
export * from '../utils'
