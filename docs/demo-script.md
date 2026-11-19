# Demo script

The walkthrough the README's 60-second tour comes from, with what each step proves. Every visitor gets the same sandbox, anchored to Tuesday 10:30 in Riyadh.

## The 60 seconds

| # | Do | See | It proves |
|---|---|---|---|
| 1 | Click **Open the live demo** | Your own sandbox opens on **Owed updates · 5** | Every visitor is a tenant ([0001](decisions/0001-every-visitor-gets-their-own-tenant.md)) |
| 2 | Look at Nour Logistics #1042 | Two updates behind, with 1.5 business hours left on the SLA | Debt and SLA are separate signals: on time but in the dark |
| 3 | Select it, press `n`, then `Enter` | An Arabic message signed by Sarah goes out; the row leaves Owed updates | Templates in the customer's language, signed by a person ([0010](decisions/0010-no-model-writes-to-customers.md)) |
| 4 | Open **Customer phones**, mark the message read | Read ticks come back to the console | Receipts take the signed webhook path ([0006](decisions/0006-deliveries-go-through-a-transactional-outbox.md)) |
| 5 | Open a second window as Omar, start an update in the first, then move the request to *Blocked* in the second | The first window shows the change live; sending the old message is refused | 409 with who changed what ([0005](decisions/0005-notify-checks-a-version-an-idempotency-key-and-duplicates.md)) |
| 6 | Time machine: **Thursday 16:30**, then **After the weekend** | Countdowns stop for the weekend | Business time per customer ([0009](decisions/0009-slas-run-on-business-time-and-pause-while-waiting-on-the-customer.md)) |
| 7 | Reply "Any update?" from a phone, then open **Insights** | The ask-first rate moves | v1's riskiest assumption, measured |

## What is in the sandbox

| Request | Customer | Set up to show |
|---|---|---|
| #1042 Driver app crash on cold start | Nour Logistics (VIP, Riyadh, Arabic, WhatsApp) | Two updates behind while the SLA is fine; an internal note about the customer's MDM that must never reach them |
| #1045 POS reconciliation fails for store #14 | Falcon Retail (Pro, Dubai, English, WhatsApp) | The customer asked 45 minutes ago; their 24-hour window is open, so free text is allowed |
| #1038 Invoice export missing VAT column | Nour Logistics | Waiting on the customer: the SLA clock is paused |
| #1036 Patient export to PDF cuts off long names | Pearl Clinics (Standard, Doha, Arabic, email) | Breached by 5.5 business hours |
| #1050 Map tiles fail to load in Jeddah | Nour Logistics | Resolved this morning, and nobody has told the customer |
| #1041, #1043 | Omar's customers | Visible under "Everyone's" |
| #1001 to #1028 | All | Five weeks of resolved history for the insights |

## Things to try beyond the minute

- **Pre-send checks.** On Falcon Retail #1045, write "Khalid will have it done today." Three warnings appear: an engineer's name, a time promise with no ETA, and a "done" claim. Then paste a sentence from #1042's internal note; that one blocks the send.
- **Retries.** In Customer phones, tick **Phones offline**, send an update, and watch it wait with an attempt count. Untick it and the message goes out.
- **Arabic.** Switch the language. The whole layout mirrors, plurals follow Arabic grammar, and the clock shows the Hijri date.
- **Into Ramadan.** The time machine's last jump lands on the first day of the next Ramadan, computed from Umm al-Qura. Working hours shrink, and SLAs stretch with them.
- **The customer's view.** Turn on **Customer status page**, open a request and copy the customer link. The page has no login, shows no internal notes, and is in the customer's language.
- **The API.** `/api/openapi.json` describes the endpoints. Try `POST /api/requests/{id}/notify` twice with the same `Idempotency-Key`.
