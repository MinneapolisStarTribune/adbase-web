# Forecasting Implementation and Verification Status

Initial implementation: 2026-11-17. Latest update: 2026-11-25.

The application provides a standalone workflow using synthetic data: territory authorization, querying and filtering, pagination, creation and editing of twelve monthly forecast amounts, annual totals, advertiser maintenance, Domo CSV downloads, mock sessions, and auditing. It does not connect to a real database, execute stored procedures, or integrate with Entra ID.

## Implementation scope

| Checklist area                        | Status                                                                                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 2: Engineering foundation     | Implemented: independent application, type checking, code standards, configuration validation, lockfile, and test tooling.                                                                                                      |
| Section 3: Layering                   | Implemented: pages and request handlers, business layer, repository interfaces, mock adapters, and server-side composition. Real SQL implementation is excluded from this phase.                                                |
| Section 4: Business contracts         | Testable interfaces and synthetic rules are implemented. Final rules for amounts, uniqueness, and historical ownership still require team confirmation.                                                                         |
| Section 5: Identity and authorization | Mock accounts, a server-side session interface, logout, expiry, territory authorization, and operation authorization are implemented. Entra registration, real identity mapping, and shared session storage are not integrated. |
| Section 6: Synthetic workflows        | Implemented and verified with business and browser tests.                                                                                                                                                                       |
| Section 7: Database integration       | Excluded from this phase.                                                                                                                                                                                                       |
| Section 8: Operational foundation     | CI definitions, logging, correlation IDs, auditing, a health check, a Dockerfile, and non-production Compose configuration are provided. No cloud deployment has been performed.                                                |

## Test data

Metadata in `src/modules/forecasting/infrastructure/metadata.json` defines three years, three territories, three products, and four account types. `mock-repository.ts` generates 37 advertisers and 37 forecast records. The fixtures cover the 30-row pagination boundary, zero and negative amounts, decimals, excluded advertiser `999999`, and product names containing commas, quotes, newlines, and formula prefixes.

The mock rules make the application executable; they do not establish the behavior of the real stored procedures.

## Initial verification and session regression

The initial implementation passed:

- TypeScript type checking, ESLint, and Prettier.
- 27 unit/business tests covering metadata relationships, roles and territory scopes, search precedence, pagination and totals, amount validation, creation and editing, duplicate and concurrency conflicts, advertiser change constraints, CSV output, session expiry, and configuration isolation.
- Five Chromium end-to-end scenarios: representative querying, editing, cancellation, and logout; delegate forecast creation; administrator advertiser maintenance and CSV download; denial for an account without territory access; and direct HTTP checks for authentication, authorization, Origin validation, and session revocation.
- The optimized Next.js build.
- Compose configuration validation with `docker compose config --quiet`.

Initial verification ran on Windows with Node.js 20.19.5. CI and Docker definitions use Node.js 24. Browser tests start and stop their own mock service at `127.0.0.1:3101` and do not use legacy application pages.

A subsequent regression fix addressed login responses of 403 when `APP_ORIGIN` was unset and the browser used `localhost` while Next.js used `127.0.0.1` internally. Origin validation now uses the request Host when no explicit origin is configured. Explicit origins still require an exact match, and forwarded headers are not trusted. After this fix, 40 unit/business tests and six end-to-end scenarios passed, including localhost login and logout, IP address access, and cross-origin rejection. Type, lint, formatting, and build checks also passed.

## Previous-year candidates: 2026-11-25 update

- Queries include zero-amount candidates for advertiser/product combinations present in the previous year but absent from the selected year in the same territory. Current-year records take precedence. Unsaved candidates do not recursively seed later years.
- The list distinguishes saved records from unsaved candidates. Saving a candidate uses the create endpoint; subsequent edits use the new record's update endpoint. Querying, pagination, and cancellation do not persist candidates or change previous-year records.
- Advertisers or products unavailable in the target year remain visible with an explanation and disabled Save. The server rechecks availability. When names differ between years, records are merged and deduplicated before searching the retained name snapshot.
- Existing 2026 metadata and fixtures are reused. New tests generate saved 2027 records, duplicates, and renamed advertisers in isolated in-memory repositories.
- Verification passed: type checking, ESLint, Prettier, 46 unit/business tests, the Next.js build, and seven Chromium browser scenarios. The additional browser scenario covers candidate pagination, cancellation, creation, and subsequent editing, and confirms that previous-year data remains unchanged.
- The local sandbox initially blocked test/build subprocesses with `spawn EPERM`. Approved reruns outside the sandbox passed. Browser tests used an isolated local mock service; they did not access real databases or run legacy pages.

## Remaining verification and limitations

- At the time of verification, the local Linux Docker engine was not running, so container build and runtime checks were not completed locally. The CI definition includes a container build check.
- Remote GitHub Actions execution, AWS deployment, shared sessions across instances, and production rollback and recovery remain unverified.
- Real database results, stored-procedure transactions and concurrency, Entra login, real permission mappings, and reconciliation with the Domo consumer are excluded from this phase.

Mock data, sessions, and audit events are held in process memory and reset when the service restarts. Production configuration rejects mock authentication and mock data. Checklist section 1, items 2-4 remain deferred for subsequent team discussion.
