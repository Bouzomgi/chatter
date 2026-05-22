# Chatter2 — Build Plan

High-level phases in order. Each phase should be fully working before moving to the next.

CI/CD is prioritized — infrastructure is wired up against a minimal app first, so every feature
built afterward ships through the real pipeline automatically.

---

## Phase 1 — Monorepo Scaffold

- Initialize the monorepo (npm workspaces or pnpm workspaces)
- Create `packages/client`, `packages/server`, `packages/shared`
- Configure TypeScript across all three packages with shared base `tsconfig`
- Set up ESLint + Prettier
- Set up Vitest across all packages (shared test config)
- Set up Playwright for E2E in a `packages/e2e` package
- Verify that `shared` types can be imported in both `client` and `server`

---

## Phase 2 — Minimal Deployable Server

- Stub `packages/server` with a single `GET /health` endpoint returning `200 OK`
- Stub `packages/client` with a single static HTML page ("coming soon")
- Multi-stage `Dockerfile`: build → production, serves static client from Node
- Verify the image builds and runs locally

---

## Phase 3 — Red-Black Deploy Infrastructure (Pi)

- `docker-compose.yml`: `red` service, `black` service, `postgres`, `nginx`
- Red and black on different internal ports; nginx proxies to the active one
- `docker/nginx/nginx.conf`: upstream blocks for red and black
- `docker/deploy.sh`: detect active color → bring up inactive → health check → switch nginx upstream (`nginx -s reload`) → stop old color
- Test the full cutover manually on the Pi with the stub server
- Confirm zero downtime during the switch

---

## Phase 4 — CI/CD Pipeline

- GitHub Actions workflow:
  - **All branches:** unit tests → integration tests (real Postgres via Actions service container)
  - **`main` only:** unit tests → integration tests → E2E tests (Playwright against Docker Compose) → build ARM64 image → push to `ghcr.io` → SSH into Pi → run `deploy.sh`
- Deploy only runs if all tests pass
- Store Pi SSH key and registry credentials in GitHub Actions secrets
- Test a full end-to-end deploy from a `git push` — stub server goes live on the Pi

---

## Phase 5 — Cloudflare Tunnel + Domain

- Install and configure `cloudflared` on the Pi as a systemd service
- Create a Cloudflare Tunnel routing the domain to the local nginx port
- Verify HTTPS is handled by Cloudflare (no cert management needed on Pi)
- Smoke test: push a change to `main`, confirm it appears at the live domain

**At this point the pipeline is fully operational. All subsequent phases ship automatically.**

---

## Phase 6 — Database

- Add Postgres to `docker-compose.yml` (already stubbed, now properly configured)
- Define Prisma schema: `User`, `Conversation`, `Participant`, `Message`
- Run initial migration
- Seed script with a couple of test users and a conversation
- Add a migration step to `deploy.sh` (`prisma migrate deploy` before cutover)

---

## Phase 7 — Auth (Backend)

- `POST /auth/register` — create user, hash password with bcrypt, return JWT
- `POST /auth/login` — verify credentials, return JWT in httpOnly cookie
- `POST /auth/logout` — clear cookie
- Auth middleware that protects subsequent routes
- Basic input validation

---

## Phase 8 — Users & Conversations (Backend REST)

- `POST /conversations` — create a new 1-on-1 conversation (idempotent — return existing if already exists)
- `GET /conversations` — list all conversations for current user with latest message preview

---

## Phase 9 — Real-time Messaging (Backend WebSocket)

- Integrate Socket.io into the Express server
- On connect: authenticate via JWT, join rooms for all user's conversations
- Event `message:send` → persist to DB → emit `message:new` to room
- Handle disconnect gracefully

---

## Phase 10 — Frontend Scaffold

- Set up Vite + React + TypeScript in `packages/client`
- Install Tailwind CSS
- Set up React Router: routes for `/login`, `/register`, `/` (chat)
- API client utility (wraps fetch, handles auth errors)
- Socket.io client setup

---

## Phase 11 — Auth UI

- Register screen
- Login screen
- Redirect to chat on success, redirect to login on 401
- Store minimal user info in React context (username, id)

---

## Phase 12 — Chat UI

- Sidebar: list of conversations with latest message preview
- Start new conversation: username search → create conversation → open it
- Message thread: scrollable history, auto-scroll to bottom on new message
- Message input: send on Enter, disabled while sending
- Real-time: incoming messages appear instantly via Socket.io
- iMessage-like visual style: bubbles, sent right / received left, timestamps

---

## Done

App is live, deployed, and auto-updating on every push to `main`.
