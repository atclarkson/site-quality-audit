# Architecture

## Status

Accepted foundation architecture for Phase 1. Later-phase choices marked open must be resolved before implementation depends on them.

## System context

Site Quality Audit is a multi-site web application with long-running crawl, synchronization, and AI workloads. Interactive requests remain separate from durable background execution.

```mermaid
flowchart LR
  U[Publisher] --> W[Next.js web application]
  W --> DB[(PostgreSQL)]
  W --> Q[(BullMQ)]
  Q --> R[(Redis)]
  Q --> WK[Node.js worker]
  WK --> WEB[Public websites]
  WK --> GSC[Google Search Console]
  WK --> GA[GA4 - later]
  WK --> AI[AI providers]
  WK --> EP[Evidence/CMS providers - later]
  WK --> DB
```

## Repository and process boundaries

Use a pnpm workspace TypeScript monorepo with:

- a Next.js App Router web application;
- a separately runnable Node.js TypeScript worker;
- shared packages for Prisma database access, Zod validation, queue contracts, structured logging, and domain types.

Web and worker may share trusted packages and database models, but they have independent startup, health, scaling, and failure behavior. Web-only code must not be imported into workers. Long-running work must not depend on a web request remaining active.

## Components

### Web application

Responsibilities:

- Auth.js Google authentication and database-backed sessions
- Server-side workspace authorization
- Site and integration configuration
- Audit creation and progress views
- Findings, scores, clusters, and remediation UI
- Credential submission without later secret disclosure
- Scheduling durable jobs
- Polling persisted progress state

The first interface creates and uses one private workspace per user while hiding workspace-management UI.

### Worker

A separately runnable process responsible for:

- Sitemap discovery
- HTTP crawling
- Browser-rendering fallback
- Extraction and deterministic checks
- Search Console and analytics synchronization
- AI requests and validation
- Clustering and score calculation
- Retry, checkpoint, and cancellation behavior

Workers revalidate workspace and site ownership from PostgreSQL rather than trusting queue payloads alone.

### PostgreSQL and Prisma

PostgreSQL is the system of record for tenant data, configuration, crawl snapshots, findings, metrics, prompts, model usage, recommendations, remediation history, durable progress, identities, and sessions.

Prisma is the accepted ORM. Persisted schema changes use checked-in Prisma migrations. Shared or deployed migration history is not rewritten.

### Durable job queue

BullMQ backed by Redis provides at-least-once job delivery.

Required capabilities:

- Retry policies and bounded backoff
- Scheduled and dependent jobs
- Per-site and global concurrency controls
- Cancellation
- Progress reporting
- Idempotency support
- Failed-job inspection

Queue payloads contain identifiers and versioned inputs, not credentials or large page content. PostgreSQL remains the source of truth for user-visible job progress and terminal state. Redis persistence is enabled for Docker deployments.

### Authentication and tenancy

Auth.js handles Google OAuth with database-backed sessions. Authentication establishes identity but does not replace workspace authorization.

Workspace is the tenant boundary. The first successful login transactionally creates a private workspace and Owner membership. Every tenant-owned operation verifies membership server-side. Background workers perform the same ownership validation.

### Credentials and deployment secrets

User-managed integration credentials are stored in PostgreSQL as AES-256-GCM authenticated encrypted payloads with fresh random nonces, authentication tags, and encryption-key versions.

Deployment secrets such as database credentials, Redis credentials, OAuth secrets, session secrets, and encryption master keys remain outside the application-managed credential vault. Local Docker development uses uncommitted `.env` files based on committed safe examples. Production uses environment variables or mounted secret files. Zod validates required configuration at startup.

### Object storage

Object storage is not required for Phase 1. It may later hold raw HTML, screenshots, large exports, or generated reports. The database should store references rather than large binaries when it is introduced.

## Deployment model

Docker-first.

Initial Compose services:

- `web`
- `worker`
- `postgres`
- `redis`

Production may place web and worker on the same host while keeping them as separate services. Migration execution is an explicit deployment step and must not race across ordinary service startup. The reverse proxy and hosting provider remain open.

## Crawl lifecycle

```mermaid
stateDiagram-v2
  [*] --> Created
  Created --> Discovering
  Discovering --> Queued
  Queued --> Crawling
  Crawling --> Extracting
  Extracting --> Checking
  Checking --> Completed
  Discovering --> Failed
  Crawling --> Failed
  Extracting --> Failed
  Checking --> Failed
  Failed --> Queued: retry/resume
  Created --> Cancelled
  Queued --> Cancelled
  Crawling --> Cancelling
  Cancelling --> Cancelled
```

1. Normalize and validate the site and sitemap URL.
2. Enforce network policy before each request and redirect.
3. Discover sitemap indexes and URL sets.
4. Create stable URL records and crawl jobs with idempotency keys.
5. Fetch with ordinary HTTP.
6. Use browser rendering only when configured or extraction indicates it is needed.
7. Persist an immutable page snapshot.
8. Run deterministic extraction and checks.
9. Update progress counters transactionally.
10. Complete the crawl only when terminal child jobs are accounted for.

## AI-analysis lifecycle

1. User selects pages or an audit policy selects eligible pages.
2. System calculates estimated usage and records provider/model configuration.
3. Input is cleaned, bounded, labeled as untrusted content, and associated with site context.
4. A versioned prompt and response schema are selected.
5. Worker submits request or batch.
6. Response is parsed and validated.
7. Invalid output is retried with bounded repair attempts.
8. Valid output is stored immutably with prompt version, model, usage, cost, and confidence.
9. Scores and recommendations are calculated separately from raw model output.

AI output never directly mutates site content or authorizes destructive remediation.

## Background-job design

Jobs should be coarse enough to avoid excessive queue overhead and fine enough to retry without repeating an entire audit.

Suggested hierarchy:

- Audit orchestration job
- Sitemap discovery job
- Page crawl job
- Page deterministic-analysis job
- Search data synchronization job
- Page AI-analysis job
- Cluster-generation job
- Score-calculation job
- Audit-finalization job

Each job requires:

- Workspace and site identifiers
- Stable idempotency key
- Input version
- Attempt count
- Cancellation check
- Structured result or failure code

## Idempotency

- A page snapshot is uniquely identified by crawl, normalized URL, fetch variant, and content-hash policy.
- Search metrics use source, property, date, dimensions, and page/query keys.
- AI runs use page snapshot, prompt version, provider, model, and analysis mode.
- Retried jobs may update job state but must not duplicate immutable results or billable requests when a completed result already exists.
- Initial workspace provisioning must tolerate repeated or concurrent authentication callbacks without creating duplicates.

## Integration boundaries

Use explicit provider interfaces for:

- AI provider
- Search-performance provider
- Analytics provider
- CMS provider
- Evidence provider
- Rendering provider

Provider-specific tokens and response objects must not leak into domain models.

## Live progress

The database remains the source of truth. Phase 1 uses polling for progress updates. Server-sent events may be added later without changing persisted job state or progress contracts.

Track at least:

- URLs discovered
- URLs queued
- Fetching
- Successfully fetched
- Failed
- Deterministically analyzed
- AI queued
- AI completed
- AI failed
- Estimated and actual cost

## Failure handling

- Classify retryable and permanent failures.
- Use bounded exponential backoff.
- Record HTTP, extraction, validation, provider, quota, and policy failures separately.
- Permit page-level retries without restarting the whole audit.
- An audit may complete with warnings when a defined failure threshold is not exceeded.
- Cancellation stops new work and allows active work to finish or time out safely.

## Observability

- Structured logs with tenant-safe identifiers
- Correlation IDs spanning web request, audit, and job
- Job duration and failure metrics
- Crawl response and extraction metrics
- AI token, latency, validation, retry, and cost metrics
- Health and readiness endpoints
- Administrative failed-job inspection

Secrets, raw authorization headers, and unredacted sensitive content must not enter logs.

## Scaling

Initial deployment can use one web and one worker service. Scale workers horizontally by workload type later.

Potential future separation:

- Browser worker
- Crawl worker
- AI worker
- Synchronization worker

Concurrency must be constrained per host, per site, per provider, and globally.

## Alternatives considered

### Single-process application

Rejected because long crawls and AI runs should survive web restarts and cannot safely occupy request lifecycles.

### SQLite

Rejected for the primary deployment because concurrent workers and multi-user history are first-class requirements. It may remain useful for isolated tests.

### Browser rendering for every page

Rejected. It is slower, more expensive, and increases attack surface. Standard HTTP is the default with explicit fallback.

### Serverless-only architecture

Not selected for the initial product because durable crawling and browser workloads fit persistent workers more naturally. Parts of the web layer may later be deployable serverlessly.

## Open decisions

- Embedding provider and vector storage
- Raw-content and object-storage policy
- Production reverse proxy and hosting