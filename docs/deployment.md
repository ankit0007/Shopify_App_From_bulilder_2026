# Production deployment isolation

This app must run as an isolated service on `formbuilder.it3.in`. Existing
websites and applications on the server are out of scope and must not be
modified.

## Isolation contract

- Dedicated deployment directory, for example `/opt/shopify-form-builder`.
- Dedicated Docker Compose project and container names.
- Dedicated PostgreSQL database and credentials.
- Dedicated environment file owned by root with mode `0600`.
- Dedicated system service or Compose restart policy.
- Dedicated reverse-proxy virtual host for `formbuilder.it3.in`.
- Only ports 80/443 are exposed publicly; PostgreSQL is private to the app.
- No existing Nginx/Apache virtual host, certificate, database, or service is
  replaced.

Before the first deployment, inventory the server read-only:

```sh
hostnamectl
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'
systemctl list-units --type=service --state=running
ss -ltnp
nginx -T
apachectl -S
```

The output must be reviewed before adding a reverse-proxy route. If Nginx,
Apache, or another gateway already owns the domain, add one isolated site
entry and reload only after configuration validation. Never overwrite the
existing gateway configuration.

## Required production values

The following values belong only in the server environment, never in Git:

- Shopify API key and API secret
- `SHOPIFY_APP_URL=https://formbuilder.it3.in`
- PostgreSQL `DATABASE_URL`
- Redis `REDIS_URL` for the production submission rate limiter
- Shopify app client ID and scopes
- Any storage, email, or integration credentials added in later phases

The supplied root password is not stored in this repository or deployment
files. It should be rotated after secure access is established, and a
non-root deployment user with least-privilege access should be created before
production operation.

## Shopify launch requirements

Server deployment alone does not make the app App Store-ready. The Partner
Dashboard must still contain the production app URL, redirect URLs, privacy
policy, support details, billing plans, scopes, compliance webhook
configuration, and App Store listing information. Run `shopify app deploy` only
after those values and the production database are verified.
