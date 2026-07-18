# Roadmap

The roadmap is ordered to produce useful, testable capability early while delaying expensive or speculative integrations.

## Phase 0 — Product and architecture specification

### Goals

Define product scope, safety constraints, data concepts, scoring principles, AI contracts, and implementation boundaries.

### Deliverables

- Product requirements
- Architecture and ADRs
- Conceptual data model
- Scoring framework
- AI response contracts
- Security model
- Agent instructions

### Exit criteria

- Documents agree on terminology and scope.
- Provisional decisions and open decisions are explicit.
- Phase 1 can be implemented without inventing product behavior.

### Deferred

All application code and provider integrations.

## Phase 1 — Application foundation

### Goals

Create a secure Docker-first application skeleton supporting authentication, tenancy, sites, durable jobs, and encrypted integration credentials.

### Deliverables

- Web and worker services
- PostgreSQL and queue dependencies
- Migration and validation tooling
- Google login
- Workspace/site creation
- Credential vault UI and encryption service
- Health checks, structured logging, and basic tests
- Dashboard shell with job-status components

### Dependencies

The accepted Phase 1 foundation ADRs define the framework, ORM, authentication, queue, encryption, tenancy, and local secret-management choices required for implementation.

### Exit criteria

- A user can sign in and create a site.
- Web can enqueue a durable test job handled by the worker.
- Worker restart does not lose job state.
- A test credential can be stored encrypted, verified through a fake provider, masked, rotated, and deleted.
- Tenant-isolation and SSRF unit tests pass.

### Deferred

Real crawling, Search Console, AI, embeddings, and production deployment.

## Phase 2 — Crawl engine and deterministic audit

### Goals

Produce a valuable whole-site inventory and objective audit without paid AI.

### Deliverables

- Sitemap-index and nested-sitemap discovery
- URL normalization and exclusion rules
- Safe HTTP crawler with redirect tracking
- Playwright fallback policy
- Main-content and metadata extraction
- Links, images, video, schema, canonical, robots, headings, dates, and authors
- Versioned snapshots and content hashes
- Deterministic rule engine
- Live progress, cancellation, retries, and crawl history
- CSV/JSON export

### Dependencies

Phase 1 foundation and finalized crawl network policy.

### Exit criteria

- A Ghost sitemap index such as `https://adamandlinds.com/sitemap.xml` can be audited without site-specific code.
- Failed pages are isolated and retryable.
- Results survive worker restarts.
- Every finding links to evidence and a rule version.

### Deferred

Search performance, AI quality judgments, semantic clustering, and CMS writes.

## Phase 3 — Search Console and analytics

### Goals

Add demand, visibility, and trend data so prioritization reflects actual opportunity.

### Deliverables

- Incremental Google authorization
- Search Console property selection
- Historical page/query synchronization
- Date, country, device, page, and query dimensions where supported
- Import status and freshness indicators
- Ranking and impression trend features
- GA4 connection and core page metrics after Search Console is stable
- Manual CSV import fallback

### Dependencies

Google Cloud OAuth configuration and normalized site/page mapping.

### Exit criteria

- A user can connect a property and sync a bounded historical period.
- Repeated syncs are idempotent.
- Metrics map safely to canonical page identities while retaining unmatched rows.
- The dashboard distinguishes absent data from poor performance.

### Deferred

BigQuery bulk export unless normal API limits materially block the MVP.

## Phase 4 — AI-assisted analysis

### Goals

Add explainable editorial assessment without allowing AI to control site changes.

### Deliverables

- AI provider abstraction
- Anthropic connection and credential verification
- Prompt and schema registry
- Page and site-context review
- Structured output validation and bounded retries
- Usage and cost tracking
- Pre-run cost estimate and budgets
- Batch support where appropriate
- Human-readable findings with source excerpts

### Dependencies

Stable page snapshots, scoring contract, and credential handling.

### Exit criteria

- Selected pages can be analyzed reproducibly against a prompt version.
- Invalid responses never affect scores.
- Cached results avoid duplicate billable requests.
- Model findings are clearly distinguished from deterministic facts.

### Deferred

Autonomous rewriting, publishing, or destructive action.

## Phase 5 — Clustering, prioritization, and remediation

### Goals

Turn page-level evidence into a practical, ordered work queue.

### Deliverables

- Similarity and topic-cluster pipeline
- Shared-query and semantic-overlap evidence
- Primary/supporting/competing page roles
- Page and site score snapshots
- Opportunity, business importance, confidence, effort, and priority
- Remediation tasks with human decisions and notes
- Before/after audit comparisons
- Transparent score drill-down

### Dependencies

Search metrics and AI analysis should be available but optional. Deterministic-only operation must remain supported.

### Exit criteria

- The system ranks recommended work without hiding the underlying inputs.
- Important pages cannot disappear inside site averages.
- Merge/remove/redirect recommendations require explicit approval.
- Re-running after edits shows score and finding changes without rewriting history.

### Deferred

Automatic CMS mutation.

## Phase 6 — CMS, MCP, and evidence providers

### Goals

Connect recommendations to publisher-owned evidence and content systems.

### Deliverables

- General `EvidenceProvider` interface
- General `CmsProvider` interface
- Content Vault MCP adapter
- Ghost read integration
- Suggestions for relevant photos, video, trips, and journal evidence
- Evidence usage tracking where supported
- Safe preview and deep-link workflows

### Dependencies

Stable provider contracts and tenant-safe credential storage.

### Exit criteria

- Evidence suggestions are attributable and permission-scoped.
- A provider failure cannot block the base audit.
- No write action occurs without a separately accepted product and security change.

### Deferred

AI article generation and automated publishing.

## Phase 7 — Production hardening

### Goals

Operate reliably on a public HTTPS deployment.

### Deliverables

- Production Compose/deployment documentation
- Reverse proxy and TLS configuration
- Backups, restore tests, and migration runbook
- Queue recovery and monitoring
- Rate, crawl, and cost limits
- Container/dependency scanning
- Audit logs and security review
- Data export/deletion flows

### Dependencies

Production host and reverse proxy decisions.

### Exit criteria

- Security checklist passes.
- Backup restoration is demonstrated.
- Web and workers can be independently restarted and scaled.
- Alerts cover failed jobs, provider errors, queue backlog, and storage health.

### Deferred

Multi-region scale, billing, and enterprise administration unless actual usage requires them.

## Open roadmap questions

- When BigQuery export becomes necessary
- Embedding provider and storage
- Production hosting and reverse proxy
- Commercial or billing plans
- Repository visibility