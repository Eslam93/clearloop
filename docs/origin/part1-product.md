# Part 1 — Product Thinking

## The problem in one paragraph

A GCC/MENA SMB SaaS platform manages customer requests across internal teams. Customers complain because internal teams can't see request status without manually querying the database. There is no unified dashboard. There are no notifications. CSAT dropped 18% last quarter. The brief asks us to identify the *right* problem before reaching for a solution.

## The most affected user — and their workflow today

**The account manager (the customer-facing rep) bears the cost of the information gap.** They get the angry customer call, can't see request status themselves, and have to interrupt internal teams over Slack or WhatsApp before calling the customer back. Internal teams can work around missing UI longer than AMs can; AMs absorb the customer-trust cost directly every time they have to say *"let me check and get back to you."*

**The current workflow:**

1. Customer pings AM — *"any update on my ticket?"*
2. AM messages the internal team on Slack / WhatsApp.
3. An engineer queries the database.
4. Engineer replies in the thread.
5. AM relays the answer back to the customer.

Two human relays per query, two context switches, latency measured in hours not minutes, and no audit of who said what to whom.

**Root cause (one sentence):** Status data exists in the database but has no visibility layer for non-engineering roles, forcing a human relay between customers and internal teams that breaks down at any meaningful request volume.

Why not the internal engineer as the primary user? Because engineers tolerate manual DB queries as a known operational tax, but AMs have no escape hatch — they are the ones the customer is angry at. Fixing the engineer's workflow saves clicks; fixing the AM's workflow saves CSAT.

## Two user stories

**Story 1.** As an account manager, I want to see every open request from my customers in one filtered view with SLA risk surfaced so that I can answer *"where is my request?"* before the customer asks.

**Story 2.** As an account manager, I want to push a status update to the customer in one click from the request view so that I close the loop without context-switching into email or WhatsApp.

**Why these two specifically.** They cover the two halves of the CSAT problem — passive visibility (read) and proactive communication (write). Story 1 alone is a status page; Story 2 alone is a notification feature with no context. Together they map to the moment the customer is angry: the AM needs to *see* the state and *push* an update without leaving the screen. Omitting a customer-facing story (e.g., "as a customer I want to check status myself") is deliberate — the customer's pain is real but it is solved upstream by the AM's loop, not by giving every SMB customer their own portal to learn.

## Three solutions, at different effort levels

| Effort | Solution | Tradeoff |
| --- | --- | --- |
| **Quick** | Read-only per-customer status URL — emailed to the customer at request creation. | Pull-only. Customer still has to check it manually. Does nothing for the AM, who is the cost-bearer. |
| **Medium** | Internal unified request dashboard for AMs + a one-click "notify customer" action that fires a status update through an existing channel (WhatsApp / email). | Requires AM adoption *and* status discipline from internal teams (statuses have to actually change in real time). |
| **Comprehensive** | Multi-tenant dashboard with role-based views + real notification infrastructure (WhatsApp BSP + email + in-app) + SLA breach alerting + audit log + customer-facing portal. | Weeks of work. Meaningful change-management surface — multiple teams, multiple channels, real compliance considerations. |

## Chosen solution: the medium option

**The dashboard plus one-click Notify.** The prototype renders the dashboard, the SLA risk surfacing, the drawer with the status timeline, and the Notify action as a toast with a persisted notification record on the row. The notification *channel itself* (WhatsApp / email delivery) is mocked — that's the honest scope cut, declared up front rather than discovered at submission.

**The one screen that carries the value moment:** the account manager's request queue. Sortable list, one status filter chip (Open vs All), SLA-at-risk badges, row click opens a detail drawer showing the status timeline, and a single **Notify customer** button. That one click is the loop-closing moment — the dashboard is the visibility half, Notify is the proactive-communication half. Either alone misses the point.

This scores on the rubric because it picks the user who bears the customer-trust cost (Part 1 weight), the screen demonstrates the *moment of value* the brief calls out — closing the information loop — in one click (Part 4 weight), and the cut line is pre-declared rather than retrofitted (Build Log weight).

## The riskiest assumption

**That AMs will actually use the Notify button proactively — that they will reach for it before the customer reaches for the phone.**

The dashboard is the cheap half: visibility is a UI problem, and a UI problem can be shipped. The harder half is the behavioural shift from reactive ("answer when asked") to proactive ("push when status changes"). If AMs treat Notify as just-another-button they happen to click when a customer is already on the line, the prototype works but the CSAT lift never materialises. The information loop closes the same number of times it already closes today — it just looks prettier.

This is the assumption that, if wrong, makes the whole solution theatre.

## How to validate it cheaply, both sides of the loop

1. **Shadow 1–2 AMs for an afternoon, and pull a sample of last quarter's status-update Slack threads.** Count how often AMs reach out to customers *before* being asked. That's the baseline the Notify button has to move. If the baseline is already high, AMs are proactive and the dashboard's job is just to make their existing behaviour faster — high confidence. If the baseline is near zero, the behavioural lift is the whole bet, and Notify needs to be paired with explicit prompts (e.g., a daily "requests where status changed and customer hasn't been notified" list) to nudge the behaviour.
2. **15-minute interviews with 3 customers who complained last quarter.** One question: *"when you complained, what would have changed your experience?"* If they say *"I just wanted to know what was happening,"* proactive pushes are exactly what they want and the medium option lands. If they say *"I wanted it resolved faster,"* the dashboard is theatre and we should ship SLA breach alerting / escalation routing instead.

The two validations cost an afternoon and three phone calls. If both signals point to visibility-and-proactive-communication, the medium option is the right build. If either points to resolution speed, we pivot the roadmap before writing the next line of code.
