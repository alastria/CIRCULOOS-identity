# ========================================
# Dockerfile for Hardhat Node (Local Blockchain)
# ========================================
# Simplified build - install deps directly in container

FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm@10.15.0

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 hardhat

# Copy workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tools/scripts/core/check-pnpm.js ./tools/scripts/core/

# Copy source code first (excluding node_modules via .dockerignore or using rsync)
COPY apps/contracts/package.json ./apps/contracts/
COPY apps/contracts/hardhat.config.ts ./apps/contracts/
COPY apps/contracts/tsconfig.json ./apps/contracts/
COPY apps/contracts/contracts ./apps/contracts/contracts
COPY apps/contracts/scripts ./apps/contracts/scripts

# Install ALL workspace dependencies (NODE_ENV must be development for devDependencies)
ENV NODE_ENV=development
RUN pnpm install

# Change ownership
RUN chown -R hardhat:nodejs /app/apps/contracts

# Default environment variables
ENV NODE_ENV=development
ENV HTTP_HOST=0.0.0.0
ENV RPC_PORT=8545

# Change to contracts directory
WORKDIR /app/apps/contracts

# Switch to non-root user
USER hardhat

# Expose RPC port
EXPOSE 8545

# Healthcheck (RPC functional check)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node scripts/docker/healthcheck.mjs || exit 1

# Default command - run hardhat with shell
CMD /bin/sh -c "./node_modules/.bin/hardhat node --hostname 0.0.0.0 --port 8545"
