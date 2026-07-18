# Site Quality Audit

Site Quality Audit is a self-hostable web application for assessing the technical, editorial, and strategic quality of content websites.

This repository now contains the first Phase 1 scaffold:

- `apps/web`: Next.js App Router web application
- `apps/worker`: separate Node.js worker process
- `packages/config`, `packages/domain`, `packages/logging`, `packages/validation`: shared workspace packages

## Setup

1. Enable pnpm through Corepack if needed: `corepack enable`
2. Install dependencies: `pnpm install`
3. Copy `.env.example` to `.env`
4. Start both processes: `pnpm dev`

Useful commands:

- `pnpm dev:web`
- `pnpm dev:worker`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test`
- `pnpm build`

## Documentation

- [Product requirements](docs/product-requirements.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Scoring framework](docs/scoring-framework.md)
- [AI analysis](docs/ai-analysis-schema.md)
- [Security](docs/security.md)
- [Roadmap](docs/roadmap.md)
- [Architecture decisions](docs/decisions/)
