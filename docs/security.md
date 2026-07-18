# Security

## Scope

The application stores credentials, OAuth tokens, private performance data, crawled content, and AI analysis. Security is a product requirement, not a deployment add-on.

## Primary threats

- Cross-tenant data access
- Credential or refresh-token disclosure
- SSRF through crawl targets, redirects, webhooks, or integration URLs
- Prompt injection embedded in crawled pages
- XSS from rendered page content or AI output
- CSRF against authenticated actions
- Queue tampering or replay
- Excessive crawling, provider spending, or denial of service
- Sensitive data leakage through logs, exports, backups, or support tooling
- Compromised dependencies or containers

## Tenant isolation

Every tenant-owned operation must be scoped to a workspace. Authorization must be enforced server-side before reading, mutating, queuing, exporting, or deleting data.

Requirements:

- Never trust workspace or site IDs supplied by the browser without ownership checks.
- Include workspace scope in repository/service methods.
- Add authorization and cross-tenant regression tests.
- Avoid globally addressable object URLs containing predictable identifiers.
- Administrative access must be explicit and audited.

## Authentication and authorization

Google OAuth is the initial login direction. Exact library remains open.

- Use secure, HTTP-only, same-site cookies.
- Rotate sessions after authentication and privilege changes.
- Require reauthentication for high-risk credential or account operations when practical.
- Define owner, administrator, editor, and viewer capabilities before multi-role UI ships.
- Login authorization must remain separate from optional Search Console and GA authorization.
- Request external scopes incrementally and with least privilege.

## Credential encryption

User-entered provider secrets and refresh tokens are encrypted before database storage.

- The master encryption key lives outside PostgreSQL.
- Use an authenticated encryption scheme with a unique nonce per value.
- Store key version, algorithm version, and non-secret metadata.
- Decrypt only in server or worker memory immediately before use.
- Never return the original value after submission.
- UI displays only provider, label, status, and masked suffix where safe.
- Support verification, rotation, revocation, and deletion.
- Design for key rotation without decrypting all records in one blocking transaction.

Exact key-management mechanism remains open for local and production deployments.

## OAuth token handling

- Store refresh tokens encrypted.
- Keep access tokens short-lived and preferably memory-only.
- Do not log provider responses containing tokens.
- Record granted scopes and connection owner.
- Handle revocation and expired authorization cleanly.
- Do not reuse login OAuth consent as silent permission for analytics data.

## SSRF defenses

The crawler and configurable integration URLs create a high-risk network boundary.

Before every outbound request and redirect:

- permit only supported schemes, normally HTTPS and optionally HTTP;
- parse and normalize the hostname strictly;
- resolve DNS and block loopback, private, link-local, multicast, reserved, and cloud metadata ranges;
- repeat destination validation after DNS resolution and every redirect;
- defend against DNS rebinding;
- block embedded credentials in URLs;
- limit redirects, response size, duration, and content type;
- restrict ports by default;
- do not forward user-supplied authorization headers across hosts;
- run browser rendering with equivalent network restrictions.

Access to internal network targets may only be enabled by an explicit administrator-controlled deployment policy and is not an MVP feature.

## Crawler isolation and limits

- Per-site and global concurrency limits
- Request delays and retry ceilings
- Maximum sitemap size, URL count, page size, and crawl duration
- Browser process CPU, memory, and time limits
- Download refusal for unsupported binary types
- User-agent identification
- Cancellation and emergency stop
- Workspace quotas to prevent unbounded cost

## Prompt injection

Crawled content is untrusted data, even when it resembles system instructions.

- Clearly delimit page content from model instructions.
- State that page text cannot change the task, schema, policies, or tool access.
- Do not expose credentials, publishing tools, network tools, or destructive actions to analysis models.
- Validate all model output.
- Treat model-provided URLs, commands, and recommendations as untrusted.
- Require human approval for destructive remediation.

## XSS and unsafe content

- Never inject raw crawled HTML or AI output into the dashboard.
- Render extracted text as escaped content.
- Sanitize any approved rich-text subset with a maintained allowlist.
- Use a restrictive Content Security Policy.
- Isolate future page previews or screenshots from the application origin.
- Validate export formats to prevent spreadsheet-formula injection.

## CSRF and request security

- Use same-site cookies and framework-supported CSRF defenses.
- Require POST/PUT/PATCH/DELETE for mutations.
- Verify origin for sensitive browser requests where appropriate.
- Apply rate limits to login, credential verification, crawl creation, AI runs, and exports.

## Database protections

- Use TLS in production where supported.
- Use a least-privilege application database role.
- Run migrations through controlled deployment steps.
- Parameterize all queries.
- Back up encrypted credentials only as encrypted ciphertext.
- Test tenant deletion and backup restoration.

## Queue and Redis protections

- Redis must not be exposed publicly.
- Authenticate and encrypt transport in production where supported.
- Treat job payloads as sensitive; store identifiers rather than credentials or full page content.
- Sign or validate any externally submitted job command.
- Ensure retries do not duplicate billable work.
- Define persistence and recovery behavior before production.

## Logging and redaction

Never log:

- API keys or credential-bearing URLs
- OAuth codes, access tokens, or refresh tokens
- Authorization or cookie headers
- Encryption plaintext
- Entire raw prompts or pages by default

Logs should contain correlation IDs, safe provider identifiers, status codes, durations, and redacted diagnostics. Debug logging must not weaken redaction.

## Backups and recovery

- Encrypt backups at rest.
- Restrict backup access.
- Document retention and deletion behavior.
- Regularly test restoration.
- Ensure restoration does not accidentally revive revoked credentials without warning.
- Back up PostgreSQL before production migrations.

## Secret rotation

Document procedures for rotating:

- application/session secret
- database credentials
- encryption master keys
- Google OAuth client secret
- provider credentials
- reverse-proxy certificates

Revoked credentials should immediately stop future jobs and clearly mark affected connections.

## Dependency and container security

- Pin and regularly update runtime and container dependencies.
- Use minimal non-root production images.
- Scan dependencies and images in CI.
- Separate build and runtime stages.
- Do not bake secrets into images.
- Keep browser dependencies isolated and patched.
- Generate an SBOM when production packaging is introduced.

## Production checklist

Before public deployment:

- HTTPS and secure cookies enabled
- Master key and session secrets generated outside source control
- Database and Redis are private
- Backup and restore tested
- SSRF and tenant-isolation tests passing
- Rate and cost limits configured
- OAuth redirect URIs restricted
- Logs reviewed for redaction
- Health checks and alerts enabled
- Default administrator and debug paths removed or protected
- Dependency and container scans passing

## Open security decisions

- Encryption library and key hierarchy
- Production secret manager
- Authentication library and session store
- Whether PostgreSQL row-level security supplements application checks
- Browser sandbox implementation
- Exact crawl and spending quotas
- Raw-content retention and object-storage encryption
- Incident response and audit-log retention

## Related documents

- [Architecture](architecture.md)
- [Data model](data-model.md)
- [AI analysis](ai-analysis-schema.md)
