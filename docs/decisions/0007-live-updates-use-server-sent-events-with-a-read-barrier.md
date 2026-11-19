# 0007. Live updates use Server-Sent Events over the event log, with a read barrier

- **Status:** Accepted
- **Decided:** 2026-11-19
- **Written:** 2026-11-19, while building v2

## Context

The two-window demo needs every open console to see a change within a couple of seconds. The app runs on serverless functions, which cannot hold a Postgres `LISTEN` connection.

## Decision

- `GET /api/stream` polls the event log every 1.5 seconds and sends `change` events with the event id. The browser's `EventSource` resumes with `Last-Event-ID` after a drop. Each connection lives about 50 seconds, inside serverless limits.
- Read barrier: only events whose writing transaction is older than every transaction still running (`xid < pg_snapshot_xmin(pg_current_snapshot())`). Identity values are handed out at insert, not at commit. Without the barrier a slow transaction holding a lower id could commit after the reader moved past it, and its event would never be sent.
- On `change`, the browser refreshes its server-rendered data. The server stays the single source of truth, and the browser has no copy of the domain logic to drift.
- The stream also carries presence (who has which request open), which each window reports every 8 seconds.

## Alternatives

- **A managed pub/sub (Ably, Pusher).** Push instead of poll, but another vendor and another place for tenancy to leak. The right swap if traffic grows.
- **WebSockets.** Not available on the serverless runtime without a separate service.

## Consequences

- Polling costs one small query per open console every 1.5 seconds. The stream closes while the tab is hidden.
