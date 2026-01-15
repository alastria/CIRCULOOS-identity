// Re-export all config from the config/ directory
export * from './config/'
export { loadConfig, getTestConfig } from './config/loader'
export type { AppConfig } from './config/loader'

// Pre-loaded config singleton for convenience
import { loadConfig } from './config/loader'
export const config = loadConfig()
