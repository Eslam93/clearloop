# NOTES — What I would do with a full week

The submission shows the value moment (close the account-manager / customer loop in one click) and the technical shape of the medium-effort solution. It does *not* show the things a real week of work would buy — real notification infrastructure, customer-facing surfaces, breach alerting, multi-tenant auth tests, proper SLA modelling. This is the honest list of what a week buys, in the order I would build it.

## What I would build, in order

### Day 1 — Validate before extending

Before any code, run the two-sided validation:

- Shadow one or two AMs for an afternoon. Pull a sample of last quarter's status-update Slack threads. Count how often AMs reach out to customers *before* being asked — that's the proactive-vs-reactive baseline the Notify button has to move.
- 15-minute calls with three customers who complained last quarter. One question — *"when you complained, what would have changed your experience?"*

If the validation confirms the riskiest assumption — that AMs will use Notify proactively if the surface lowers the friction — proceed with the build below. If it doesn't, pivot to SLA breach alerting + escalation routing instead, because no dashboard fixes a "we're slow" problem.

### Day 2 — Real notification infrastructure

Replace the in-memory store with a real `Notification` table backed by Postgres. Add a WhatsApp BSP integration (Meta Cloud API or a regional provider like 360dialog for GCC-friendly pricing) and an email fallback (SendGrid or AWS SES).

Wire the 5-minute idempotency window and the `request_version` 409 logic — both are real concerns the moment two AMs touch the same request inside the same minute:

- `POST /api/requests/{id}/notify` returns 409 on stale-version mismatch (force a reload of the drawer with the current snapshot) and 200 with `idempotent: true` on duplicate inside the window.
- Background worker retries failed sends with exponential backoff; surfaces deliverability failures on the row as *"Send failed — retry?"*.
- Template library (Arabic + English) per customer tier, gated by an admin role.

### Day 3 — Multi-tenant auth and scoping tests

Today's tenant scoping is a single `WHERE tenant_id = ?` clause. That's correct, but not auditable. With a week:

- Session middleware derives `tenant_id` and `user_id` from the auth token and exposes them via a request-scoped context object the data layer reads from. Route handlers *cannot* pass tenant explicitly — making "forgot to scope" un-typeable.
- An integration test in CI authenticates as AM-A in Tenant A, requests a `customer_id` belonging to Tenant B, asserts the response is `404 Not Found` (not `200 []` — the empty-list response would leak ID existence through timing).
- A scheduled job scans server query logs for any read without a `tenant_id` predicate. Alerts oncall if it finds one.

### Day 4 — Customer-facing read-only portal

A magic-link page per request, emailed to the customer at request creation, that shows the same status and timeline the AM sees — minus internal notes. Polls every 30 seconds. No auth beyond the link's signed token (24-hour TTL).

This is the missing half of the loop for customers who would rather check than ask.

**Validation gate:** only build this if the Day 1 customer interviews show customers want self-service visibility. If they say *"I just want my AM to tell me,"* skip it and double down on the Notify UX instead.

### Day 5 — SLA breach alerting and per-tier config

Two pieces:

- **Alerting.** Background job fires `request.sla.at_risk` four hours before breach and `request.sla.breached` at breach, into the AM's Slack and a daily digest email. Per-tenant subscription preferences.
- **Per-tier SLA config UI.** An admin screen that sets `sla_hours_by_tier` per tenant. SLA is hardcoded today. Customers in different verticals have wildly different expectations — 24 hours is fine for B2B SaaS, one hour is the bar for healthcare.

### Day 6 — Timezone-aware SLA modelling, properly

The prototype keeps SLA naive on purpose — in the static dataset it never visibly drifts. In production:

- `sla_due_at_utc` is computed once at request creation from `(customer.timezone, customer.business_calendar)` — not derived at display time.
- Business calendars per tenant (default to a GCC weekend of Friday/Saturday; configurable for tenants serving Western customers).
- Display formats the SLA in the AM's *local* timezone, with a hover tooltip showing the customer's timezone.

The reason this is Day 6 and not Day 1: it surfaces as *"the SLA badge flickers across midnight for international customers"* — a polish-class issue, not a launch blocker.

### Day 7 — Audit log surfacing

Every status change and notification is already logged in the data model. The UI surfaces only the per-request timeline today. Add:

- A tenant-level audit view (admin only) for who-did-what across the org.
- Export-to-CSV per request, for customer-facing dispute resolution.
- A quarterly aggregate (notifications sent per AM, time-to-first-notify per priority tier) — this feeds the AM-adoption baseline that the riskiest assumption hinges on.

## What I would intentionally NOT build, even with more time

These look like obvious wins. They aren't.

- **In-app chat between AM and customer.** Looks like the "complete" version of Notify. In practice it adds support burden (AMs are now answering chats), pulls the conversation off the channel customers actually prefer (WhatsApp in the GCC), and turns a one-click action into a thread the AM has to manage. The right answer is *push the update into the channel the customer already uses*, not pull the customer into ours.
- **Customer-side login and a full customer dashboard.** SMB customers don't want another login. The magic-link read-only page (Day 4) gives them what they want without onboarding.
- **AI-generated status summaries.** Tempting because it would feel modern, but a status update signed by *"Sarah"* is more trustworthy than one signed by *"AI Assistant."* The trust signal is the named human, not the text. If the message volume ever justifies AI assistance, ship it as a draft the AM can edit and send — never auto-send.
- **An SLA-prediction model.** Predicting which requests will breach is interesting but answers a question nobody is asking. The question is *"which requests are breaching right now"* — that's a `WHERE hours_to_sla <= 0` query, not a model.
- **Role-based view permutations for engineers and leads.** AMs are the bottleneck; engineers and leads aren't currently complaining. Don't build for users who haven't reported a problem.

## What I would change in the prototype itself

If I had even another hour on the prototype:

- **A 409 stale-state demo.** Two browser windows on the same request, change the status in one (via a hidden dev shortcut), then have the other one hit Notify and surface the 409 response with the fresh snapshot. The 409 logic is wired into the API design but the UI never demonstrates it today.
- **Keyboard shortcuts.** `Enter` opens the top-priority row's drawer; `Shift+Enter` triggers Notify. The product is for AMs who triage many requests in a row — keyboard speed matters.
- **An *"I notified them already, just logging it"* link** at the bottom of the drawer. For the case where the AM has already messaged the customer out-of-band and is recording the notification rather than sending one. Right now Notify always sends; sometimes the AM just needs an audit-trail entry.

## The one thing I'm most unsure about

Whether Notify should default to WhatsApp or email. The default is WhatsApp because that matches GCC SMB customer behaviour, but I haven't validated that's true across all three tiers. The VIP tier might prefer email — more formal, more auditable on their side. If so, the right shape is *default per tier*, not a global default. Day 1 customer interviews would settle this; until then, WhatsApp is the better guess but not the right one.
