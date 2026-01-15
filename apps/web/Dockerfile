# ========================================
# Dockerfile for Web (Next.js)
# ========================================
# Multi-stage build optimized for production

# ----------------------------------------
# Stage 1: Dependencies
# ----------------------------------------
FROM node:20-alpine AS deps

# Install pnpm and required system dependencies
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@10.15.0

WORKDIR /app

# Copy workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY libs/common/package.json ./libs/common/
COPY tools/scripts ./tools/scripts

# Install ALL workspace dependencies (NODE_ENV must be development for devDependencies)
ENV NODE_ENV=development
RUN pnpm install
# ----------------------------------------
# Stage 2: Builder
# ----------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat && npm install -g pnpm@10.15.0
WORKDIR /app

# Public variables that Next.js injects during build
ARG NEXT_PUBLIC_ISSUER_URL
ARG NEXT_PUBLIC_VERIFIER_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_EIP712_DOMAIN_NAME
ARG NEXT_PUBLIC_EIP712_DOMAIN_VERSION
ARG NEXT_PUBLIC_EIP712_CHAIN_ID
ARG NEXT_PUBLIC_CHAIN_ID
ARG NEXT_PUBLIC_EIP712_VERIFYING_CONTRACT
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_NETWORK_NAME
ARG NEXT_PUBLIC_DIAMOND_ADDRESS

# Make them visible during build
ENV NEXT_PUBLIC_ISSUER_URL=${NEXT_PUBLIC_ISSUER_URL}
ENV NEXT_PUBLIC_VERIFIER_URL=${NEXT_PUBLIC_VERIFIER_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_EIP712_DOMAIN_NAME=${NEXT_PUBLIC_EIP712_DOMAIN_NAME}
ENV NEXT_PUBLIC_EIP712_DOMAIN_VERSION=${NEXT_PUBLIC_EIP712_DOMAIN_VERSION}
ENV NEXT_PUBLIC_EIP712_CHAIN_ID=${NEXT_PUBLIC_EIP712_CHAIN_ID}
ENV NEXT_PUBLIC_CHAIN_ID=${NEXT_PUBLIC_CHAIN_ID}
ENV NEXT_PUBLIC_EIP712_VERIFYING_CONTRACT=${NEXT_PUBLIC_EIP712_VERIFYING_CONTRACT}
ENV NEXT_PUBLIC_RPC_URL=${NEXT_PUBLIC_RPC_URL}
ENV NEXT_PUBLIC_NETWORK_NAME=${NEXT_PUBLIC_NETWORK_NAME}
ENV NEXT_PUBLIC_DIAMOND_ADDRESS=${NEXT_PUBLIC_DIAMOND_ADDRESS}

# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy libs/common source code
COPY libs/common ./libs/common
# Copy libs/common node_modules from deps
COPY --from=deps /app/libs/common/node_modules ./libs/common/node_modules

# Copy app source code first
COPY apps/web ./apps/web

# Then restore node_modules (source copy overwrites them)
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Build libs/common first (Next.js depends on it)
WORKDIR /app/libs/common
RUN pnpm build

WORKDIR /app/apps/web

# Build the app (use Webpack explicitly)
ENV NEXT_TELEMETRY_DISABLED=1
# Force webpack instead of Turbopack (default in Next.js 16)
RUN pnpm exec next build --webpack

# ----------------------------------------
# Stage 3: Runner (Production)
# ----------------------------------------
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat tini
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 web

# Copy build artifacts
COPY --from=builder --chown=web:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=web:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=web:nodejs /app/apps/web/package.json ./apps/web/package.json
COPY --from=deps    --chown=web:nodejs /app/node_modules ./node_modules
COPY --from=deps    --chown=web:nodejs /app/apps/web/node_modules ./apps/web/node_modules

# Default environment variables
ENV NODE_ENV=production
ENV PORT=3000

USER web
WORKDIR /app/apps/web

EXPOSE 3000

# HTTP Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "http=require('http');req=http.request({method:'GET',host:'127.0.0.1',port:process.env.PORT||3000,path:'/'}, r=>process.exit(r.statusCode<500?0:1));req.on('error',()=>process.exit(1));req.end();" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
# Run Next.js without pnpm at runtime
CMD ["node", "node_modules/next/dist/bin/next", "start"]
