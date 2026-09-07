# Chatter

A personal chat app modeled on iMessage — this repo is a serverless rebuild of the backend (API Gateway + Lambda + DynamoDB), replacing the original's Express/Socket.io/Postgres server. See `CLAUDE.md` for the roadmap and workflow.

## Packages

- `packages/client` — React + TypeScript + Vite frontend (carried over from the original project)
- `packages/shared` — shared TypeScript types
- `packages/server` — AWS CDK app: Lambda handlers behind API Gateway (HTTP + WebSocket), DynamoDB for storage
