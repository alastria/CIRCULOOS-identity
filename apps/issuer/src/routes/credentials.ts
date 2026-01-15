import { FastifyPluginAsync } from 'fastify'
import { IssueController } from '../controllers/issueController'
import { authenticateJWT } from '../middleware/auth.middleware'

interface CredentialsRoutesOptions {
  issueController: IssueController
}

/**
 * Credentials Routes - /api/v1/credentials
 * 
 * CRUD operations for credentials: list, get, status, revoke, QR, PDF
 */
const credentialsRoutes: FastifyPluginAsync<CredentialsRoutesOptions> = async (fastify, opts) => {
  const controller = opts.issueController

  // ============================================================================
  // GET /api/v1/credentials/my - List MY credentials (holder's own)
  // ============================================================================
  fastify.get('/my', {
    preHandler: authenticateJWT,
    schema: {
      tags: ['credentials'],
      summary: 'List my credentials',
      description: 'Get credentials owned by the authenticated holder (from backend storage)',
      response: {
        200: {
          type: 'object',
          properties: {
            credentials: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'array', items: { type: 'string' } },
                  issuer: { type: 'string' },
                  issuanceDate: { type: 'string' },
                  expirationDate: { type: 'string' },
                  credentialSubject: { type: 'object', additionalProperties: true },
                  hasProof: { type: 'boolean' }
                }
              }
            },
            total: { type: 'number' },
            source: { type: 'string', enum: ['backend', 'backend-issuances'] }
          }
        }
      }
    }
  }, controller.listMyCredentials.bind(controller))

  // ============================================================================
  // GET /api/v1/credentials - List credentials
  // ============================================================================
  fastify.get('/', {
    preHandler: authenticateJWT,
    schema: {
      tags: ['credentials'],
      summary: 'List credentials',
      description: 'Get a paginated list of credentials for the authenticated user',
      querystring: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['DRAFT', 'ISSUED', 'CLAIMED', 'REVOKED'],
            description: 'Filter by credential status'
          },
          limit: {
            type: 'number',
            default: 20,
            minimum: 1,
            maximum: 100,
            description: 'Number of results per page'
          },
          offset: {
            type: 'number',
            default: 0,
            minimum: 0,
            description: 'Number of results to skip'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            credentials: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                  holderAddress: { type: 'string' },
                  createdAt: { type: 'number' },
                  expiresAt: { type: 'number' }
                }
              }
            },
            total: { type: 'number', description: 'Total number of credentials' },
            limit: { type: 'number' },
            offset: { type: 'number' }
          }
        }
      }
    }
  }, controller.listIssuances.bind(controller))

  // ============================================================================
  // GET /api/v1/credentials/:id - Get credential by ID
  // ============================================================================
  fastify.get('/:id', {
    preHandler: authenticateJWT,
    schema: {
      tags: ['credentials'],
      summary: 'Get credential',
      description: 'Retrieve a credential by ID. Requires authentication and ownership verification.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Credential ID or Issuance ID' }
        }
      },
      response: {
        200: {
          type: 'object',
          description: 'W3C Verifiable Credential',
          additionalProperties: true
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, controller.getCredential.bind(controller))

  // ============================================================================
  // GET /api/v1/credentials/:id/status - Get credential status
  // ============================================================================
  fastify.get('/:id/status', {
    schema: {
      tags: ['credentials'],
      summary: 'Check credential status',
      description: 'Get the current status of a credential (active, revoked, expired). Public endpoint.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Credential ID' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string', enum: ['active', 'revoked', 'expired'] },
            revoked: { type: 'boolean' },
            revokedAt: { type: 'number' },
            reason: { type: 'string' },
            expiresAt: { type: 'number' }
          }
        }
      }
    }
  }, controller.getCredentialStatus.bind(controller))

  // ============================================================================
  // GET /api/v1/credentials/:id/public - Get credential for public verification
  // ============================================================================
  fastify.get('/:id/public', {
    schema: {
      tags: ['credentials'],
      summary: 'Get credential for public verification',
      description: 'Get a credential by ID for public verification via QR code. Returns the full VC for signature verification.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Credential ID (can be URN or issuance ID)' }
        }
      },
      response: {
        200: {
          type: 'object',
          description: 'W3C Verifiable Credential for verification',
          additionalProperties: true
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, controller.getCredentialPublic.bind(controller))

  // ============================================================================
  // GET /api/v1/credentials/:id/full - Get full credential (authenticated)
  // ============================================================================
  fastify.get('/:id/full', {
    preHandler: authenticateJWT,
    schema: {
      tags: ['credentials'],
      summary: 'Get full credential with personal data',
      description: 'Get the complete credential including personal attributes. Requires SIWA authentication and only the holder can access their own credential.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Credential ID (can be URN or issuance ID)' }
        }
      },
      response: {
        200: {
          type: 'object',
          description: 'Full W3C Verifiable Credential with all attributes',
          additionalProperties: true
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            hint: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, controller.getCredentialFull.bind(controller))

  // ============================================================================
  // POST /api/v1/credentials/:id/revoke - Revoke credential
  // ============================================================================
  fastify.post('/:id/revoke', {
    preHandler: authenticateJWT,
    schema: {
      tags: ['credentials'],
      summary: 'Revoke credential',
      description: 'Revoke a previously issued credential. Requires issuer signature.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Credential ID' }
        }
      },
      body: {
        type: 'object',
        required: ['reason', 'signature', 'signerAddress'],
        properties: {
          reason: {
            type: 'string',
            enum: ['revoked_by_issuer', 'credential_expired', 'holder_request', 'security_concern', 'other'],
            description: 'Reason for revocation'
          },
          signature: { type: 'string', description: 'EIP-712 signature authorizing revocation' },
          signerAddress: { type: 'string', description: 'Address of the signer (must match issuer)' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            revoked: { type: 'boolean' },
            revokedAt: { type: 'number' },
            reason: { type: 'string' }
          }
        }
      }
    }
  }, controller.revokeCredential.bind(controller))

  // ============================================================================
  // GET /api/v1/credentials/:id/pdf - Download credential as PDF
  // ============================================================================
  fastify.get('/:id/pdf', {
    preHandler: authenticateJWT,
    schema: {
      tags: ['credentials'],
      summary: 'Download credential as PDF',
      description: 'Get a PDF version of the credential with embedded QR code and verification link.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Credential ID or Issuance ID' }
        }
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'PDF file'
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, controller.generatePDF.bind(controller))

  // ============================================================================
  // POST /api/v1/credentials/pdf/from-vc - Generate PDF from VC JSON
  // ============================================================================
  fastify.post('/pdf/from-vc', {
    preHandler: authenticateJWT,
    schema: {
      tags: ['credentials'],
      summary: 'Generate PDF from VC JSON',
      description: 'Recover lost PDFs by generating from the VC JSON. Requires authentication and ownership.',
      body: {
        type: 'object',
        required: ['vc'],
        properties: {
          vc: {
            type: 'object',
            description: 'Complete Verifiable Credential JSON'
          }
        }
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'PDF file with embedded VC'
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, controller.generatePDFFromVC.bind(controller))

  // ============================================================================
  // GET /api/v1/credentials/:id/qr - Get QR code
  // ============================================================================
  fastify.get('/:id/qr', {
    schema: {
      tags: ['credentials'],
      summary: 'Get QR code for credential',
      description: 'Generate a QR code linking to the credential verification page. Public endpoint.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Credential ID or Issuance ID' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          size: {
            type: 'number',
            default: 300,
            minimum: 100,
            maximum: 1000,
            description: 'QR code size in pixels'
          }
        }
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'PNG image of QR code'
        }
      }
    }
  }, controller.generateQRCode.bind(controller))
}

export default credentialsRoutes
