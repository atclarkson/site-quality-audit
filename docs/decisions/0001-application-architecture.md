# ADR 0001: Application Architecture

## Status

Accepted.

## Context

The product requires an interactive dashboard plus long-running crawls, synchronization, browser rendering, and AI analysis. It must run locally in Docker and later on a self-hosted server. Phase 1 needs a concrete repository and process structure before scaffolding can begin.

## Decision

Use a Docker-first TypeScript monorepo managed with pnpm workspaces.

The repository will contain:

- a Next.js application using the App Router for the web interface and server-side application endpoints;
- a separately runnable Node.js TypeScript worker process;
- shared packages for database access, validation, queue contracts, structured logging, and domain types.

The web and worker may share packages and persisted models, but they remain separate processes with independent lifecycle, startup, health, and failure behavior. Long-running work must never depend on a web request remaining active.

PostgreSQL is the system of record. Docker Compose is the initial local orchestration mechanism.

## Alternatives considered

- Single-process web application
- Local-only command-line script
- SQLite-first desktop application
- Serverless-only architecture
- Separate repositories for web, worker, and shared code

## Consequences

- Long work survives web request and process boundaries.
- Local setup includes several services.
- Shared contracts reduce duplication without coupling process lifecycles.
- Migrations, queue recovery, service health, and environment validation become first-class concerns.
- The monorepo must preserve clear package boundaries and avoid importing web-only code into workers.

## Revisit conditions

Revisit if implementation demonstrates that Next.js cannot cleanly support the required server-side boundaries, or deployment constraints materially favor another architecture.
