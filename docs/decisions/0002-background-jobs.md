# ADR 0002: Durable Background Jobs

## Status

Accepted.

## Context

Crawls, synchronization, rendering, clustering, and AI batches can exceed web-request lifetimes and must support retries, cancellation, progress, and restart recovery.

## Decision

Use BullMQ backed by Redis as the durable at-least-once job queue, with separately runnable worker processes.

Every job must be idempotent, tenant-scoped, bounded, observable, and safe to retry. Queue payloads contain stable identifiers and versioned inputs, not credentials or large page content. Workers revalidate workspace and site ownership from PostgreSQL before performing tenant-owned work.

Persist business progress and terminal state in PostgreSQL. BullMQ state supports delivery and execution but is not the only source of truth for user-visible progress.

Redis persistence must be enabled in Docker deployments so ordinary worker or web restarts do not discard queued work. Production recovery, backup, and failed-job inspection are hardened in Phase 7.

## Alternatives considered

- In-process promises or cron tasks
- Database polling without a queue library
- Managed cloud queue
- Workflow orchestration platform

## Consequences

- Duplicate delivery is expected and handled through persisted idempotency keys.
- Queue payloads contain identifiers, not credentials or large page content.
- Progress survives worker restarts because it is persisted in PostgreSQL.
- Redis becomes a required runtime dependency.
- Queue recovery and retention settings require explicit deployment configuration.

## Revisit conditions

Revisit if workflow complexity, queue dependency, or production scale justifies database-native jobs or a dedicated workflow engine.
