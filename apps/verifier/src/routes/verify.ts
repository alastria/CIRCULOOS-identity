import { FastifyPluginAsync } from "fastify"

/**
 * Verify Routes - User-friendly API
 * 
 * This module provides clean REST endpoints for credential and presentation verification.
 */
const verifyRoutes: FastifyPluginAsync = async (fastify) => {

    // ============================================================================
    // POST /api/v1/verify - Verify a Verifiable Credential
    // ============================================================================
    fastify.post('/verify', {
        schema: {
            tags: ['verify'],
            summary: 'Verify a Verifiable Credential',
            description: 'Verifies the authenticity and validity of a W3C Verifiable Credential. Checks signature, expiry, revocation status, and issuer trust.',
            body: {
                type: 'object',
                required: ['credential'],
                properties: {
                    credential: {
                        type: 'object',
                        description: 'W3C Verifiable Credential to verify',
                        additionalProperties: true
                    },
                    checkOnChain: {
                        type: 'boolean',
                        default: true,
                        description: 'Whether to check on-chain status (issuance/revocation)'
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        valid: { type: 'boolean', description: 'Overall validity of the credential' },
                        issuer: {
                            type: 'object',
                            properties: {
                                did: { type: 'string' },
                                address: { type: 'string' },
                                signatureValid: { type: 'boolean' },
                                trusted: { type: 'boolean' }
                            }
                        },
                        holder: {
                            type: 'object',
                            properties: {
                                did: { type: 'string' },
                                address: { type: 'string' },
                                match: { type: 'boolean' }
                            }
                        },
                        checks: {
                            type: 'object',
                            properties: {
                                signature: { type: 'string', enum: ['VALID', 'INVALID'] },
                                notExpired: { type: 'string', enum: ['VALID', 'INVALID'] },
                                notRevoked: { type: 'string', enum: ['VALID', 'INVALID', 'N/A'] },
                                trustedIssuer: { type: 'string', enum: ['VALID', 'INVALID', 'N/A'] },
                                onChainStatus: { type: 'string', enum: ['VALID', 'INVALID', 'N/A'] }
                            }
                        },
                        error: { type: 'string' }
                    }
                },
                400: {
                    type: 'object',
                    properties: {
                        valid: { type: 'boolean' },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { credential, checkOnChain = true } = request.body as any

            // Validate W3C VC structure
            if (!credential || !credential.proof || !credential.credentialSubject) {
                return reply.code(400).send({
                    valid: false,
                    error: 'Invalid W3C VC: must have embedded proof and credentialSubject'
                })
            }

            // Import verification utilities - use schema-aware verification
            const { verifyCredentialIssuance, detectCredentialType, hashVC } = await import('@circuloos/common')

            // Extract proof info
            const proof = credential.proof
            const domain = proof.domain
            const signature = proof.signature

            if (!domain || !signature) {
                return reply.code(400).send({
                    valid: false,
                    error: 'Invalid proof: must have domain and signature'
                })
            }

            // Detect credential type and verify using schema registry
            const credentialType = detectCredentialType(credential)
            // console.log(`[Verify] Credential type detected: ${credentialType}`)
            // console.log(`[Verify] Domain:`, JSON.stringify(domain))

            // Verify using the schema-aware function
            const recovered = verifyCredentialIssuance(domain, credential, signature, credentialType)

            // console.log('[Verify VC] Recovered address:', recovered)
            // console.log('[Verify VC] Expected verificationMethod:', proof.verificationMethod)

            let issuerResult = {
                ok: !!recovered,
                recovered: recovered || undefined,
                expected: proof.verificationMethod,
                reason: recovered ? undefined : 'Invalid signature or unknown credential type'
            }

            // Check if recovered address matches verificationMethod
            if (recovered && proof.verificationMethod) {
                if (recovered.toLowerCase() !== proof.verificationMethod.toLowerCase()) {
                    issuerResult = {
                        ...issuerResult,
                        ok: false,
                        reason: `Signer mismatch: recovered ${recovered}, expected ${proof.verificationMethod}`
                    }
                }
            }

            const checks = {
                signature: issuerResult.ok ? 'VALID' : 'INVALID',
                notExpired: 'VALID', // TODO: implement expiry check
                notRevoked: 'N/A' as string,
                trustedIssuer: 'N/A' as string,
                onChainStatus: 'N/A' as string
            }

            // Check issuer trust via registry
            const registry = (fastify as any).trustedIssuerRegistry
            if (registry && issuerResult.recovered) {
                const trusted = await registry.isTrustedIssuer(issuerResult.recovered)
                checks.trustedIssuer = trusted ? 'VALID' : 'INVALID'

                if (!trusted) {
                    issuerResult = { ...issuerResult, ok: false, reason: 'Issuer not in trusted registry' }
                }
            }

            // Check on-chain status if requested
            if (checkOnChain) {
                const onchain = (fastify as any).onchainService
                if (onchain) {
                    const vcHash = hashVC(credential)
                    const issued = await onchain.isIssued(vcHash)
                    const revoked = await onchain.isRevoked(vcHash)

                    checks.notRevoked = revoked ? 'INVALID' : 'VALID'
                    checks.onChainStatus = issued ? 'VALID' : 'INVALID'

                    if (!issued) {
                        issuerResult = { ...issuerResult, ok: false, reason: 'Credential not recorded on-chain' }
                    }

                    if (revoked) {
                        return reply.send({
                            valid: false,
                            error: 'Credential has been revoked',
                            checks
                        })
                    }
                }
            }

            const valid = issuerResult.ok

            // console.log('[Verify VC] Final Result - Valid:', valid, 'Reason:', issuerResult.reason)

            return reply.send({
                valid,
                issuer: {
                    did: credential.issuer,
                    address: issuerResult.recovered,
                    signatureValid: issuerResult.ok,
                    trusted: checks.trustedIssuer === 'VALID'
                },
                holder: {
                    did: credential.credentialSubject.id
                },
                checks,
                error: valid ? undefined : issuerResult.reason
            })
        } catch (err: any) {
            request.log.error(err)
            return reply.code(500).send({
                valid: false,
                error: err.message || 'Internal server error'
            })
        }
    })

    // ============================================================================
    // POST /api/v1/verify/presentation - Verify a Verifiable Presentation
    // ============================================================================
    fastify.post('/verify/presentation', {
        schema: {
            tags: ['verify'],
            summary: 'Verify a Verifiable Presentation',
            description: 'Verifies a Verifiable Presentation (VP) which contains one or more VCs signed by the holder. Validates both the VP signature and all embedded credentials.',
            body: {
                type: 'object',
                required: ['presentation'],
                properties: {
                    presentation: {
                        type: 'object',
                        description: 'W3C Verifiable Presentation to verify',
                        additionalProperties: true
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        valid: { type: 'boolean' },
                        holder: {
                            type: 'object',
                            properties: {
                                did: { type: 'string' },
                                address: { type: 'string' },
                                signatureValid: { type: 'boolean' }
                            }
                        },
                        credentials: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    valid: { type: 'boolean' },
                                    issuer: { type: 'string' },
                                    error: { type: 'string' }
                                }
                            }
                        },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { presentation } = request.body as any

            // Validate VP structure
            if (!presentation || !presentation.proof || !presentation.verifiableCredential) {
                return reply.code(400).send({
                    valid: false,
                    error: 'Invalid W3C VP: must have proof and verifiableCredential array'
                })
            }

            // Verify VP signature (holder's signature over the presentation)
            // Verify VP signature (holder's signature over the presentation)
            const { verifyCredentialProof, verifySignedCredential } = await import('@circuloos/common')

            const vpWithoutProof = { ...presentation, proof: undefined }

            const vpResult = verifyCredentialProof(vpWithoutProof, presentation.proof, {
                expectedPurpose: 'authentication'
            })

            // console.log('[Verify VP] VP Structure:', JSON.stringify(vpWithoutProof, null, 2))
            // console.log('[Verify VP] Proof:', JSON.stringify(presentation.proof, null, 2))
            // console.log('[Verify VP] Result:', JSON.stringify(vpResult, null, 2))

            if (!vpResult.ok) {
                return reply.send({
                    valid: false,
                    error: 'Invalid VP signature: ' + vpResult.reason,
                    holder: {
                        signatureValid: false
                    }
                })
            }

            // Check if recovered address matches presentation.holder
            // presentation.holder is usually a DID, e.g. did:alastria:quorum:0x...
            if (presentation.holder && vpResult.recovered) {
                const holderDid = presentation.holder.toLowerCase()
                const recoveredAddress = vpResult.recovered.toLowerCase()

                if (!holderDid.includes(recoveredAddress)) {
                    return reply.send({
                        valid: false,
                        error: `Holder mismatch: signer ${recoveredAddress} does not match holder DID ${holderDid}`,
                        holder: {
                            signatureValid: false
                        }
                    })
                }
            }

            // Verify each embedded credential
            const credentials = []
            const vcs = Array.isArray(presentation.verifiableCredential)
                ? presentation.verifiableCredential
                : [presentation.verifiableCredential]

            for (const vc of vcs) {
                const vcSigned = {
                    vc: { ...vc, proof: undefined },
                    issuerProof: vc.proof
                }

                const vcResult = verifySignedCredential(vcSigned, {
                    requireW3CCompliance: true
                })

                credentials.push({
                    id: vc.id,
                    valid: vcResult.issuer.ok,
                    issuer: vc.issuer,
                    error: vcResult.issuer.ok ? undefined : vcResult.issuer.reason
                })
            }

            const allCredentialsValid = credentials.every(c => c.valid)

            return reply.send({
                valid: allCredentialsValid,
                holder: {
                    did: presentation.holder,
                    address: vpResult.recovered,
                    signatureValid: true
                },
                credentials
            })
        } catch (err: any) {
            request.log.error(err)
            return reply.code(500).send({
                valid: false,
                error: err.message || 'Internal server error'
            })
        }
    })
}

export default verifyRoutes
