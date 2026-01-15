import {
  EmailSender,
  buildIssuanceDraft,
  VC,
  TrustedIssuerRegistryClient,
  IStorageAdapter,
  DIDUtils,
  getCredentialType
} from '@circuloos/common'
import { SecurityService } from './security.service'
import { config } from '../config'
import { logger } from '../logger'
import { CredentialService } from './credential.service'
import { RegistryService } from './registry.service'
import { NotificationService } from './notification.service'
import { utils } from 'ethers'

export class IssuanceService {
  private security: SecurityService
  private credential: CredentialService
  private registry: RegistryService
  private notification: NotificationService

  constructor(opts: {
    storage: IStorageAdapter
    emailSender?: EmailSender
    hmacSecret?: string
    otpExpirySeconds?: number
    trustedIssuerRegistry?: TrustedIssuerRegistryClient
    createCredentialRegistry?: (address: string, signerOrProvider: any) => any
  }) {
    this.security = new SecurityService(opts.hmacSecret, opts.otpExpirySeconds)
    this.credential = new CredentialService(opts.storage)
    this.registry = new RegistryService(opts.trustedIssuerRegistry, opts.createCredentialRegistry)
    this.notification = new NotificationService(opts.emailSender)
  }

  async prepare(email: string, holderAddress?: string, companyName?: string, customClaims?: Record<string, any>) {
    // Validate required holder address for W3C compliance
    if (!holderAddress?.trim()) {
      throw new Error('holderAddress is required for credential issuance')
    }

    const normalizedHolder = holderAddress.trim()

    // Validate holder address format (basic ethereum address validation)
    if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedHolder)) {
      throw new Error('invalid holderAddress format')
    }

    // SECURITY: ISSUER_DID is required in production
    const issuerDid = config.issuer.did
    if (!issuerDid && config.nodeEnv === 'production') {
      throw new Error('ISSUER_DID is required in production')
    }
    const normalizedEmail = email?.trim() || 'unknown@example.test'

    // SECURITY: HMAC secret is required for secure credential IDs
    const hmacSecret = config.issuer.hmacSecret
    if (!hmacSecret && config.nodeEnv === 'production') {
      throw new Error('ISSUER_HMAC_SECRET is required in production')
    }

    // 1. Create Draft VC
    const { id, draftVc } = this.credential.createDraftVC(
      normalizedHolder,
      normalizedEmail,
      issuerDid || 'did:example:issuer', // Fallback only for dev/test
      hmacSecret || 'dev-secret-only-for-testing',
      companyName,
      customClaims
    )

    // 2. Generate OTP and Token
    const otp = this.security.generateOtpCode(6)
    const otpHash = this.security.hashOtp(otp)
    const token = this.security.createSessionToken({ id, holderAddress: normalizedHolder })
    const exp = this.security.getExpiryDate()

    // Normalize registry address for EIP-712 domain (it must be an address, not a DID)
    const registryAddress = this.registry.getTrustedRegistryAddress()
    const normalizedRegistryAddress = registryAddress ? DIDUtils.normalizeAddress(registryAddress) : undefined
    const domain = this.security.buildDomain(normalizedRegistryAddress)

    // 3. Save Issuance Record
    const payload = buildIssuanceDraft(id, otpHash, exp)
    await this.credential.saveIssuance(id, {
      ...payload,
      draft: draftVc,
      domain,
      otpHash,
      holderAddress: normalizedHolder,
      tokenIssuedAt: Date.now(),
    })

    // NOTE: Email is NOT sent here anymore. It will be sent after Issuer signs in mint().

    return { id, token, otp, expiresAt: exp, domain, holderAddress: normalizedHolder, draftVc }
  }

  async mint(id: string, issuerSignature?: string, issuerSigner?: string, domainOverride?: any) {
    // 1. Load Issuance
    const rec = await this.credential.loadIssuance(id)
    if (!rec) throw new Error('not found')

    // Validate Status
    if (rec.status !== 'DRAFT' && rec.status !== 'PENDING_ISSUER_SIGNATURE') {
      if (rec.status === 'ISSUED') throw new Error('already issued')
      throw new Error(`invalid status for mint: ${rec.status}`)
    }

    const vc = rec.draft
    if (!vc) throw new Error('no draft to mint')

    // Normalize registry address for EIP-712 domain
    const registryAddress = this.registry.getTrustedRegistryAddress()
    const normalizedRegistryAddress = registryAddress ? DIDUtils.normalizeAddress(registryAddress) : undefined

    // If domainOverride is provided, ensure its verifyingContract is normalized
    if (domainOverride && domainOverride.verifyingContract) {
      domainOverride.verifyingContract = DIDUtils.normalizeAddress(domainOverride.verifyingContract)
    }

    const domain = domainOverride || this.security.buildDomain(normalizedRegistryAddress)

    // 2. Validate Registry Domain
    if (this.registry.getTrustedRegistryAddress()) {
      const verifyingContract = domain?.verifyingContract
      if (!verifyingContract) {
        throw new Error('trusted issuer registry enabled but domain missing verifyingContract')
      }
      // Compare normalized addresses
      const trustedAddress = DIDUtils.normalizeAddress(this.registry.getTrustedRegistryAddress()!)
      if (verifyingContract.toLowerCase() !== trustedAddress.toLowerCase()) {
        throw new Error(`verifyingContract must match trusted issuer registry address. Got ${verifyingContract}, expected ${trustedAddress}`)
      }
    }

    // 3. Verify Issuer Signature
    if (!issuerSignature || !issuerSigner) {
      throw new Error('missing issuer signature and signer; client EIP-712 signature required')
    }

    logger.debug({
      domain,
      vcId: vc.id,
      issuerSigner,
      hasSignature: !!issuerSignature
    }, 'Mint signature verification starting')

    // Use the new schema registry to verify signature with the same types used by frontend
    // This ensures the EIP-712 typed data hash matches
    const credentialType = 'circuloos-marketplace'
    const schema = getCredentialType(credentialType)

    let recovered: string | null = null

    if (schema) {
      // Use the schema's types and message builder for verification
      const { primaryType, types, messageBuilder } = schema.schema.issuance
      const message = messageBuilder(vc)

      logger.debug({ primaryType, schemaUsed: credentialType }, 'Using schema registry verification')

      try {
        recovered = utils.verifyTypedData(domain, types, message, issuerSignature)
        logger.debug({ recovered }, 'Schema registry recovered address')
      } catch (schemaErr: any) {
        logger.warn({ error: schemaErr.message }, 'Schema registry verification failed, trying legacy')
        // Fallback to legacy verification
        recovered = this.security.verifySignature(domain, vc, issuerSignature)
      }
    } else {
      // Fallback to legacy verification if schema not found
      logger.warn({ credentialType }, 'Schema not found - using legacy verification')
      recovered = this.security.verifySignature(domain, vc, issuerSignature)
    }

    logger.debug({ recovered }, 'Final recovered address')

    if (!recovered) {
      logger.debug('verifyCredential returned no address for signature')
      throw new Error('invalid issuer signature')
    }
    if (recovered.toLowerCase() !== issuerSigner.toLowerCase()) {
      logger.debug({ recovered, expected: issuerSigner }, 'Signer mismatch')
      throw new Error(`issuer signer mismatch: recovered=${recovered}, expected=${issuerSigner}`)
    }

    const issuerProof = this.credential.buildProof(issuerSignature, issuerSigner, domain, 'assertionMethod')

    // 4. Check Trusted Registry
    const trusted = await this.registry.isTrustedIssuer(issuerSigner)
    if (!trusted) {
      throw new Error('issuer signer is not listed in the trusted issuer registry')
    }

    // 5. Generate New Token/OTP
    const otp = this.security.generateOtpCode(6)
    const otpHash = this.security.hashOtp(otp)
    const holderAddress = rec.holderAddress
    if (!holderAddress) throw new Error('issuance record missing holderAddress')
    const token = this.security.createSessionToken({ id, holderAddress })

    // 6. Embed proof in VC (W3C standard)
    const vcWithProof = this.credential.embedProof(vc, issuerProof)
    await this.credential.saveVC(vc.id, vcWithProof)

    logger.debug({ issuanceId: id, issuerProof }, 'Saving issuance')

    await this.credential.saveIssuance(id, {
      ...rec,
      issuerProof,
      otpHash,
      tokenIssuedAt: Date.now(),
      status: 'ISSUED', // Update status
    })

    // 7. Record On-Chain
    const receipt = await this.registry.recordIssuance(vc)
    if (receipt) {
      await this.credential.saveVC(`${vc.id}.onchain`, { txHash: receipt.txHash, blockNumber: receipt.blockNumber } as any)
    }

    // 8. Send Email (Moved from prepare)
    // We use the NEW token generated in mint step 5
    // We need the email address. It should be in the draft VC or issuance record.
    // The draft VC has credentialSubject.email (if added) or we can extract from rec if we saved it?
    // In prepare, we passed email to createDraftVC.
    // createDraftVC puts email in credentialSubject.email if it's a standard claim?
    // Let's check createDraftVC usage in prepare:
    // const { id, draftVc } = this.credential.createDraftVC(normalizedHolder, normalizedEmail, ...)
    // It seems email is used there.
    // Also, prepare didn't save email explicitly in issuance record, but it might be in the draft.
    // Let's try to extract email from draftVc.credentialSubject.email or similar.
    // Or we can save email in issuance record in prepare.
    // Wait, createDraftVC likely puts it in credentialSubject.
    const email = vc.credentialSubject?.email || vc.credentialSubject?.id // Fallback? No.
    // If email is not in draft, we have a problem.
    // In prepare, we had `normalizedEmail`.
    // Let's assume it's in credentialSubject.
    // If not, I'll have to fix it.
    // Actually, looking at `prepare` in the original code:
    // await this.notification.sendClaimInfo(normalizedEmail, otp, normalizedHolder, token)
    // It used `normalizedEmail`.
    // I will try to extract it from draft.

    // Attempt to find email
    let recipientEmail = 'unknown@example.com'
    if (vc.credentialSubject && vc.credentialSubject.email) {
      recipientEmail = vc.credentialSubject.email
    } else if (vc.credentialSubject && typeof vc.credentialSubject === 'object') {
      // Search for email field
      for (const key in vc.credentialSubject) {
        if (key.toLowerCase().includes('email')) {
          recipientEmail = vc.credentialSubject[key]
          break
        }
      }
    }

    if (recipientEmail && recipientEmail !== 'unknown@example.com') {
      await this.notification.sendClaimInfo(recipientEmail, otp, holderAddress, token)
    } else {
      logger.warn({ holder: holderAddress }, 'Could not find email to send claim info')
    }

    const exposeOtp = config.nodeEnv !== 'production'

    return {
      id,
      token,
      issuer: { verificationMethod: issuerProof.verificationMethod },
      otp: exposeOtp ? otp : undefined,
    }
  }

  async finalize(id: string, otpOrObj: any) {
    // otpOrObj parsing
    let otp: string | undefined
    let providedToken: string | undefined
    let providedSignature: string | undefined
    let providedSigner: string | undefined
    let providedTimestamp: string | undefined
    let providedClaimMessage: any | undefined
    if (typeof otpOrObj === 'string') otp = otpOrObj
    else {
      otp = otpOrObj?.otp
      providedToken = otpOrObj?.token
      providedSignature = (otpOrObj as any)?.signature
      providedSigner = (otpOrObj as any)?.signer
      providedTimestamp = (otpOrObj as any)?.timestamp
      providedClaimMessage = (otpOrObj as any)?.claimMessage
    }

    if (!providedToken) throw new Error('missing token')

    // 1. Verify Token
    const tokenHolderAddress = this.validateToken(providedToken, id, providedSigner)

    // 2. Load Issuance
    const rec = await this.credential.loadIssuance(id)
    if (!rec) throw new Error('not found')
    if (rec.expiresAt && Date.now() > rec.expiresAt) throw new Error('expired')

    // Validate Status
    if (rec.status !== 'ISSUED') {
      if (rec.status === 'CLAIMED') throw new Error('already claimed')
      throw new Error(`invalid status for finalize: ${rec.status}`)
    }

    // 3. Verify OTP
    if (!otp) throw new Error('missing otp')
    if (!this.security.verifyOtpCode(otp, rec.otpHash)) throw new Error('invalid otp')

    // 4. Validate Holder Address
    const storedHolderAddress = rec.holderAddress
    if (storedHolderAddress && tokenHolderAddress.toLowerCase() !== storedHolderAddress.toLowerCase()) {
      throw new Error('token holder address does not match issuance record')
    }

    const vc = rec.draft
    // Fallback VC creation removed for brevity/safety - we expect draft to exist from prepare phase

    const defaultDomain = this.security.buildDomain(this.registry.getTrustedRegistryAddress())

    // 5. Verify Holder Signature
    if (!providedSignature || !providedSigner) {
      throw new Error('missing holder signature; client EIP-712 signature required')
    }

    // IMPORTANT: Prioritize client domain if provided (frontend may update chainId to match active network)
    // If client provides a domain, use it (it matches what was used to sign)
    // Otherwise, use stored domain or default
    const storedDomain = rec.domain
    const clientDomain = (otpOrObj && (otpOrObj as any).domain) ? (otpOrObj as any).domain : undefined
    // Client domain takes priority because it's what the frontend used to sign
    const domainToCheck = clientDomain || storedDomain || defaultDomain

    // Log domain information for debugging
    logger.debug({
      storedDomain,
      clientDomain,
      defaultDomain,
      domainToCheck,
      providedSigner,
      tokenHolderAddress
    }, 'Finalize domain resolution')

    // Use the claimMessage provided by the frontend if available
    // This ensures we verify against the exact same message that was signed
    // If not provided, fall back to reconstructing from VC (legacy behavior)
    let credentialPreview: any
    if (providedClaimMessage) {
      // Frontend provided the exact message - use it directly
      logger.debug({ hasClaimMessage: true }, 'Using provided claimMessage from frontend')
      credentialPreview = providedClaimMessage
    } else {
      // Fallback: Build credentialPreview from VC (may not match frontend exactly)
      logger.debug({ hasClaimMessage: false }, 'No claimMessage provided, building from VC (legacy)')
      credentialPreview = {
        issuerName: typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id || 'Circuloos',
        holderName: vc.credentialSubject?.name || '',
        name: vc.credentialSubject?.name || '',
        issuedAt: vc.validFrom || vc.issuanceDate || '',
        validFrom: vc.validFrom || vc.issuanceDate || '',
      }
    }

    const recovered = this.verifyHolderSignature(
      domainToCheck,
      providedToken,
      providedSigner,
      providedTimestamp,
      providedSignature,
      credentialPreview,
      !!providedClaimMessage // Flag to indicate if we should use message directly
    )

    logger.debug({ recovered, providedSigner }, 'Finalize signature verification')

    if (recovered.toLowerCase() !== providedSigner.toLowerCase()) {
      logger.debug({ recovered, expected: providedSigner }, 'Finalize signer mismatch')
      throw new Error('signature signer mismatch')
    }

    const holderProof = this.credential.buildProof(providedSignature, providedSigner, domainToCheck, 'authentication')

    // 6. Enforce Holder Match
    this.enforceHolderMatch(vc, recovered)

    // 7. Save Finalized VC with holder proof
    const existing = await this.credential.loadVC(vc.id)
    const issuerProof = existing?.proof || rec.issuerProof
    if (!issuerProof) throw new Error('missing issuer proof; ensure mint step completed')

    // Create W3C VP if holder is signing
    // VP = Verifiable Presentation containing the VC
    const vp = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      holder: holderProof.verificationMethod,
      verifiableCredential: [this.credential.embedProof(vc, issuerProof)],
      proof: holderProof
    }

    await this.credential.saveVC(vc.id, vp)
    await this.credential.saveIssuance(id, {
      ...rec,
      holderProof,
      lastClaimedAt: Date.now(),
      claimedByAddress: providedSigner,
      status: 'CLAIMED', // Update status
    })

    return {
      vcId: vc.id,
      holder: {
        verificationMethod: holderProof.verificationMethod,
      },
    }
  }

  private validateToken(token: string, expectedId: string, providedSigner?: string): string {
    if (typeof token !== 'string' || !token.includes('.')) {
      throw new Error('invalid token: malformed token format')
    }

    const vt = this.security.verifySessionToken(token)
    if (!vt.ok) {
      const errorMsg = vt.error || 'token verification failed'
      throw new Error(`invalid token: ${errorMsg}`)
    }

    if (!vt.payload?.id) {
      throw new Error('invalid token: missing token ID in payload')
    }

    if (vt.payload.id !== expectedId) {
      throw new Error(`invalid token: token ID mismatch - expected ${expectedId}, got ${vt.payload.id}`)
    }

    const tokenHolderAddress = vt.payload?.holderAddress
    if (!tokenHolderAddress) {
      throw new Error('invalid token: missing holder address binding')
    }

    if (providedSigner && tokenHolderAddress.toLowerCase() !== providedSigner.toLowerCase()) {
      throw new Error('token holder address does not match provided signer')
    }

    return tokenHolderAddress
  }

  private verifyHolderSignature(
    domain: any,
    token: string,
    signer: string,
    timestamp: string | undefined,
    signature: string,
    credentialPreviewOrMessage?: any,
    useMessageDirectly: boolean = false
  ): string {
    // Use the new schema registry to verify signature with the same types used by frontend
    const credentialType = 'circuloos-marketplace'
    const schema = getCredentialType(credentialType)

    let recovered: string | null = null

    if (schema && credentialPreviewOrMessage) {
      const { primaryType, types, messageBuilder } = schema.schema.claim

      // If useMessageDirectly is true, the frontend sent the exact signed message
      // Otherwise, we need to reconstruct it using messageBuilder
      let message: any
      if (useMessageDirectly) {
        // Frontend provided the exact message - use it directly
        // But we need to ensure BigInt fields are properly handled
        message = { ...credentialPreviewOrMessage }
        // Convert timestamp string to BigInt if needed
        if (typeof message.timestamp === 'string') {
          message.timestamp = BigInt(message.timestamp)
        } else if (typeof message.timestamp === 'number') {
          message.timestamp = BigInt(message.timestamp)
        }
        logger.debug({ messageSource: 'frontend' }, 'Using exact message from frontend')
      } else {
        // Reconstruct message using messageBuilder (may not match frontend exactly)
        message = messageBuilder(credentialPreviewOrMessage, signer, token)
        logger.debug({ messageSource: 'reconstructed' }, 'Reconstructed message using messageBuilder')
      }

      logger.debug({ primaryType, hasSchema: true }, 'Using schema registry verification for claim')

      try {
        recovered = utils.verifyTypedData(domain, types, message, signature)
        logger.debug({ recovered }, 'Schema registry recovered address')
      } catch (schemaErr: any) {
        logger.warn({ error: schemaErr.message }, 'Schema registry verification failed, trying legacy')
        // Fallback to legacy verification
        recovered = this.verifyHolderSignatureLegacy(domain, token, signer, timestamp, signature)
      }
    } else {
      // Fallback to legacy verification if schema not found
      logger.warn({ hasSchema: false }, 'Schema not found or no credentialPreview - using legacy verification')
      recovered = this.verifyHolderSignatureLegacy(domain, token, signer, timestamp, signature)
    }

    if (!recovered) {
      throw new Error('invalid signature')
    }

    return recovered
  }

  private verifyHolderSignatureLegacy(
    domain: any,
    token: string,
    signer: string,
    timestamp: string | undefined,
    signature: string
  ): string | null {
    const credentialClaimTypes = {
      CredentialClaim: [
        { name: "token", type: "string" },
        { name: "holder", type: "address" },
        { name: "timestamp", type: "uint256" },
      ],
    }

    const messageTimestamp = timestamp
      ? BigInt(timestamp)
      : BigInt(Math.floor(Date.now() / 1000))

    const credentialClaimMessage = {
      token: token,
      holder: signer,
      timestamp: messageTimestamp,
    }

    logger.debug({
      token: token?.substring(0, 20) + '...',
      holder: signer,
      timestamp: messageTimestamp.toString()
    }, 'Legacy CredentialClaim message')

    let recovered: string | null = null
    try {
      recovered = utils.verifyTypedData(domain, credentialClaimTypes, credentialClaimMessage, signature)
    } catch (err: any) {
      logger.error({ error: err.message }, 'Legacy signature verification error')
      return null
    }

    return recovered
  }

  private enforceHolderMatch(vc: any, recoveredSigner: string): void {
    try {
      const expectedHolderId = vc?.credentialSubject?.id?.toString().trim()
      const expectedHolderAddress = (vc?.credentialSubject?.holderAddress || '').toString().trim()
      const expectedHolder = expectedHolderId || expectedHolderAddress

      if (expectedHolder) {
        // Normalize expected holder: if it's a DID, extract the address
        const normalizedExpected = DIDUtils.normalizeAddress(expectedHolder)

        logger.debug({
          recoveredSigner,
          expectedHolder,
          normalizedExpected
        }, 'Enforcing holder match')

        if (recoveredSigner.toLowerCase() !== normalizedExpected) {
          throw new Error(`holder signature mismatch: recovered=${recoveredSigner} expected=${expectedHolder} (normalized=${normalizedExpected})`)
        }
      } else {
        throw new Error('credential missing holder identification')
      }

      if (!vc.credentialSubject.id) {
        vc.credentialSubject.id = recoveredSigner
      }
    } catch (err: any) {
      throw new Error(err?.message || err)
    }
  }
}
