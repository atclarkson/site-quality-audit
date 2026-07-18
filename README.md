# Site Quality Audit

Site Quality Audit is a self-hostable web application for assessing the technical, editorial, and strategic quality of content websites.

Current crawler scope:

- Starts from a site's primary URL and optional sitemap
- Crawls up to 100 same-host pages per audit at depth 5
- Uses `SiteQualityAuditBot/0.1` as the crawler user agent
- Collects safe technical metadata such as HTTP status, titles, descriptions, canonicals, robots directives, headings, word counts, links, images, structured data counts, and crawl timing
- Persists crawl progress and page inventory for each audit run
- Does not execute client-side JavaScript or browser rendering yet

## Setup

1. Copy `.env.example` to `.env`
2. Start PostgreSQL and Redis: `pnpm db:up`
3. Install dependencies: `pnpm install`
4. Generate Prisma: `pnpm db:generate`
5. Apply migrations: `pnpm db:migrate`
6. Start the web app and worker: `pnpm dev`
7. Run validation: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`

Run a local audit:

1. Start the stack with `pnpm db:up`
2. Start the web app and worker with `pnpm dev`
3. Sign in, add a small public site, and start an audit from the site detail page

Crawler defaults:

- Maximum 100 HTML pages per audit
- Maximum crawl depth 5
- Maximum response size 5 MB
- Request timeout 15 seconds
- Maximum 5 redirects
- Concurrency 3 with a small per-host delay
- `www` and non-`www` hostnames are treated as distinct crawl scopes

Google OAuth environment variables:

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `REDIS_URL`

Local Google OAuth callback URL:

- `http://localhost:3000/api/auth/callback/google`

Real Google OAuth credentials belong only in `.env`.

Useful commands:

- `pnpm db:status`
- `pnpm db:logs`
- `pnpm db:down`
- `pnpm db:reset` (development only)

## Documentation

- [Product requirements](docs/product-requirements.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Scoring framework](docs/scoring-framework.md)
- [AI analysis](docs/ai-analysis-schema.md)
- [Security](docs/security.md)
- [Roadmap](docs/roadmap.md)
- [Architecture decisions](docs/decisions/)
