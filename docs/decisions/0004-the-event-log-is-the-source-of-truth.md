# 0004. The event log is the source of truth, and requests are a projection

- **Status:** Accepted
- **Decided:** 2026-11-19
- **Written:** 2026-11-19, while building v2

## Context

The timeline, update debt, the ask-first rate, the SLA pauses and the live stream all need the same history: who changed what, when, and whether the customer could see it.

## Decision

- `request_events` is append-only. The app role may only select and insert, and a trigger refuses `UPDATE` from every role, the owner included.
- `requests` holds the current status and version, updated in the same transaction as the event that changes them.
- Each event carries `visibility` (internal or customer), the virtual time it happened, and the writing transaction's id (`xid8`) for the live stream's read barrier (0007).

## Consequences

- Debt, metrics and SLA are pure functions of events (`apps/web/lib/domain`), unit-tested without a database.
- Deleting a sandbox deletes its events through the cascade, run by the owner in `purge_expired_tenants`.

## Evidence

`packages/db/tests/tenancy.test.ts` ("the event log"), and the guard-removal checks `event-log-trigger` and `event-log-grants`.
