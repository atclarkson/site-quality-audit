# ADR 0008: Deployment and Local Secret Handling

## Status

Accepted.

## Context

The application needs database credentials, Redis configuration, OAuth secrets, session secrets, and encryption master keys before it can start. These deployment-level secrets are different from user-managed integration credentials stored by the application.

## Decision

Use uncommitted `.env` files for local Docker development. Commit `.env.example` files that contain variable names, safe descriptions, and non-secret example values only.

Production deployments supply secrets through environment variables or mounted secret files. The configuration layer may normalize both sources into the same validated runtime configuration, but secret values must not be committed, logged, exposed to the browser, or stored in the web-managed credential vault.

Deployment-level secrets include at least:

- PostgreSQL credentials and connection URLs;
- Redis credentials and connection URLs;
- Google OAuth client secrets;
- Auth.js/session secrets;
- credential-encryption master keys.

Validate required configuration with Zod during process startup. Web and worker processes must fail startup clearly when required values are missing or malformed. Error output may identify the missing variable but must never print secret values.

Mounted secret files must be read only by trusted server or worker code and should use restrictive filesystem permissions.

## Alternatives considered

- Committed development secrets
- Storing deployment secrets in PostgreSQL
- Requiring an external cloud secrets manager in Phase 1
- Allowing partially configured services to start and fail later

## Consequences

- Developers must create local `.env` files from documented examples.
- Production operators remain responsible for secure secret delivery and backup of encryption keys.
- Startup failures occur early rather than during credential or authentication operations.
- A managed KMS or secrets manager can be added later without changing the user-managed credential model.

## Revisit conditions

Revisit when production operations justify a required external secrets manager, KMS integration, or orchestrator-specific secret mechanism.