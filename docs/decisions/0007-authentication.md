# ADR 0007: Authentication

## Status

Accepted.

## Context

Phase 1 requires Google login, durable sessions, and server-side authorization that remains distinct from tenant ownership. The authentication choice must work with the Next.js application and PostgreSQL-backed identity data.

## Decision

Use Auth.js with Google OAuth and database-backed sessions stored through Prisma.

Authentication establishes the user's identity. It does not by itself authorize access to workspace-owned resources. Every tenant-owned operation must separately verify an active membership and the required role on the server.

On a user's first successful login, create the user, one private workspace, and an Owner membership transactionally. Later logins reuse the existing identity and membership. Provisioning must be idempotent so concurrent or repeated callbacks do not create duplicate workspaces or memberships.

OAuth client secrets and session-related deployment secrets remain outside the web-managed integration credential vault.

## Alternatives considered

- Custom OAuth and session implementation
- Stateless JWT-only sessions
- Password authentication in the initial release
- External hosted identity provider

## Consequences

- Google OAuth configuration is required for normal login.
- Session state can be revoked and inspected through the database.
- Authorization helpers and tenant-isolation tests are required from the beginning.
- Initial account provisioning requires a transaction and uniqueness constraints.

## Revisit conditions

Revisit if additional identity providers, enterprise SSO, or deployment constraints require a different authentication system.