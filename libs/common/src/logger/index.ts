import pino, { Logger as PinoLogger, LoggerOptions } from 'pino'

// Sensitive fields that should be redacted in logs
const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'signature',
  'privateKey',
  'private_key',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'otp',
  'otpHash',
  'hmacSecret',
  'emailBinding',
  'proof.signature',
  'issuerProof.signature',
  'holderProof.signature',
]

// Fields to partially redact (show first/last chars)
const PARTIAL_REDACT_FIELDS = [
  'email',
  'address',
  'wallet',
  'holderAddress',
  'issuerAddress',
  'signerAddress',
]

/**
 * Redact sensitive data from objects before logging
 */
function redactSensitiveData(obj: any, depth = 0): any {
  if (depth > 10) return obj // Prevent infinite recursion
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, depth + 1))
  }

  const redacted: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()

    // Full redaction for sensitive fields
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]'
      continue
    }

    // Partial redaction for email-like fields
    if (PARTIAL_REDACT_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      if (typeof value === 'string') {
        if (value.includes('@')) {
          // Email: show first 2 chars + domain
          const [local, domain] = value.split('@')
          redacted[key] = `${local.slice(0, 2)}***@${domain}`
        } else if (value.startsWith('0x') || value.startsWith('did:')) {
          // Address/DID: show first 6 and last 4 chars
          redacted[key] = value.length > 12 
            ? `${value.slice(0, 6)}...${value.slice(-4)}`
            : value
        } else {
          redacted[key] = value
        }
        continue
      }
    }

    // Recursively process nested objects
    if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value, depth + 1)
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'

export interface LoggerConfig {
  level?: LogLevel
  name?: string
  prettyPrint?: boolean
  redactSensitive?: boolean
}

/**
 * Professional Logger Service
 * 
 * Features:
 * - Configurable log levels
 * - Pretty printing in development
 * - Automatic redaction of sensitive data
 * - Structured logging (JSON in production)
 * - Child loggers for context
 */
export class LoggerService {
  private logger: PinoLogger
  private redactSensitive: boolean

  constructor(config: LoggerConfig = {}) {
    const isDev = process.env.NODE_ENV !== 'production'
    const level = config.level || (isDev ? 'debug' : 'info')
    this.redactSensitive = config.redactSensitive !== false

    const options: LoggerOptions = {
      level,
      name: config.name || 'circuloos',
      // Timestamp format
      timestamp: pino.stdTimeFunctions.isoTime,
      // Base context
      base: {
        env: process.env.NODE_ENV || 'development',
        ...(config.name ? { service: config.name } : {}),
      },
      // Format error objects properly
      formatters: {
        level: (label) => ({ level: label }),
      },
    }

    // Pretty print in development
    if (isDev && config.prettyPrint !== false) {
      options.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    }

    this.logger = pino(options)
  }

  /**
   * Create a child logger with additional context
   */
  child(bindings: Record<string, any>): LoggerService {
    const childLogger = new LoggerService({ redactSensitive: this.redactSensitive })
    childLogger.logger = this.logger.child(this.redact(bindings))
    return childLogger
  }

  /**
   * Redact sensitive data if enabled
   */
  private redact(data: any): any {
    if (!this.redactSensitive) return data
    return redactSensitiveData(data)
  }

  /**
   * Format message and data for logging
   */
  private formatArgs(message: string, data?: any): { obj?: any; msg: string } {
    if (data !== undefined) {
      return { obj: this.redact(data), msg: message }
    }
    return { msg: message }
  }

  // Log methods
  fatal(message: string, data?: any): void {
    const { obj, msg } = this.formatArgs(message, data)
    if (obj) {
      this.logger.fatal(obj, msg)
    } else {
      this.logger.fatal(msg)
    }
  }

  error(message: string, data?: any): void {
    const { obj, msg } = this.formatArgs(message, data)
    if (obj) {
      this.logger.error(obj, msg)
    } else {
      this.logger.error(msg)
    }
  }

  warn(message: string, data?: any): void {
    const { obj, msg } = this.formatArgs(message, data)
    if (obj) {
      this.logger.warn(obj, msg)
    } else {
      this.logger.warn(msg)
    }
  }

  info(message: string, data?: any): void {
    const { obj, msg } = this.formatArgs(message, data)
    if (obj) {
      this.logger.info(obj, msg)
    } else {
      this.logger.info(msg)
    }
  }

  debug(message: string, data?: any): void {
    const { obj, msg } = this.formatArgs(message, data)
    if (obj) {
      this.logger.debug(obj, msg)
    } else {
      this.logger.debug(msg)
    }
  }

  trace(message: string, data?: any): void {
    const { obj, msg } = this.formatArgs(message, data)
    if (obj) {
      this.logger.trace(obj, msg)
    } else {
      this.logger.trace(msg)
    }
  }

  /**
   * Log with explicit level
   */
  log(level: LogLevel, message: string, data?: any): void {
    const { obj, msg } = this.formatArgs(message, data)
    if (obj) {
      this.logger[level](obj, msg)
    } else {
      this.logger[level](msg)
    }
  }

  /**
   * Get the underlying pino logger (for Fastify integration)
   */
  getPinoLogger(): PinoLogger {
    return this.logger
  }

  /**
   * Check if a level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.logger.isLevelEnabled(level)
  }
}

// Default logger instance
let defaultLogger: LoggerService | null = null

/**
 * Get or create the default logger instance
 */
export function getLogger(config?: LoggerConfig): LoggerService {
  if (!defaultLogger || config) {
    defaultLogger = new LoggerService(config)
  }
  return defaultLogger
}

/**
 * Create a named logger (child of default)
 */
export function createLogger(name: string, additionalContext?: Record<string, any>): LoggerService {
  const base = getLogger()
  return base.child({ service: name, ...additionalContext })
}

// Export types
export type { PinoLogger }

// Re-export pino for advanced usage
export { pino }
