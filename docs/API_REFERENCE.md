# API Routes Structure

## Overview

The Issuer Service API is organized into 4 main modules:

| Module | Prefix | Description |
|--------|--------|-------------|
| **Auth** | `/api/v1/auth` | Authentication (SIWA) |
| **Issue** | `/api/v1/issue` | Credential issuance flow |
| **Credentials** | `/api/v1/credentials` | Credential CRUD operations |
| **System** | `/api/v1/system` | Administration & blockchain sync |

---

## Auth Module (`/api/v1/auth`)

Authentication using SIWA (Sign-In with Alastria).

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/challenge/:address` | Get nonce for SIWA | No |
| `POST` | `/verify` | Verify SIWA signature, set JWT cookie | No |
| `POST` | `/logout` | Clear session cookie | No |

### Authentication Flow

```
1. GET /api/v1/auth/challenge/{address}  → { nonce, issuedAt }
2. Sign SIWE message with wallet
3. POST /api/v1/auth/verify { address, signature, nonce } → JWT cookie
4. All subsequent requests include HttpOnly cookie automatically
```

---

## Issue Module (`/api/v1/issue`)

Core credential issuance flow.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/` | One-step issuance (simplified) | Yes JWT |
| `GET` | `/info/*` | Get issuance info from token | No |
| `POST` | `/prepare` | Start issuance, create draft VC | Yes JWT |
| `POST` | `/mint` | Issuer signs the credential | Yes JWT |
| `POST` | `/finalize` | Holder claims the credential | Yes JWT |

### Issuance Flow

```
Option A: Full Flow (prepare → mint → finalize)
  1. POST /issue/prepare { email, holderAddress } → { id, token, domain, draftVc }
  2. POST /issue/mint { id, signature, signer } → { token, otp }
  3. Holder receives email with claim link
  4. POST /issue/finalize { id, token, otp, signature, signer } → { vcId }

Option B: Simplified (one-step)
  1. POST /issue { holderAddress, email, signature, signerAddress } → { credentialId, claimUrl }
```

---

## Credentials Module (`/api/v1/credentials`)

CRUD operations for credentials.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/` | List credentials | Yes JWT |
| `GET` | `/:id` | Get credential by ID | Yes JWT |
| `GET` | `/:id/status` | Check credential status | No Public |
| `POST` | `/:id/revoke` | Revoke a credential | Yes JWT |
| `GET` | `/:id/pdf` | Download as PDF | Yes JWT |
| `POST` | `/pdf/from-vc` | Generate PDF from VC JSON | Yes JWT |
| `GET` | `/:id/qr` | Get verification QR code | No Public |

### Status Check (Public)

```bash
GET /api/v1/credentials/{id}/status
→ { id, status: "active|revoked|expired", revoked, revokedAt, reason, expiresAt }
```

---

## System Module (`/api/v1/system`)

Administration and blockchain synchronization.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/health` | Extended health check | No |
| `GET` | `/blockchain/stats` | Blockchain statistics | No |
| `GET` | `/blockchain/credentials` | List indexed credentials | No |
| `GET` | `/blockchain/issuers` | List trusted issuers | No |
| `POST` | `/blockchain/sync` | Trigger manual sync | No |
| `GET` | `/blockchain/sync/state` | Get sync state | No |

### Blockchain Stats

```bash
GET /api/v1/system/blockchain/stats
→ {
    credentials: { total, active, revoked },
    issuers: { total, active },
    sync: { lastSyncedBlock, lastSyncTime, isSyncing }
  }
```

---

## Verifier Service (`/api/v1/verify`)

Separate service at port 8002.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/` | Verify a Verifiable Credential |
| `POST` | `/presentation` | Verify a Verifiable Presentation |
| `GET` | `/health` | Health check |

---

## Legacy Routes (Deprecated)

These routes are maintained for backward compatibility but will be removed in v2.0:

- `GET /api/v1/credentials/:id` → Use `/api/v1/credentials/:id` (same path, now in credentials module)
- `POST /api/v1/credentials` → Use `POST /api/v1/issue` (simplified issuance)
- `GET /admin/blockchain/*` → Use `/api/v1/system/blockchain/*`
- `/api/v1/issue/auth/*` → Use `/api/v1/auth/*`

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"  // Optional
}
```

Common HTTP status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid authentication)
- `403` - Forbidden (not enough permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## OpenAPI Documentation

Interactive documentation available at:
- Issuer: `http://localhost:8001/api/v1/docs`
- Verifier: `http://localhost:8002/api/v1/docs`
