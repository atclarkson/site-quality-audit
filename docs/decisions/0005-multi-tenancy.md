# ADR 0005: Multi-Tenancy

## Status

Accepted.

## Context

The application should support multiple users and multiple sites and may later be offered beyond one publisher. Retrofitting tenant boundaries after crawl, metric, credential, and AI-history tables exist would be risky.

## Decision

Use a workspace as the tenant boundary from the beginning. Users access workspaces through memberships. Sites, credentials, connections, audits, jobs, findings, metrics, scores, and remediation records belong to a workspace directly or through an enforced parent relationship.

For the initial product, the first successful login for a user creates one private workspace and an Owner membership transactionally. The interface may hide workspace management, but persistence and authorization remain workspace-aware from the beginning.

Authorization must be checked server-side for every tenant-owned operation. Background jobs carry workspace and site identifiers, and workers revalidate ownership rather than trusting job payloads alone.

## Alternatives considered

- Single-user schema initially
- Site as tenant boundary
- Database per tenant

## Consequences

- More foreign keys and authorization tests from the outset.
- Clear support for multiple sites and future collaboration.
- Easier workspace deletion and data export.
- The UI can remain simple while the domain model is ready for broader use.

## Revisit conditions

Revisit if regulatory or enterprise requirements demand stronger physical isolation, or if the product permanently becomes a single-user local tool.