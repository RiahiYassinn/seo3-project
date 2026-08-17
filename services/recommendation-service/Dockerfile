# syntax=docker/dockerfile:1
#
# Build context is the REPOSITORY ROOT, not this directory:
#   docker build -f services/recommendation-service/Dockerfile -t devlab/recommendation-service .
#
# The repo is an npm-workspaces monorepo with a single root package-lock.json,
# so `npm ci` can only run from the root with every workspace manifest present.

FROM node:20-alpine AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false

# ---------- dependencies ----------
FROM base AS deps

# Only the manifests, so this layer caches until a dependency actually changes.
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
COPY turbo.json ./
COPY services/recommendation-service/ services/recommendation-service/
RUN npx turbo run build --filter=recommendation-service

# ---------- production dependencies ----------
# Rebuilt from the same lockfile but scoped to this one workspace and without
# dev dependencies, so the runtime image does not carry the whole monorepo.
FROM deps AS prod-deps
RUN npm ci --omit=dev \
      --workspace=recommendation-service --include-workspace-root

# ---------- runtime ----------
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
      && adduser --system --uid 1001 nestjs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/services/recommendation-service/package.json ./services/recommendation-service/package.json
COPY --from=builder --chown=nestjs:nodejs /app/services/recommendation-service/dist ./services/recommendation-service/dist

USER nestjs
WORKDIR /app/services/recommendation-service

EXPOSE 3004
CMD ["node", "dist/main.js"]
