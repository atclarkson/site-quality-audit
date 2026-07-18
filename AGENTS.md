# AGENTS.md

## Purpose

This repository builds Site Quality Audit. Agents implement the documented product; they do not silently redefine it.

## Source-of-truth order

1. Accepted architecture decision records in `docs/decisions/`
2. `docs/product-requirements.md`
3. `docs/architecture.md`
4. `docs/data-model.md`
5. `docs/scoring-framework.md`
6. `docs/ai-analysis-schema.md`
7. `docs/security.md`
8. `docs/roadmap.md`
9. Existing implementation and tests

When documents conflict, stop and surface the conflict. Do not choose an interpretation silently.

## Required engineering behavior

- Keep web request handling and background work separated.
- Long-running crawl, synchronization, embedding, and AI work belongs in durable jobs.
- Validate all external API responses and AI output with versioned schemas.
- Treat crawled HTML, metadata, integration output, and model output as untrusted.
- Add migrations for persisted schema changes. Never edit production data manually as an implementation shortcut.
- Make jobs idempotent and safe to retry.
- Preserve historical snapshots; do not overwrite audit history.
- Add tests for authorization, tenant isolation, scoring changes, job retries, parsers, and schema validation.
- Update relevant documentation and ADRs when an architectural decision changes.

## Scoring rules

- Never change scoring weights, formulas, thresholds, or labels without a versioned change and tests.
- Never collapse quality risk, opportunity, business importance, confidence, effort, and priority into one unexplained value.
- Every displayed score must be traceable to its inputs.
- AI recommendations are advisory. Redirect, merge, removal, and other destructive actions require human approval.

## Security rules

- Never commit secrets, `.env` files, real access tokens, OAuth credentials, refresh tokens, or credential-bearing URLs.
- Never return stored credentials to the browser after submission.
- Never log secrets, authorization headers, raw refresh tokens, or unredacted sensitive page content.
- Enforce tenant ownership in application logic and database access patterns.
- Block SSRF targets including localhost, private networks, link-local addresses, and cloud metadata endpoints by default.
- Revalidate resolved IPs after redirects and DNS resolution.

## Scope control

Do not add article generation, automated publishing, billing, or autonomous destructive remediation unless an accepted product change explicitly adds them.
