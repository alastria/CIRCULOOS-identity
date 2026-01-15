import {
    generateOtp,
    hmacOtp,
    verifyOtp,
    createToken,
    verifyToken,
    buildEip712Domain,
    verifyCredential,
    expiresAt
} from '@circuloos/common'
import { config } from '../config'

export class SecurityService {
    private hmacSecret: string
    private otpExpirySeconds: number

    constructor(hmacSecret?: string, otpExpirySeconds?: number) {
        this.hmacSecret = hmacSecret || config.issuer.hmacSecret || 'dev-secret'
        this.otpExpirySeconds = otpExpirySeconds || config.security.otpExpirySeconds || 300
    }

    generateOtpCode(length: number = 6): string {
        return generateOtp(length)
    }

    hashOtp(otp: string): string {
        return hmacOtp(this.hmacSecret, otp)
    }

    verifyOtpCode(otp: string, hash: string): boolean {
        return verifyOtp(this.hmacSecret, otp, hash)
    }

    createSessionToken(payload: any): string {
        return createToken(payload, this.hmacSecret, this.otpExpirySeconds)
    }

    verifySessionToken(token: string): { ok: boolean; payload?: any; error?: string } {
        return verifyToken(token, this.hmacSecret)
    }

    getExpiryDate(): number {
        return expiresAt(this.otpExpirySeconds)
    }

    buildDomain(verifyingContract?: string) {
        return buildEip712Domain(
            config.eip712.domainName,
            config.eip712.domainVersion,
            config.blockchain.chainId,
            verifyingContract
        )
    }

    verifySignature(domain: any, vc: any, signature: string): string | null {
        return verifyCredential(domain, vc, signature)
    }
}
