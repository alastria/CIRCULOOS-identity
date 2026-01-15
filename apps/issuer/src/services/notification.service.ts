import { EmailSender } from '@circuloos/common'
import { config } from '../config'

export class NotificationService {
    private emailSender?: EmailSender

    constructor(emailSender?: EmailSender) {
        this.emailSender = emailSender
    }

    async sendClaimInfo(email: string, otp: string, holderAddress: string, token: string): Promise<void> {
        if (!this.emailSender) return

        // Get frontend URL from centralized config
        const frontendUrl = config.appPublicUrl

        // Build claim link with token in URL (token is already URL-safe, but encode for safety)
        const claimLink = `${frontendUrl.replace(/\/$/, '')}/claim/${encodeURIComponent(token)}`

        const emailBody = `Your OTP is: ${otp}

This credential is issued to address: ${holderAddress}
Only this address can claim the credential.

🔗 Click here to claim your credential:
${claimLink}

The link will automatically use your token, so you don't need to copy it manually.

If the link doesn't work, you can visit ${frontendUrl}/claim and enter your token manually:
${token}

This link will expire in 72 hours.`

        await this.emailSender.send(email, 'Your Credential is Ready', emailBody)
    }
}
