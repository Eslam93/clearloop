# 0002. Postgres row-level security enforces tenancy, and the app cannot bypass it

- **Status:** Accepted
- **Decided:** 2026-11-19
- **Written:** 2026-11-19, while building v2

## Context

v1's design said scoping happens "at the data-access layer, not at the HTTP layer". The prototype did the opposite: it filtered tenants in the browser after downloading everything. The design intent was right; it needed a mechanism that does not depend on every query remembering a `WHERE`.

## Decision

- Every tenant table has `ENABLE` and `FORCE ROW LEVEL SECURITY` and a policy `tenant_id = app_current_tenant()`. The tenant is a transaction-local setting (`set_config('app.tenant_id', ..., true)`), which is safe with connection pooling.
- The app connects as `clearloop_app`: no superuser, no `BYPASSRLS`, owner of nothing. With no tenant set it sees no rows at all.
- `withTenant(ctx, fn)` is the only way application code gets a database handle. No raw handle is exported.
- Six narrow security-definer functions answer the few cross-tenant questions (rate limits, webhook and link lookups, the sweeper, purge, `rls_gaps`), each with explicit `EXECUTE` grants.
- `rls_gaps()` lists any table the app role can touch without forced row-level security and a policy. CI fails on any row.

The policy shape, the pool-safe setting and `rls_gaps` are ported from the postgres-data-layer pieces of the author's ToolKit.

## Alternatives

- **Application-level scoping only.** One forgotten filter is a breach, and nothing tests the absence of a filter.
- **A database per tenant.** Strong isolation, but heavy for thousands of short-lived sandboxes.

## Consequences

- The CI database's default user is a superuser, which skips row-level security entirely. Tests connect as the app role; a superuser test run would prove nothing.
- Cross-tenant work needs a security-definer function, which is deliberate friction.

## Evidence

`packages/db/tests/tenancy.test.ts`, and the guard-removal checks `rls-on-requests` and `rls-gaps` in `scripts/guard-checks.ts`.
