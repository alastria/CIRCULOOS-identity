import { FastifyPluginAsync } from "fastify"
import { IssueController } from '../controllers/issueController'
import { authenticateJWT } from '../middleware/auth.middleware'

interface SimplifiedIssueRoutesOptions {
    issueController: IssueController
}

/**
 * Simplified Issue Routes - User-friendly API
 * 
 * This module provides a clean, RESTful API for credential issuance.
 * It abstracts the complex prepare->mint->finalize flow into simple endpoints.
 */
const simplifiedIssueRoutes: FastifyPluginAsync<SimplifiedIssueRoutesOptions> = async (fastify, opts) => {
    const controller = opts.issueController

    // ============================================================================
    // POST /api/v1/credentials - Issue a credential
    // ============================================================================
    fastify.post('/credentials', {
        preHandler: authenticateJWT,
        schema: {
            tags: ['credentials'],
            summary: 'Issue a new credential',
            description: 'Creates and issues a complete W3C Verifiable Credential in one step. The credential is automatically signed by the issuer and an email is sent to the holder.',
            body: {
                type: 'object',
                required: ['holderAddress', 'email', 'signature', 'signerAddress'],
                properties: {
                    holderAddress: {
                        type: 'string',
                        pattern: '^0x[a-fA-F0-9]{40}$',
                        description: 'Ethereum address of the credential holder'
                    },
                    email: {
                        type: 'string',
                        format: 'email',
                        description: 'Email address where the claim link will be sent'
                    },
                    signature: {
                        type: 'string',
                        pattern: '^0x[a-fA-F0-9]+$',
                        description: 'EIP-712 signature from the issuer wallet'
                    },
                    signerAddress: {
                        type: 'string',
                        pattern: '^0x[a-fA-F0-9]{40}$',
                        description: 'Address of the issuer who signed (must be authenticated)'
                    },
                    domain: {
                        type: 'object',
                        description: 'EIP-712 domain used for signing (optional, will use default if not provided)'
                    },
                    claims: {
                        type: 'object',
                        description: 'Custom claims to include in the credential',
                        properties: {
                            name: { type: 'string', description: 'Full name of the holder' },
                            companyName: { type: 'string', description: 'Company/organization name' }
                        },
                        additionalProperties: true
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        credentialId: { type: 'string', description: 'Unique identifier for the issued credential' },
                        status: { type: 'string', enum: ['issued'], description: 'Credential status' },
                        claimUrl: { type: 'string', description: 'URL where the holder can claim the credential' },
                        expiresAt: { type: 'number', description: 'Unix timestamp when the claim link expires' }
                    }
                },
                400: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, controller.issueCredentialSimplified.bind(controller))

    // ============================================================================
    // GET /api/v1/credentials/:id - Get a credential
    // ============================================================================
    // DISABLED: Conflicts with credentials.ts routes. Use /api/v1/credentials/:id instead.
    // fastify.get('/credentials/:id', {
    //     preHandler: authenticateJWT,
    //     schema: {
    //         tags: ['credentials'],
    //         summary: 'Retrieve a credential',
    //         description: 'Get the full W3C Verifiable Credential by ID. Requires authentication and ownership verification.',
    //         params: {
    //             type: 'object',
    //             required: ['id'],
    //             properties: {
    //                 id: { type: 'string', description: 'Credential ID or Issuance ID' }
    //             }
    //         },
    //         response: {
    //             200: {
    //                 type: 'object',
    //                 description: 'W3C Verifiable Credential',
    //                 additionalProperties: true
    //             },
    //             404: {
    //                 type: 'object',
    //                 properties: {
    //                     error: { type: 'string' }
    //                 }
    //             }
    //         }
    //     }
    // }, controller.getCredential.bind(controller))

    // ============================================================================
    // GET /api/v1/credentials/:id/pdf - Download credential as PDF
    // ============================================================================
    // DISABLED: Conflicts with credentials.ts routes. Use /api/v1/credentials/:id/pdf instead.
    // fastify.get('/credentials/:id/pdf', {
    //     preHandler: authenticateJWT,
    //     schema: {
    //         tags: ['credentials'],
    //         summary: 'Download credential as PDF',
    //         description: 'Get a PDF version of the credential with embedded QR code and verification link.',
    //         params: {
    //             type: 'object',
    //             required: ['id'],
    //             properties: {
    //                 id: { type: 'string', description: 'Credential ID or Issuance ID' }
    //             }
    //         },
    //         response: {
    //             200: {
    //                 type: 'string',
    //                 format: 'binary',
    //                 description: 'PDF file'
    //             },
    //             404: {
    //                 type: 'object',
    //                 properties: {
    //                     error: { type: 'string' }
    //                 }
    //             }
    //         }
    //     }
    // }, controller.generatePDF.bind(controller))

    // ============================================================================
    // GET /api/v1/credentials - List credentials
    // ============================================================================
    // DISABLED: Conflicts with credentials.ts routes. Use /api/v1/credentials instead.
    // fastify.get('/credentials', {
    //     preHandler: authenticateJWT,
    //     schema: {
    //         tags: ['credentials'],
    //         summary: 'List issued credentials',
    //         description: 'Get a paginated list of credentials issued by the authenticated issuer.',
    //         querystring: {
    //             type: 'object',
    //             properties: {
    //                 status: {
    //                     type: 'string',
    //                     enum: ['DRAFT', 'ISSUED', 'CLAIMED', 'REVOKED'],
    //                     description: 'Filter by credential status'
    //                 },
    //                 limit: {
    //                     type: 'number',
    //                     default: 20,
    //                     minimum: 1,
    //                     maximum: 100,
    //                     description: 'Number of results per page'
    //                 },
    //                 offset: {
    //                     type: 'number',
    //                     default: 0,
    //                     minimum: 0,
    //                     description: 'Number of results to skip'
    //                 }
    //             }
    //         },
    //         response: {
    //             200: {
    //                 type: 'object',
    //                 properties: {
    //                     credentials: {
    //                         type: 'array',
    //                         items: {
    //                             type: 'object',
    //                             properties: {
    //                                 id: { type: 'string' },
    //                                 status: { type: 'string' },
    //                                 holderAddress: { type: 'string' },
    //                                 createdAt: { type: 'number' },
    //                                 expiresAt: { type: 'number' }
    //                             }
    //                         }
    //                     },
    //                     total: { type: 'number', description: 'Total number of credentials' },
    //                     limit: { type: 'number' },
    //                     offset: { type: 'number' }
    //                 }
    //             }
    //         }
    //     }
    // }, controller.listIssuances.bind(controller))

    // ============================================================================
    // GET /api/v1/credentials/:id/qr - Get QR code for credential
    // ============================================================================
    // DISABLED: Conflicts with credentials.ts routes. Use /api/v1/credentials/:id/qr instead.
    // fastify.get('/credentials/:id/qr', {
    //     schema: {
    //         tags: ['credentials'],
    //         summary: 'Get QR code for credential verification',
    //         description: 'Generate a QR code that links to the public verification page for this credential.',
    //         params: {
    //             type: 'object',
    //             required: ['id'],
    //             properties: {
    //                 id: { type: 'string', description: 'Credential ID or Issuance ID' }
    //             }
    //         },
    //         querystring: {
    //             type: 'object',
    //             properties: {
    //                 size: {
    //                     type: 'number',
    //                     default: 300,
    //                     minimum: 100,
    //                     maximum: 1000,
    //                     description: 'QR code size in pixels'
    //                 }
    //             }
    //         },
    //         response: {
    //             200: {
    //                 type: 'string',
    //                 format: 'binary',
    //                 description: 'PNG image of QR code'
    //             }
    //         }
    //     }
    // }, controller.generateQRCode.bind(controller))

    // ============================================================================
    // POST /api/v1/credentials/:id/revoke - Revoke a credential
    // ============================================================================
    // DISABLED: Conflicts with credentials.ts routes. Use /api/v1/credentials/:id/revoke instead.
    // fastify.post('/credentials/:id/revoke', {
    //     preHandler: authenticateJWT,
    //     schema: {
    //         tags: ['credentials'],
    //         summary: 'Revoke a credential',
    //         description: 'Revoke a previously issued credential. Requires signature from the issuer.',
    //         params: {
    //             type: 'object',
    //             required: ['id'],
    //             properties: {
    //                 id: { type: 'string', description: 'Credential ID' }
    //             }
    //         },
    //         body: {
    //             type: 'object',
    //             required: ['reason', 'signature', 'signerAddress'],
    //             properties: {
    //                 reason: {
    //                     type: 'string',
    //                     enum: ['revoked_by_issuer', 'credential_expired', 'holder_request', 'security_concern', 'other'],
    //                     description: 'Reason for revocation'
    //                 },
    //                 signature: { type: 'string', description: 'EIP-712 signature authorizing revocation' },
    //                 signerAddress: { type: 'string', description: 'Address of the signer (must match issuer)' }
    //             }
    //         },
    //         response: {
    //             200: {
    //                 type: 'object',
    //                 properties: {
    //                     revoked: { type: 'boolean' },
    //                     revokedAt: { type: 'number' },
    //                     reason: { type: 'string' }
    //                 }
    //             }
    //         }
    //     }
    // }, controller.revokeCredential.bind(controller))

    // ============================================================================
    // GET /api/v1/credentials/:id/status - Get credential status
    // ============================================================================
    // DISABLED: Conflicts with credentials.ts routes. Use /api/v1/credentials/:id/status instead.
    // fastify.get('/credentials/:id/status', {
    //     schema: {
    //         tags: ['credentials'],
    //         summary: 'Check credential status',
    //         description: 'Get the current status of a credential (active, revoked, expired).',
    //         params: {
    //             type: 'object',
    //             required: ['id'],
    //             properties: {
    //                 id: { type: 'string', description: 'Credential ID' }
    //             }
    //         },
    //         response: {
    //             200: {
    //                 type: 'object',
    //                 properties: {
    //                     id: { type: 'string' },
    //                     status: { type: 'string', enum: ['active', 'revoked', 'expired'] },
    //                     revoked: { type: 'boolean' },
    //                     revokedAt: { type: 'number' },
    //                     reason: { type: 'string' },
    //                     expiresAt: { type: 'number' }
    //                 }
    //             }
    //         }
    //     }
    // }, controller.getCredentialStatus.bind(controller))
}

export default simplifiedIssueRoutes
