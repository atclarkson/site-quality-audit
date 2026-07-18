# Site Quality Audit

Site Quality Audit is a self-hostable web application for assessing the technical, editorial, and strategic quality of content websites.

## Setup

1. Copy `.env.example` to `.env`
2. Start PostgreSQL and Redis: `pnpm db:up`
3. Install dependencies: `pnpm install`
4. Generate Prisma: `pnpm db:generate`
5. Apply migrations: `pnpm db:migrate`
6. Start the web app and worker: `pnpm dev`
7. Run validation: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`

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
