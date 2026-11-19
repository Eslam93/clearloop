# From a 3.5-hour take-home to a product

ClearLoop began as a product-engineer take-home on 21 May 2026. The brief described a GCC SaaS company whose customers complained that nobody internal could see a request's status without querying the database, and whose customer satisfaction had fallen 18% in a quarter. It asked for product thinking, a technical design, a note on AI use, a build log, and one working screen.

v1 is kept unedited in [`origin/`](origin/) and tagged [`v0.1.0-takehome`](https://github.com/Eslam93/clearloop/tree/v0.1.0-takehome). This is the story of what came after, written on 2026-11-19.

## What v1 got right

The thinking held up, and v2 builds on it rather than replacing it.

- **The user.** v1 picked the account manager, not the engineer: the person who takes the angry call and has no way to see status.
- **The two halves.** It named two halves of the problem: seeing the state, and pushing an update without leaving the screen.
- **The riskiest assumption.** It was not "does a dashboard help" but "will account managers tell customers before customers ask".
- **The cut line and the don't-build list.** It declared its cut line in advance, and listed what not to build: in-app chat, customer logins, AI-written updates, an SLA prediction model.

## What v1 got wrong

Checked against the code and the live site on 2026-11-19.

| # | Issue | Evidence |
|---|---|---|
| 1 | Another tenant's data shipped to every visitor. The page was a client component that imported the whole dataset and filtered tenants in the browser. | The live bundle contained a Tenant B request. |
| 2 | Two clocks. SLA math used a fixed 21 May; relative times used the real clock. | A row read "Notified 183d ago" next to "At risk · 3.0h left". |
| 3 | The two edge cases the design was built around were not implemented. | The notify route ignored the version and always said `idempotent: false`. |
| 4 | Notify bumped the request's version. | With a 409 check on, a second notify would conflict with itself. |
| 5 | "Persisted server-side" was a `Map` inside one serverless instance. | It reset on cold start and nothing read it back. |
| 6 | The build log said dark mode rendered correctly. | Nothing ever switched it on. |
| 7 | Three of ten requests fitted above the fold on a laptop. | Measured at 1440x900. |
| 8 | No license, no tests, no CI, and the assignment PDF committed. | The repo tree. |

The first two were live on a public URL, so they were fixed first, in their own pull request ([#1](https://github.com/Eslam93/clearloop/pull/1)), before any of v2.

## What v2 did with each of v1's promises

| v1 said | v2 |
|---|---|
| "Scoping happens at the data-access layer, not at the HTTP layer" | Forced row-level security on every table. The app connects as a role that cannot bypass it, and server components do the reads. A bundle canary fails the build if demo data reaches the browser. |
| Edge case 1: another tenant's id must be 404, not `200 []` | Built, and tested through the API and between two browser sandboxes. |
| Edge case 2: a stale version is 409; a duplicate within 5 minutes is not sent again | Built with the request row locked, plus an `Idempotency-Key`. Two account managers clicking at once send one message, tested concurrently. |
| The riskiest assumption: will account managers notify proactively? | The **ask-first rate**, measured continuously from the event log, and **update debt** to act on it. |
| NOTES, day 2: real notification infrastructure | A transactional outbox, transient-only retries, signed receipts, and WhatsApp's 24-hour rule. |
| NOTES, day 3: tenancy tests in CI | Tenancy tests through the app role, guard-removal checks, and isolation between two live sandboxes. |
| NOTES, day 4: a customer status page, but only if validated | Built behind a per-tenant flag, off by default, with a redaction layer that is tested. |
| NOTES, day 6: timezone-aware SLAs | A business-time engine with GCC work weeks, Ramadan hours and Hijri holidays, paused while waiting on the customer. |
| NOTES: keyboard shortcuts, and "I already told them" | Both built. |
| NOTES: don't build chat, customer logins, AI-written updates, SLA prediction | Still not built. Decision [0010](decisions/0010-no-model-writes-to-customers.md) explains why no model writes to customers. |

## The new idea: update debt

v1 surfaced one risk per request: are we slow? The brief's actual failure is a second, independent one: does the customer know? A request can be on time while the customer hears nothing. Update debt is the list of customer-visible changes the customer has not been told about. The **Owed updates** view is the list an account manager works down to zero. The ask-first rate is how you find out whether they do.

## Numbers, on 2026-11-19

| What | Count |
|---|---|
| Business-time tests (70 of them property tests) | 137 |
| Database tenancy and schema tests | 28 |
| Web unit tests: domain, i18n, channels | 33 |
| Integration tests on Postgres | 12 |
| End-to-end tests, including axe in both languages | 13 |
| Guards removed in CI whose tests then failed | 10 of 10 |
| Decision records | 11 |

## How it was built

The v2 plan ([`v2-plan.md`](v2-plan.md)) was written first and approved with its defaults. The build ran unattended in one Claude Code session; one subagent built `packages/business-time` in a separate git worktree while the main session built the database layer. The order changed once ([decision 0011](decisions/0011-build-the-ui-once-on-the-real-backend.md)). The failures along the way are in [`v2-build-log.md`](v2-build-log.md).
