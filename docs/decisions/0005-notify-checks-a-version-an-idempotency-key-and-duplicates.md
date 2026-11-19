# 0005. Notify checks a version, honours an Idempotency-Key, and refuses duplicates for five minutes

- **Status:** Accepted
- **Decided:** 2026-11-19
- **Written:** 2026-11-19, while building v2

## Context

v1's design named two edge cases and its prototype implemented neither: an account manager sending an update written for a status that has since changed, and two sends of the same update.

## Decision

In one transaction, with the request row locked (`SELECT ... FOR UPDATE`):

1. An `Idempotency-Key` seen before returns the stored response. The same key with a different body fingerprint is refused with 422 (ported from fastapi-foundation in the author's ToolKit).
2. A `request_version` that no longer matches returns 409 with a snapshot naming who changed what, so the UI can say "Khalid moved it from In progress to Blocked a minute ago".
3. The same update (request, version, channel, template) sent in the last five minutes is returned with `idempotent: true` instead of messaging the customer again. `allow_repeat` overrides this on purpose.

The version increments on status and ETA changes only. v1's prototype bumped it on every notify, which would have made a second notify conflict with itself.

## Alternatives

- **A unique constraint on (request, version, channel).** It would also forbid a deliberate second update at the same status.
- **`If-Match` with 412.** More idiomatic HTTP, but v1's contract specified 409 and a JSON snapshot. Keeping it shows the design held up.

## Consequences

- Concurrent sends on one request take turns on the row lock, which is cheap at this scale.

## Evidence

`apps/web/tests/services.int.test.ts` (409, concurrent sends, replay), `apps/web/e2e/console.spec.ts` (the two-window story), and the guard-removal checks `version-check` and `duplicate-guard`.
