const fs = require('fs')
const path = require('path')

function normalizePayload(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Input JSON must be an object')
  }

  if (input.presentation && typeof input.presentation === 'object') {
    return detectPayloadKind(input.presentation)
  }

  if (input.credential && typeof input.credential === 'object') {
    return detectPayloadKind(input.credential)
  }

  if (input.vc && typeof input.vc === 'object') {
    return detectPayloadKind(input.vc)
  }

  return detectPayloadKind(input)
}

function detectPayloadKind(document) {
  const types = Array.isArray(document?.type)
    ? document.type
    : document?.type
      ? [document.type]
      : []

  if (document?.verifiableCredential || types.includes('VerifiablePresentation')) {
    return { kind: 'presentation', data: document }
  }

  return { kind: 'credential', data: document }
}

function summarizeProof(proof) {
  if (!proof) {
    return ['- proof: missing']
  }

  const lines = [
    `- proof.type: ${proof.type || 'missing'}`,
    `- proof.proofPurpose: ${proof.proofPurpose || 'missing'}`,
    `- proof.verificationMethod: ${proof.verificationMethod || 'missing'}`,
    `- proof.signature: ${proof.signature ? 'present' : 'missing'}`,
    `- proof.proofValue: ${proof.proofValue ? 'present' : 'missing'}`,
    `- proof.domain: ${proof.domain ? 'present' : 'missing'}`,
  ]

  if (proof.domain) {
    lines.push(`- proof.domain.chainId: ${proof.domain.chainId ?? 'missing'}`)
    lines.push(`- proof.domain.verifyingContract: ${proof.domain.verifyingContract || 'missing'}`)
  }

  return lines
}

function localWarnings(payload) {
  const warnings = []
  const proof = payload?.proof

  if (proof?.proofValue && !proof?.domain) {
    warnings.push('proofValue exists but domain is missing; verifier will reject this as a provisional/non-verifiable credential.')
  }

  if (proof?.proofPurpose === 'assertionMethod' && proof?.verificationMethod && payload?.issuer) {
    const verificationMethod = String(proof.verificationMethod).toLowerCase()
    const issuer = String(payload.issuer).toLowerCase()
    if (!issuer.includes(verificationMethod)) {
      warnings.push('assertionMethod proof verificationMethod does not appear to belong to the issuer DID.')
    }
  }

  if (!payload?.credentialSubject?.id && !payload?.holder && !payload?.verifiableCredential) {
    warnings.push('No credentialSubject.id found.')
  }

  return warnings
}

async function main() {
  const filePath = process.argv[2]
  const baseUrl = process.argv[3] || 'http://localhost:8002'

  if (!filePath) {
    console.error('Usage: node scripts/diagnose-credential.js <path-to-json> [verifier-base-url]')
    process.exit(1)
  }

  const absolutePath = path.resolve(process.cwd(), filePath)
  const raw = fs.readFileSync(absolutePath, 'utf8')
  const parsed = JSON.parse(raw)
  const payload = normalizePayload(parsed)
  const endpoint = payload.kind === 'presentation' ? '/api/v1/verify/presentation' : '/api/v1/verify'
  const body = payload.kind === 'presentation'
    ? { presentation: payload.data }
    : { credential: payload.data }

  console.log(`File: ${absolutePath}`)
  console.log(`Kind: ${payload.kind}`)
  console.log(`Endpoint: ${baseUrl}${endpoint}`)
  console.log('')

  const proofLines = payload.kind === 'presentation'
    ? summarizeProof(payload.data?.proof)
    : summarizeProof(payload.data?.proof)
  for (const line of proofLines) {
    console.log(line)
  }

  const warnings = localWarnings(payload.data)
  if (warnings.length) {
    console.log('')
    console.log('Warnings:')
    for (const warning of warnings) {
      console.log(`- ${warning}`)
    }
  }

  console.log('')
  console.log('Verifier response:')

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let parsedResponse = text
  try {
    parsedResponse = JSON.parse(text)
  } catch {
    // keep raw text
  }

  console.log(`- HTTP status: ${response.status}`)
  if (typeof parsedResponse === 'string') {
    console.log(parsedResponse)
  } else {
    console.log(JSON.stringify(parsedResponse, null, 2))
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error))
  process.exit(1)
})