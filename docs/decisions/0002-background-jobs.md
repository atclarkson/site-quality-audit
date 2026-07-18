# ADR 0002: Durable Background Jobs

## Status

Provisionally accepted.

## Context

Crawls, synchronization, rendering, clustering, and AI batches can exceed web-request lifetimes and must support retries, cancellation, progress, and restart recovery.

## Decision

Use a durable at-least-once job queue with a separately runnable worker. Every job must be idempotent, tenant-scoped, bounded, observable, and safe to retry. Redis plus BullMQ is the leading implementation, but the final queue remains open.

## Alternatives considered

- In-process promises or cron tasks
- Database polling without a queue library
- Managed cloud queue
- Workflow orchestration platform

## Consequences

- Duplicate delivery is expected and handled through persisted idempotency keys.
- Queue payloads contain identifiers, not credentials or large page content.
- Progress is persisted in PostgreSQL rather than existing only in queue memory.
- Redis persistence and recovery behavior must be resolved before production.

## Revisit conditions

Revisit if queue dependency, workflow complexity, or production scale justifies database-native jobs or a dedicated workflow engine.
