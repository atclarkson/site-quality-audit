# ADR 0006: Database Access and Migrations

## Status

Accepted.

## Context

Phase 1 requires shared, typed database access from web and worker processes, repeatable schema evolution, and a migration history suitable for Docker and later production deployment.

## Decision

Use PostgreSQL with Prisma ORM. Keep the Prisma schema and database client in a shared database package used by trusted server and worker code.

All persisted schema changes require checked-in Prisma migrations. `prisma db push` may be used only for disposable local experiments and is not an accepted production or shared-environment migration mechanism. Once a migration has been shared or applied outside a disposable environment, its history must not be rewritten; corrections require a new migration.

Migration execution is an explicit deployment step and must not race across ordinary web and worker startup.

## Alternatives considered

- Raw SQL as the primary access layer
- Drizzle ORM
- Database schema synchronization without migration files

## Consequences

- Schema evolution is reviewable and reproducible.
- Web and worker share generated types and transaction behavior.
- Deployment needs a defined migration step.
- Database-specific behavior still requires explicit tests and, where needed, reviewed SQL migrations.

## Revisit conditions

Revisit if Prisma blocks required PostgreSQL features or creates unacceptable operational constraints.
