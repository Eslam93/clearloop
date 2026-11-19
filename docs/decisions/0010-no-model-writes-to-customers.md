# 0010. No model writes to customers; pre-send checks are rules

- **Status:** Accepted
- **Decided:** 2026-11-19
- **Written:** 2026-11-19, while building v2

## Context

v1 decided that the trust signal in a status update is the named person, not the text, and listed AI-written updates under what it would not build. v2 was a chance to revisit that.

## Decision

- Every message is a template in the customer's language, signed by the account manager, with an optional line in their own words.
- Before a message goes out, rules check the account manager's words:
  - text copied from an internal note blocks the send;
  - an engineer's name, a time promise with no ETA, a "done" claim that contradicts the status, or Arabic and English versions that disagree on numbers are warnings that must be acknowledged.
- The checks run in the browser as the account manager types, and again on the server.

## Alternatives

- **An LLM reviewer** for tone and register, never writing. Possible later. It would follow the author's usual rules: a mock model so CI needs no key, versioned prompts, and golden cases.
- **AI-drafted updates.** v1's NOTES allowed them as drafts, never auto-sent. Not built: the named-human signal is the point.

## Evidence

`apps/web/lib/domain/domain.test.ts` ("pre-send checks"), and the guard-removal check `internal-note-block`.
