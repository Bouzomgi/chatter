# Chatter2 Codebase Audit

> Reviewed: 2026-05-24

## CI/CD

**P2 — Add ESLint to CI**
TypeCheck catches type errors but not code style issues, unused variables, or common React pitfalls. A lint step would catch real bugs before review.

**P3 — Remove placeholder test files**
`packages/server/src/index.test.ts`, `packages/client/src/main.test.tsx`, and `packages/shared/src/index.test.ts` are 7-line stubs. They add CI noise and create a false sense of coverage. Delete them or write real tests.

**P3 — Pin CI action versions**
`actions/checkout@v4` and `actions/setup-node@v4` use major-version tags, not SHAs. A compromised upstream tag could silently affect your build. Pin to commit SHAs.

---

## Testing

**P1 — No tests for Login, Register, or Settings pages**
These are the primary entry points of the app and have zero test coverage. A regression in auth form submission or avatar update would only be caught by E2E (which doesn't run on PRs).

**P1 — Frontend components with zero coverage**
`Sidebar`, `MessageInput`, `Header`, `UserItem`, `FormField`, `AvatarSelectionModal`, and `SubmissionArrow` are all untested. The `Sidebar` toggle between conversation and user list is a notable gap.

**P2 — No error case testing on the frontend**
API failures (network error, 500) are not tested. The `api.ts` client redirects on 401 but has no other error handling. There's no error boundary, so an unhandled exception crashes the entire app with a blank screen.

**P2 — Backend missing tests for `GET /users` and `PUT /users/me`**
Both user routes are completely untested. Avatar index validation (0–8) is a good candidate for unit tests.

**P2 — E2E smoke tests don't cover messaging**
The smoke suite checks health, auth, and navigation, but not the core feature: sending a message. A broken message send on production would not be caught by the smoke gate.

**P3 — No test for Socket.io disconnect/reconnect**
If the socket drops and reconnects, messages received during the gap are not re-fetched. This behavior is untested and unhandled.

---

## Backend

**P1 — No request validation library**
Body validation is done with manual `typeof` checks and `String()` casts. This is fragile — `avatarIndex` accepts `"7"` (a string) because there's no schema enforcement. Add Zod or express-validator at the route layer.

**P1 — No message pagination**
`GET /conversations/:id/messages` returns all messages with no limit. A long conversation (thousands of messages) will cause slow queries and large payloads. Add cursor-based pagination.

**P2 — No rate limiting**
Any endpoint can be hammered indefinitely. Message sending, registration, and login are the highest-risk. Add `express-rate-limit`.

**P2 — No structured logging**
`console.log` only. Production errors are invisible unless you `docker logs` and grep manually. Add pino or winston with request IDs.

**P2 — No database indexes defined**
The schema has no `@@index` directives. The most common queries — conversations by userId, messages by conversationId — will do full table scans as data grows. Add indexes for `Participant.userId` and `Message.conversationId`.

**P2 — No cascade deletes in schema**
Deleting a User leaves orphaned Participant and Message rows. Prisma's `onDelete: Cascade` should be set on the FK relations.

**P3 — Message body has no length cap**
A 100MB message body would be accepted, stored, and broadcast. Add a max-length validation (e.g., 4000 chars) at the route level.

**P3 — JWT secret has no minimum length enforcement**
`JWT_SECRET=dev-secret` works fine in development. At startup, log a warning or throw if `JWT_SECRET` is shorter than 32 characters.

---

## Frontend

**P1 — No React error boundary**
Any unhandled JS exception in a component renders a blank white screen with no recovery path. A top-level `<ErrorBoundary>` with a "something went wrong" fallback is a one-file fix.

**P2 — `Chat.tsx` is a 212-line monolith**
The reducer, all socket logic, all API calls, and the render are in one file. Extract the reducer + initial state into `chatReducer.ts`, and consider a `useChat` custom hook. This also makes the state logic independently testable.

**P2 — API client swallows non-401 errors silently**
`apiFetch` only handles 401. A 500 from the server resolves as a `Response` object and the caller's `.then(r => r.json())` either throws or returns an error body that gets treated as real data. Add a `!r.ok` throw for all non-2xx responses.

**P2 — No loading state in MessageThread**
When a conversation is selected, messages are fetched async. During that fetch, `activeMessages` is `null` and nothing is rendered — no spinner, no skeleton. Add a visible loading indicator.

**P3 — No accessibility**
No `aria-label` on icon buttons, no keyboard navigation for the conversation list, no focus management when opening the user list. The `<img>` alt attributes exist, which is good, but that's the extent of it.

**P3 — Conversations not refreshed on reconnect**
If the socket drops and reconnects, conversations fetched on mount may be stale. New conversations created by others during the gap won't appear until page refresh.

---

## Code Style / Quality

**P2 — `useEffect` dependency lint is suppressed implicitly**
`Chat.tsx` has `useEffect(() => { ... }, [])` with functions defined inside the component referenced inside the effect (`onMessageNew` references `user`). This works because `user` is stable post-login, but it's an unlinted footgun. The ESLint `exhaustive-deps` rule would surface this.

**P3 — `hasAutoSelectedRef` pattern is fragile**
The auto-select-first-conversation logic (`hasAutoSelectedRef.current = true`) only fires once per mount, which is correct — but the dependency array `[state.conversations]` means it re-evaluates on every conversation update, just guarded by the ref. This is correct but surprising to read. A comment or restructuring would help.

**P3 — Shared package has no runtime exports**
`packages/shared` exports only TypeScript types. That's fine, but the `package.json` has a `main` entry pointing to `src/index.ts` directly. This is consumed by TypeScript-only builds and would break if any consumer did a plain Node `require`. Low risk given the monorepo structure, but worth a clean `exports` field.

---

## Summary

| Priority | Category | Item |
|---|---|---|
| P1 | Testing | No tests for Login, Register, Settings pages |
| P1 | Testing | Frontend components with zero coverage |
| P1 | Backend | No request validation library (Zod) |
| P1 | Backend | No message pagination |
| P1 | Frontend | No React error boundary |
| P2 | Testing | No frontend error case testing |
| P2 | Testing | Backend missing tests for user routes |
| P2 | Testing | E2E smoke doesn't cover messaging |
| P2 | Backend | No rate limiting |
| P2 | Backend | No structured logging |
| P2 | Backend | No database indexes |
| P2 | Backend | No cascade deletes in schema |
| P2 | Frontend | `Chat.tsx` monolith — extract reducer + custom hook |
| P2 | Frontend | API client swallows non-401 errors |
| P2 | Frontend | No loading state in MessageThread |
| P2 | Code style | `useEffect` deps not linted (missing ESLint) |
| P2 | CI/CD | Add ESLint to CI |
| P3 | Testing | No Socket.io reconnect test |
| P3 | Backend | No message body length cap |
| P3 | Backend | No JWT secret minimum length check |
| P3 | Frontend | No accessibility (ARIA, keyboard nav) |
| P3 | Frontend | Conversations not refreshed on socket reconnect |
| P3 | Code style | `hasAutoSelectedRef` pattern is fragile/surprising |
| P3 | Code style | Shared package `exports` field needs cleanup |
| P3 | CI/CD | Remove placeholder test files |
| P3 | CI/CD | Pin CI action versions to SHAs |
