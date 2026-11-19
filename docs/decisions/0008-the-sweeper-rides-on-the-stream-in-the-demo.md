# 0008. In the demo, the outbox sweeper rides on the live stream; production needs a scheduler

- **Status:** Accepted
- **Decided:** 2026-11-19
- **Written:** 2026-11-19, while building v2

## Context

Retries need something to run every few seconds. Vercel's Hobby plan runs cron jobs once a day.

## Decision

- A send is dispatched immediately after its transaction commits (`after()`).
- While a console is open, its stream sweeps that tenant's due outbox rows every few polls. In the demo a retry is only visible to someone watching, so this is enough.
- `/api/cron/sweep` sweeps every tenant and purges expired sandboxes, for a real scheduler (Vercel Cron on a paid plan, or any external scheduler that sends `CRON_SECRET`).

## Consequences

- A retry for a tenant nobody is watching waits for the cron sweep. That is acceptable for a demo; a production deployment schedules the sweep every minute.
