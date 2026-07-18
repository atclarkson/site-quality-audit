# Site Quality Audit

Site Quality Audit is a self-hostable web application for assessing the technical, editorial, and strategic quality of content websites.

## Setup

1. Copy `.env.example` to `.env`
2. Start PostgreSQL: `pnpm db:up`
3. Install dependencies: `pnpm install`
4. Generate Prisma: `pnpm db:generate`
5. Apply migrations: `pnpm db:migrate`
6. Run validation: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`

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
