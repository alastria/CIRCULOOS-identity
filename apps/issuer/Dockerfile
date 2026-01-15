# ========================================
# Dockerfile for Issuer Service
# ========================================
# Multi-stage build optimized for production

# ----------------------------------------
# Stage 1: Dependencies
# ----------------------------------------
FROM node:20-slim AS deps

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.15.0

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY libs/common/package.json ./libs/common/
COPY libs/file-store/package.json ./libs/file-store/
COPY apps/issuer/package.json ./apps/issuer/
COPY tools/scripts ./tools/scripts

# Install ALL workspace dependencies (NODE_ENV must be development for devDependencies)
ENV NODE_ENV=development
RUN pnpm install

# Rebuild better-sqlite3 to ensure native bindings are correct for this platform
RUN cd /app/libs/common && pnpm rebuild better-sqlite3
RUN cd /app/apps/issuer && pnpm rebuild better-sqlite3

# ----------------------------------------
# Stage 2: Builder
# ----------------------------------------
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.15.0

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/libs/common/node_modules ./libs/common/node_modules
COPY --from=deps /app/libs/file-store/node_modules ./libs/file-store/node_modules
COPY --from=deps /app/apps/issuer/node_modules ./apps/issuer/node_modules

# Copy full source code
COPY libs/common ./libs/common
COPY libs/file-store ./libs/file-store
COPY apps/contracts/abi ./apps/contracts/abi
COPY apps/issuer ./apps/issuer

# Restore node_modules after source copy (source copy may have overwritten them)
COPY --from=deps /app/libs/common/node_modules ./libs/common/node_modules
COPY --from=deps /app/libs/file-store/node_modules ./libs/file-store/node_modules
COPY --from=deps /app/apps/issuer/node_modules ./apps/issuer/node_modules

# Build packages and app
WORKDIR /app/libs/common
RUN pnpm build

WORKDIR /app/libs/file-store
RUN pnpm build

WORKDIR /app/apps/issuer
RUN pnpm build

# ----------------------------------------
# Stage 3: Runner (Production)
# ----------------------------------------
FROM node:20-slim AS runner

# Install minimal runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
  tini \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.15.0

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 issuer

# Copy production dependencies (from builder, not deps, to include compiled binaries)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/issuer/node_modules ./apps/issuer/node_modules
COPY --from=builder /app/libs/common/node_modules ./libs/common/node_modules
COPY --from=builder /app/libs/file-store/node_modules ./libs/file-store/node_modules

# Copy builds
COPY --from=builder --chown=issuer:nodejs /app/libs/common/dist ./libs/common/dist
COPY --from=builder --chown=issuer:nodejs /app/libs/common/package.json ./libs/common/
COPY --from=builder --chown=issuer:nodejs /app/libs/file-store/dist ./libs/file-store/dist
COPY --from=builder --chown=issuer:nodejs /app/libs/file-store/package.json ./libs/file-store/
COPY --from=builder --chown=issuer:nodejs /app/apps/contracts/abi ./apps/issuer/abi
COPY --from=builder --chown=issuer:nodejs /app/apps/issuer/dist ./apps/issuer/dist
COPY --from=builder --chown=issuer:nodejs /app/apps/issuer/package.json ./apps/issuer/
COPY --from=builder --chown=issuer:nodejs /app/apps/issuer/scripts ./apps/issuer/scripts

# Create directories for filestore and data
RUN mkdir -p /app/apps/issuer/tmp-filestore && \
  mkdir -p /app/apps/issuer/data && \
  chown -R issuer:nodejs /app/apps/issuer/tmp-filestore && \
  chown -R issuer:nodejs /app/apps/issuer/data

# Default environment variables
ENV NODE_ENV=production
ENV HTTP_HOST=0.0.0.0
ENV HTTP_PORT=3001
ENV ISSUER_PORT=3001

# Switch to non-root user
USER issuer

WORKDIR /app/apps/issuer

# Expose port
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node scripts/docker/healthcheck.js || exit 1

# Use tini as init system
ENTRYPOINT ["/usr/bin/tini", "--"]

# Default command
CMD ["node", "dist/index.js"]
