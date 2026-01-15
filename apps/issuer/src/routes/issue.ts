import { FastifyPluginAsync } from "fastify"
import { IssueController } from '../controllers/issueController'
import { authenticateJWT } from '../middleware/auth.middleware'

// Schemas (JSON Schema format for Fastify)
const prepareSchema = {
  description: "Initiate a credential issuance process (requires JWT authentication)",
  tags: ["issue"],
  body: {
    type: "object",
    required: ["email", "holderAddress"],
    properties: {
      email: { type: "string", format: "email", description: "User email address" },
      companyName: { type: "string", description: "Organization name" },
      holderAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", description: "Ethereum address of the holder" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        id: { type: "string", description: "Issuance ID" },
        token: { type: "string", description: "Session token" },
        otp: { type: "string", description: "One-Time Password (dev only)" },
        expiresAt: { type: "number", description: "Expiration timestamp" },
        domain: { type: "object", description: "EIP-712 Domain", additionalProperties: true },
        holderAddress: { type: "string", description: "Holder address" },
        draftVc: { type: "object", description: "Draft Verifiable Credential", additionalProperties: true },
      },
      additionalProperties: true,
    },
  },
}

const mintSchema = {
  description: "Mint a credential (Issuer signature)",
  tags: ["issue"],
  body: {
    type: "object",
    required: ["id", "signature", "signer"],
    properties: {
      id: { type: "string", description: "Issuance ID" },
      signature: { type: "string", description: "Issuer EIP-712 signature" },
      signer: { type: "string", description: "Issuer address" },
      domain: { type: "object", description: "EIP-712 Domain override" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        id: { type: "string" },
        token: { type: "string" },
        issuer: { type: "object", properties: { verificationMethod: { type: "string" } } },
        otp: { type: "string" },
      },
    },
  },
}

const finalizeSchema = {
  description: "Finalize claim (Holder signature)",
  tags: ["issue"],
  body: {
    type: "object",
    required: ["id", "token", "otp", "signature", "signer"],
    properties: {
      id: { type: "string", description: "Issuance ID" },
      token: { type: "string", description: "Session token" },
      otp: { type: "string", description: "OTP code" },
      signature: { type: "string", description: "Holder EIP-712 signature" },
      signer: { type: "string", description: "Holder address" },
      domain: { type: "object" },
      timestamp: { type: "string", description: "Timestamp from CredentialClaim message" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        vcId: { type: "string" },
        holder: { type: "object", properties: { verificationMethod: { type: "string" } } },
      },
    },
  },
}

const issueOneStepSchema = {
  description: "Issue a credential in one step (prepare + mint combined)",
  tags: ["issue"],
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

interface IssueRoutesOptions {
  issueController: IssueController
}

/**
 * Issue Routes - /api/v1/issue
 * 
 * Core credential issuance flow endpoints:
 * - prepare: Start issuance, generate draft VC
 * - mint: Issuer signs the credential
 * - finalize: Holder claims the credential
 * - info: Get issuance info from token (for claim page)
 * - issue: One-step issuance (prepare + mint combined)
 */
const issueRoutes: FastifyPluginAsync<IssueRoutesOptions> = async (fastify, opts) => {
  const controller = opts.issueController

  // ============================================================================
  // POST /api/v1/issue - One-step issuance (simplified)
  // ============================================================================
  fastify.post('/', {
    preHandler: authenticateJWT,
    schema: issueOneStepSchema
  }, controller.issueCredentialSimplified.bind(controller))

  // ============================================================================
  // GET /api/v1/issue/info/* - Get issuance info from token
  // ============================================================================
  // Use wildcard (*) to capture tokens with special characters like dots and equals signs
  fastify.get('/info/*', {
    schema: {
      tags: ['issue'],
      summary: 'Get issuance info from token',
      description: 'Get issuance information from claim token (for claim page)',
      params: {
        type: 'object',
        properties: { '*': { type: 'string' } },
        required: ['*']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            id: { type: 'string' },
            holderAddress: { type: 'string' },
            status: { type: 'string' },
            expiresAt: { type: 'number' },
            domain: { type: 'object' },
            credentialType: { type: 'string' },
            issuer: { type: 'string' }
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
  }, controller.getTokenInfo.bind(controller))

  // ============================================================================
  // POST /api/v1/issue/prepare - Initiate issuance
  // ============================================================================
  fastify.post('/prepare', {
    preHandler: authenticateJWT,
    schema: prepareSchema
  }, controller.prepare.bind(controller))

  // ============================================================================
  // POST /api/v1/issue/mint - Issuer signs credential
  // ============================================================================
  fastify.post('/mint', {
    preHandler: authenticateJWT,
    schema: mintSchema
  }, controller.mint.bind(controller))

  // ============================================================================
  // POST /api/v1/issue/finalize - Holder claims credential
  // ============================================================================
  fastify.post('/finalize', {
    preHandler: authenticateJWT,
    schema: finalizeSchema
  }, controller.finalize.bind(controller))
}

export default issueRoutes
