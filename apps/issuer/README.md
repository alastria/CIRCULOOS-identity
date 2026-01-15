# Circuloos Issuer API

W3C Verifiable Credentials issuer service with EIP-712 signature support.

## Overview

The Issuer API provides endpoints for:
- Issuing W3C Verifiable Credentials with EIP-712 signatures
- Storing credential drafts for holder claiming
- OTP-based credential claiming flow
- Blockchain-based credential minting
- Swagger UI API documentation

## Quick Start

### Development (Local)

```bash
# From project root
pnpm dev

# Or run issuer only
pnpm --filter @circuloos/issuer dev
```

### Docker

```bash
# From project root
pnpm docker:build
pnpm docker:start
```

Access at: **http://localhost:3001**
Swagger UI: **http://localhost:3001/docs**

## Environment Variables

The issuer uses a **decentralized configuration** approach:
- **Shared variables**: `/.env.shared` (blockchain, contracts)
- **Service-specific**: `/apps/issuer/.env` (secrets, ports, storage)

### Setup

```bash
# 1. Copy shared configuration
cp /.env.shared.example /.env.shared

# 2. Copy issuer configuration
cp .env.example .env

# 3. Review and adjust values
```

### Configuration Reference

See `.env.example` for complete documentation. Key variables:

#### HTTP Server
- `HTTP_HOST` - Bind address (default: 0.0.0.0)
- `ISSUER_PORT` - HTTP port (default: 3001)
- `DOWNLOAD_LINK_BASE_URL` - Public URL for credential links

#### Security
- `ISSUER_PRIVATE_KEY` - Private key for EIP-712 signatures
- `ISSUER_HMAC_SECRET` - Secret for OTP generation (min 32 chars)
- `JWT_SECRET` - JWT authentication secret (min 32 chars)
- `CORS_ALLOWED_ORIGINS` - Comma-separated allowed origins

#### Identity
- `ISSUER_DID` - Decentralized Identifier for this issuer

#### Storage
- `FILESTORE_BASE_DIR` - Temporary credential storage path
- `ISSUANCE_AUDIT_PATH` - Audit log file path

#### Security Timeouts
- `NONCE_EXPIRY_SECONDS` - Challenge-response nonce lifetime
- `OTP_EXPIRY_SECONDS` - One-time password lifetime

#### Features
- `SWAGGER_ENABLED` - Enable Swagger UI (true/false)

### Blockchain Configuration

Blockchain variables are in `/.env.shared`:
- `RPC_URL` - Ethereum RPC endpoint
- `CHAIN_ID` - Network chain ID
- `EIP712_VERIFYING_CONTRACT` - Contract address for signatures
- `CREDENTIAL_REGISTRY_ADDRESS` - CredentialRegistry contract
- `REVOCATION_REGISTRY_ADDRESS` - RevocationRegistry contract

## API Endpoints

### Core Endpoints

#### `POST /prepare`
Prepare a credential draft for holder signing.

**Request:**
```json
{
  "credentialSubject": {
    "id": "did:example:holder",
    "name": "Example Holder"
  },
  "credentialSchema": {
    "id": "https://example.com/schemas/credential",
    "type": "JsonSchemaValidator2018"
  }
}
```

**Response:**
```json
{
  "id": "issuance_1234567890_abcdef",
  "token": "jwt-token-here",
  "otp": "123456",
  "downloadLink": "http://localhost:3001/tmp-filestore/issuances/issuance_..."
}
```

#### `POST /mint`
Mint the credential on-chain after holder signature.

**Request:**
```json
{
  "issuanceId": "issuance_1234567890_abcdef",
  "holderSignature": "0x..."
}
```

### File Storage Endpoints

#### `GET /tmp-filestore/issuances/:id`
Retrieve credential draft by issuance ID.

#### `GET /tmp-filestore/vcs/:id`
Retrieve final signed credential.

### Health Check

#### `GET /health`
Service health check endpoint.

## Development

### Build

```bash
# From this directory
pnpm build

# From project root
pnpm --filter @circuloos/issuer build
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

- [ ] Generate secure `ISSUER_PRIVATE_KEY` (store in secret manager)
- [ ] Generate secure `ISSUER_HMAC_SECRET`: `openssl rand -hex 32`
- [ ] Generate secure `JWT_SECRET`: `openssl rand -hex 32`
- [ ] Set `DOWNLOAD_LINK_BASE_URL` to public domain
- [ ] Update `CORS_ALLOWED_ORIGINS` to production domains only
- [ ] Use absolute paths for `FILESTORE_BASE_DIR`
- [ ] Consider database for `ISSUANCE_AUDIT_PATH`
- [ ] Set `SWAGGER_ENABLED=false` or add authentication
- [ ] Configure proper `NODE_ENV=production` in `.env.shared`
- [ ] Use managed RPC provider (not local Hardhat)
- [ ] Deploy smart contracts and update addresses in `.env.shared`

### Docker Production

```bash
# Build image
docker build -t circuloos-issuer -f Dockerfile ../..

# Run with production env
docker run --env-file .env.production -p 3001:3001 circuloos-issuer
```

### Independent Deployment

The issuer can be deployed independently of other services:

```bash
cd apps/issuer
docker build -t circuloos-issuer .
docker run --env-file .env.production circuloos-issuer
```

Just ensure:
1. `.env.shared` variables are available (blockchain config)
2. Service-specific `.env` is configured
3. RPC_URL points to accessible blockchain node
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
apps/issuer/
├── src/
│   ├── index.ts           # Main entry point & routes
│   └── ...                # Service logic
├── .env.example           # Environment template
├── .env                   # Local environment (gitignored)
├── Dockerfile             # Docker image definition
├── package.json           # Dependencies & scripts
└── README.md              # This file
```

## Email Testing

The issuer sends emails with OTP codes for credential claiming. For testing without external email services:

### Option 1: EmailMock (Default)

The system uses `EmailMock` by default, which stores emails in memory.

**View sent emails:**
```bash
# API endpoint
curl http://localhost:3001/playground/emails

# Or via Swagger UI
open http://localhost:3001/docs
```

**Clear inbox:**
```bash
curl -X DELETE http://localhost:3001/playground/emails
```

### Option 2: Mailpit (SMTP Server with Web UI)

For a more realistic testing experience with a real SMTP server:

1. Start Mailpit:
   ```bash
   docker compose --profile email-testing up -d mailpit
   ```

2. Access web UI: http://localhost:8025

3. Configure SMTP in `.env`:
   ```bash
   SMTP_HOST=mailpit  # or localhost for local dev
   SMTP_PORT=1025
   SMTP_SECURE=false
   EMAIL_FROM=noreply@alastria.test
   ```

See [EMAIL_TESTING.md](../../docs/EMAIL_TESTING.md) for complete documentation.

## Troubleshooting

### Empty API Responses

If endpoints return `{}` instead of data:
- Rebuild Docker image: `pnpm docker:build`
- Check Fastify schema has `additionalProperties: true`

### CORS Errors

Check `CORS_ALLOWED_ORIGINS` includes the frontend URL.

### Contract Call Failures

- Verify `RPC_URL` in `.env.shared` is accessible
- Check contract addresses are correct
- Ensure `ISSUER_PRIVATE_KEY` has gas for transactions

### Email Not Received

- Check `/playground/emails` endpoint if using EmailMock
- Verify Mailpit is running: `docker compose ps mailpit`
- Check issuer logs: `docker compose logs issuer`
- Review `TRUSTED_ISSUER_REGISTRY_ADDRESS` (disable if not deployed)

### OTP Failures

- Check `ISSUER_HMAC_SECRET` matches between prepare and mint
- Verify `OTP_EXPIRY_SECONDS` hasn't been exceeded

## Documentation

- **API Docs**: http://localhost:3001/docs (when running)
- **Best Practices**: `/docs/BEST-PRACTICES.md`
- **Docker Setup**: `/docs/docker/README.md`
- **Project Root**: `/README.md`

## Support

For issues or questions:
1. Check this README
2. Review `/docs/BEST-PRACTICES.md`
3. Check logs: `pnpm docker:logs:issuer`
4. Verify environment configuration

---

**Service**: Circuloos Issuer API
**Port**: 3001
**Health**: http://localhost:3001/health
**Docs**: http://localhost:3001/docs
