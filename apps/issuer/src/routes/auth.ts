import { FastifyPluginAsync } from 'fastify'
import { AuthController } from '../controllers/authController'
import { IssueController } from '../controllers/issueController'

interface AuthRoutesOptions {
  authController: AuthController
  issueController: IssueController
}

/**
 * Authentication Routes - /api/v1/auth
 * 
 * Handles wallet-based authentication using SIWA (Sign-In with Alastria)
 */
const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (fastify, opts) => {
  const authController = opts.authController
  const issueController = opts.issueController

  // ============================================================================
  // GET /api/v1/auth/challenge/:address - Get authentication challenge
  // ============================================================================
  fastify.get('/challenge/:address', {
    schema: {
      tags: ['auth'],
      summary: 'Get authentication challenge',
      description: 'Get a nonce for SIWA (Sign-In with Alastria) authentication',
      params: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Ethereum wallet address' }
        },
        required: ['address']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            nonce: { type: 'string', description: 'Random nonce to sign' },
            issuedAt: { type: 'string', description: 'ISO timestamp' }
          }
        }
      }
    }
  }, issueController.getAuthChallenge.bind(issueController))

  // ============================================================================
  // POST /api/v1/auth/verify - Verify SIWA signature
  // ============================================================================
  fastify.post('/verify', {
    schema: {
      tags: ['auth'],
      summary: 'Verify SIWA signature',
      description: 'Verify SIWA signature and create authenticated session (JWT in HttpOnly cookie)',
      body: {
        type: 'object',
        required: ['address', 'signature', 'nonce'],
        properties: {
          address: { type: 'string', description: 'Wallet address' },
          signature: { type: 'string', description: 'EIP-4361 SIWE/SIWA signature' },
          nonce: { type: 'string', description: 'Nonce from /auth/challenge' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            wallet: { type: 'string', description: 'Authenticated wallet address' },
            role: { type: 'string', enum: ['holder', 'issuer', 'admin'], description: 'User role' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, authController.verifySIWA.bind(authController))

  // ============================================================================
  // POST /api/v1/auth/logout - Logout
  // ============================================================================
  fastify.post('/logout', {
    schema: {
      tags: ['auth'],
      summary: 'Logout',
      description: 'Clear session cookie and logout',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        }
      }
    }
  }, authController.logout.bind(authController))
}

export default authRoutes
