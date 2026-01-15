import { CredentialProof, CredentialProofPurpose, SignedCredential, VC } from './types'
import { verifyCredential } from './eip712'
import { verifyCredentialIssuance } from './eip712/helpers'
import { detectCredentialType } from './eip712/registry'

export type CredentialVerificationResult = {
  ok: boolean
  recovered?: string
  expected?: string
  reason?: string
}

export function verifyCredentialProof(
  vc: VC,
  proof: CredentialProof,
  opts?: {
    trustedSubjects?: string[]
    expectedPurpose?: CredentialProofPurpose
  },
): CredentialVerificationResult {
  if (!proof) return { ok: false, reason: 'missing proof' }
  if (opts?.expectedPurpose && proof.proofPurpose !== opts.expectedPurpose) {
    return { ok: false, reason: `unexpected proof purpose: ${proof.proofPurpose}` }
  }

  let recovered: string | null = null

  // Check for new EIP-712 proof format (with dynamic types in eip712 field)
  if ((proof as any).eip712 && (proof as any).proofValue) {
    try {
      const eip712Data = (proof as any).eip712
      const { domain, types, primaryType } = eip712Data
      const includedMessage = eip712Data.message
      const signature = (proof as any).proofValue

      console.log('[Common Verifier] EIP-712 data received:')
      console.log('  - domain:', JSON.stringify(domain))
      console.log('  - types keys:', Object.keys(types || {}))
      console.log('  - primaryType:', primaryType)
      console.log('  - message:', includedMessage ? JSON.stringify(includedMessage) : 'MISSING!')
      console.log('  - signature:', signature?.substring(0, 20) + '...')

      // Import ethers dynamically to avoid circular deps if any, or just use what's available
      const { utils } = require('ethers')

      // Use the message included in the proof if available
      // This is the exact message that was signed by the holder
      let messageToVerify = includedMessage

      if (!messageToVerify) {
        console.warn('[Common Verifier] No message included in proof.eip712.message - verification will fail')
        return { ok: false, reason: 'No message included in proof.eip712.message' }
      }

      // Convert string values back to their proper types for EIP-712 verification
      messageToVerify = { ...messageToVerify }
      
      // Convert timestamp string back to BigInt if needed (uint256 type)
      if (messageToVerify.timestamp !== undefined && typeof messageToVerify.timestamp === 'string') {
        messageToVerify.timestamp = BigInt(messageToVerify.timestamp)
      }

      console.log('[Common Verifier] Message to verify:', JSON.stringify(messageToVerify, (k, v) => 
        typeof v === 'bigint' ? v.toString() : v
      ))

      recovered = utils.verifyTypedData(domain, types, messageToVerify, signature)
      console.log('[Common Verifier] Dynamic EIP-712 recovered:', recovered)
    } catch (err) {
      console.error('[Common Verifier] Dynamic EIP-712 verification failed:', err)
    }
  } 
  // Check for issuer proof (assertionMethod) - use schema registry for verification
  else if (proof.proofPurpose === 'assertionMethod' && proof.domain && proof.signature) {
    console.log('[Common Verifier] Verifying issuer proof using schema registry')
    console.log('[Common Verifier] VC type:', vc.type)
    console.log('[Common Verifier] Proof domain:', JSON.stringify(proof.domain))
    
    try {
      // Use the new schema registry verification which matches the signing types
      const credentialType = detectCredentialType(vc)
      console.log('[Common Verifier] Detected credential type:', credentialType)
      
      recovered = verifyCredentialIssuance(proof.domain, vc, proof.signature, credentialType)
      console.log('[Common Verifier] Schema registry recovered:', recovered)
    } catch (err) {
      console.error('[Common Verifier] Schema registry verification failed:', err)
      // Fallback to legacy verification
      console.log('[Common Verifier] Falling back to legacy verification')
      recovered = verifyCredential(proof.domain, vc, proof.signature)
    }
  }
  else {
    // Fallback to legacy verification
    console.log('[Common Verifier] Using legacy verification')
    recovered = verifyCredential(proof.domain, vc, proof.signature)
  }

  console.log('[Common Verifier] Recovered address:', recovered)
  console.log('[Common Verifier] Expected verificationMethod:', proof.verificationMethod)

  if (!recovered) return { ok: false, reason: 'invalid signature' }

  const expected = proof.verificationMethod
  if (expected && recovered.toLowerCase() !== expected.toLowerCase()) {
    return { ok: false, recovered, expected, reason: 'signer mismatch' }
  }

  if (opts?.trustedSubjects?.length) {
    const trusted = opts.trustedSubjects.map((s) => s.toLowerCase())
    if (!trusted.includes(recovered.toLowerCase())) {
      return { ok: false, recovered, expected, reason: 'subject not trusted' }
    }
  }

  return { ok: true, recovered, expected }
}

export function verifySignedCredential(
  signed: SignedCredential,
  opts?: {
    trustedIssuers?: string[]
    trustedHolders?: string[]
    requireW3CCompliance?: boolean
  },
) {
  const issuer = verifyCredentialProof(signed.vc, signed.issuerProof, {
    trustedSubjects: opts?.trustedIssuers,
    expectedPurpose: 'assertionMethod',
  })

  const holder = signed.holderProof
    ? verifyCredentialProof(signed.vc, signed.holderProof, {
      trustedSubjects: opts?.trustedHolders,
      expectedPurpose: 'authentication',
    })
    : undefined

  // Additional W3C compliance checks
  if (opts?.requireW3CCompliance) {
    // Check if credentialSubject.id exists and matches holder
    const subjectId = signed.vc.credentialSubject?.id
    if (!subjectId) {
      return {
        issuer,
        holder: {
          ok: false,
          reason: 'W3C compliance: credentialSubject.id is required'
        }
      }
    }

    // If holder proof exists, verify it matches credentialSubject.id
    if (holder && holder.ok && holder.recovered) {
      if (subjectId.toLowerCase() !== holder.recovered.toLowerCase()) {
        return {
          issuer,
          holder: {
            ok: false,
            reason: 'W3C compliance: holder signature does not match credentialSubject.id'
          }
        }
      }
    }
  }

  return { issuer, holder }
}
