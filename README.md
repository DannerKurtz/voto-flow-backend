# Voto Flow Backend

Initial backend scaffold for Voto Flow. It uses Node.js, TypeScript, Fastify, Zod, OpenAPI, and Swagger UI.

This delivery intentionally does not include TSE access, polling, persistence, result routes, WebSocket events, or election domain code. Those parts depend on the project phases that define their official contracts.

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
pnpm dev
```

The API listens on `http://localhost:3000` by default.

## Available endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Returns `{ "status": "ok" }` when the API is running. |
| `GET /documentation` | Serves Swagger UI. |
| `GET /documentation/json` | Serves the generated OpenAPI document. |

## Commands

```bash
pnpm dev
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

## PostgreSQL

From the repository root, start the development database with:

```bash
docker compose up -d postgres
docker compose ps
```

The default credentials are for local development only. To override them, copy the root `.env.example` to `.env` before starting Compose.
