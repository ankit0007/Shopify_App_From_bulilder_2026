# Shopify Form Builder architecture

## Runtime boundaries

- `app/routes` contains HTTP entry points only: authentication, loaders/actions,
  App Bridge shell, and webhook adapters.
- `app/domain` contains business rules that do not depend on React.
- `app/db.server.ts` and Prisma are the persistence boundary.
- `extensions/form-builder-theme` is the isolated storefront integration boundary.
  The admin bundle is never shipped to the storefront.

All merchant-owned records have a `shopId` foreign key. Services receive the
authenticated tenant context from Shopify server authentication; they never use a
shop identifier supplied by the browser as an authorization decision.

## Form identity

`Form.id` is the internal database key. `Form.publicId` is an immutable,
globally unique opaque identifier generated once at creation time. It is the only
input to `createFormShortcode`, producing `[form:<publicId>]`.

Names, titles, versions, styles, and display rules can change without changing
`publicId`. Duplication calls the creation path and receives a new public ID.
Shortcode resolution is tenant-scoped and only returns `PUBLISHED` forms.

## Phase 2 builder contract

The admin builder uses one normalized `FormBuilderConfig` for editing and
preview. Supported field types are text, textarea, email, phone, number, URL,
password, date, time, datetime, select, multi-select, radio, checkbox, yes/no,
and hidden. Each field has a stable key, safe submission name, row, column,
width, options, and validation configuration.

Explicit saves update the current draft version. If the current version is
already published, the save creates the next draft version first. Publishing
validates the draft, marks exactly one version as published, records
`Form.publishedVersion`, and changes the form status to `PUBLISHED`. This keeps
incomplete edits away from the future storefront renderer.

The builder UI is split into a field library, sortable canvas, and settings
panel. `@dnd-kit` supplies pointer and keyboard sorting primitives. Desktop,
tablet, and mobile preview modes use the same normalized configuration.

## Storefront placement

The Theme App Extension app block provides inline placement. The block passes
the immutable public ID to the app proxy endpoint configured in
`shopify.app.toml`; the proxy resolves only the current published version and
accepts validated submissions. The storefront bundle is a dependency-free,
namespaced asset inside the extension and never includes the admin builder or
Prisma client.

Arbitrary shortcodes are not assumed to execute in Shopify themes. Manual
placement is represented as a `SHORTCODE` display surface and must be
implemented through a Shopify-supported surface.

## Authentication, webhooks, and billing

The official Shopify React Router package owns managed installation, App Bridge
authentication, token exchange, and webhook HMAC verification. Mandatory public
app compliance topics are registered in `shopify.app.toml`.

New public-app pricing uses Shopify App Pricing configured in the Partner
Dashboard. `BillingState` stores a local entitlement snapshot and plan key for
feature checks; it is not a payment system and does not create charges.

## Data and security

PostgreSQL is the production-oriented datasource. Prisma migrations are the
source of truth for schema changes. Files store an opaque storage key rather than
user-controlled paths. Secrets belong in environment variables and are excluded
from Git. Submissions are pinned to the published `FormVersion` used for
validation. Unexpected fields and oversized payloads are rejected; CAPTCHA,
rate limiting, notifications, uploads, analytics, and integrations remain
deferred. The compliance route remains HMAC-verified. Shop redaction removes
tenant data, while customer-level requests require a future customer
identity/retention policy because anonymous submission values are not linked to
Shopify customer records.

The app proxy URL, app block availability, production URLs, compliance
subscriptions, and extension deployment require Shopify Partner Dashboard
verification.
