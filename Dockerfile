FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

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

# --- Production stage ---
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --filter @chatter/server --prod
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/client/dist packages/client/dist
EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
