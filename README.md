# Shopify Form Builder

Production foundation for a Shopify public app that provides a visual form builder, published storefront forms, and a validated submission foundation. This repository is based on Shopify's current React Router app template and uses a Theme App Extension plus Shopify App Proxy for storefront delivery.

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

## Phase 2 scope

The premium builder now supports form creation, field library drag-and-drop,
one/two/three-column layouts, responsive preview modes, field/form/style
settings, draft saves, explicit publishing, disabling, duplication, deletion,
and immutable shortcode copying. Supported fields are text, textarea, email,
phone, number, URL, password, date, time, datetime, select, multi-select,
radio, checkbox, yes/no, and hidden.

Publishing is explicit and server-validated. Edits after publishing are stored
in a new draft version, so incomplete work cannot change the published
configuration.

## Phase 1 foundation

Included: official Shopify app foundation, PostgreSQL Prisma schema, tenant relationships, form/version/layout/style entities, placement model, submission/file/notification/integration/billing/audit entities, mandatory compliance webhook endpoint, Theme App Extension block contract, admin navigation shell, and identity/isolation tests.

Phase 2 and Phase 3 add the visual editor, published storefront rendering, and
validated submission storage. Email/file processing, analytics, integrations,
and billing enforcement remain deferred.

## Phase 3 storefront and submissions

Published forms are loaded through the Shopify App Proxy path configured in
`shopify.app.toml` and placed through the Theme App Extension block. The proxy
resolves only a tenant-matched published version using the immutable
`Form.publicId`; draft and disabled forms fail safely. Storefront submissions
are validated server-side, reject unknown fields and oversized payloads, and
are pinned to the exact published `FormVersion` used for validation.
Password fields remain rejected at submission time because plaintext password
retention is not implemented. Development uses a small in-memory submission
throttle; production requires a shared Redis/equivalent limiter.

The admin `/app/submissions` page is tenant-scoped and paginated. Values are
rendered as escaped text, never trusted HTML. App Proxy activation, production
URLs, extension deployment, compliance subscriptions, and Partner Dashboard
configuration require Shopify Partner Dashboard verification.

See [`docs/architecture.md`](docs/architecture.md) for boundaries and decisions.

## Production server safety

The production deployment is designed to coexist with other applications on
`formbuilder.it3.in`. It uses a dedicated directory, Compose project,
PostgreSQL database, environment file, service, and reverse-proxy route. It
must never overwrite an existing site or service. See
[`docs/deployment.md`](docs/deployment.md) for the isolation contract and
pre-deployment inventory checklist.
