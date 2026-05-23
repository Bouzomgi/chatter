# Chatter

## Development workflow

`main` is a protected branch — all work must be done on a feature branch and merged via PR.

After implementing a feature, follow this loop until the PR is fully ready:

1. Commit, push, open a PR.
2. Monitor CI with `/loop` — after every push re-check `gh pr checks <n>` until the run passes. Once it passes, stop checking.
3. Validate **every** item in the PR test plan yourself before rebuilding Docker — do not ask the user to do this. For API/data ACs, use `curl`. For UI ACs, start the Vite dev server (`pnpm vite --port 5173` in `packages/client`) and the server (`JWT_SECRET=dev-secret pnpm exec tsx src/index.ts` in `packages/server`) and use Playwright or a headless browser. E2E tests are run automatically by CI — do not re-run them locally.
4. Start the dev servers so the user can visually confirm the feature at `http://localhost:5173`:
   - Server: `JWT_SECRET=dev-secret pnpm exec tsx src/index.ts` in `packages/server`
   - Client: `pnpm vite --port 5173` in `packages/client`
   - Vite hot-reloads on save. Restart the server manually if backend files changed.
   - Admin credentials (local DB): email `a`, password `a`.
   - Only rebuild Docker (`docker compose build red nginx 2>&1 | tail -5 && docker compose up -d`) when explicitly asked. Docker is for production validation, not day-to-day review.
5. Check off each passing item in the PR description with `gh pr edit`.
6. If anything fails, fix it and validate with the local dev server before rebuilding Docker again. Push and restart from step 2.

Any feature that spans both frontend and backend must include Playwright E2E tests in `packages/e2e/tests/`. Use `getByPlaceholder` for inputs (FormField renders no `<label>`), `getByRole('button')` for the submit arrow.

E2E tests run against production — they must never create or delete data. Use the always-provisioned admin account (email from `ADMIN_EMAIL` env var, password from `ADMIN_PASSWORD` env var, default `admin123`) wherever a logged-in user is needed. Do not rely on seeded users (alice/bob/carol) — they only exist in local/dev environments.

