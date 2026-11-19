# 0001. Every visitor gets their own tenant, so the demo proves the tenancy model

- **Status:** Accepted
- **Decided:** 2026-11-19
- **Written:** 2026-11-19, while building v2

## Context

The public demo needs data a visitor can change: send updates, move the clock, reply as a customer. A shared demo tenant would let one visitor see what another typed, and every visit would start from someone else's mess. v1 avoided the problem by having no writes at all, and still leaked a second tenant's data into the browser.

## Decision

- Opening the demo creates a new tenant for that visitor, seeded with the same story (`apps/web/lib/server/seed.ts`), and sets a signed cookie naming it. The cookie lasts 24 hours.
- The tenant is the only scope: every query runs through `withTenant`, and row-level security does the rest (0002).
- Sandbox creation is rate-limited per salted address hash, counted in Postgres (`rate_limit_hit`).
- A cleanup function (`purge_expired_tenants`) deletes expired sandboxes and everything they own.

## Alternatives

- **One shared demo tenant, reset nightly.** Simpler, but visitors would trample each other, and free-text fields would need moderation.
- **Client-only demo state.** No server at all, which proves nothing about the tenancy model.

## Consequences

- The demo's own isolation is the tenancy test, run by every visitor. A cross-tenant leak would show up as someone else's data on screen.
- A visitor only sees their own sandbox, so there is nothing to moderate. Sandbox status pages are `noindex`, carry a demo banner, and expire with the sandbox.
- The database grows with traffic, so expired tenants have to be purged (`/api/cron/sweep`).

## Evidence

`apps/web/e2e/console.spec.ts` ("tenant isolation over HTTP") opens two sandboxes and checks that neither can see or address the other.
