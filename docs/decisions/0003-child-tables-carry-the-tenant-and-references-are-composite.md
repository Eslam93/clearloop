# 0003. Child tables carry tenant_id, and references are composite keys

- **Status:** Accepted
- **Decided:** 2026-11-19
- **Written:** 2026-11-19, while building v2

## Context

v1's data model put `tenant_id` on the four root entities and let child rows (status events, notifications) inherit tenancy through `request_id`. Row-level security on a child table would then need a join in its policy.

## Decision

- Every table carries `tenant_id`, and the policy on each is the same one-column comparison.
- Every reference to another tenant-owned row is a composite foreign key on `(tenant_id, id)`. A row cannot point at another tenant's row, even through a bug in the code or a superuser session.

## Alternatives

- **Keep v1's transitive scoping.** Policies with joins are slower and easy to get wrong, and a wrong join leaks silently.

## Consequences

- A little denormalisation: `tenant_id` is repeated on child rows.
- Cross-tenant references fail at insert time with a foreign-key error, before row-level security is even involved.

## Evidence

`packages/db/tests/tenancy.test.ts`: "cannot point a row at another tenant's row, even as the owner".
