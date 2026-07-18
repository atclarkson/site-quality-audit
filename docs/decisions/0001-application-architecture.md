# ADR 0001: Application Architecture

## Status

Provisionally accepted.

## Context

The product requires an interactive dashboard plus long-running crawls, synchronization, browser rendering, and AI analysis. It must run locally in Docker and later on a self-hosted server.

## Decision

Use a Docker-first TypeScript application with separate web and worker processes, PostgreSQL as the system of record, and a durable background-job system. The leading web-framework direction is Next.js, but the exact framework and ORM remain open until Phase 1.

## Alternatives considered

- Single-process web application
- Local-only command-line script
- SQLite-first desktop application
- Serverless-only architecture

## Consequences

- Long work survives web request and process boundaries.
- Local setup includes several services.
- Domain code and validation contracts must be shared without coupling process lifecycles.
- Migrations, queue recovery, and service health become first-class concerns.

## Revisit conditions

Revisit if Phase 1 demonstrates that the selected framework cannot cleanly separate worker execution, or deployment constraints materially favor another architecture.
