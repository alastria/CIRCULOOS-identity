import { FastifyReply, FastifyRequest } from 'fastify'
import { IssuanceService } from '../services/issuanceService'
import { authService } from '../services/authService'
import { PDFService } from '../services/pdf.service'
import { IssuanceRepository } from '../repositories/issuanceRepository'
import { TrustedIssuerRegistryClient, SqlJsStorageAdapter, DIDUtils } from '@circuloos/common'
import { NonceService } from '../services/nonce.service'
import { config } from '../config'

export class IssueController {
    constructor(
        private issuanceService: IssuanceService,
        private _authService: typeof authService,
        private pdfService: PDFService,
        private issuanceRepository: IssuanceRepository,
        private storage: SqlJsStorageAdapter,
        private registry?: TrustedIssuerRegistryClient,
        private nonceService?: NonceService
    ) { }

    // Helper getter to match usage in methods
    private get authService() {
        return this._authService
    }

    async getAuthChallenge(request: FastifyRequest, reply: FastifyReply) {
        const { address } = request.params as { address: string }

        // Use NonceService if available (new SIWA flow), otherwise fallback to authService (legacy)
        if (this.nonceService) {
            const result = await this.nonceService.generateNonce(address)
            // Return issuedAt (ISO string) for SIWE message construction
            return {
                nonce: result.nonce,
                issuedAt: result.createdAt.toISOString()
            }
        } else {
            const nonce = this.authService.generateNonce(address)
            return { nonce }
        }
    }

    async getCredential(request: FastifyRequest, reply: FastifyReply) {
        const { id } = request.params as { id: string }

        // CRITICAL: Get wallet from JWT (verified by middleware)
        const userWallet = request.user?.wallet

        if (!userWallet) {
            // Fallback to legacy authentication (headers) if JWT not present
            const signature = request.headers['x-signature'] as string
            const address = request.headers['x-address'] as string

            if (!signature || !address) {
                return reply.code(401).send({ error: 'Unauthorized: No session or signature found' })
            }

            // Verify Signature
            if (!this.authService.verifySignature(address, signature)) {
                return reply.code(403).send({ error: 'Invalid or expired signature' })
            }

            // Continue with legacy flow using address from header
            return this.getCredentialWithAddress(id, address, reply)
        }

        // New JWT flow: use wallet from JWT
        return this.getCredentialWithAddress(id, userWallet, reply)
    }

    private async getCredentialWithAddress(id: string, address: string, reply: FastifyReply) {
        // 1. Get Credential from storage
        const storedData = await this.storage.loadVC(id)
        if (!storedData) {
            return reply.code(404).send({ error: 'Credential not found' })
        }

        // 2. Extract VC from VP if stored as VP
        let vc: any = storedData
        if (storedData.type?.includes('VerifiablePresentation') && storedData.verifiableCredential?.length > 0) {
            // Extract the actual VC from the VP - this VC already has the issuerProof embedded
            vc = storedData.verifiableCredential[0]
        }

        // 3. Verify Ownership (Access Control)
        const credentialSubject = vc.credentialSubject || {}
        const holderAddress = credentialSubject?.id || credentialSubject?.holderAddress
        if (!holderAddress) {
            return reply.code(403).send({ error: 'Credential missing holder information' })
        }

        // Normalize holder address
        let normalizedHolder = DIDUtils.normalizeAddress(holderAddress)

        if (normalizedHolder !== address.toLowerCase()) {
            return reply.code(403).send({ error: 'Access denied: Wallet does not match credential holder' })
        }

        // Return the VC with issuer proof (not the whole VP)
        return vc
    }

    async listIssuances(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { status, limit, offset } = request.query as any
            const userWallet = (request as any).user?.wallet

            if (!userWallet) {
                return reply.code(401).send({ error: 'Unauthorized: No session found' })
            }

            const result = await this.issuanceRepository.listIssuances(
                status,
                limit ? parseInt(limit) : 100,
                offset ? parseInt(offset) : 0,
                userWallet
            )

            return reply.send(result)
        } catch (err: any) {
            request.log.error(err)
            return reply.status(500).send({ error: err.message || 'Internal Server Error' })
        }
    }

    async getTokenInfo(request: FastifyRequest, reply: FastifyReply) {
        try {
            let token = (request.params as any)['*'] || ''
            try {
                token = decodeURIComponent(token)
            } catch (e) {
                // If decoding fails, use original token
            }

            // Decode token to get issuance ID
            // Accessing private security service via issuanceService is not ideal but keeping consistent for now
            // TODO: Refactor to expose security service or move verification logic
            const vt = (this.issuanceService as any)['security'].verifySessionToken(token)
            if (!vt.ok || !vt.payload?.id) {
                return reply.code(400).send({ error: 'Invalid or expired token' })
            }

            const id = vt.payload.id
            const holderAddress = vt.payload.holderAddress

            const rec = await this.storage.loadIssuance(id)
            if (!rec) {
                return reply.code(400).send({ error: 'Issuance not found' })
            }

            if (rec.expiresAt && Date.now() > rec.expiresAt) {
                return reply.code(400).send({ error: 'Token expired' })
            }

            const draftVc = rec.draft
            const credentialType = draftVc?.type?.[1] || draftVc?.type?.[0] || 'VerifiableCredential'
            const issuer = typeof draftVc?.issuer === 'string' ? draftVc.issuer : draftVc?.issuer?.id

            return reply.send({
                valid: true,
                id,
                holderAddress: holderAddress || rec.holderAddress,
                status: rec.status || 'DRAFT',
                expiresAt: rec.expiresAt,
                domain: rec.domain,
                credentialType,
                issuer: issuer || 'Unknown'
            })
        } catch (err: any) {
            request.log.error(err)
            return reply.code(400).send({ error: err.message || 'Failed to get token info' })
        }
    }

    async prepare(request: FastifyRequest, reply: FastifyReply) {
        try {
            const body = request.body as any

            // CRITICAL: Get issuer wallet from JWT (verified by authenticateJWT middleware)
            const issuerWallet = request.user?.wallet

            if (!issuerWallet) {
                return reply.code(401).send({ error: 'Unauthorized: No valid session found. Please authenticate first.' })
            }

            // Verify issuer is trusted (if registry exists)
            if (this.registry) {
                const isTrusted = await this.registry.isTrustedIssuer(issuerWallet)
                if (!isTrusted) {
                    return reply.code(403).send({ error: 'Issuer address is not authorized. The wallet must be registered in the Trusted Issuer Registry.' })
                }
            }

            // Call issuance service with JWT-authenticated issuer
            const result = await this.issuanceService.prepare(body.email, body.holderAddress, body.companyName)
            return reply.send(result)
        } catch (err: any) {
            request.log.error(err)
            return reply.code(400).send({ error: err.message })
        }
    }

    async mint(request: FastifyRequest, reply: FastifyReply) {
        try {
            const body = request.body as any
            const result = await this.issuanceService.mint(body.id, body.signature, body.signer, body.domain)
            return reply.send(result)
        } catch (err: any) {
            request.log.error(err)
            return reply.code(400).send({ error: err.message })
        }
    }

    async finalize(request: FastifyRequest, reply: FastifyReply) {
        try {
            const body = request.body as any
            const result = await this.issuanceService.finalize(body.id, {
                token: body.token,
                otp: body.otp,
                signature: body.signature,
                signer: body.signer,
                domain: body.domain,
                timestamp: body.timestamp,
                claimMessage: body.claimMessage // Pass the claim message from frontend
            })
            return reply.send(result)
        } catch (err: any) {
            request.log.error(err)
            return reply.code(400).send({ error: err.message })
        }
    }

    async generatePDF(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = request.params as { id: string }

            // CRITICAL: Get wallet from JWT (verified by middleware)
            const userWallet = request.user?.wallet
            if (!userWallet) {
                return reply.code(401).send({ error: 'Unauthorized: No session found' })
            }

            let storedData = await this.storage.loadVC(id)
            let vc: any = null

            if (!storedData) {
                const issuance = await this.storage.loadIssuance(id)
                if (issuance && issuance.draft) {
                    vc = {
                        ...issuance.draft,
                        proof: issuance.issuerProof,
                    }
                }
            } else {
                // storedData might be a VP (VerifiablePresentation) containing a VC
                // Extract the actual VC from the VP if needed
                if (storedData.type?.includes('VerifiablePresentation') && storedData.verifiableCredential?.length > 0) {
                    // Extract the first VC from the VP - this VC already has the issuerProof embedded
                    vc = storedData.verifiableCredential[0]
                } else {
                    // It's a direct VC
                    vc = storedData
                }
            }

            if (!vc) {
                return reply.code(404).send({ error: 'Credential not found' })
            }

            // Verify ownership
            const credentialSubject = vc.credentialSubject || {}
            const holderAddress = credentialSubject?.id || credentialSubject?.holderAddress
            if (holderAddress) {
                const normalizedHolder = DIDUtils.normalizeAddress(holderAddress)
                if (normalizedHolder !== userWallet) {
                    return reply.code(403).send({ error: 'Access denied: Credential does not belong to authenticated wallet' })
                }
            }

            // DID configuration from environment
            const defaultIssuerDid = config.issuer.did || 'did:alastria:quorum:issuer'

            const vcData = {
                id: vc.id || id,
                type: vc.type || ['VerifiableCredential'],
                issuer: vc.issuer || defaultIssuerDid,
                issuanceDate: vc.issuanceDate || vc.validFrom || new Date().toISOString(),
                expirationDate: vc.expirationDate || vc.validUntil,
                credentialSubject: vc.credentialSubject || {},
                proof: vc.proof, // Now this is the issuerProof, not the holderProof
            }

            const baseUrl = config.downloadLinkBaseUrl || config.appPublicUrl

            if (!baseUrl) {
                throw new Error('DOWNLOAD_LINK_BASE_URL or APP_PUBLIC_URL must be configured')
            }

            const pdfBytes = await this.pdfService.generateVCPDF(vcData, baseUrl)

            reply.type('application/pdf')
            reply.header('Content-Disposition', `attachment; filename="Credential_${id.slice(-8)}.pdf"`)
            reply.header('Content-Length', pdfBytes.length.toString())

            return reply.send(Buffer.from(pdfBytes))
        } catch (err: any) {
            request.log.error(err)
            return reply.code(500).send({ error: err.message || 'Failed to generate PDF' })
        }
    }

    async generatePDFFromVC(request: FastifyRequest, reply: FastifyReply) {
        try {
            const body = request.body as { vc: any }
            const { vc } = body

            if (!vc) {
                return reply.code(400).send({ error: 'VC JSON is required' })
            }

            // CRITICAL: Get wallet from JWT (verified by middleware)
            const userWallet = request.user?.wallet
            if (!userWallet) {
                return reply.code(401).send({ error: 'Unauthorized: No session found' })
            }

            // Extract VC data (handle both direct VC and VP with VC inside)
            const vcData = vc.verifiableCredential?.[0] || vc

            // CRITICAL SECURITY: Verify ownership before generating PDF
            // Get holder address from VC
            const credentialSubject = vcData.credentialSubject || {}
            const holderAddress = credentialSubject.id || credentialSubject.holderAddress

            if (!holderAddress) {
                return reply.code(400).send({ error: 'Credential missing holder information' })
            }

            // Normalize holder address (handle DID format)
            const normalizedHolder = DIDUtils.normalizeAddress(holderAddress)

            // Verify ownership: authenticated user must be the holder
            if (userWallet !== normalizedHolder) {
                return reply.code(403).send({
                    error: 'Access denied: Authenticated wallet does not match credential holder. Only the credential owner can generate the PDF.'
                })
            }

            // DID configuration from environment
            const defaultIssuerDid = config.issuer.did || 'did:alastria:quorum:issuer'

            const vcPdfData = {
                id: vcData.id || 'unknown',
                type: vcData.type || ['VerifiableCredential'],
                issuer: vcData.issuer || defaultIssuerDid,
                issuanceDate: vcData.issuanceDate || vcData.validFrom || new Date().toISOString(),
                expirationDate: vcData.expirationDate || vcData.validUntil,
                credentialSubject: vcData.credentialSubject || {},
                proof: vcData.proof,
            }

            const baseUrl = config.downloadLinkBaseUrl || config.appPublicUrl

            if (!baseUrl) {
                throw new Error('DOWNLOAD_LINK_BASE_URL or APP_PUBLIC_URL must be configured')
            }

            // Use the same PDF service to ensure identical output
            const pdfBytes = await this.pdfService.generateVCPDF(vcPdfData, baseUrl)

            reply.type('application/pdf')
            const vcId = vcData.id || 'unknown'
            reply.header('Content-Disposition', `attachment; filename="Credential_${vcId.slice(-8)}.pdf"`)
            reply.header('Content-Length', pdfBytes.length.toString())

            return reply.send(Buffer.from(pdfBytes))
        } catch (err: any) {
            request.log.error(err)
            return reply.code(500).send({ error: err.message || 'Failed to generate PDF from VC' })
        }
    }

    /**
     * Simplified credential issuance - combines prepare, mint, and finalize into one step
     * This is the new user-friendly API that requires client-side signing for security
     */
    async issueCredentialSimplified(request: FastifyRequest, reply: FastifyReply) {
        try {
            const body = request.body as any

            // CRITICAL: Get issuer wallet from JWT (verified by authenticateJWT middleware)
            const issuerWallet = request.user?.wallet

            if (!issuerWallet) {
                return reply.code(401).send({ error: 'Unauthorized: No valid session found. Please authenticate first.' })
            }

            // Verify issuer is trusted (if registry exists)
            if (this.registry) {
                const isTrusted = await this.registry.isTrustedIssuer(issuerWallet)
                if (!isTrusted) {
                    return reply.code(403).send({ error: 'Issuer address is not authorized. The wallet must be registered in the Trusted Issuer Registry.' })
                }
            }

            const { holderAddress, email, claims, signature, signerAddress, domain } = body

            // Verify that signerAddress matches authenticated wallet
            if (signerAddress.toLowerCase() !== issuerWallet.toLowerCase()) {
                return reply.code(403).send({ error: 'Signer address must match authenticated wallet' })
            }

            // Step 1: Prepare the credential
            const prepareResult = await this.issuanceService.prepare(
                email,
                holderAddress,
                claims?.companyName,
                claims
            )

            // Step 2: Mint with provided signature (client-side signing)
            const mintResult = await this.issuanceService.mint(
                prepareResult.id,
                signature,
                signerAddress,
                domain || prepareResult.domain
            )

            // Return the issuance info with claim URL
            const claimUrl = `${config.appPublicUrl}/claim/${mintResult.token}`

            return reply.send({
                credentialId: prepareResult.id,
                status: 'issued',
                claimUrl,
                expiresAt: prepareResult.expiresAt
            })
        } catch (err: any) {
            request.log.error(err)
            return reply.code(400).send({ error: err.message })
        }
    }

    /**
     * Generate QR code for credential verification
     */
    async generateQRCode(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = request.params as { id: string }
            const { size = 300 } = request.query as { size?: number }

            // Get config with fallbacks
            const baseUrl = `${config.appPublicUrl}/verify`
            const qrSize = size

            // Generate verification URL
            const verifyUrl = `${baseUrl}?vc=${id}`

            // Generate QR code
            const QRCode = (await import('qrcode')).default
            const qrBuffer = await QRCode.toBuffer(verifyUrl, {
                width: qrSize,
                margin: 2,
                errorCorrectionLevel: 'M',
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            })

            return reply
                .type('image/png')
                .header('Cache-Control', 'public, max-age=3600')
                .send(qrBuffer)
        } catch (err: any) {
            request.log.error(err)
            return reply.code(500).send({ error: 'Failed to generate QR code' })
        }
    }

    /**
     * Revoke a credential
     */
    async revokeCredential(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = request.params as { id: string }
            const { reason, signature, signerAddress } = request.body as {
                reason: string
                signature: string
                signerAddress: string
            }

            // Verify JWT authentication
            const userWallet = request.user?.wallet
            if (!userWallet) {
                return reply.code(401).send({ error: 'Authentication required' })
            }

            // Load the issuance
            const issuance = await this.storage.loadIssuance(id)
            if (!issuance) {
                return reply.code(404).send({ error: 'Credential not found' })
            }

            // Verify the signer is the issuer
            if (signerAddress.toLowerCase() !== userWallet.toLowerCase()) {
                return reply.code(403).send({ error: 'Only the issuer can revoke this credential' })
            }

            // Update issuance status to REVOKED
            issuance.status = 'REVOKED'
            issuance.revokedAt = Date.now()
            issuance.revocationReason = reason
            issuance.revokedBy = signerAddress.toLowerCase()
            await this.storage.saveIssuance(id, issuance)

            // If there's a credential hash, update blockchain_credentials table as well
            if (issuance.credentialHash && typeof this.storage.updateCredentialRevocation === 'function') {
                await this.storage.updateCredentialRevocation({
                    credentialHash: issuance.credentialHash,
                    revoker: signerAddress,
                    blockNumber: 0, // Application-level revocation (not on-chain yet)
                    txHash: '', // No transaction yet
                    timestamp: new Date(),
                    reason
                })
            }

            return reply.send({
                revoked: true,
                revokedAt: issuance.revokedAt,
                reason: issuance.revocationReason
            })
        } catch (err: any) {
            request.log.error(err)
            return reply.code(500).send({ error: 'Failed to revoke credential' })
        }
    }

    /**
     * List credentials owned by the authenticated holder
     * Returns VCs from the backend storage (not Snap)
     */
    async listMyCredentials(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userWallet = request.user?.wallet
            if (!userWallet) {
                return reply.code(401).send({ error: 'Unauthorized: No session found' })
            }

            // Check if storage adapter supports listVCsByHolder
            if (typeof (this.storage as any).listVCsByHolder === 'function') {
                const credentials = await (this.storage as any).listVCsByHolder(userWallet)

                // Extract relevant info from each VC
                const result = credentials.map((vcData: any) => {
                    // vcData might be a VP with embedded VC
                    const vc = vcData.verifiableCredential?.[0] || vcData

                    return {
                        id: vc.id,
                        type: vc.type,
                        issuer: vc.issuer,
                        issuanceDate: vc.validFrom || vc.issuanceDate,
                        expirationDate: vc.validUntil || vc.expirationDate,
                        credentialSubject: vc.credentialSubject,
                        // Include proof type for UI
                        hasProof: !!vc.proof
                    }
                })

                return reply.send({
                    credentials: result,
                    total: result.length,
                    source: 'backend'
                })
            }

            // Fallback: Use issuances filtered by holder
            const { issuances } = await this.storage.listIssuances({
                holderAddress: userWallet,
                status: 'CLAIMED'
            })

            const credentials = issuances.map((issuance: any) => ({
                id: issuance.id,
                type: issuance.draft?.type || ['VerifiableCredential'],
                issuer: issuance.draft?.issuer,
                issuanceDate: issuance.draft?.validFrom,
                expirationDate: issuance.draft?.validUntil,
                status: issuance.status,
                claimedAt: issuance.lastClaimedAt
            }))

            return reply.send({
                credentials,
                total: credentials.length,
                source: 'backend-issuances'
            })
        } catch (err: any) {
            request.log.error(err)
            return reply.code(500).send({ error: 'Failed to list credentials' })
        }
    }

    /**
     * Get credential status (active, revoked, expired)
     */
    async getCredentialStatus(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = request.params as { id: string }

            // Load the issuance
            const issuance = await this.storage.loadIssuance(id)
            if (!issuance) {
                return reply.code(404).send({ error: 'Credential not found' })
            }

            // Determine status
            let status = 'active'
            let revoked = false
            let revokedAt: number | undefined
            let reason: string | undefined
            let expiresAt: number | undefined

            if (issuance.status === 'REVOKED') {
                status = 'revoked'
                revoked = true
                revokedAt = issuance.revokedAt
                reason = issuance.revocationReason
            } else if (issuance.expiresAt && issuance.expiresAt < Date.now()) {
                status = 'expired'
            }

            expiresAt = issuance.expiresAt

            return reply.send({
                id,
                status,
                revoked,
                revokedAt,
                reason,
                expiresAt
            })
        } catch (err: any) {
            request.log.error(err)
            return reply.code(500).send({ error: 'Failed to get credential status' })
        }
    }

    /**
     * Get credential for public verification (QR code scanning)
     * Returns ONLY verification data - NO personal attributes
     * Public info: issuer DID, holder DID, type, dates, proof (for signature verification)
     */
    async getCredentialPublic(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = request.params as { id: string }

            // Decode URL-encoded ID (e.g., urn%3Auuid%3A... -> urn:uuid:...)
            const decodedId = decodeURIComponent(id)

            let vc: any = null

            // Strategy 1: Try to load VC directly by ID (urn:uuid:xxx format)
            vc = await this.storage.loadVC(decodedId)

            // Strategy 2: If not found, try loading by issuance ID
            if (!vc) {
                let issuance = await this.storage.loadIssuance(decodedId)

                // Try extracting UUID from URN if it looks like one
                if (!issuance && decodedId.startsWith('urn:uuid:')) {
                    const uuid = decodedId.replace('urn:uuid:', '')
                    issuance = await this.storage.loadIssuance(uuid)
                }

                if (issuance) {
                    // Only return credentials that have been issued (CLAIMED status)
                    if (issuance.status !== 'CLAIMED' && issuance.status !== 'ISSUED') {
                        return reply.code(404).send({ error: 'Credential not found or not yet issued' })
                    }

                    // Load the VC using the issuance ID
                    const storedData = await this.storage.loadVC(issuance.id)
                    if (storedData) {
                        vc = storedData
                    }
                }
            }

            if (!vc) {
                return reply.code(404).send({ error: 'Credential not found' })
            }

            // Extract VC from VP if stored as VP
            if (vc.type?.includes('VerifiablePresentation') && vc.verifiableCredential?.length > 0) {
                vc = vc.verifiableCredential[0]
            }

            // PRIVACY: Return only public verification data
            // - Issuer DID and Holder DID are public (blockchain addresses)
            // - Type, dates, and proof are needed for verification
            // - Personal attributes in credentialSubject are REDACTED
            const holderDid = vc.credentialSubject?.id || vc.credentialSubject?.holderAddress

            const publicVC = {
                '@context': vc['@context'],
                id: vc.id,
                type: vc.type,
                issuer: vc.issuer,
                issuanceDate: vc.issuanceDate,
                validFrom: vc.validFrom,
                expirationDate: vc.expirationDate,
                validUntil: vc.validUntil,
                // Only include holder DID, not personal attributes
                credentialSubject: {
                    id: holderDid
                },
                // Include proof for signature verification
                proof: vc.proof
            }

            return reply.send(publicVC)
        } catch (err: any) {
            request.log.error(err)
            return reply.code(500).send({ error: 'Failed to get credential' })
        }
    }

    /**
     * Get full credential with personal attributes (requires authentication)
     * Only the holder can access their own credential's full details
     */
    async getCredentialFull(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = request.params as { id: string }
            const userWallet = (request as any).user?.wallet

            if (!userWallet) {
                return reply.code(401).send({ error: 'Authentication required to view full credential details' })
            }

            // Decode URL-encoded ID (e.g., urn%3Auuid%3A... -> urn:uuid:...)
            const decodedId = decodeURIComponent(id)

            let vc: any = null

            // Strategy 1: Try to load VC directly by ID (urn:uuid:xxx format)
            vc = await this.storage.loadVC(decodedId)

            // Strategy 2: If not found, try loading by issuance ID
            if (!vc) {
                let issuance = await this.storage.loadIssuance(decodedId)

                if (!issuance && decodedId.startsWith('urn:uuid:')) {
                    const uuid = decodedId.replace('urn:uuid:', '')
                    issuance = await this.storage.loadIssuance(uuid)
                }

                if (issuance) {
                    if (issuance.status !== 'CLAIMED' && issuance.status !== 'ISSUED') {
                        return reply.code(404).send({ error: 'Credential not found or not yet issued' })
                    }

                    const storedData = await this.storage.loadVC(issuance.id)
                    if (storedData) {
                        vc = storedData
                    }
                }
            }

            if (!vc) {
                return reply.code(404).send({ error: 'Credential not found' })
            }

            // Extract VC from VP if stored as VP
            if (vc.type?.includes('VerifiablePresentation') && vc.verifiableCredential?.length > 0) {
                vc = vc.verifiableCredential[0]
            }

            // AUTHORIZATION: Only the holder can see full details
            const holderAddress = vc.credentialSubject?.id || vc.credentialSubject?.holderAddress || ''
            const normalizedHolder = DIDUtils.normalizeAddress(holderAddress)
            const normalizedUser = userWallet.toLowerCase()

            if (normalizedHolder !== normalizedUser) {
                return reply.code(403).send({
                    error: 'Access denied: Only the credential holder can view full details',
                    hint: 'Connect with the wallet that owns this credential'
                })
            }

            // Return full VC with all attributes
            return reply.send(vc)
        } catch (err: any) {
            request.log.error(err)
            return reply.code(500).send({ error: 'Failed to get credential' })
        }
    }
}
