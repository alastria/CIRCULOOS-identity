/**
 * Enhanced IssuanceService Integration Example
 * 
 * Demonstrates how to use SecureOTPService and SecureTokenService
 * in the issuance flow with best practices
 */

import {
  buildIssuanceDraft,
  buildVC,
  buildEip712Domain,
  verifyCredential,
  buildCredentialProof,
  createSecureOTPService,
  createSecureTokenService,
  OTPConfig,
  TokenClaims,
  hashVC
} from '@circuloos/common'
import { randomBytes } from 'crypto'

/**
 * Example: Enhanced Issuance Flow with Secure Auth
 */
export class EnhancedIssuanceService {
  private otpService: ReturnType<typeof createSecureOTPService>
  private tokenService: ReturnType<typeof createSecureTokenService>
  private store: any
  private hmacSecret: string

  constructor(opts: {
    store: any
    hmacSecret: string
    otpExpirySeconds?: number
  }) {
    this.store = opts.store
    this.hmacSecret = opts.hmacSecret

    // Initialize secure services
    this.otpService = createSecureOTPService({
      secret: opts.hmacSecret,
      expirySeconds: opts.otpExpirySeconds || 300,
      length: 6,
      algorithm: 'sha256'
    })

    this.tokenService = createSecureTokenService(opts.hmacSecret)
  }

  /**
   * STEP 1: Prepare - Generate OTP and Token
   * 
   * Best practices:
   * - Always require holderAddress (W3C compliance)
   * - Use secure OTP with rate limiting
   * - Issue token with operation binding
   * - Store draft with all metadata
   */
  async prepare(
    email: string,
    holderAddress: string,
    companyName?: string
  ): Promise<{
    id: string
    token: string
    otp: string
    expiresAt: number
  }> {
    // Validate inputs
    if (!holderAddress?.trim()) {
      throw new Error('holderAddress is required for W3C compliance')
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(holderAddress.trim())) {
      throw new Error('invalid holder address format')
    }

    // Generate unique issuance ID
    const id = `issuance_${Date.now()}_${randomBytes(6).toString('hex')}`
    const normalizedEmail = email.trim().toLowerCase()

    // Generate secure OTP with rate limiting
    const otpResult = await this.otpService.generate(normalizedEmail)

    // Create draft VC with W3C compliance
    const issuerDid = process.env.ISSUER_DID || 'did:example:issuer'
    const draft = buildIssuanceDraft({
      id,
      issuer: issuerDid,
      subject: {
        id: holderAddress, // W3C standard binding
        holderAddress, // Backward compatibility
        email: normalizedEmail,
        company: companyName || '',
        issuance: {
          id,
          preparedAt: new Date().toISOString(),
        }
      }
    })

    // Issue secure token with operation binding
    const token = await this.tokenService.issue({
      sub: holderAddress,
      issuanceId: id,
      operation: 'prepare',
      email: normalizedEmail
    } as Partial<TokenClaims>, 300)

    // Store draft with OTP metadata (hash only, not OTP itself)
    await this.store.writeAtomic(`issuances/${id}.json`, {
      id,
      draft,
      holderAddress,
      email: normalizedEmail,
      otp: {
        hash: otpResult.hash,
        salt: otpResult.salt,
        expiresAt: otpResult.expiresAt,
        // Never store the actual OTP value
      },
      token: {
        issued: true,
        // Never store the token itself
      },
      status: 'prepared',
      createdAt: Date.now(),
      expiresAt: otpResult.expiresAt
    })

    // Return to user
    return {
      id,
      token, // User must store this
      otp: otpResult.otp, // Send via email in production
      expiresAt: otpResult.expiresAt
    }
  }

  /**
   * STEP 2: Mint - Issuer Signs the Credential
   * 
   * Best practices:
   * - Verify token first
   * - Validate EIP-712 signature
   * - Register onchain
   * - Generate new token for holder
   */
  async mint(
    id: string,
    token: string,
    signature: string,
    signerAddress: string
  ): Promise<{
    success: boolean
    token: string
    otp: string
    expiresAt: number
  }> {
    // Verify token
    const tokenResult = await this.tokenService.verify(token)
    if (!tokenResult.valid) {
      throw new Error(`Invalid token: ${tokenResult.reason}`)
    }

    if (tokenResult.claims?.issuanceId !== id) {
      throw new Error('Token issuanceId mismatch')
    }

    if (tokenResult.claims?.operation !== 'prepare') {
      throw new Error('Token not valid for mint operation')
    }

    // Load draft
    const issuanceData = await this.store.loadAll(`issuances/${id}.json`)
    if (!issuanceData) {
      throw new Error('Issuance not found')
    }

    if (issuanceData.status !== 'prepared') {
      throw new Error(`Invalid status: ${issuanceData.status}`)
    }

    // Validate signature (EIP-712)
    const domain = buildEip712Domain(
      process.env.EIP712_DOMAIN_NAME || 'Circuloos',
      process.env.EIP712_DOMAIN_VERSION || '1',
      Number(process.env.CHAIN_ID || 31337)
    )

    // Build credential proof
    const issuerProof = buildCredentialProof({
      verificationMethod: signerAddress,
      signature,
      domain,
      proofPurpose: 'assertionMethod'
    })

    // Verify signature matches
    const vcHash = hashVC(issuanceData.draft)
    const isValidSignature = await verifyCredential(
      issuanceData.draft,
      issuerProof,
      domain
    )

    if (!isValidSignature) {
      throw new Error('Invalid issuer signature')
    }

    // Update issuance with issuer proof
    issuanceData.issuerProof = issuerProof
    issuanceData.status = 'minted'
    issuanceData.mintedAt = Date.now()

    // TODO: Register onchain
    // await credentialRegistry.registerCredential(vcHash, issuerAddress, holderAddress)

    // Generate new OTP and token for holder
    const newOtpResult = await this.otpService.generate(issuanceData.email)
    const newToken = await this.tokenService.issue({
      sub: issuanceData.holderAddress,
      issuanceId: id,
      operation: 'finalize',
      vcHash
    } as Partial<TokenClaims>, 300)

    // Update stored data
    issuanceData.otp = {
      hash: newOtpResult.hash,
      salt: newOtpResult.salt,
      expiresAt: newOtpResult.expiresAt
    }

    await this.store.writeAtomic(`issuances/${id}.json`, issuanceData)

    return {
      success: true,
      token: newToken,
      otp: newOtpResult.otp, // Send to holder via email
      expiresAt: newOtpResult.expiresAt
    }
  }

  /**
   * STEP 3: Finalize - Holder Signs and Claims Credential
   * 
   * Best practices:
   * - Verify both OTP and token
   * - Validate holder signature matches credentialSubject.id
   * - Create complete double-signed VC
   * - Store final credential
   */
  async finalize(
    id: string,
    token: string,
    otp: string,
    holderSignature: string,
    holderAddress: string
  ): Promise<{
    vcId: string
    downloadUrl: string
  }> {
    // Verify token
    const tokenResult = await this.tokenService.verify(token)
    if (!tokenResult.valid) {
      throw new Error(`Invalid token: ${tokenResult.reason}`)
    }

    if (tokenResult.claims?.issuanceId !== id) {
      throw new Error('Token issuanceId mismatch')
    }

    if (tokenResult.claims?.operation !== 'finalize') {
      throw new Error('Token not valid for finalize operation')
    }

    // Load issuance
    const issuanceData = await this.store.loadAll(`issuances/${id}.json`)
    if (!issuanceData) {
      throw new Error('Issuance not found')
    }

    if (issuanceData.status !== 'minted') {
      throw new Error(`Invalid status: ${issuanceData.status}`)
    }

    // Verify OTP with rate limiting
    const otpResult = await this.otpService.verify(
      otp,
      issuanceData.otp.hash,
      issuanceData.email,
      issuanceData.otp.salt,
      issuanceData.otp.expiresAt
    )

    if (!otpResult.valid) {
      throw new Error(`OTP verification failed: ${otpResult.reason}`)
    }

    // Validate holder address matches credentialSubject.id (W3C compliance)
    if (holderAddress.toLowerCase() !== issuanceData.holderAddress.toLowerCase()) {
      throw new Error('Holder address mismatch')
    }

    if (holderAddress.toLowerCase() !== issuanceData.draft.credentialSubject.id.toLowerCase()) {
      throw new Error('Holder does not match credentialSubject.id (W3C violation)')
    }

    // Build holder proof
    const domain = buildEip712Domain(
      process.env.EIP712_DOMAIN_NAME || 'Circuloos',
      process.env.EIP712_DOMAIN_VERSION || '1',
      Number(process.env.CHAIN_ID || 31337)
    )

    const holderProof = buildCredentialProof({
      verificationMethod: holderAddress,
      signature: holderSignature,
      domain,
      proofPurpose: 'authentication'
    })

    // Verify holder signature
    const isValidHolderSignature = await verifyCredential(
      issuanceData.draft,
      holderProof,
      domain
    )

    if (!isValidHolderSignature) {
      throw new Error('Invalid holder signature')
    }

    // Create final VC with both proofs
    const vcId = `vc_${Date.now()}_${randomBytes(6).toString('hex')}`
    const finalVC = {
      vc: {
        ...issuanceData.draft,
        id: vcId,
        issuanceDate: new Date().toISOString()
      },
      issuerProof: issuanceData.issuerProof,
      holderProof
    }

    // Store final credential
    await this.store.writeAtomic(`vcs/${vcId}.json`, finalVC)

    // Update issuance status
    issuanceData.status = 'finalized'
    issuanceData.finalizedAt = Date.now()
    issuanceData.vcId = vcId
    await this.store.writeAtomic(`issuances/${id}.json`, issuanceData)

    return {
      vcId,
      downloadUrl: `/tmp-filestore/vcs/${vcId}.json`
    }
  }

  /**
   * Periodic cleanup of rate limits and expired tokens
   */
  async cleanup(): Promise<void> {
    this.otpService.cleanup()
    // Token service has automatic cleanup
  }
}

/**
 * Example usage
 */
export async function exampleUsage() {
  const service = new EnhancedIssuanceService({
    store: {} as any, // Your FileStore instance
    hmacSecret: process.env.ISSUER_HMAC_SECRET || 'dev-secret-min-32-chars-long'
  })

  // Step 1: Prepare
  const { id, token, otp, expiresAt } = await service.prepare(
    'user@example.com',
    '0x1234567890123456789012345678901234567890',
    'Example Corp'
  )

  console.log('Prepared:', { id, token, otp })

  // Step 2: Mint (Issuer signs)
  const mintResult = await service.mint(
    id,
    token,
    '0xsignature...', // Issuer's EIP-712 signature
    '0xIssuerAddress...'
  )

  console.log('Minted:', mintResult)

  // Step 3: Finalize (Holder signs)
  const finalResult = await service.finalize(
    id,
    mintResult.token,
    mintResult.otp,
    '0xholderSignature...', // Holder's EIP-712 signature
    '0x1234567890123456789012345678901234567890'
  )

  console.log('Finalized:', finalResult)
}
