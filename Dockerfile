# syntax=docker/dockerfile:1

# ── Base ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
# libc6-compat: some Node native addons expect glibc on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Builder ───────────────────────────────────────────────────────────────
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# lib/db.ts connects lazily, so DATABASE_URL is NOT required at build time.
RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone server + assets (server.js reads .next/static and public itself).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migrations run on start via scripts/migrate.mjs. The standalone bundle only
# traces what the app imports, so the drizzle-orm migrator isn't included —
# copy the full package (superset of what's already there) plus the SQL files.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

USER nextjs
EXPOSE 3000

# Coolify reads this container-level probe. start-period covers migrate + boot.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# SKIP_MIGRATIONS=true boots without touching the schema (e.g. several replicas).
CMD ["sh", "-c", "if [ \"$SKIP_MIGRATIONS\" = \"true\" ]; then node server.js; else node scripts/migrate.mjs && node server.js; fi"]
