# ClearLoop

> Close the account-manager → customer information loop in one click.

Submitted as a product-engineer take-home (3–4 hour sprint). The brief asks for one clickable screen, the supporting docs, and a build log; the README below is the 2-minute orientation.

## The problem

A GCC/MENA SMB SaaS platform manages customer requests across internal teams, but internal teams can't see request status without manually querying the database — no dashboard, no notifications — and CSAT dropped 18% last quarter.

## The solution

An internal request dashboard for account managers, with one-click **Notify customer** that closes the AM → engineer → customer information loop without context-switching.

## How to run the prototype

```bash
cd prototype
pnpm install
pnpm dev
```

Then open `http://localhost:3000`. Click any row to open the detail drawer; click **Notify customer** to fire a `POST /api/requests/{id}/notify` and see the status update record persist.

Built with Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui. No external services — the dataset is static (`prototype/lib/data.ts`) and the notification record lives in a server-side in-memory store. Reloading the page resets any notifications added during the session.

## Three key decisions

1. **Chose the account manager over internal teams as the primary user.** They bear the customer-trust cost directly — every time a customer asks *"any update?"* and the AM has to say *"let me check and get back to you,"* the trust deficit lands on the AM, not on the engineer. The screen is materially different from a team-member queue (no customer-facing CTA on an engineer's screen).
2. **Built the medium-effort option (dashboard + one-click Notify) over the quick (read-only URL) or the comprehensive (multi-tenant + customer portal).** The one-click Notify is what closes the loop the brief calls broken — a read-only URL leaves the customer pulling, and the comprehensive option is weeks of work. The medium option is the one that demonstrates the value moment in the time budget.
3. **Notification channel mocked (no real WhatsApp/email delivery); dashboard, sort, filter chip, drawer timeline, and notification record are real.** The prototype contains no decorative controls — every button on screen does what it says. Settings cogs and notification-rules editors were cut from scope explicitly rather than faked.

## Repo layout

```
/
├── README.md            ← this file
├── TAKEHOME_KICKOFF.md  ← the spec I wrote before any work started
├── part1-product.md     ← root cause, user, stories, solutions, riskiest assumption
├── part2-technical.md   ← data model (6 entities), 2 API endpoints, 2 edge cases
├── part3-ai-workflow.md ← where AI was used, verbatim prompts, boundary
├── part4-build-log.md   ← five required questions answered honestly
├── /prototype           ← Next.js 16 + shadcn/ui — the one screen
└── NOTES.md             ← what I would do with a full week
```

## What I would do with a full week

See [NOTES.md](./NOTES.md). The TL;DR — Day 1 is validation (shadow AMs + customer interviews), Days 2-3 are real notification infra and multi-tenant auth hardening, Day 4 is a customer-facing read-only portal *only if* the validation calls for it, Days 5-7 cover SLA breach alerting, timezone-aware SLA, and audit-log surfacing. The doc also names the things I would intentionally *not* build (in-app chat, customer-side login, AI-generated status summaries, SLA prediction models) and why each looks like an obvious win but isn't.

## Time spent

About 3.5 hours. The brief expects 4-6; the build log explains what that bought (speed-with-judgment cuts, pre-declared) and what it cost (no dark-mode polish loop, no real notification channel).
