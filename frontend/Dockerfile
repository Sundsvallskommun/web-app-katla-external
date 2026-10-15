# Install dependencies only when needed
ARG NODE_VERSION=22.18.0
ARG YARN_VERSION=1.22.22
FROM node:${NODE_VERSION}-alpine AS build-base
ARG YARN_VERSION
RUN test "$(yarn --version)" = "${YARN_VERSION}"

FROM build-base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Rebuild the source code only when needed
FROM build-base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# These values are needed while Next.js creates its standalone bundle. Runtime
# values are supplied separately by Compose for server-side request handling.
ARG NEXT_PUBLIC_APP_NAME=Katla
ARG NEXT_PUBLIC_API_URL
ARG API_URL_INTERNAL
ARG DOMAIN_NAME
ARG NEXT_PUBLIC_BASE_PATH
ARG ADMIN_URL
ARG NEXT_PUBLIC_PROTECTED_ROUTES
ARG NEXT_PUBLIC_INACTIVITY_WARNING_TIMEOUT=1500000
ARG NEXT_PUBLIC_INACTIVITY_COUNTDOWN_TIMEOUT=300000
ARG NEXT_PUBLIC_DRAFT_ERRAND=false
ARG NEXT_PUBLIC_REDUCED_STAKEHOLDER_INFO=true
ARG NEXT_PUBLIC_ERRAND_FILTER=true
ARG NEXT_PUBLIC_DISCLOSURE_DONE_MARK=false
ARG NEXT_PUBLIC_OTHER_PARTIES_DISCLOSURE=false
ARG HEALTH_AUTH=false
ARG HEALTH_USERNAME
ARG HEALTH_PASSWORD

ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

# Production image, copy all the files and run next
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Automatically leverage output traces to reduce image size 
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
