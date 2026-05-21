# Part 4 — Build Log

## Time window

The brief expects 4–6 hours. I built this in 3–4. The cut line in `part1-product.md` and the static dataset shape in the prototype were *pre-declared* in the plan file rather than discovered at submission time — speed with judgment is what the brief is hiring for, and pre-committing cuts is how that judgment becomes visible rather than implicit.

## Before you started — what single thing had to work?

An account manager opens one screen, sees which of their customers' requests are at SLA risk, and pushes a status update to the customer in one click. Everything else is supporting context.

That's the loop the brief identified as broken (customers learn through silence; internal teams query the database by hand). If the prototype demonstrates the loop closing in one click, the value moment is visible; if it doesn't, no amount of polish recovers it.

## First prompt — exactly what I typed

> Hi, Read TAKEHOME_KICKOFF.md and lets get start with the plan

That's it. The kickoff document (`TAKEHOME_KICKOFF.md`) is the actual spec — nine numbered outputs structured to force planning before any code. Everything downstream was driven by that doc plus three external review rounds that refined the plan it produced.

## First failure — predicted vs. actual

The plan recorded a **predicted** first failure: shadcn/ui's drawer component would fail to render server-side cleanly because the underlying Radix primitive uses browser-only APIs; mitigation — drop `'use client'` at the component boundary and re-run.

The **actual** first failure was different. Worth recording because the predicted-vs-actual gap tells reviewers something about my mental model.

```
ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND  No package.json was found in
"C:\Users\eslam\AppData\Local\pnpm-cache\dlx\08bca6da39f6.../node_modules\create-next-app"
```

`pnpm create next-app@latest` failed with a cache-fault on Windows. **How I handled it:** switched to `npx --yes create-next-app@latest`, which worked. The same `pnpm dlx` failure recurred on `shadcn init` — same fix (`npx`). Total time lost: about three minutes.

The predicted shadcn-drawer SSR issue *did not* happen — `components/ui/sheet.tsx` already declares `'use client'` at the top, so the wrapping `RequestDrawer` inherited that correctly. What my prediction revealed: I was anticipating a known shadcn-on-Next-15 footgun. What the actual failure revealed: Windows plus `pnpm dlx` cache layout is a footgun I hadn't considered. Both are worth knowing.

## Scope cut — what came out to finish in time

These cuts were declared in the plan file *before* the build ran:

- **Notification channel — mocked, not real.** The Notify button `POST`s to a Next.js route handler that persists notifications in a module-level `Map` and returns a real 200 response with a `notification_id`. The route handler does not actually send WhatsApp messages or emails. Honest framing: *"notification persisted server-side; channel delivery mocked."*
- **No real database.** The static dataset lives in `prototype/lib/data.ts` — 14 requests across two tenants. Reloading the page resets any notifications added by the in-memory store.
- **Decorative product surfaces cut entirely** rather than faked. No settings cog, no notification-rules editor preview, no multi-customer dropdown, no team-avatar decorations on rows. The prototype's UI surface contains no buttons that don't work.
- **One filter chip** (Open vs All) instead of a full filter system. Sorting is hard-coded to SLA priority (breached → at-risk → healthy).
- **No dark-mode polish loop.** Dark mode renders correctly but wasn't manually QA'd at multiple breakpoints.

The cut order that was *not* needed but was pre-committed: animations drop first, polish second, filter chip third, Notify CTA and timeline always survive. The build came in inside the time budget, so none of these triggered.

**One scope addition** happened during the build, also pre-committed: the backend route handler at `prototype/app/api/requests/[id]/notify/route.ts` was added when Checkpoint 2 (Notify works end-to-end) landed inside the plan's minute-70 ceiling. The plan rule was — *if Checkpoint 2 lands ≤ minute 70, add a thin route handler that persists notifications server-side and returns a real response; otherwise ship toast-only.* The rule fired. The endpoint was smoke-tested with `curl` before being declared done:

```
$ curl -s -X POST -H "Content-Type: application/json" \
    -d '{"channel":"whatsapp","template":"status_update","request_version":4,
         "status_at_send":"in_progress","actor_name":"Sarah Al Hashimi"}' \
    http://localhost:3000/api/requests/req_01/notify
{"notification_id":"ntf_mpfsse72","sent_at":"2026-05-21T18:01:55.166Z",
 "channel":"whatsapp","status_at_send":"in_progress","idempotent":false}
```

## Manual work — what I did by hand, without AI

- **The kickoff document (`TAKEHOME_KICKOFF.md`).** I wrote this. It is the spec the AI worked from for everything else.
- **The choice of primary user (account manager, not internal engineer).** AI offered no opinion — I picked because internal engineers tolerate manual DB queries as a known operational tax, but AMs have no escape hatch, and CSAT is dropping because AMs can't answer customers in real time.
- **The riskiest-assumption reframe.** A human reviewer noticed that *"does a dashboard solve CSAT"* was a question the chosen solution had already implicitly answered (the chosen solution includes Notify), so the real assumption is behavioural — *will AMs actually use Notify proactively?* I accepted the reframe; AI did not generate it.
- **The cut order in this build log.** Pre-declared in the plan before any code ran — animations first, polish second, filter chip third, Notify CTA and timeline always survive. Writing this list *before* pressure hits is what kept it honest under pressure.
- **The decision to add a second tenant + a second AM to the static dataset.** From the round-3 review — I accepted because it makes the cross-tenant edge case in `part2-technical.md` demonstrable rather than theoretical, and the cost (~5 minutes of dataset edits) was inside budget.
- **The audit of type definitions in `prototype/lib/data.ts`.** Flattening six normalised entities into row-friendly TypeScript is exactly where a model can quietly add fields that weren't in the data model. I read every field against `part2-technical.md`.
- **The decision to push back on the round-2 reviewer's "this is Codex not Claude Code" claim.** AI assessed the system-prompt evidence (`claude-opus-4-7` is not an OpenAI model) and rejected the factual point while accepting the underlying critique (drop unverifiable meta-claims). I confirmed both moves before applying.

The reason for the boundary: the brief grades on judgment, not throughput. The places I held the pen are exactly the places where a wrong call wouldn't be caught by a build that compiles or a test that passes.
