# Product Requirements

## Problem

Publishers with dozens or hundreds of pages often know that site quality has declined but cannot reliably determine what to fix first. Existing tools emphasize technical SEO metrics, generic checklists, or opaque scores. They rarely combine crawl evidence, search performance, editorial quality, first-hand experience, topical overlap, business value, and remediation workflow.

Site Quality Audit must turn a whole-site assessment into an explainable, prioritized work queue.

It must not claim to diagnose an algorithmic penalty or prove why a search engine changed rankings. It surfaces risks, opportunities, and supporting evidence.

## Vision

A self-hostable, multi-site application that helps publishers systematically improve every page over time.

The central user question is:

> What should we fix next, why, and what evidence supports that recommendation?

## Target users

Primary:

- Independent publishers and content teams managing roughly 50 or more pages
- Affiliate publishers who need to distinguish useful commercial content from thin or repetitive content
- Travel and experience-led publishers with first-party photos, video, journals, or trip records

Secondary:

- Agencies performing repeatable content audits
- Smaller publishers who want a guided backlog rather than a full enterprise SEO suite

## Jobs to be done

- Assess an entire site without manually opening every page.
- Identify technically broken, editorially weak, duplicative, low-evidence, or commercially over-aggressive pages.
- Protect pages that are already valuable.
- Find high-opportunity pages where modest work may produce meaningful improvement.
- Decide whether related pages should remain separate, be rewritten, merged, redirected, removed, or monitored.
- Track completed work and compare later audits.
- Connect recommendations to first-party evidence the publisher already owns.

## Product principles

1. Every recommendation is explainable.
2. Deterministic evidence comes before paid AI judgment.
3. AI behaves as a senior editorial adviser, not an autonomous decision-maker.
4. Destructive actions require explicit human approval.
5. Scores are versioned and transparent.
6. The product is task-oriented: it should make the next useful action obvious.
7. The product remains general and is not hard-coded for one site or CMS.

## Roles

### Owner

Manages a workspace, members, sites, integrations, credentials, retention, and destructive settings.

### Editor

Runs audits, reviews findings, accepts or rejects recommendations, and manages remediation tasks.

### Viewer

Can view sites, audits, findings, and reports but cannot change integrations or accept destructive recommendations.

The initial product exposes Owner functionality and automatically creates one private workspace with an Owner membership for each newly authenticated user. Shared-workspace management remains deferred, while persistence and authorization remain membership-based from the beginning.

## Functional requirements

### Site management

- Add multiple sites.
- Configure primary URL, sitemap URL, language, market, CMS type, business model, authors, important topic areas, and URL exclusions.
- Verify site reachability and sitemap validity.
- Prevent duplicate normalized site registrations within a workspace.

### Crawling

- Parse sitemap indexes and nested sitemaps.
- Crawl sitemap URLs and optionally discover internal URLs.
- Respect configurable concurrency, delays, timeouts, redirect limits, maximum response sizes, and URL limits.
- Use standard HTTP fetching first and browser rendering only when necessary.
- Record status, redirect chain, canonical, robots directives, headings, body content, metadata, links, images, video embeds, structured data, dates, author signals, and content fingerprints.
- Show live progress and recover safely from interruption.

### Deterministic analysis

- Detect indexability conflicts, canonical mismatches, broken links, redirect chains, missing or duplicate metadata, thin main content, low text-to-template ratios, orphan risk, excessive affiliate-link density, missing author/date signals, sitemap inconsistencies, and near-duplicate content.
- Findings must include severity, evidence, rule version, and affected URLs.

### Search data

- Connect Google Search Console through OAuth.
- Select an authorized property.
- Synchronize page- and query-level clicks, impressions, CTR, and average position by date and supported dimensions.
- Preserve historical imports and synchronization metadata.
- Allow CSV import as a fallback or early implementation path.
- Add GA4 later for page views, engagement, and key-event context.

### AI analysis

- Support configurable AI providers, initially Anthropic.
- Store provider credentials securely.
- Estimate cost before large runs where practical.
- Analyze page quality using structured, validated output.
- Assess originality, information gain, first-hand experience, evidence, trust, intent satisfaction, editorial quality, generic-language risk, template risk, thin-content risk, affiliate-first risk, factual specificity, and justification for a standalone page.
- Never label content as definitively AI-written.
- Support page review, site-context review, and cluster review.

### Clustering

- Group pages using titles, headings, semantic similarity, internal links, URL structure, and shared Search Console queries.
- Identify likely primary pages, supporting pages, competing pages, distinct intents, merge candidates, and missing coverage.
- Require human review before consolidation decisions become tasks.

### Scoring and prioritization

Keep distinct:

- Quality risk
- Traffic opportunity
- Business importance
- Recommendation confidence
- Estimated effort
- Work priority

Every score must expose its inputs, weights, version, and missing-data behavior.

### Remediation

Supported actions:

- Protect
- Quick improvement
- Major rewrite
- Merge
- Redirect
- Remove
- Technical correction
- Internal-link improvement
- Add first-party evidence
- Monitor

Statuses:

- Unreviewed
- Accepted
- In progress
- Completed
- Rejected
- Needs evidence
- Monitor

Users can add notes, override priority with a reason, select merge or redirect targets, and retain an audit trail.

### Dashboard

- Show current site health and changes over time.
- Emphasize current work, high-priority risks, high-opportunity pages, crawl failures, and analysis progress.
- Allow drill-down from every aggregate score to affected pages and source findings.
- Avoid decorative metrics that do not lead to action.

### Integrations

- Configure integrations in the web application.
- Verify, mask, rotate, and remove stored credentials.
- Future connectors include Ghost, WordPress, custom MCP servers, and evidence providers such as Content Vault.

## Non-functional requirements

- Docker-first local and production operation
- Durable, retryable background jobs
- Tenant isolation
- Encrypted credentials at rest
- Accessible, responsive dashboard
- Observable job state and failures
- Reproducible scoring
- Versioned prompts, schemas, rules, and formulas
- Idempotent synchronization and analysis
- Safe handling of untrusted web and model content

## MVP

The MVP is complete when one authenticated owner can:

1. Create a site.
2. Provide a sitemap.
3. Run a resumable crawl.
4. View extracted page data and deterministic findings.
5. Import or synchronize Search Console page metrics.
6. Configure an Anthropic credential.
7. run structured AI analysis on selected pages.
8. View transparent page scores and a prioritized backlog.
9. Accept, reject, or track recommendations.
10. Rerun an audit and compare snapshots.

Topic clustering may begin with a limited implementation, but the data model and interfaces must support later semantic expansion.

## Explicit non-goals for the initial product

- Automated article generation
- Autonomous publishing or CMS modification
- Automatic redirects, deletions, or merges
- Rank tracking as a replacement for dedicated rank trackers
- Keyword-density or TF-IDF optimization
- Backlink crawling at Ahrefs/Semrush scale
- Proof that a particular Google system caused a ranking change
- Billing and subscription management
- Enterprise single sign-on

## Primary journeys

### First audit

Sign in → create site → validate sitemap → configure crawl → run crawl → review deterministic findings → connect/import Search Console → select pages for AI analysis → review prioritized backlog.

### Daily work

Open dashboard → see highest-priority accepted or unreviewed tasks → inspect evidence → accept/reject → work page → mark completed → schedule or run reassessment.

### Consolidation review

Open topic cluster → compare intents, performance, links, and quality → choose primary page → accept merge recommendation → create tracked tasks without changing the live site.

## Acceptance criteria

- No score is displayed without a drill-down explanation.
- A failed worker can restart without duplicating completed page snapshots or charges.
- A user cannot access another workspace's sites, credentials, findings, or jobs.
- The crawler blocks private/internal targets by default.
- AI output that fails schema validation is not stored as a valid analysis.
- Stored secrets are masked and cannot be retrieved through normal application APIs.
- Destructive recommendations remain recommendations until a human accepts them.

## Open product questions

- Which business-importance inputs are manual versus derived?
- How much historical data should the default deployment retain?
- Which dashboard views are required before private beta?
- Should CSV Search Console import precede OAuth integration?
- What crawl and AI limits should be configurable by deployment administrators?
- Does the repository remain public?
