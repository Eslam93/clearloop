# v2 build log

The same five questions v1's build log answered, for the rebuild. Written on 2026-11-19.

## Before you started: what had to work?

Two things, in this order:

1. **The live site had to stop leaking.** v1 shipped another tenant's data to every visitor, and the link was public. That fix went out first, on its own ([#1](https://github.com/Eslam93/clearloop/pull/1)), and was checked on the live bundle after deploy.
2. **Tenancy had to be enforced by the database.** Every v2 feature writes data, and each visitor gets a tenant. If row-level security was wrong, everything above it was theatre. The schema and its tests came before any screen.

## First prompt

v1's build log quoted its prompts unedited, so this one does too. The request that started v2:

> read the project, it was a take home interview task, now I want it to be a publicly available solution on my github that make me proud, give me a full plan of how to facelift it and make it greater than what it is now, skim through my current public repos to have idea what I've now, and skim through my toolkit private repo, it might have useful tools for u, but do not just copy things I have, I need something new as well. prepare a plan and come show it to me

After reading [`v2-plan.md`](v2-plan.md), the approval:

> defaults, go ahead unattended

## First failure, and the ones after it

In the order they happened:

1. **Tailwind 4 refused `@apply btn`.** In v4, a class that other rules `@apply` must be declared with `@utility`, not in `@layer components`.
2. **The Arabic seed failed to insert.** On Windows, the embedded Postgres initialised its cluster in the system code page (WIN1252), which has no Arabic. Fixed with `--encoding=UTF8` at init and an explicit UTF-8 `CREATE DATABASE`, for local runs and for tests.
3. **An English title in an Arabic message reordered itself.** Fixed with Unicode bidi isolates (FSI and PDI) around titles and names. They are plain text, so they survive into a real WhatsApp message.
4. **The rate limiter locked the test suite out.** Twenty sandboxes an hour per address is right for the public demo and wrong for a test run. The limit is now configurable and high outside production.
5. **axe found two problems.** Subtle text was 3.76:1 against the 4.5:1 that small text needs, and two buttons had accessible names that did not contain their visible text. Both are fixed; every page in both languages now has zero serious violations.
6. **The two-window story did not work for a person.** A live update re-rendered the composer on the new version, which threw away what the account manager had typed, and the 409 never showed. The composer now keeps the version it started on and says what changed; the server still refuses the old message.
7. **A hidden tab missed changes.** The stream closes while a tab is hidden, and reopening started from the newest event. It now resumes from the last event the tab saw.
8. **CI failed before its first end-to-end test.** The migrate script used top-level `await` in a package that tsx compiles as CommonJS.
9. **A dictionary bug turned up while pruning unused keys.** One label called `t()` on a plural group, which would have shown the raw key. Removing 29 unused keys surfaced it.

## Scope cut

Against the plan's "version to be proud of":

- **The guided tour.** Not built. Its strings were removed rather than left unused.
- **The email adapter.** Designed, not built. The WhatsApp adapter is built and unit-tested, but not wired in: the demo has no credentials and no real phone numbers.
- **The LLM review layer.** Not built, by decision ([0010](decisions/0010-no-model-writes-to-customers.md)).
- **Publishing `@clearloop/business-time` to npm.** Not yet.
- **Things only the owner can do.** The Vercel root directory, the Neon database, the custom domain, the portfolio page and a launch post ([`deploy.md`](deploy.md)).

Built beyond the plan:
- the guard-removal checks require their suites to pass first, so a broken setup cannot pass for a proven guard;
- the stream announces its position, so reconnects resume instead of skipping.

## Manual work

This rebuild was done by Claude Code, working unattended from an approved plan. The human decisions were the plan's five defaults:
- the size of the build;
- rule-based checks only, no model writing to customers;
- removing the assignment PDF from the tree;
- the domain;
- the hosting.

Every other choice the agent made is written down as a decision record, so it can be read and reversed.

How the work was split:
- The main session built the database layer, the server, the console and the tests.
- A subagent built `packages/business-time` in its own git worktree from a written spec: 137 tests, and six bugs planted to prove they fail.
- Its commit was cherry-picked onto `v2`. The one conflict, in `pnpm-lock.yaml`, was resolved by reinstalling.

What a person should still review:
- **The Arabic copy.** A native speaker should read the dictionary and the message templates.
- **The holiday presets.** Official dates follow announcements.
- **The deploy settings in [`deploy.md`](deploy.md).**
