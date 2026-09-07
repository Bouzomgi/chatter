# Chatter (serverless)

A rebuild of [chatter-server](https://github.com/Bouzomgi/chatter-server)'s backend on API Gateway, Lambda, and DynamoDB — see that repo's `AUDIT.md`/design docs for why. `packages/client` and `packages/shared` are carried over as-is to start; `packages/server` is new.

## Development workflow

Same discipline as the original project: `main` is protected — every feature lands on its own branch, opens a PR, and **must pass CI before merging**. Nothing gets merged on faith; by the time a feature reaches `main`, CI has already proven it typechecks, lints, has passing tests, and (for infra changes) synthesizes cleanly.

1. Branch per feature/step (see roadmap below).
2. Push, open a PR.
3. CI runs `typecheck`, `lint`, `test`, and `pnpm --filter server run synth` (renders the CDK stack to CloudFormation locally — no AWS credentials needed, but it catches broken infra code before it ever reaches an account).
4. Once an AWS account/credentials are wired up (a later step), add a deploy job and validate against the real stack the same way the original project validated against its Docker Compose stack — don't skip that step once it's available.
5. Merge only after CI is green.

## Roadmap

Each step below is one branch/PR, in order:

1. ~~**Scaffold**~~ — workspace, CDK app with placeholder DynamoDB tables (`Users`, `Participants`, `Messages`, `Connections`) and a `/health` Lambda behind an HTTP API. CI wired up. *(done)*
2. **Auth** — `register`/`login` Lambdas, `Users` table, JWT issuing (mirrors `routes/auth.ts` in the original).
3. **WebSocket connect/disconnect** — `$connect`/`$disconnect` Lambdas, populate/clear the `Connections` table from `Participants`.
4. **Send message** — `sendMessage` Lambda: write to `Messages`, fan out to active connections via `postToConnection`.
5. **REST conversations/users routes** — `getConversations`, `getMessages` (cursor pagination), `createConversation`, `updateMe`.
6. **Client rewiring** — swap `socket.io-client` for the native `WebSocket` API with manual reconnect; point `api.ts` at the new HTTP API.
7. **Deploy pipeline** — `cdk deploy` on merge to `main`; static client build to S3 + CloudFront.
8. **Video chat signaling** *(stretch)* — `call:offer`/`call:answer`/`call:ice-candidate` WebSocket routes, same shape as `sendMessage`.

## Notes carried over from the original project

- `packages/shared` stays TypeScript-types-only, consumed via workspace protocol.
- `FormField` renders no `<label>` — use `getByPlaceholder` in tests; `getByRole('button')` for the submit arrow.
- E2E tests (once reintroduced in a later step) must run against a real deployed environment and never create/delete data outside a dedicated test account.
