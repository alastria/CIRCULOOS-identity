/**
 * Enhanced Authentication Module
 * 
 * Provides secure OTP and token management with:
 * - Rate limiting
 * - Timing-safe comparisons
 * - Replay attack prevention
 * - Comprehensive validation
 */

// Export classes and functions with unique names to avoid conflicts
export {
  SecureOTPService,
  createSecureOTPService,
  generateSecureOtp,
  verifySecureOtp
} from './secureOTP'

export {
  SecureTokenService,
  createSecureTokenService
  // Note: createToken and verifyToken from './twofa' are used for backward compat
} from './secureToken'

export type {
  OTPConfig,
  OTPResult,
  OTPVerificationResult
} from './secureOTP'

export type {
  TokenClaims,
  TokenVerificationResult
} from './secureToken'
