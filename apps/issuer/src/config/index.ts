import { loadConfig } from '@circuloos/common'

// Load and validate configuration once
export const config = loadConfig()

// Export specific sections for convenience if needed, 
// but generally prefer using the full config object to see context.
export const {
    http,
    issuer,
    storage,
    security,
    email,
    diamond,
    blockchain,
    swagger,
    adminAddresses
} = config
