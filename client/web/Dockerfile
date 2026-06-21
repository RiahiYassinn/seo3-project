# Base Node.js image
FROM node:20-alpine AS base

# Dependencies stage
FROM base AS deps
WORKDIR /app

ARG NEXT_PUBLIC_API_GATEWAY=http://localhost:3000
ARG NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_GATEWAY=$NEXT_PUBLIC_API_GATEWAY
ENV NEXT_PUBLIC_API_GATEWAY_URL=$NEXT_PUBLIC_API_GATEWAY_URL

# Copy package files
COPY package*.json ./
RUN npm install

# Build stage
FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_GATEWAY=http://localhost:3000
ARG NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_GATEWAY=$NEXT_PUBLIC_API_GATEWAY
ENV NEXT_PUBLIC_API_GATEWAY_URL=$NEXT_PUBLIC_API_GATEWAY_URL
ENV NEXT_FONT_GOOGLE_MOCKED_RESPONSES=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js application
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
