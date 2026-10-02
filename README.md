# Shopify Form Builder

Production foundation for a Shopify public app that will provide a visual form builder for merchants. This repository is based on Shopify's current React Router app template and intentionally stops at Phase 1: architecture, tenant-safe persistence, authentication/webhook wiring, storefront extension contract, and identity tests.

## Stack

- Shopify CLI + React Router 7 + TypeScript
- Shopify managed installation, App Bridge, and Polaris web components
- Prisma with PostgreSQL for application data and Shopify sessions
- Tailwind CSS for reusable app-owned styling tokens
- Vitest for domain tests
- Theme App Extension for storefront placement

## Local setup

1. Install Node.js 22.12+ and Shopify CLI 4.8+.
2. Copy `.env.example` to `.env` and fill in local values. Never commit `.env`.
3. Create a PostgreSQL database and set `DATABASE_URL`.
4. Install packages and generate the Prisma client:

   ```shell
   npm install
   npm run setup
   ```

5. Link this project to a Shopify Dev Dashboard app after creating/selecting the app:

   ```shell
   npm run config:link
   ```

6. Start the Shopify development workflow:

   ```shell
   npm run dev
   ```

Shopify CLI manages the development tunnel, app configuration, and installation flow. The app is not considered linked until `shopify app config link` has been completed by a developer with Partner Dashboard access.

## Commands

- `npm run format` — format source files
- `npm run lint` — lint the repository
- `npm run typecheck` — generate React Router types and run TypeScript checks
- `npm test` — run unit/domain tests
- `npm run build` — create the production React Router build
- `npm run deploy` — deploy app configuration and extensions after Partner Dashboard setup

## Immutable form IDs

Every form has an opaque, immutable `publicId`. The shortcode is generated only from that ID:

```text
[form:184729]
```

The ID survives renames and configuration changes. Duplicating or recreating a form produces a new ID. Resolution is scoped by authenticated shop and only published forms render.

## Phase 1 scope

Included: official Shopify app foundation, PostgreSQL Prisma schema, tenant relationships, form/version/layout/style entities, placement model, submission/file/notification/integration/billing/audit entities, mandatory compliance webhook endpoint, Theme App Extension block contract, admin navigation shell, and identity/isolation tests.

Not included: the visual editor, complete submission handling, email/file processing, analytics, integrations, billing enforcement, or storefront rendering. Those are subsequent phases.

See [`docs/architecture.md`](docs/architecture.md) for boundaries and decisions.
