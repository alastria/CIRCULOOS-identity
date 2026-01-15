import { FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../config'
import jwt from 'jsonwebtoken'
import { DIDUtils } from '@circuloos/common'

export interface JWTPayload {
  wallet: string
  role: 'holder' | 'issuer' | 'admin'
  iat: number
  exp: number
}

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      wallet: string
      role: 'holder' | 'issuer' | 'admin'
    }
  }
}

export const authenticateJWT = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // CRITICAL: Extract token from HttpOnly Cookie (not from Authorization header)
    // Browser sends cookie automatically, JavaScript cannot read it
    const token = (request as any).cookies?.auth_token

    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized: Session not found' })
    }

    const jwtSecret = config.security.jwtSecret
    if (!jwtSecret) {
      console.error('JWT_SECRET is not configured')
      return reply.code(500).send({ error: 'Server configuration error' })
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload

    // CRITICAL: Address comes from verified JWT, not from user input
    request.user = {
      wallet: decoded.wallet.toLowerCase(),
      role: decoded.role
    }
  } catch (error) {
    // If token expired or is invalid, clear the cookie
    reply.clearCookie('auth_token', { path: '/' })
    return reply.code(401).send({ error: 'Session expired or invalid' })
  }
}

// Middleware to verify ownership of a resource
export async function verifyOwnership(
  request: FastifyRequest,
  reply: FastifyReply,
  resourceHolderAddress: string
): Promise<boolean> {
  const userWallet = request.user?.wallet

  if (!userWallet) {
    reply.code(401).send({ error: 'Unauthorized: No session found' })
    return false
  }

  // Normalize addresses (support DID format)
  const normalizedUser = DIDUtils.normalizeAddress(userWallet)
  const normalizedResource = DIDUtils.normalizeAddress(resourceHolderAddress)

  if (normalizedUser !== normalizedResource) {
    reply.code(403).send({
      error: 'Access denied: Resource does not belong to authenticated wallet'
    })
    return false
  }

  return true
}

// Middleware to verify role
export async function requireRole(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedRoles: Array<'holder' | 'issuer' | 'admin'>
): Promise<boolean> {
  const userRole = request.user?.role

  if (!userRole) {
    reply.code(401).send({ error: 'Unauthorized: No session found' })
    return false
  }

  if (!allowedRoles.includes(userRole)) {
    reply.code(403).send({
      error: `Access denied: Role '${userRole}' not allowed. Required: ${allowedRoles.join(', ')}`
    })
    return false
  }

  return true
}


