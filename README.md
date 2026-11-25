# AdBase Web

Next.js, React, and TypeScript application for incrementally migrating business features from the legacy `AdvAdBaseWeb` application. Forecasting Grid is the first business module, backed entirely by synthetic metadata and an in-memory repository. Real database access, stored procedures, and Entra ID are intentionally not connected.

The modern application lives in `adbase-web/`, alongside the legacy `AdvAdBaseWeb/` project and the repository-level `docs/`. Run the commands below from `adbase-web/`.

## Run locally

Use Node.js 24 LTS (`.nvmrc`) and npm. The initial workstation also passed verification on Node.js 20.19.5.

```powershell
# Only copy the example if you do not already have .env.local.
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Open http://localhost:3000 and choose a sample account. Four accounts cover a representative, a delegated representative, an administrator, and an employee without territories. The account picker is a mock identity provider, not enterprise authentication. Keep the sample application on a local or isolated test network.

The existing `.env.local` is preserved. Application writes modify in-memory fixtures only. Changes are shared by users of the same process and reset on server restart. A restart also invalidates every sample session. This sample requires one process/replica; a real shared session store, durable data and audit adapters belong to the later integration phase.

## Implemented workflows

- Territory and configurable-year selection; advertiser ID/name search; ALL, #, and A–Z ranges; 30-row pagination. Search text overrides the range.
- Previous-year advertiser/product combinations appear as unsaved zero-amount candidates when missing from the selected year. Saving creates a target-year record; unavailable products remain visible with an explanation.
- Territory annual totals across all advertisers and pages, with decimal-string transport and exact decimal aggregation.
- Forecast creation, editing of all twelve amounts, per-month validation, cancellation, duplicate detection, and optimistic version checks. Editing uses the original record identity; filters cannot alter its territory or year.
- Administrator-only advertiser search, creation, ID/name/territory editing, duplicate checking, and conflict handling.
- Administrator-only Domo CSV download with eight ordered columns, one row per nonzero month, advertiser 999999 exclusion, CSV quoting, and text formula protection.
- Opaque server-side sample sessions, logout/revocation, idle and absolute expiry, same-origin write checks, and authorization for direct API calls. User roles never come from a query parameter or mutation payload.
- Structured logs, request correlation IDs, audit events, a restricted activity view, and configuration health checks.
- CI, Linux Docker image definition, and local non-production Compose configuration.

## Structure

Business modules live under `src/modules/<module>/`; add future migrated features as siblings of `forecasting/`. Keep their domain rules, use cases, ports, and adapters within their own module. `src/app/` contains Next.js pages and HTTP entry points; `src/server/` contains server composition and shared infrastructure. The current home page serves Forecasting Grid.

```text
src/app/                         Pages, client forms, request/download handlers
src/modules/forecasting/
  domain/                        Types, validation, decimal rules
  application/                   Authorized use cases and CSV transformation
  ports/                         Repository, clock and audit interfaces
  infrastructure/                Synthetic metadata and in-memory repository
src/server/
  auth/                          Sample session store and actor resolution
  config/                        Environment validation
  observability/                 Logging support
  runtime.ts                     Server-only dependency composition
  http.ts                        Request parsing, origin checks and error responses
tests/                           Domain, repository, session and config tests
tests/e2e/                       Browser workflows and direct API security tests
```

Business code does not import Next.js request/cookie/redirect APIs. Pages resolve initial context directly through the service. Interactive browser operations call HTTP handlers, which validate requests, resolve the server session, and invoke authorized use cases. User-specific responses are not cached.

## Metadata and sample data

Edit `src/modules/forecasting/infrastructure/metadata.json` to configure sample years, territories, products, product availability, and account scopes. `mock-repository.ts` builds fictional advertiser and forecast fixtures, including enough records for pagination, zero and negative values, decimal fractions, and CSV special characters. Tests create independent repositories; browser tests start a fresh server and use its shared fixtures.

## Commands and verification

```powershell
npm run check        # TypeScript, ESLint, formatting, unit/business tests
npm run build
npm start            # Local optimized build; APP_ENV must remain development/test

# Install browser binaries into the ignored project-local cache once.
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.playwright'
npx playwright install chromium
npm run test:e2e     # Starts and stops its own mock server on 127.0.0.1:3101
npm run test:all     # Checks, build, then browser/API tests
```

The six E2E scenarios cover localhost login without APP_ORIGIN, normal, delegated, administrator and unmapped accounts, plus direct HTTP requests that try to bypass identity, territory access, administrator permission and origin checks. The HTML report is generated at `playwright-report/index.html`; failure traces and screenshots are in `test-results/`. These outputs are ignored by Git. `npm run format` applies Prettier.

## Environment configuration

| Variable           | Purpose                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`          | `development`, `test`, or `production`. Defaults to production when `NODE_ENV=production`, otherwise development.                                          |
| `DATA_SOURCE`      | `mock` by default. `sqlserver` is reserved and rejected until an adapter is implemented.                                                                   |
| `AUTH_MODE`        | `mock` by default. `entra` is reserved and rejected until integration is implemented.                                                                      |
| `APP_ORIGIN`       | Optional exact public HTTP(S) origin without a trailing slash. Set it behind a reverse proxy. Otherwise the incoming Host and request URL scheme are used. |
| `BUILD_STANDALONE` | Set to `1` for the Docker standalone output. Ordinary builds support `npm start`.                                                                          |

Production rejects mock identity/data, and unsupported adapters never fall back to mocks. Config errors return an unavailable page/health status without exposing configuration values. `.env.local` is loaded by Next.js; files under `config/` are templates for explicit injection. Future credentials belong in server environment variables or a secret manager, never `NEXT_PUBLIC_*`. Logs contain no tokens, raw request bodies, amounts, or credentials.

## Containers and delivery

```powershell
docker compose config --quiet
docker compose up --build
```

Compose binds to `127.0.0.1:3000`, uses mock test configuration, and runs one replica. Open http://localhost:3000 (the configured public origin). The image uses Node.js 24, runs as a non-root user, and has an HTTP health check. The Docker build context excludes `.env*`, Git metadata, caches, and test artifacts. The bare image defaults to production and remains unavailable until approved production adapters exist; Compose explicitly selects test mode.

GitHub Actions defines installation, checks, build, Chromium tests, failure artifacts, and a Docker build. No remote repository, AWS resources, or live deployment has been configured. Container execution on the initial machine remains unverified because its Linux Docker engine is not running.

Before later production integration, supply real database and identity implementations, shared session/audit persistence, approved business rules, and platform-specific secrets, networking, deployment, and rollback configuration. Business-team discussions previously deferred remain deferred.
