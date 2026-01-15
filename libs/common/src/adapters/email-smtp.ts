import { EmailSender } from './email'
import nodemailer from 'nodemailer'

/**
 * Creates an SMTP email sender using nodemailer
 * Configure via environment variables:
 * - SMTP_HOST: SMTP server host (default: localhost)
 * - SMTP_PORT: SMTP server port (default: 1025)
 * - SMTP_SECURE: Use TLS/SSL (default: false)
 * - SMTP_USER: SMTP username (optional)
 * - SMTP_PASS: SMTP password (optional)
 * - EMAIL_FROM: From address (default: noreply@alastria.test)
 */
export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user?: string
  pass?: string
  from: string
}

export function createSmtpEmailSender(config?: SmtpConfig): EmailSender {
  const host = config?.host || process.env.SMTP_HOST || 'localhost'
  const port = config?.port || Number(process.env.SMTP_PORT || 1025)
  const secure = config?.secure ?? (process.env.SMTP_SECURE === 'true')
  const user = config?.user || process.env.SMTP_USER
  const pass = config?.pass || process.env.SMTP_PASS
  const from = config?.from || process.env.EMAIL_FROM || 'noreply@alastria.test'

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? {
      user,
      pass,
    } : undefined,
    // Disable certificate validation for local testing (Mailpit, etc.)
    tls: {
      rejectUnauthorized: false,
    },
  })

  return {
    async send(to: string, subject: string, body: string) {
      try {
        await transporter.sendMail({
          from,
          to,
          subject,
          text: body,
        })
      } catch (error) {
        console.error('Failed to send email:', error)
        throw error
      }
    },
  }
}

