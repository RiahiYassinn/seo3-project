# syntax=docker/dockerfile:1
#
# Build context is the REPOSITORY ROOT, not this directory:
#   docker build -f client/web/Dockerfile -t devlab/web-client .
#
# Relies on `output: 'standalone'` in next.config.js, which bundles the server
# and only the traced runtime dependencies.

FROM node:20-alpine AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false

# ---------- dependencies ----------
FROM base AS deps

COPY package.json package-lock.json ./
COPY api-gateway/package.json api-gateway/
COPY client/web/package.json client/web/
COPY services/analysis-service/package.json services/analysis-service/
COPY services/developer-service/package.json services/developer-service/
COPY services/nlp-service/package.json services/nlp-service/
COPY services/notification-service/package.json services/notification-service/
COPY services/recommendation-service/package.json services/recommendation-service/
COPY services/skill-service/package.json services/skill-service/
COPY shared/types/package.json shared/types/
COPY shared/utils/package.json shared/utils/

# Native addons (e.g. bcrypt) have no musl prebuilds and must compile here.
RUN apk add --no-cache python3 make g++

# Install scripts must run so those addons actually get built.
RUN npm ci

# ---------- build ----------
FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# have to be build args -- setting them at runtime does not reach the browser.
# The app reads both spellings (lib/api.ts vs lib/auth.ts); keep them equal.
# This is the gateway's PUBLISHED host port, since the browser dials it.
ARG NEXT_PUBLIC_API_GATEWAY=http://localhost:3000
ARG NEXT_PUBLIC_API_GATEWAY_URL=$NEXT_PUBLIC_API_GATEWAY
ENV NEXT_PUBLIC_API_GATEWAY=$NEXT_PUBLIC_API_GATEWAY \
    NEXT_PUBLIC_API_GATEWAY_URL=$NEXT_PUBLIC_API_GATEWAY_URL

COPY turbo.json ./
COPY shared/ shared/
COPY client/web/ client/web/
RUN npx turbo run build --filter=nextjs

# ---------- runtime ----------
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Tracing starts at the monorepo root, so the bundle keeps that layout:
# hoisted node_modules at /app plus the app itself under /app/client/web.
COPY --from=builder --chown=nextjs:nodejs /app/client/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/client/web/.next/static ./client/web/.next/static

# Ensure the destination directory exists and safely copy public assets if present
RUN mkdir -p ./client/web/public
COPY --from=builder --chown=nextjs:nodejs /app/client/web/public* ./client/web/public/

USER nextjs
WORKDIR /app/client/web

EXPOSE 3000
CMD ["node", "server.js"]