# Voto Flow Backend Guide

## Mission

Build the backend for Voto Flow, a small application for tracking the official results of Brazil's 2026 General Elections. It serves roughly ten concurrent users and must favor correctness, simplicity, reliability, and maintainability over infrastructure scale.

The backend is the sole component allowed to retrieve data from the TSE. The frontend must consume only data and real-time updates supplied by this backend.

## Development Boundaries

The project progresses only through explicitly authorized phases. Do not start a later phase, create implementation code, install dependencies, define database schemas, or introduce APIs and protocols until its phase has been approved.

Current status:

- Phase 1 — Official TSE research: completed.
- Next authorized analysis phase: Phase 2 — Electoral Domain.
- Backend implementation remains unauthorized until Phase 10 receives explicit approval.

## Architectural Direction

Use a modular monolith when implementation is authorized. The intended platform is Node.js, TypeScript, Fastify, Zod, PostgreSQL, REST, and WebSocket.

Keep temporary shared state in process memory and persistent state in PostgreSQL. Do not introduce Redis, brokers, Kafka, RabbitMQ, Kubernetes, microservices, multiple backend instances, or distributed coordination unless a concrete future requirement justifies them.

Future responsibilities may include TSE integration, polling, validation, normalization, persistence, REST, and WebSocket delivery. Do not create abstractions merely to mirror this list; establish boundaries from the actual official data model.

## Official TSE Data Rules

Use current official TSE documentation and files as the primary source of truth. Label relevant findings as `CONFIRMED`, `INFERRED`, or `UNCONFIRMED`; never present an inference as an official fact.

Phase 1 established the following facts:

- `ele-c.json` (EA11) supplies configuration needed to discover election identifiers and build resource URLs.
- EA14 reports Brazil-level progress by UF; EA15 refines progress by municipality within a UF.
- EA14 and EA15 can direct EA20 retrieval, but their timestamps are only a strong indicator because files are generated and distributed in parallel.
- EA20 is the official unified-result source by office and geographic scope.
- The TSE CDN supports ETag and Last-Modified conditional validation and can return HTTP 304. A 304 still counts toward its rate limit.
- No index files are planned for identifying result updates.
- The official maximum is 100 requests per second per IP; the future backend must enforce a stricter global internal ceiling of 10 requests per second across all TSE requests.
- Incorrect or repeated nonexistent URLs can cause temporary blocking; never probe the CDN by guessing paths.
- The TSE publishes a JWS-verification manual. Any future signature verification must follow that official specification exactly.

Consult these official sources before making TSE integration decisions:

- https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados
- https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados
- https://www.tse.jus.br/legislacao/compilada/res/2026/resolucao-no-23-751-de-26-de-fevereiro-de-2026

## Electoral Correctness

The supported offices are President, Governor, Senator, Federal Deputy, State Deputy, and District Deputy where applicable. Municipal offices are out of scope.

For proportional offices, never determine elected candidates merely by sorting vote totals. Preserve and use the official TSE situation or classification when it is provided.

Validate and normalize official data before persistence. Preserve snapshots only when relevant result data changed, so history supports result-evolution charts without duplicate records. Do not emit a real-time update when the stored state did not materially change.

## Future Quality Requirements

When implementation is authorized:

- Consult current official documentation for dependencies and the current TSE material for electoral behavior.
- Use structured Fastify/Pino logs for TSE requests, status, duration, retries, detected changes, snapshots, and WebSocket connection counts.
- Test parsing, validation, normalization, rate limiting, conditional HTTP behavior, polling, snapshots, and subscriptions with local fixtures rather than live TSE services.
- Design retries, backoff, timeout handling, cache validation, and JWS verification only after their documented requirements have been confirmed.
- Treat REST as the future initial-state delivery mechanism and WebSocket as the future update mechanism unless later phases produce a better evidence-based design.

## Change Discipline

Before making a significant architecture decision, document the problem, viable alternatives, trade-offs, recommendation, and justification. Prefer the simplest solution that preserves official-data fidelity, reliability, and reasonable future evolution.

Do not commit, push, create branches, open pull requests, or publish changes unless explicitly requested.
