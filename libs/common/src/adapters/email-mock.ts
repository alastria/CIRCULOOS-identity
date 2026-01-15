import { EmailSender } from './email'

const sent: Array<{ to: string; subject: string; body: string }> = []

export const EmailMock: EmailSender = {
  async send(to: string, subject: string, body: string) {
    sent.push({ to, subject, body })
    return Promise.resolve()
  }
}

export function getSentEmails() {
  return sent.slice()
}

export function clearSent() {
  sent.length = 0
}
