# Voto Flow Backend

Voto Flow stores official TSE result documents, preserves meaningful snapshots, serves the current state through REST, and pushes changed documents to interested WebSocket clients. It uses Node.js, TypeScript, Fastify, PostgreSQL, Zod, OpenAPI, and Swagger UI.

## Requirements

- Node.js 20 or newer
- pnpm 10 or newer

## Run locally

```bash
cd ..
docker compose up -d postgres
cd backend
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

The API listens on `http://localhost:3000` by default.

## Available endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Returns `{ "status": "ok" }` when the API is running. |
| `GET /results/:electionCode/:scopeCode/:officeCode` | Returns the last stored official result document. |
| `GET /results/:electionCode/:scopeCode/:officeCode/snapshots` | Returns meaningful snapshots, newest first. |
| `WS /ws` | Receives real-time updates after a subscription. |
| `GET /documentation` | Serves Swagger UI. |
| `GET /documentation/json` | Serves the generated OpenAPI document. |

## Commands

```bash
pnpm dev
pnpm db:migrate
pnpm build
pnpm start
pnpm typecheck
pnpm test
```

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | HTTP listening host. |
| `PORT` | `3000` | HTTP listening port. |
| `LOG_LEVEL` | `info` | Fastify/Pino log level. |
| `DATABASE_URL` | `postgresql://voto_flow:voto_flow@localhost:5432/voto_flow` | PostgreSQL connection string. |
| `FRONTEND_ORIGIN` | `http://localhost:3001` | Only browser origin permitted by CORS. |
| `TSE_MAX_REQUESTS_PER_SECOND` | `10` | Global backend ceiling for TSE requests; accepts values from 1 to 10. |
| `TSE_TIMEOUT_MS` | `10000` | Per-request TSE HTTP timeout in milliseconds. |
| `TSE_POLL_INTERVAL_MS` | `30000` | Delay between completed polling cycles. |
| `TSE_POLL_TARGETS` | unset | JSON array of EA20 result targets to poll. Unset disables the poller. |

## PostgreSQL

From the repository root, start the development database with:

```bash
docker compose up -d postgres
docker compose ps
```

The default credentials are for local development only. To override them, copy the root `.env.example` to `.env` before starting Compose.

## TSE polling

The backend only queries URLs explicitly set in `TSE_POLL_TARGETS`. This avoids hardcoding electoral codes or URLs: derive each target from the official EA11 configuration and TSE documentation for the selected environment before enabling polling.

```dotenv
TSE_POLL_TARGETS=[{"electionCode":"<official-election-code>","scopeCode":"<official-scope-code>","officeCode":"<official-office-code>","sourceUrl":"<official-ea20-url>"}]
```

For every target, the poller reads the stored ETag and Last-Modified value and sends `If-None-Match` and `If-Modified-Since` when available. A `304 Not Modified` does not create a snapshot or publish a WebSocket event. A changed response is hashed from its raw JSON, persisted, and published only to subscribers of the matching election, scope, and office.

The global in-process limiter is deliberately capped at 10 requests per second across all configured targets. This is a local safety ceiling, not the official TSE limit and not a polling recommendation.

## WebSocket protocol

Connect to `ws://localhost:3000/ws`, then subscribe using:

```json
{"type":"subscribe","electionCode":"<code>","scopeCode":"<scope>","officeCode":"<code>"}
```

The server acknowledges with `subscribed`. When that document changes, it sends:

```json
{"type":"result.updated","data":{"electionCode":"...","scopeCode":"...","officeCode":"...","sourcePayload":{}}}
```

## Integrity status

The backend validates that TSE responses are JSON and retains their raw-content SHA-256 hash for change detection. It **does not yet assert JWS authenticity**. The TSE JWS verification steps, certificates, and exact signing format must be implemented from the official specification before a result can be marked cryptographically verified.
