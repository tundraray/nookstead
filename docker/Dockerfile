# =============================================================
# Unified multi-stage Dockerfile
# Build: docker build --target <server|game|steward|genmap> .
# =============================================================

# ── Stage 1: Install dependencies (shared, cached by lockfile) ──
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/game/package.json apps/game/
COPY apps/genmap/package.json apps/genmap/
COPY apps/steward/package.json apps/steward/
COPY packages/db/package.json packages/db/
COPY packages/map-lib/package.json packages/map-lib/
COPY packages/map-renderer/package.json packages/map-renderer/
COPY packages/s3/package.json packages/s3/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build all projects (shared across targets) ──
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
WORKDIR /app

COPY --from=deps /root/.local/share/pnpm/store /root/.local/share/pnpm/store
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm nx sync
RUN pnpm nx build server --configuration=production --skip-nx-cache && \
    pnpm nx build game --skip-nx-cache && \
    pnpm nx build genmap --skip-nx-cache && \
    pnpm nx build steward --skip-nx-cache

# ── Target: server (Colyseus game server) ──
FROM node:20-alpine AS server

RUN addgroup --system --gid 1001 nookstead && \
    adduser --system --uid 1001 nookstead
WORKDIR /app

COPY --from=builder --chown=nookstead:nookstead /app/dist/apps/server ./

USER nookstead

ENV NODE_ENV=production
EXPOSE 2567

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:2567/health || exit 1

CMD ["node", "main.mjs"]

# ── Target: game (Next.js web client) ──
FROM node:20-alpine AS game

RUN addgroup --system --gid 1001 nookstead && \
    adduser --system --uid 1001 nookstead
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/game/public ./apps/game/public
COPY --from=builder --chown=nookstead:nookstead /app/apps/game/.next/standalone ./
COPY --from=builder --chown=nookstead:nookstead /app/apps/game/.next/static ./apps/game/.next/static

USER nookstead

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "apps/game/server.js"]

# ── Target: steward (background worker — NPC reflections, scheduled tasks) ──
FROM node:20-alpine AS steward

RUN addgroup --system --gid 1001 nookstead && \
    adduser --system --uid 1001 nookstead
WORKDIR /app

COPY --from=builder --chown=nookstead:nookstead /app/apps/steward/dist ./

USER nookstead

ENV NODE_ENV=production

CMD ["node", "main.js"]

# ── Target: genmap (map generation service) ──
FROM node:20-alpine AS genmap

RUN addgroup --system --gid 1001 nookstead && \
    adduser --system --uid 1001 nookstead
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/genmap/public ./apps/genmap/public
COPY --from=builder --chown=nookstead:nookstead /app/apps/genmap/.next/standalone ./
COPY --from=builder --chown=nookstead:nookstead /app/apps/genmap/.next/static ./apps/genmap/.next/static

USER nookstead

EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

CMD ["node", "apps/genmap/server.js"]
