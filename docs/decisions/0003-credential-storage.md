# ADR 0003: Credential Storage

## Status

Proposed.

## Context

Users will connect external services such as Anthropic, Google Search Console, GA4, CMS platforms, and custom MCP or evidence providers. These connections may require API keys, OAuth refresh tokens, client secrets, or credential-bearing endpoints. The application must support configuration through the web interface without exposing stored secrets after submission.

Secrets stored in the same database as application data require application-level encryption and operational separation between ciphertext and the encryption master key.

## Decision

Store user-supplied integration credentials in PostgreSQL as authenticated encrypted payloads. The encryption master key is supplied to the application at deployment time and is never stored in PostgreSQL. Each credential record includes a key version so secrets can be rotated and re-encrypted.

Requirements:

- Encryption and decryption occur only in trusted server or worker code.
- Stored secrets are never returned to the browser after submission.
- The UI displays only provider, status, verification date, and a masked identifier where safe.
- Credential verification uses the secret server-side and stores a sanitized result.
- OAuth refresh tokens receive the same protection as API keys.
- Logs, errors, queue payloads, analytics, and tracing must redact secret material.
- Credential-bearing URLs are treated as secrets in their entirety.
- Deletion removes the encrypted payload and disables dependent connections.
- Key rotation supports decrypting with an old key version and re-encrypting with the current version.

Server-level deployment secrets such as the credential-encryption master key, session secret, and OAuth client secret remain outside the web-managed credential store.

## Alternatives considered

- Plaintext database storage: rejected as an unnecessary and severe risk.
- Environment variables for every user integration: rejected because users must configure integrations through the application and multiple workspaces need independent credentials.
- External secrets manager from the first release: strong option, but adds deployment complexity and vendor coupling. The domain model should allow one later.
- Browser-side encryption with a user passphrase: rejected because unattended background workers must use credentials.

## Consequences

- Production deployment requires secure delivery and backup of the master key.
- Losing the master key makes encrypted credentials unrecoverable.
- Database compromise alone should not expose plaintext credentials.
- Application compromise can still expose credentials while in use, so authorization, process security, and logging discipline remain critical.
- Credential rotation and verification workflows must be implemented and tested.

## Revisit conditions

Revisit when external KMS or secrets-manager support becomes operationally justified, when enterprise tenants require customer-managed keys, or when the threat model requires envelope encryption with managed key services.