# FlowTrace Server - Multi-stage Dockerfile
# @requirements 9.3 - Produce a Docker-compatible deployment artifact

# ============================================================================
# Stage 1: Base image with pnpm
# ============================================================================
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

# Set working directory
WORKDIR /app

# ============================================================================
# Stage 2: Install dependencies
# ============================================================================
FROM base AS deps

# Copy workspace configuration files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json tsconfig.base.json tsconfig.json ./

# Copy all package.json files for dependency resolution
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/cache/package.json ./packages/cache/
COPY packages/storage/package.json ./packages/storage/
COPY apps/server/package.json ./apps/server/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ============================================================================
# Stage 3: Build all packages
# ============================================================================
FROM deps AS builder

# Copy source code
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# Build all packages using Turborepo
RUN pnpm turbo build --filter=@flowtrace/server...

# ============================================================================
# Stage 4: Production image
# ============================================================================
FROM node:20-alpine AS runner

# Install pnpm for production
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 flowtrace

WORKDIR /app

# Copy workspace configuration
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy built packages
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/core/dist ./packages/core/dist

COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/api/dist ./packages/api/dist

COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/db/dist ./packages/db/dist

COPY --from=builder /app/packages/cache/package.json ./packages/cache/
COPY --from=builder /app/packages/cache/dist ./packages/cache/dist

COPY --from=builder /app/packages/storage/package.json ./packages/storage/
COPY --from=builder /app/packages/storage/dist ./packages/storage/dist

COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Create data directory for tick storage
RUN mkdir -p /app/data/ticks && chown -R flowtrace:nodejs /app/data

# Switch to non-root user
USER flowtrace

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV STORAGE_PATH=/app/data/ticks

# Expose API port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/docs || exit 1

# Start the server
CMD ["node", "apps/server/dist/main.js"]
