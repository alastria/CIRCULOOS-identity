import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationService } from '../../src/services/notification.service'

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

        expect(mockEmailSender.send).toHaveBeenCalledWith(
            'test@example.com',
            'Your Credential Claim Information',
            expect.stringContaining('Your OTP is 123456')
        )
        expect(mockEmailSender.send).toHaveBeenCalledWith(
            'test@example.com',
            'Your Credential Claim Information',
            expect.stringContaining('Token: token-123')
        )
    })

    it('does nothing if no email sender provided', async () => {
        const noEmailService = new NotificationService(undefined)
        await noEmailService.sendClaimInfo('test@example.com', '123', '0x', 'tok')
        // Should not throw
    })
})
