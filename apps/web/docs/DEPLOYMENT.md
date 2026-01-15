# Deployment Guide
## Alastria Verifiable Credentials Frontend

---

## 1. Prerequisites

### Required
- Node.js 20+
- pnpm 9+ (recommended) or npm
- MetaMask browser extension
- Access to Alastria network (Red-T or Red-B)

### Optional
- Docker & Docker Compose
- Vercel account (for cloud deployment)

---

## 2. Environment Configuration

### 2.1 Environment Files

El proyecto incluye tres archivos de entorno:

| File | Purpose |
|------|---------|
| `.env` | Base configuration (committed) |
| `.env.local` | Local development overrides |
| `.env.docker` | Docker Compose configuration |

### 2.2 Required Variables

\`\`\`env
# API Endpoints
NEXT_PUBLIC_ISSUER_API_URL=http://localhost:4000
NEXT_PUBLIC_VERIFIER_API_URL=http://localhost:5000

# Blockchain Configuration
NEXT_PUBLIC_CHAIN_ID=83584648538
NEXT_PUBLIC_RPC_URL=https://red-t.alastria.io/v0/9461d9f4292b41230002cc5d
NEXT_PUBLIC_DIAMOND_ADDRESS=0x...

# MetaMask Snap
NEXT_PUBLIC_SNAP_ID=npm:@aspect-vc/circuloos-snap
NEXT_PUBLIC_SNAP_VERSION=^1.0.0

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

### 2.3 Network Configurations

**Alastria Red-T (Testnet)**
\`\`\`env
NEXT_PUBLIC_CHAIN_ID=83584648538
NEXT_PUBLIC_RPC_URL=https://red-t.alastria.io/v0/9461d9f4292b41230002cc5d
NEXT_PUBLIC_NETWORK_NAME=Alastria Red-T
NEXT_PUBLIC_BLOCK_EXPLORER=https://explorer.red-t.alastria.io
\`\`\`

**Alastria Red-B (Production)**
\`\`\`env
NEXT_PUBLIC_CHAIN_ID=2020
NEXT_PUBLIC_RPC_URL=https://red-b.alastria.io/v0/...
NEXT_PUBLIC_NETWORK_NAME=Alastria Red-B
NEXT_PUBLIC_BLOCK_EXPLORER=https://explorer.red-b.alastria.io
\`\`\`

**Local Hardhat**
\`\`\`env
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_NETWORK_NAME=Hardhat Local
\`\`\`

---

## 3. Local Development

### 3.1 Installation

\`\`\`bash
# Clone repository
git clone https://github.com/alastria/vc-frontend.git
cd vc-frontend

# Install dependencies
pnpm install

# Copy environment file
cp .env .env.local

# Edit .env.local with your configuration
nano .env.local
\`\`\`

### 3.2 Start Development Server

\`\`\`bash
# Start Next.js dev server
pnpm dev

# Open browser
open http://localhost:3000
\`\`\`

### 3.3 With Backend Services

\`\`\`bash
# Terminal 1: Start Issuer API
cd ../issuer-api
pnpm dev

# Terminal 2: Start Verifier API
cd ../verifier-api
pnpm dev

# Terminal 3: Start Hardhat node
cd ../smart-contracts
npx hardhat node

# Terminal 4: Start Frontend
cd ../vc-frontend
pnpm dev
\`\`\`

---

## 4. Docker Deployment

### 4.1 Dockerfile

\`\`\`dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
\`\`\`

### 4.2 Docker Compose

\`\`\`yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    env_file:
      - .env.docker
    depends_on:
      - issuer-api
      - verifier-api
    networks:
      - alastria-network

  issuer-api:
    image: alastria/issuer-api:latest
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://...
      - BLOCKCHAIN_RPC_URL=${NEXT_PUBLIC_RPC_URL}
    networks:
      - alastria-network

  verifier-api:
    image: alastria/verifier-api:latest
    ports:
      - "5000:5000"
    environment:
      - BLOCKCHAIN_RPC_URL=${NEXT_PUBLIC_RPC_URL}
    networks:
      - alastria-network

networks:
  alastria-network:
    driver: bridge
\`\`\`

### 4.3 Build & Run

\`\`\`bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f frontend

# Stop services
docker-compose down
\`\`\`

---

## 5. Vercel Deployment

### 5.1 Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Import Git Repository
3. Select `alastria/vc-frontend`
4. Configure project settings

### 5.2 Environment Variables

Add in Vercel Dashboard → Settings → Environment Variables:

\`\`\`
NEXT_PUBLIC_ISSUER_API_URL=https://issuer-api.alastria.io
NEXT_PUBLIC_VERIFIER_API_URL=https://verifier-api.alastria.io
NEXT_PUBLIC_CHAIN_ID=2020
NEXT_PUBLIC_RPC_URL=https://red-b.alastria.io/v0/...
NEXT_PUBLIC_DIAMOND_ADDRESS=0x...
NEXT_PUBLIC_SNAP_ID=npm:@aspect-vc/circuloos-snap
NEXT_PUBLIC_APP_URL=https://vc.alastria.io
\`\`\`

### 5.3 Deploy

\`\`\`bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
\`\`\`

### 5.4 Custom Domain

1. Go to Vercel Dashboard → Domains
2. Add domain: `vc.alastria.io`
3. Configure DNS records:
   - `A` record → Vercel IP
   - `CNAME` record → `cname.vercel-dns.com`

---

## 6. Nginx Configuration

For self-hosted deployments behind Nginx:

\`\`\`nginx
server {
    listen 80;
    server_name vc.alastria.io;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vc.alastria.io;

    ssl_certificate /etc/letsencrypt/live/vc.alastria.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vc.alastria.io/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`

---

## 7. Health Checks

### 7.1 Application Health

\`\`\`bash
# Check frontend
curl -I https://vc.alastria.io

# Check API connectivity
curl https://vc.alastria.io/api/health
\`\`\`

### 7.2 Monitoring

Recommended monitoring setup:

- **Uptime**: Vercel Analytics or UptimeRobot
- **Errors**: Sentry integration
- **Performance**: Vercel Speed Insights
- **Logs**: Vercel Logs or Datadog

---

## 8. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Wallet not connecting | Check MetaMask is installed and unlocked |
| Wrong network | Switch MetaMask to Alastria network |
| API errors | Verify API URLs in environment variables |
| Build fails | Clear `.next` folder and `node_modules` |
| Snap not installing | Update MetaMask to latest version |

### Debug Mode

\`\`\`bash
# Enable debug logging
DEBUG=* pnpm dev

# Check browser console for [v0] logs
\`\`\`

---

## 9. Security Checklist

- [ ] Environment variables not exposed in client bundle
- [ ] HTTPS enabled in production
- [ ] CORS configured on APIs
- [ ] Rate limiting on API routes
- [ ] CSP headers configured
- [ ] Authorized wallets list reviewed
- [ ] Smart contract addresses verified
