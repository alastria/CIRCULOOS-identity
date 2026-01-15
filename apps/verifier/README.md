# Circuloos Verifier API

W3C Verifiable Credentials and Presentations verification service.

## Overview

The Verifier API provides endpoints for:
- Verifying W3C Verifiable Credentials
- Verifying W3C Verifiable Presentations
- Challenge-response verification flows
- Blockchain-based credential status checks
- Swagger UI API documentation

## Quick Start

### Development (Local)

```bash
# From project root
pnpm dev

# Or run verifier only
pnpm --filter @circuloos/verifier dev
```

### Docker

```bash
# From project root
pnpm docker:build
pnpm docker:start
```

Access at: **http://localhost:4001**
Swagger UI: **http://localhost:4001/docs**

## Environment Variables

The verifier uses a **decentralized configuration** approach:
- **Shared variables**: `/.env.shared` (blockchain, contracts)
- **Service-specific**: `/apps/verifier/.env` (secrets, ports, storage)

### Setup

```bash
# 1. Copy shared configuration
cp /.env.shared.example /.env.shared

# 2. Copy verifier configuration
cp .env.example .env

# 3. Review and adjust values
```

### Configuration Reference

See `.env.example` for complete documentation. Key variables:

#### HTTP Server
- `HTTP_HOST` - Bind address (default: 0.0.0.0)
- `VERIFIER_PORT` - HTTP port (default: 4001)

#### Security
- `JWT_SECRET` - JWT authentication secret (min 32 chars)
- `CORS_ALLOWED_ORIGINS` - Comma-separated allowed origins
- `NONCE_EXPIRY_SECONDS` - Challenge-response nonce lifetime

#### Storage
- `FILESTORE_BASE_DIR` - Temporary verification session storage
- `VERIFICATION_AUDIT_PATH` - Audit log file path

#### Features
- `SWAGGER_ENABLED` - Enable Swagger UI (true/false)

### Blockchain Configuration

Blockchain variables are in `/.env.shared`:
- `RPC_URL` - Ethereum RPC endpoint
- `CHAIN_ID` - Network chain ID
- `EIP712_VERIFYING_CONTRACT` - Contract address for signatures
- `CREDENTIAL_REGISTRY_ADDRESS` - CredentialRegistry contract
- `REVOCATION_REGISTRY_ADDRESS` - RevocationRegistry contract
- `PROOF_REGISTRY_ADDRESS` - ProofRegistry contract

## API Endpoints

### Verification Endpoints

#### `POST /verify-credential`
Verify a W3C Verifiable Credential.

**Request:**
```json
{
  "credential": {
    "@context": [...],
    "type": ["VerifiableCredential"],
    "issuer": "did:example:issuer",
    "issuanceDate": "2023-01-01T00:00:00Z",
    "credentialSubject": {...},
    "proof": {...}
  }
}
```

**Response:**
```json
{
  "verified": true,
  "checks": {
    "signatureValid": true,
    "notRevoked": true,
    "notExpired": true
  }
}
```

#### `POST /verify-presentation`
Verify a W3C Verifiable Presentation.

**Request:**
```json
{
  "presentation": {
    "@context": [...],
    "type": ["VerifiablePresentation"],
    "verifiableCredential": [...],
    "proof": {...}
  },
  "challenge": "optional-challenge-string"
}
```

#### `GET /challenge`
Generate a verification challenge for presentation flow.

**Response:**
```json
{
  "challenge": "generated-nonce",
  "expiresAt": "2023-01-01T00:05:00Z"
}
```

### Health Check

#### `GET /health`
Service health check endpoint.

## Development

### Build

```bash
# From this directory
pnpm build

# From project root
pnpm --filter @circuloos/verifier build
```

### Test

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch
```

### Linting

```bash
pnpm lint
```

## Production Deployment

### Security Checklist

Before deploying to production:

- [ ] Generate secure `JWT_SECRET`: `openssl rand -hex 32`
- [ ] Update `CORS_ALLOWED_ORIGINS` to production domains only
- [ ] Use absolute paths for `FILESTORE_BASE_DIR`
- [ ] Consider database for `VERIFICATION_AUDIT_PATH`
- [ ] Set `SWAGGER_ENABLED=false` or add authentication
- [ ] Configure proper `NODE_ENV=production` in `.env.shared`
- [ ] Use managed RPC provider (not local Hardhat)
- [ ] Verify smart contract addresses in `.env.shared`
- [ ] Set appropriate `NONCE_EXPIRY_SECONDS` for your use case

### Docker Production

```bash
# Build image
docker build -t circuloos-verifier -f Dockerfile ../..

# Run with production env
docker run --env-file .env.production -p 4001:4001 circuloos-verifier
```

### Independent Deployment

The verifier can be deployed independently of other services:

```bash
cd apps/verifier
docker build -t circuloos-verifier .
docker run --env-file .env.production circuloos-verifier
```

Just ensure:
1. `.env.shared` variables are available (blockchain config)
2. Service-specific `.env` is configured
3. `RPC_URL` points to accessible blockchain node
4. Smart contracts are deployed and addresses configured

## Architecture

### Dependencies

- **Fastify** - HTTP framework
- **@circuloos/common** - Shared utilities and types
- **@circuloos/file-store** - File storage abstraction
- **ethers.js** - Ethereum interactions
- **Pino** - Structured logging

### File Structure

```
apps/verifier/
├── src/
│   ├── index.ts           # Main entry point & routes
│   └── ...                # Service logic
├── .env.example           # Environment template
├── .env                   # Local environment (gitignored)
├── Dockerfile             # Docker image definition
├── package.json           # Dependencies & scripts
└── README.md              # This file
```

## Verification Logic

The verifier performs multiple checks:

1. **Signature Verification**: Validates EIP-712 signature
2. **Issuer Trust**: Checks issuer DID (optional trusted registry)
3. **Revocation Status**: Queries blockchain RevocationRegistry
4. **Expiration**: Validates credential expiration date
5. **Holder Binding**: Verifies presentation signature matches holder

## Troubleshooting

### Verification Failures

If legitimate credentials fail verification:
- Check blockchain connectivity (`RPC_URL` in `.env.shared`)
- Verify contract addresses match issuer configuration
- Ensure credential hasn't been revoked on-chain
- Check for clock skew (expiration/issuance dates)

### CORS Errors

Check `CORS_ALLOWED_ORIGINS` includes the frontend URL.

### Contract Call Failures

- Verify `RPC_URL` in `.env.shared` is accessible
- Check contract addresses are correct
- Ensure contracts are deployed on the target network

### Challenge Expired

If challenges expire too quickly:
- Increase `NONCE_EXPIRY_SECONDS` in `.env`
- Default is 300 seconds (5 minutes)

## Documentation

- **API Docs**: http://localhost:4001/docs (when running)
- **Best Practices**: `/docs/BEST-PRACTICES.md`
- **Docker Setup**: `/docs/docker/README.md`
- **Project Root**: `/README.md`

## Support

For issues or questions:
1. Check this README
2. Review `/docs/BEST-PRACTICES.md`
3. Check logs: `pnpm docker:logs:verifier`
4. Verify environment configuration

---

**Service**: Circuloos Verifier API
**Port**: 4001
**Health**: http://localhost:4001/health
**Docs**: http://localhost:4001/docs
