# 0011. The UI was built once, on the real backend, instead of first on static data

- **Status:** Accepted
- **Decided:** 2026-11-19
- **Written:** 2026-11-19, while building v2

## Context

The v2 plan put a design phase on static data before the backend, so the new look could go live early.

## Decision

Build the backend first and the UI once, on real data.

## Consequences

- v2 cannot deploy until a database exists, so the early live look the plan wanted was never on offer. Building the UI twice would have bought nothing.
- The v1 site stayed live with its two serious bugs fixed, in a separate hotfix merged first.
