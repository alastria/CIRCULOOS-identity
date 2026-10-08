/**
 * Issue/credential routes are now protected by `authenticateJWT` (HttpOnly `auth_token`
 * cookie signed with config.security.jwtSecret). Tests that drive those routes over HTTP
 * mint a session cookie with the same secret the server uses.
 */
import jwt from 'jsonwebtoken'
import { config } from '../../src/config'

export function authCookies(wallet: string, role: 'holder' | 'issuer' | 'admin' = 'issuer') {
    const secret = config.security.jwtSecret
    if (!secret) throw new Error('config.security.jwtSecret not set')
    return { auth_token: jwt.sign({ wallet: wallet.toLowerCase(), role }, secret, { expiresIn: '1h' }) }
}
