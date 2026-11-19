# 0006. Deliveries go through a transactional outbox, at least once

- **Status:** Accepted
- **Decided:** 2026-11-19
- **Written:** 2026-11-19, while building v2

## Context

Sending inside the notify request would tie the customer's message to the web request's lifetime. A crash between "sent" and "recorded" would lose either the record or the message.

## Decision

- The `notifications` row is the outbox, written in the same transaction as the `update_sent` event.
- A dispatcher claims due rows with `FOR UPDATE SKIP LOCKED` and pushes `next_attempt_at` out as a lease, sends outside any transaction, then records the result.
- Only transient failures (timeouts, 429, 5xx) are retried, with backoff and jitter, honouring `Retry-After`. Anything else fails the message for good. These rules are ported from classified_retry and fan_out_jobs in the author's ToolKit.
- Receipts (delivered, read) arrive as webhooks verified with `X-Hub-Signature-256` over the raw body, and never move a message backwards.

## Consequences

- At least once: a crash after the provider accepted a message and before it was recorded repeats it, and WhatsApp does not deduplicate. The window is one send; the alternative, at most once, loses messages.
- The sandbox channel signs its own simulated receipts and calls the same handler, so the demo exercises the real verification path.

## Evidence

`apps/web/tests/services.int.test.ts` ("the outbox and receipts"), and the guard-removal check `webhook-signature`.
