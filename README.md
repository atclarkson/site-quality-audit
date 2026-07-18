# Site Quality Audit

Site Quality Audit is a self-hostable web application for assessing the technical, editorial, and strategic quality of content websites.

It will crawl sites, combine deterministic checks with AI-assisted review, connect search-performance data, identify overlap and weak evidence, and produce a transparent, prioritized remediation backlog.

## Status

Phase 0: product and architecture specification.

Application implementation has not begun.

## Product principles

- Every recommendation must be explainable.
- Deterministic checks run before paid AI analysis.
- AI advises; humans approve destructive actions.
- Quality risk, traffic opportunity, business importance, confidence, effort, and work priority remain separate concepts.
- The product reports risk indicators and evidence. It does not claim to prove the cause of a search-ranking change.
- The system is multi-site and must not be hard-coded for any single publisher.

## Initial use case

The first site assessed will be `https://adamandlinds.com`, using its Ghost sitemap index at `https://adamandlinds.com/sitemap.xml`.

This is an initial use case, not a product constraint.

## Planned capabilities

- Sitemap and internal-link crawling
- Technical and structural page checks
- Editorial and first-hand-evidence assessment
- Search Console integration
- Optional GA4 integration
- AI-assisted page and cluster analysis
- Topic overlap and cannibalization detection
- Transparent page and site scoring
- Prioritized remediation backlog
- Historical audits and progress tracking
- Future CMS, MCP, and evidence-provider integrations

## Documentation

- [Product requirements](docs/product-requirements.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Scoring framework](docs/scoring-framework.md)
- [AI analysis](docs/ai-analysis-schema.md)
- [Security](docs/security.md)
- [Roadmap](docs/roadmap.md)
- [Architecture decisions](docs/decisions/)

## Security

Never commit API keys, OAuth secrets, refresh tokens, credential-bearing integration URLs, production environment values, or private customer data.

User-entered integration credentials will be encrypted at rest and will never be returned to the browser after submission.

## Roadmap summary

1. Product and architecture specification
2. Application foundation
3. Crawl engine
4. Search Console and analytics
5. AI analysis
6. Clustering, prioritization, and remediation
7. CMS, MCP, and evidence providers
8. Production hardening
