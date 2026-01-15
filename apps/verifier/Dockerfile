# ========================================
# Dockerfile for Verifier Service
# ========================================
# Multi-stage build optimized for production

# ----------------------------------------
# Stage 1: Dependencies
# ----------------------------------------
FROM node:20-slim AS deps

# Install pnpm and required system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.15.0

WORKDIR /app

# Copy workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY libs/common/package.json ./libs/common/
COPY libs/file-store/package.json ./libs/file-store/
COPY libs/test-utils/package.json ./libs/test-utils/
COPY apps/verifier/package.json ./apps/verifier/
COPY tools/scripts ./tools/scripts

# Install ALL workspace dependencies (NODE_ENV must be development for devDependencies)
ENV NODE_ENV=development
RUN pnpm install

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
COPY --from=deps /app/libs/test-utils/node_modules ./libs/test-utils/node_modules
COPY --from=deps /app/apps/verifier/node_modules ./apps/verifier/node_modules

# Copy full source code
COPY libs/common ./libs/common
COPY libs/file-store ./libs/file-store
COPY libs/test-utils ./libs/test-utils
COPY apps/contracts/abi ./apps/contracts/abi
COPY apps/verifier ./apps/verifier

# Restore node_modules after source copy
COPY --from=deps /app/libs/common/node_modules ./libs/common/node_modules
COPY --from=deps /app/libs/file-store/node_modules ./libs/file-store/node_modules
COPY --from=deps /app/libs/test-utils/node_modules ./libs/test-utils/node_modules
COPY --from=deps /app/apps/verifier/node_modules ./apps/verifier/node_modules

# Build packages and app
WORKDIR /app/libs/common
RUN pnpm build

WORKDIR /app/libs/file-store
RUN pnpm build

WORKDIR /app/libs/test-utils
RUN pnpm build || true

WORKDIR /app/apps/verifier
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
  adduser --system --uid 1001 verifier

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/verifier/node_modules ./apps/verifier/node_modules
COPY --from=deps /app/libs/common/node_modules ./libs/common/node_modules
COPY --from=deps /app/libs/file-store/node_modules ./libs/file-store/node_modules

# Copy builds
COPY --from=builder --chown=verifier:nodejs /app/libs/common/dist ./libs/common/dist
COPY --from=builder --chown=verifier:nodejs /app/libs/common/package.json ./libs/common/
COPY --from=builder --chown=verifier:nodejs /app/libs/file-store/dist ./libs/file-store/dist
COPY --from=builder --chown=verifier:nodejs /app/libs/file-store/package.json ./libs/file-store/
COPY --from=builder --chown=verifier:nodejs /app/libs/test-utils/package.json ./libs/test-utils/
COPY --from=builder --chown=verifier:nodejs /app/apps/contracts/abi ./apps/verifier/abi
COPY --from=builder --chown=verifier:nodejs /app/apps/verifier/dist ./apps/verifier/dist
COPY --from=builder --chown=verifier:nodejs /app/apps/verifier/package.json ./apps/verifier/
COPY --from=builder --chown=verifier:nodejs /app/apps/verifier/scripts ./apps/verifier/scripts

# Create directories for filestore and data
RUN mkdir -p /app/apps/verifier/tmp-filestore && \
  mkdir -p /app/apps/verifier/data && \
  chown -R verifier:nodejs /app/apps/verifier/tmp-filestore && \
  chown -R verifier:nodejs /app/apps/verifier/data

# Default environment variables
ENV NODE_ENV=production
ENV HTTP_HOST=0.0.0.0
ENV HTTP_PORT=4001
ENV VERIFIER_PORT=4001

# Switch to non-root user
USER verifier

WORKDIR /app/apps/verifier

# Expose port
EXPOSE 4001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node scripts/docker/healthcheck.js || exit 1

# Use tini as init system
ENTRYPOINT ["/usr/bin/tini", "--"]

# Default command
CMD ["node", "dist/index.js"]
