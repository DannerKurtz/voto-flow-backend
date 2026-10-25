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
| `SECOND_ROUND_COMPARISON_CONFIG` | unset | Enables the configured presidential first- and second-round comparison. |
| `GOVERNOR_SECOND_ROUND_TARGETS` | unset | JSON array of second-round governor result identities; each must match an EA20 target configured in `TSE_POLL_TARGETS`. |

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

## Presidential comparison: first and second rounds

Set `SECOND_ROUND_COMPARISON_CONFIG` only after setting all matching EA20 targets in `TSE_POLL_TARGETS`. It is intentionally separate from the polling URLs: targets describe transport, while this variable identifies the two rounds, the supported scopes, and the two official candidate IDs.

```dotenv
SECOND_ROUND_COMPARISON_CONFIG={"firstRound":{"electionCode":"<first-round-election>","officeCode":"<president-office>"},"secondRound":{"electionCode":"<second-round-election>","officeCode":"<president-office>"},"scopes":["br","ac","al","ap","am","ba","ce","df","es","go","ma","mt","ms","mg","pa","pb","pr","pe","pi","rj","rn","rs","ro","rr","sc","sp","se","to"],"candidates":[{"key":"flavio","firstRoundSqcand":"<official-sqcand>","secondRoundSqcand":"<official-sqcand>"},{"key":"lula","firstRoundSqcand":"<official-sqcand>","secondRoundSqcand":"<official-sqcand>"}]}
```

The process rejects this configuration when any configured scope is missing a first- or second-round EA20 target. Do not guess the EA20 URLs, election codes, office code, or `sqcand` values: obtain them from EA11 and the official EA20 documents. The TSE documents the official 2026 distribution parameters and request limit at [Informações técnicas sobre a divulgação de resultados](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados).

When configured, the API adds:

| Endpoint | Purpose |
| --- | --- |
| `GET /results/second-round/president` | Lists the comparison for Brazil and every configured UF. |
| `GET /results/second-round/president/:scopeCode` | Returns one configured comparison, such as `br` or `sp`. |
| `GET /results/second-round/governors` | Lists configured state governor runoff results, including pending states. |
| `GET /results/second-round/governors/:scopeCode` | Returns one configured governor runoff result. |

Each comparison returns official first- and second-round candidate votes and percentages, official second-round blank/null votes, and the official totalization percentage. A scope without both stored EA20 documents returns `availability: "pending"` with no partial comparison.

`estimatedSurplus` is not an official TSE value. It is explicitly marked with `estimated: true` and labelled `Outros candidatos, nulos e brancos (estimativa)`. It remains unavailable until both configured candidates have reached their respective first-round totals in that scope; only then is each positive difference exposed. Official blank and null votes remain separate in `secondRound`.

### Governor runoff bonus

Set `GOVERNOR_SECOND_ROUND_TARGETS` to a JSON array of election/scope/office identities for the governor runoff EA20 documents. Every identity must have a matching entry in `TSE_POLL_TARGETS`; the configuration loader rejects missing or duplicated identities. Configure the official election and office codes from EA11 rather than hardcoding them in the application. The endpoint returns normalized official candidate votes, percentages, blank/null votes, totalization percentage, and pending states. The matching WebSocket subscription is `subscribe.second-round-governor` with a `scopeCode`; changed results arrive as `second-round.governor.updated`.

The 2026 supplemental display can be configured for AC, AM, DF, ES, RN, and TO. Those scopes are supplied through environment configuration, so deployments can omit this optional feature or use a different official target set without changing code.

## WebSocket protocol

Connect to `ws://localhost:3000/ws`, then subscribe using:

```json
{"type":"subscribe","electionCode":"<code>","scopeCode":"<scope>","officeCode":"<code>"}
```

The server acknowledges with `subscribed`. When that document changes, it sends:

```json
{"type":"result.updated","data":{"electionCode":"...","scopeCode":"...","officeCode":"...","sourcePayload":{}}}
```

For the normalized presidential comparison, subscribe by scope:

```json
{"type":"subscribe.second-round-comparison","scopeCode":"sp"}
```

After a matching first- or second-round EA20 update, the server sends:

```json
{"type":"second-round.comparison.updated","data":{"scopeCode":"sp","comparison":{}}}
```

## Integrity status

The backend validates that TSE responses are JSON and retains their raw-content SHA-256 hash for change detection. It **does not yet assert JWS authenticity**. The TSE JWS verification steps, certificates, and exact signing format must be implemented from the official specification before a result can be marked cryptographically verified.

## Refactoring boundaries and performance

The repository contract is split into `ResultReader`, `SnapshotReader` and `ResultWriter`. Services depend only on the operations they use; PostgreSQL and the in-memory test adapter implement the same aggregate contract. HTTP/WS contracts remain unchanged.

`PresidentialComparisonService.list()` loads all configured identities in one PostgreSQL statement, replacing two reads per scope (56 reads for Brazil plus 27 UFs). It maps documents by identity and preserves configured scope order, including pending scopes. Single-scope reads remain independent.

The poller depends on small transport, persistence and publication contracts. Concurrent calls share the in-flight cycle. With the production error callback, a failed target is logged and other targets continue. `stop()` finishes the in-flight target and skips remaining targets before the database pool is closed; SIGINT/SIGTERM close the app gracefully. A broken WebSocket subscriber is removed without interrupting other subscribers.

Startup validates polling/comparison configuration before connecting for migrations, then applies pending migrations automatically. This refactor adds no migrations. The existing global TSE limiter is still shared across all polling targets.

Tests cover comparison batching/order, missing rounds, polling overlap/shutdown and subscriber failure isolation, alongside the existing API, normalization, surplus and TSE-client tests. These tests use local adapters and fixtures, not the live TSE or production PostgreSQL.
