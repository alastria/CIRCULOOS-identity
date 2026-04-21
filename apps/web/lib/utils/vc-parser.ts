import type {
  VerifiableCredential,
  VCValidationResult,
  VCAnalysis,
  VCStatus,
  VCIssuerAnalysis,
  VCHolderAnalysis,
  VCContext,
  VCProof,
  VCSecurityScore,
  VCTimelineEvent,
} from "@/lib/types/vc"
import { keccak256, toBytes } from "viem"

// Parse and validate JSON
export function parseVCJson(input: string): { vc: VerifiableCredential | null; error: string | null } {
  try {
    const parsed = JSON.parse(input)
    return { vc: parsed as VerifiableCredential, error: null }
  } catch {
    return { vc: null, error: "JSON inválido: Error de sintaxis en el documento" }
  }
}

// Validate VC structure
export function validateVC(vc: VerifiableCredential): VCValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  let vcVersion: "1.0" | "1.1" | "2.0" | "unknown" = "unknown"
  let proofType: string | null = null

  // Check @context
  if (!vc["@context"]) {
    errors.push("Falta campo obligatorio: @context")
  } else {
    const contexts = Array.isArray(vc["@context"]) ? vc["@context"] : [vc["@context"]]
    if (contexts.includes("https://www.w3.org/2018/credentials/v1")) {
      vcVersion = "1.1"
    } else if (contexts.includes("https://www.w3.org/ns/credentials/v2")) {
      vcVersion = "2.0"
    } else if (contexts.some((c) => c.includes("credentials"))) {
      vcVersion = "1.0"
      warnings.push("Usa estándar antiguo v1.0")
    }
  }

  // Check type
  if (!vc.type) {
    errors.push("Falta campo obligatorio: type")
  } else {
    const types = Array.isArray(vc.type) ? vc.type : [vc.type]
    if (!types.includes("VerifiableCredential")) {
      errors.push("El campo type debe incluir 'VerifiableCredential'")
    }
  }

  // Check issuer
  if (!vc.issuer) {
    errors.push("Falta campo obligatorio: issuer")
  }

  // Check credentialSubject
  if (!vc.credentialSubject) {
    errors.push("Falta campo obligatorio: credentialSubject")
  }

  // Check issuanceDate
  if (!vc.issuanceDate) {
    errors.push("Falta campo obligatorio: issuanceDate")
  }

  // Check proof
  if (!vc.proof) {
    warnings.push("No tiene firma (proof) - Puede ser un borrador")
  } else {
    const proofs = Array.isArray(vc.proof) ? vc.proof : [vc.proof]
    proofType = proofs[0]?.type || null
  }

  // Check expirationDate
  if (!vc.expirationDate) {
    warnings.push("No tiene fecha de expiración")
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    vcVersion,
    proofType,
  }
}

// Extract DID type
export function extractDIDType(did: string): string {
  if (!did) return "unknown"
  if (did.startsWith("did:alastria:")) return "did:alastria"
  if (did.startsWith("did:ethr:")) return "did:ethr"
  if (did.startsWith("did:web:")) return "did:web"
  if (did.startsWith("did:key:")) return "did:key"
  if (did.startsWith("did:pkh:")) return "did:pkh"
  if (did.startsWith("0x")) return "ethereum-address"
  return "unknown"
}

// Extract Ethereum address from DID
export function extractEthereumAddress(did: string): string | null {
  if (!did) return null
  if (did.startsWith("0x") && did.length === 42) return did.toLowerCase()

  // did:alastria:network:0x...
  const alastriaMatch = did.match(/did:alastria:[^:]+:(?:0x)?([a-fA-F0-9]{40})/i)
  if (alastriaMatch) return `0x${alastriaMatch[1].toLowerCase()}`

  // did:ethr:0x...
  const ethrMatch = did.match(/did:ethr:(?:0x)?([a-fA-F0-9]{40})/i)
  if (ethrMatch) return `0x${ethrMatch[1].toLowerCase()}`

  // did:ethr:chainId:0x...
  const ethrChainMatch = did.match(/did:ethr:\d+:(?:0x)?([a-fA-F0-9]{40})/i)
  if (ethrChainMatch) return `0x${ethrChainMatch[1].toLowerCase()}`

  // did:pkh:eip155:1:0x...
  const pkhMatch = did.match(/did:pkh:eip155:\d+:(?:0x)?([a-fA-F0-9]{40})/i)
  if (pkhMatch) return `0x${pkhMatch[1].toLowerCase()}`

  return null
}

// Analyze issuer
export function analyzeIssuer(vc: VerifiableCredential): VCIssuerAnalysis {
  const issuer = typeof vc.issuer === "string" ? { id: vc.issuer } : vc.issuer
  const did = issuer.id
  const didType = extractDIDType(did)
  const ethereumAddress = extractEthereumAddress(did)

  return {
    did,
    didType,
    name: issuer.name || null,
    ethereumAddress,
    ensName: null, // Would need ENS resolution
    url: issuer.url || null,
    image: issuer.image || null,
    isTrusted: false, // Would need blockchain verification
    trustLevel: "unknown",
    signatureValid: null, // Would need signature verification
  }
}

// Detect claim type
function detectClaimType(
  value: unknown,
): "string" | "number" | "boolean" | "date" | "url" | "email" | "hash" | "object" | "array" {
  if (Array.isArray(value)) return "array"
  if (typeof value === "object" && value !== null) return "object"
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "number") return "number"
  if (typeof value === "string") {
    if (/^0x[a-fA-F0-9]{64}$/.test(value)) return "hash"
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) return "email"
    if (/^https?:\/\//.test(value)) return "url"
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return "date"
  }
  return "string"
}

// Analyze holder/subject
export function analyzeHolder(vc: VerifiableCredential): VCHolderAnalysis {
  const subject = vc.credentialSubject
  const did = subject.id || null
  const didType = did ? extractDIDType(did) : null
  const ethereumAddress = did ? extractEthereumAddress(did) : null

  // Extract claims
  const claims: VCHolderAnalysis["claims"] = []
  let protectedCount = 0

  for (const [key, value] of Object.entries(subject)) {
    if (key === "id") continue
    const type = detectClaimType(value)
    const isProtected = type === "hash"
    if (isProtected) protectedCount++
    claims.push({ key, value, type, isProtected })
  }

  // Calculate privacy level
  const totalClaims = claims.length
  const protectedRatio = totalClaims > 0 ? protectedCount / totalClaims : 0
  let privacyLevel: "low" | "medium" | "high" = "low"
  if (protectedRatio > 0.7) privacyLevel = "high"
  else if (protectedRatio > 0.3) privacyLevel = "medium"

  return {
    did,
    didType,
    ethereumAddress,
    ensName: null,
    name: typeof subject.name === "string" ? subject.name : null,
    claims,
    signatureValid: null,
    privacyLevel,
  }
}

// Parse contexts
export function parseContexts(vc: VerifiableCredential): VCContext[] {
  const rawContexts = Array.isArray(vc["@context"]) ? vc["@context"] : [vc["@context"]]

  return rawContexts.map((ctx) => {
    if (typeof ctx === "string") {
      if (ctx.includes("w3.org/2018/credentials") || ctx.includes("w3.org/ns/credentials")) {
        return {
          url: ctx,
          name: "W3C VC Context",
          description: "Contexto base de Credenciales Verificables",
          isStandard: true,
        }
      }
      if (ctx.includes("schema.org")) {
        return { url: ctx, name: "Schema.org", description: "Vocabulario de datos estructurados", isStandard: true }
      }
      return {
        url: ctx,
        name: "Contexto Personalizado",
        description: "Contexto definido por el emisor",
        isStandard: false,
      }
    }
    return {
      url: "inline",
      name: "Contexto Inline",
      description: "Contexto embebido en el documento",
      isStandard: false,
    }
  })
}

// Extract proofs
export function extractProofs(vc: VerifiableCredential): VCProof[] {
  if (!vc.proof) return []
  return Array.isArray(vc.proof) ? vc.proof : [vc.proof]
}

// Calculate security score
export function calculateSecurityScore(
  vc: VerifiableCredential,
  validation: VCValidationResult,
  issuer: VCIssuerAnalysis,
  holder: VCHolderAnalysis,
): VCSecurityScore {
  const checks: VCSecurityScore["checks"] = []
  let score = 0
  const maxScore = 95

  // Issuer signature
  const hasIssuerProof = !!vc.proof
  checks.push({
    name: "Firmada por Emisor",
    passed: hasIssuerProof,
    points: hasIssuerProof ? 25 : 0,
    description: hasIssuerProof ? "La credencial tiene firma del emisor" : "Falta firma del emisor",
  })
  if (hasIssuerProof) score += 25

  // Holder signature
  const proofs = extractProofs(vc)
  const hasHolderProof = proofs.some((p) => p.proofPurpose === "authentication")
  checks.push({
    name: "Firmada por Holder",
    passed: hasHolderProof,
    points: hasHolderProof ? 15 : 0,
    description: hasHolderProof ? "El holder ha firmado la credencial" : "El holder no ha firmado",
  })
  if (hasHolderProof) score += 15

  // Trusted issuer
  checks.push({
    name: "Emisor en Registry",
    passed: issuer.isTrusted,
    points: issuer.isTrusted ? 20 : 0,
    description: issuer.isTrusted ? "Emisor verificado en blockchain" : "Emisor no está en registry público",
  })
  if (issuer.isTrusted) score += 20

  // Not expired
  const now = new Date()
  const expirationDate = vc.expirationDate ? new Date(vc.expirationDate) : null
  const isExpired = expirationDate ? expirationDate < now : false
  const isExpiringSoon = expirationDate ? expirationDate.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000 : false

  if (!isExpired) {
    checks.push({
      name: "No Expirada",
      passed: true,
      points: 5,
      description: "La credencial no ha expirado",
    })
    score += 5
  } else {
    checks.push({
      name: "Expirada",
      passed: false,
      points: -30,
      description: "La credencial ha expirado",
    })
    score -= 30
  }

  // Has evidence
  const hasEvidence = !!vc.evidence && vc.evidence.length > 0
  checks.push({
    name: "Tiene Evidencia",
    passed: hasEvidence,
    points: hasEvidence ? 5 : 0,
    description: hasEvidence ? "Incluye evidencia de verificación" : "No incluye evidencia",
  })
  if (hasEvidence) score += 5

  // Valid structure
  checks.push({
    name: "Estructura Válida",
    passed: validation.isValid,
    points: validation.isValid ? 15 : 0,
    description: validation.isValid ? "Cumple con estándar W3C" : "Errores en estructura",
  })
  if (validation.isValid) score += 15

  // Calculate level
  let level: VCSecurityScore["level"] = "untrusted"
  if (score >= 86) level = "very-high"
  else if (score >= 71) level = "high"
  else if (score >= 41) level = "medium"
  else if (score >= 1) level = "low"

  return {
    score: Math.max(0, Math.min(100, score)),
    maxScore,
    level,
    checks,
    recommendations: [],
  }
}

// Build timeline
export function buildTimeline(vc: VerifiableCredential): VCTimelineEvent[] {
  const events: VCTimelineEvent[] = []
  const proofs = extractProofs(vc)

  // Issuance
  events.push({
    id: "issuance",
    type: "created",
    date: vc.issuanceDate,
    actor: typeof vc.issuer === "string" ? vc.issuer : vc.issuer.name || vc.issuer.id,
    description: "Credencial creada y preparada",
  })

  // Issuer signature
  const issuerProof = proofs.find((p) => p.proofPurpose === "assertionMethod")
  if (issuerProof) {
    events.push({
      id: "signed-issuer",
      type: "signed-issuer",
      date: issuerProof.created,
      actor: issuerProof.verificationMethod,
      description: "Firmada por el emisor",
    })
  }

  // Holder signature
  const holderProof = proofs.find((p) => p.proofPurpose === "authentication")
  if (holderProof) {
    events.push({
      id: "signed-holder",
      type: "signed-holder",
      date: holderProof.created,
      actor: holderProof.verificationMethod,
      description: "Aceptada y firmada por el holder",
    })
  }

  // Current status
  const now = new Date()
  const expirationDate = vc.expirationDate ? new Date(vc.expirationDate) : null
  const isExpired = expirationDate ? expirationDate < now : false

  events.push({
    id: "current",
    type: isExpired ? "expired" : "current",
    date: now.toISOString(),
    actor: null,
    description: isExpired ? "Credencial expirada" : "Estado actual: Activa",
  })

  return events.sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })
}

// Calculate VC hash
export function calculateVCHash(vc: VerifiableCredential): string {
  const vcString = JSON.stringify(vc)
  return keccak256(toBytes(vcString))
}

// Determine VC status
export function determineVCStatus(vc: VerifiableCredential): VCStatus {
  const now = new Date()
  const expirationDate = vc.expirationDate ? new Date(vc.expirationDate) : null

  if (!vc.proof) return "draft"
  if (expirationDate && expirationDate < now) return "expired"
  if (expirationDate) {
    const daysUntil = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil <= 30) return "expiring"
  }
  return "active"
}

// Full analysis
export function analyzeVC(vc: VerifiableCredential): VCAnalysis {
  const validation = validateVC(vc)
  const issuer = analyzeIssuer(vc)
  const holder = analyzeHolder(vc)
  const contexts = parseContexts(vc)
  const proofs = extractProofs(vc)
  const security = calculateSecurityScore(vc, validation, issuer, holder)
  const timeline = buildTimeline(vc)
  const hash = calculateVCHash(vc)
  const status = determineVCStatus(vc)

  const issuanceDate = new Date(vc.issuanceDate)
  const expirationDate = vc.expirationDate ? new Date(vc.expirationDate) : null
  const now = new Date()
  const daysUntilExpiration = expirationDate
    ? Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return {
    raw: vc,
    validation,
    status,
    issuer,
    holder,
    contexts,
    proofs,
    security,
    blockchain: null, // Would need async blockchain queries
    timeline,
    hash,
    issuanceDate,
    expirationDate,
    daysUntilExpiration,
  }
}
