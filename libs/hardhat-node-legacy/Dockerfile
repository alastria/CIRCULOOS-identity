# ========================================
# Dockerfile para Hardhat Node (Blockchain Local)
# ========================================
# Multi-stage build para optimizar tamaño y seguridad

# ----------------------------------------
# Stage 1: Dependencias
# ----------------------------------------
FROM node:20-alpine AS deps

# Instalar pnpm
RUN npm install -g pnpm@10.15.0

WORKDIR /app

# Copiar archivos de configuración de workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/hardhat-node/package.json ./packages/hardhat-node/
COPY scripts ./scripts

# Instalar solo dependencias de producción
RUN pnpm install --frozen-lockfile --filter @circuloos/hardhat-node

# ----------------------------------------
# Stage 2: Builder
# ----------------------------------------
FROM node:20-alpine AS builder

RUN npm install -g pnpm@10.15.0

WORKDIR /app

# Copiar dependencias del stage anterior
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/hardhat-node/node_modules ./packages/hardhat-node/node_modules

# Copiar código fuente
COPY packages/hardhat-node ./packages/hardhat-node

# ----------------------------------------
# Stage 3: Runner (Producción)
# ----------------------------------------
FROM node:20-alpine AS runner

# Instalar pnpm
RUN npm install -g pnpm@10.15.0

WORKDIR /app

# Crear usuario non-root para seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 hardhat

# Copiar archivos necesarios
COPY --from=builder --chown=hardhat:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=hardhat:nodejs /app/packages/hardhat-node ./packages/hardhat-node

# Variables de entorno por defecto
ENV NODE_ENV=development
ENV HTTP_HOST=0.0.0.0
ENV RPC_PORT=8545

# Cambiar a usuario non-root
USER hardhat

WORKDIR /app/packages/hardhat-node

# Exponer puerto RPC
EXPOSE 8545

# Healthcheck (RPC functional check)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node scripts/docker/healthcheck.mjs || exit 1

# Comando por defecto
CMD ["pnpm", "node"]
