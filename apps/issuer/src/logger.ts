import pino from 'pino'
import { config } from './config'

/**
 * Application logger using pino
 * 
 * Log levels are controlled by LOG_LEVEL environment variable:
 * - fatal: critical errors that cause application to crash
 * - error: errors that should be investigated
 * - warn: warnings about potential issues
 * - info: general information (default for production)
 * - debug: debugging information (default for development)
 * - trace: very detailed debugging
 */
export const logger = pino({
  level: config.logLevel || (config.nodeEnv === 'production' ? 'info' : 'debug'),
  transport: config.nodeEnv !== 'production'
    ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }
    : undefined,
})
