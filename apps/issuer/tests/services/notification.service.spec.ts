import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationService } from '../../src/services/notification.service'

// The claim link is built from config.appPublicUrl (issuer typed config)
vi.mock('../../src/config', () => ({
    config: { appPublicUrl: 'https://app.example.test' }
}))

describe('NotificationService', () => {
    let service: NotificationService
    let mockEmailSender: any

    beforeEach(() => {
        mockEmailSender = {
            send: vi.fn()
        }
        service = new NotificationService(mockEmailSender)
    })

    it('sends claim info email', async () => {
        await service.sendClaimInfo('test@example.com', '123456', '0xholder', 'token-123')

        // Template changed: new subject, OTP line, holder binding and a claim deep link
        expect(mockEmailSender.send).toHaveBeenCalledTimes(1)
        const [to, subject, body] = mockEmailSender.send.mock.calls[0]
        expect(to).toBe('test@example.com')
        expect(subject).toBe('Your Credential is Ready')
        expect(body).toContain('Your OTP is: 123456')
        expect(body).toContain('This credential is issued to address: 0xholder')
        expect(body).toContain('https://app.example.test/claim/token-123')
        expect(body).toContain('visit https://app.example.test/claim and enter your token manually:\ntoken-123')
    })

    it('does nothing if no email sender provided', async () => {
        const noEmailService = new NotificationService(undefined)
        await expect(noEmailService.sendClaimInfo('test@example.com', '123', '0x', 'tok')).resolves.toBeUndefined()
        expect(mockEmailSender.send).not.toHaveBeenCalled()
    })
})
