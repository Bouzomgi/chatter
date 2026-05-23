FROM node:20-alpine AS base
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@9.15.4 --activate

# --- Builder stage ---
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY packages/e2e/package.json packages/e2e/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @chatter/client build
RUN pnpm --filter @chatter/server build

# --- Server production stage ---
FROM base AS server-production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --filter @chatter/server --prod
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/client/dist packages/client/dist
COPY packages/server/prisma packages/server/prisma
RUN pnpm --filter @chatter/server exec prisma generate
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @chatter/server exec prisma migrate deploy && if [ \"$SEED\" = \"true\" ]; then node packages/server/dist/seed.js; fi && node packages/server/dist/index.js"]

# --- Nginx production stage ---
FROM nginx:alpine AS nginx-production
COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf.template
COPY docker/nginx/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
