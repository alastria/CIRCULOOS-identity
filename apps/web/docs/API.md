# API Reference
## Alastria Verifiable Credentials Frontend

---

## 1. Internal API Routes

### Applications

#### POST `/api/applications`
Crear nueva solicitud de credencial.

**Request:**
\`\`\`typescript
interface CreateApplicationRequest {
  email: string
  fullName: string
  walletAddress: string
  organization?: string
  reason?: string
}
\`\`\`

**Response:**
\`\`\`typescript
interface CreateApplicationResponse {
  id: string
  status: 'pending' | 'auto-approved'
  createdAt: string
}
\`\`\`

---

#### PATCH `/api/applications/[id]`
Actualizar estado de solicitud.

**Request:**
\`\`\`typescript
interface UpdateApplicationRequest {
  action: 'approve' | 'reject' | 'reopen'
  reason?: string // Required for reject
}
\`\`\`

---

### Claim

#### POST `/api/claim/validate`
Validar token de claim.

**Request:**
\`\`\`typescript
interface ValidateClaimRequest {
  token: string
}
\`\`\`

**Response:**
\`\`\`typescript
interface ValidateClaimResponse {
  valid: boolean
  issuanceId: string
  holderEmail: string
  holderWallet: string
  credentialType: string
  expiresAt: string
}
\`\`\`

---

#### POST `/api/claim/verify-otp`
Verificar código OTP.

**Request:**
\`\`\`typescript
interface VerifyOTPRequest {
  token: string
  otp: string
}
\`\`\`

**Response:**
\`\`\`typescript
interface VerifyOTPResponse {
  valid: boolean
  attemptsRemaining?: number
  credential?: VerifiableCredential
}
\`\`\`

---

#### POST `/api/claim/finalize`
Finalizar claim con firma.

**Request:**
\`\`\`typescript
interface FinalizeClaimRequest {
  token: string
  signature: string
  walletAddress: string
}
\`\`\`

**Response:**
\`\`\`typescript
interface FinalizeClaimResponse {
  success: boolean
  credential: VerifiableCredential
  verificationUrl: string
}
\`\`\`

---

#### POST `/api/claim/resend-otp`
Reenviar código OTP.

**Request:**
\`\`\`typescript
interface ResendOTPRequest {
  token: string
}
\`\`\`

---

### Verification

#### POST `/api/verify`
Verificar credencial.

**Request:**
\`\`\`typescript
interface VerifyRequest {
  credential: VerifiableCredential | string // JSON or stringified
}
\`\`\`

**Response:**
\`\`\`typescript
interface VerifyResponse {
  valid: boolean
  status: 'active' | 'expired' | 'revoked'
  issuer: {
    did: string
    name?: string
    trusted: boolean
  }
  holder: {
    did: string
  }
  checks: {
    signature: boolean
    expiration: boolean
    revocation: boolean
    issuerTrust: boolean
  }
}
\`\`\`

---

## 2. External API Integration

### Issuer API

Base URL: `NEXT_PUBLIC_ISSUER_API_URL`

#### POST `/credentials`
Emitir nueva credencial.

**Headers:**
\`\`\`
Authorization: Bearer <jwt_token>
Content-Type: application/json
\`\`\`

**Request:**
\`\`\`typescript
interface IssueCredentialRequest {
  holderEmail: string
  holderWallet: string
  credentialType: string
  attributes: Record<string, any>
  expiresIn?: number // days
}
\`\`\`

**Response:**
\`\`\`typescript
interface IssueCredentialResponse {
  id: string
  claimToken: string
  claimUrl: string
  expiresAt: string
}
\`\`\`

---

#### GET `/credentials/:id`
Obtener credencial por ID.

---

#### POST `/credentials/:id/revoke`
Revocar credencial.

**Request:**
\`\`\`typescript
interface RevokeRequest {
  reason: string
  signature: string // Admin signature
}
\`\`\`

---

#### GET `/credentials`
Listar credenciales.

**Query Params:**
\`\`\`
?status=pending|claimed|revoked
&page=1
&limit=20
&search=email@example.com
\`\`\`

---

#### GET `/issuers`
Listar issuers autorizados.

---

#### POST `/issuers`
Registrar nuevo issuer.

---

#### DELETE `/issuers/:address`
Desactivar issuer.

---

### Verifier API

Base URL: `NEXT_PUBLIC_VERIFIER_API_URL`

#### POST `/verify`
Verificar credencial o presentación.

**Request:**
\`\`\`typescript
interface VerifyRequest {
  document: VerifiableCredential | VerifiablePresentation
  options?: {
    checkRevocation?: boolean
    checkExpiration?: boolean
    checkIssuerTrust?: boolean
  }
}
\`\`\`

---

#### GET `/status/:hash`
Consultar estado de credencial por hash.

**Response:**
\`\`\`typescript
interface StatusResponse {
  hash: string
  status: 'active' | 'revoked' | 'unknown'
  revokedAt?: string
  revokedBy?: string
  reason?: string
}
\`\`\`

---

## 3. Blockchain Integration

### Diamond Contract

Address: `NEXT_PUBLIC_DIAMOND_ADDRESS`

#### Read Functions

\`\`\`solidity
// Check if issuer is trusted
function isTrustedIssuer(address issuer) view returns (bool)

// Check if credential is revoked
function isRevoked(bytes32 credentialHash) view returns (bool)

// Get revocation details
function getRevocation(bytes32 hash) view returns (
  bool revoked,
  uint256 revokedAt,
  address revokedBy,
  string reason
)
\`\`\`

#### Write Functions

\`\`\`solidity
// Register credential hash (issuer only)
function registerCredential(bytes32 hash) external

// Revoke credential (issuer only)
function revokeCredential(bytes32 hash, string reason) external

// Add trusted issuer (admin only)
function addTrustedIssuer(address issuer) external

// Remove trusted issuer (admin only)
function removeTrustedIssuer(address issuer) external
\`\`\`

---

## 4. MetaMask Snap API

### Installation
\`\`\`typescript
await window.ethereum.request({
  method: 'wallet_requestSnaps',
  params: {
    [SNAP_ID]: { version: SNAP_VERSION }
  }
})
\`\`\`

### Methods

#### circuloos_getCredentials
\`\`\`typescript
const credentials = await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: SNAP_ID,
    request: { method: 'circuloos_getCredentials' }
  }
})
\`\`\`

#### circuloos_saveCredential
\`\`\`typescript
await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: SNAP_ID,
    request: { 
      method: 'circuloos_saveCredential',
      params: { credential: vcJSON }
    }
  }
})
\`\`\`

#### circuloos_deleteCredential
\`\`\`typescript
await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: SNAP_ID,
    request: { 
      method: 'circuloos_deleteCredential',
      params: { id: credentialId }
    }
  }
})
\`\`\`

#### circuloos_signPresentation
\`\`\`typescript
const vp = await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: SNAP_ID,
    request: { 
      method: 'circuloos_signPresentation',
      params: { 
        credentialIds: ['vc-1', 'vc-2'],
        challenge: 'random-challenge-string'
      }
    }
  }
})
\`\`\`

---

## 5. Error Codes

| Code | Description |
|------|-------------|
| `INVALID_TOKEN` | Claim token inválido o expirado |
| `ALREADY_CLAIMED` | Credencial ya reclamada |
| `INVALID_OTP` | Código OTP incorrecto |
| `MAX_ATTEMPTS` | Máximo de intentos alcanzado |
| `WALLET_MISMATCH` | Wallet no coincide con el esperado |
| `SIGNATURE_FAILED` | Error al verificar firma |
| `ISSUER_NOT_TRUSTED` | Emisor no autorizado |
| `CREDENTIAL_REVOKED` | Credencial revocada |
| `CREDENTIAL_EXPIRED` | Credencial expirada |
| `NETWORK_ERROR` | Error de conexión |
| `UNAUTHORIZED` | No autorizado |
