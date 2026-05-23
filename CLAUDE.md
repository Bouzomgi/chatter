# Chatter2

## Development workflow

`main` is a protected branch — all work must be done on a feature branch and merged via PR.

After implementing a feature, follow this loop until the PR is fully ready:
1. Commit, push, open a PR.
2. Monitor CI with `/loop` — after every push re-check `gh pr checks <n>` until the run passes.
3. Validate **every** item in the PR test plan: run Playwright E2E tests (`PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test`) and any manual checks that require a running app. For UI checks, start the Vite dev server (`pnpm vite --port 5173` in `packages/client`) and the server (`JWT_SECRET=dev-secret pnpm exec tsx src/index.ts` in `packages/server`).
4. Check off each passing item in the PR description with `gh pr edit`.
5. If anything fails, fix it, push, and restart the loop from step 2.

Any feature that spans both frontend and backend must include Playwright E2E tests in `packages/e2e/tests/`. Use `getByPlaceholder` for inputs (FormField renders no `<label>`), `getByRole('button')` for the submit arrow.

E2E tests run against production — they must never create or delete data. Use the always-provisioned admin account (`admin@admin.local`, password from `ADMIN_PASSWORD` env var, default `admin123`) wherever a logged-in user is needed. Do not rely on seeded users (alice/bob/carol) — they only exist in local/dev environments.

A personal chat web application modeled on iMessage. Users create accounts and exchange real-time 1-on-1 messages via a browser.

## Product scope (v1)

- 1-on-1 direct messages only (no group chats)
- Full message history, stored indefinitely
- Find other users by username
- Standard security: HTTPS, bcrypt passwords, JWT auth (httpOnly cookies)

## Architecture

Three-tier monolith — one deployable unit, no microservices.

```
Browser (React SPA)
  ↕ REST (HTTP)    — auth, user search, load chat history
  ↕ WebSocket      — real-time message delivery
Node.js + Express + Socket.io
  ↕ SQL (Prisma)
PostgreSQL
```

Real-time flow: client joins a Socket.io room keyed by `conversation_id`. Messages are HTTP POST'd to persist first, then the server emits to the room. On reconnect, the client fetches missed messages via REST.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend | Node.js + TypeScript + Express |
| Real-time | Socket.io |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT (httpOnly cookies) + bcrypt |

## Data model

```
User         — id, username, email, password_hash, created_at
Conversation — id, created_at
Participant  — conversation_id, user_id  (2 rows per 1-on-1 chat)
Message      — id, conversation_id, sender_id, body, created_at
```

## Repository structure

Single monorepo, one deployable unit.

```
chatter2/
  packages/
    client/       — React app (static files served by Node in prod)
    server/       — Node/Express + Socket.io
    shared/       — TypeScript types shared between client and server
  docker/
    nginx/        — nginx.conf with red/black upstream config
    deploy.sh     — color-swap deploy script (runs on Pi)
  docker-compose.yml
  .github/
    workflows/
      deploy.yml
```

## Deployment

**Hardware:** Raspberry Pi 4 (2GB RAM)
**Exposure:** Cloudflare Tunnel → no router port-forwarding, home IP stays private
**Domain:** User-owned domain routed via Cloudflare

### Red-black deployments

Zero-downtime deploys via two app server slots sharing one Postgres instance.

```
Internet → Cloudflare Tunnel → Nginx → [Red | Black] Node.js → Postgres
```

Nginx holds the traffic switch. Deploy script logic (runs on Pi):
1. Pull new image from ghcr.io
2. Detect inactive color
3. Start inactive color with new image, wait for health check
4. Rewrite nginx upstream → `nginx -s reload` (zero downtime)
5. Stop old color

### CI/CD pipeline (GitHub Actions)

```
git push main
  → run tests
  → build Docker image (linux/arm64 via QEMU)
  → push to GitHub Container Registry (ghcr.io, free)
  → SSH into Pi → run deploy.sh
```

Note: ARM64 cross-compilation via QEMU on GitHub's x86 runners is slow (~5-10 min for a Node build). Acceptable tradeoff for keeping CI free and hardware-independent.

### Cost

~$1-2/month electricity. No cloud compute costs.
