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

## Storefront placement

The Phase 1 contract uses a Theme App Extension app block for inline placement.
Later phases can add the single Shopify app proxy endpoint for dynamic data and
submissions, plus an app embed for site-wide or floating behavior. Arbitrary
shortcodes are not assumed to execute in Shopify themes; manual placement is
represented as a `SHORTCODE` display surface and must be implemented through a
Shopify-supported surface.

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
from Git. Personal-data retention and customer redaction policies will be
completed alongside submission workflows.
