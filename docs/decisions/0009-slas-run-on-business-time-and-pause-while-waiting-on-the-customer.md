# 0009. SLAs run on the customer's business time and pause while waiting on the customer

- **Status:** Accepted
- **Decided:** 2026-11-19
- **Written:** 2026-11-19, while building v2

## Context

v1 counted wall-clock hours, the same for every customer. In v1's own data, a request blocked on a sample file from the customer showed as breached while the customer held it.

## Decision

- Each customer has a calendar with:
  - a time zone;
  - a work week (Sunday to Thursday in Saudi Arabia, Kuwait, Qatar, Bahrain, Oman and Egypt; Monday to Friday in the UAE);
  - working hours;
  - fixed and Hijri holidays;
  - Ramadan hours from the Umm al-Qura calendar.

  Presets are defaults; announced dates go in overrides.
- A new status, `waiting_on_customer`, pauses the clock, and resolution stops it.
- The engine is its own package, `packages/business-time`: pure TypeScript, no dependencies, property-tested with fast-check.

## Consequences

- At risk means within a quarter of the target, capped at four business hours, so a four-hour urgent ticket is not "at risk" from the start.
- Hijri dates are computed. Official dates can differ by a day, which is what overrides are for.

## Evidence

`packages/business-time/test`: 137 tests, 70 of them property tests.
