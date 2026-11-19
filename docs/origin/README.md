# Origin: the take-home submission

ClearLoop started as a product-engineer take-home on 21 May 2026. This folder keeps that submission as it was delivered. The files are unedited, so the 3.5-hour version can be compared with what came after.

The repository at that point is tagged [`v0.1.0-takehome`](https://github.com/Eslam93/clearloop/tree/v0.1.0-takehome).

## The brief, summarized

An early-stage SaaS company serves small and medium businesses in the GCC and MENA. Its platform tracks customer requests across internal teams. Customers complain that nobody internal can see a request's status without someone querying the database. There is no shared dashboard and there are no notifications. Customer satisfaction fell 18% in a quarter.

The brief asked for four parts and a short README:

1. **Product thinking.** The root cause, the most affected user and their current workflow, two user stories, three solutions at different effort levels, and the riskiest assumption with a way to test it.
2. **Technical design.** A data model, two API endpoints, and two edge cases to handle before launch.
3. **AI workflow.** Where AI helped, the exact prompts, and what was not delegated.
4. **A working prototype and a build log.** The prototype was limited to one or two hours. The build log answered five fixed questions.

A `NOTES.md` covered what a full week would add.

The original brief is not reproduced here; this summary replaces it.

## Files

| File | What it holds |
|---|---|
| [`TAKEHOME_KICKOFF.md`](TAKEHOME_KICKOFF.md) | The spec written before any work started |
| [`part1-product.md`](part1-product.md) | Root cause, user, stories, solutions, riskiest assumption |
| [`part2-technical.md`](part2-technical.md) | Data model, two endpoints, two edge cases |
| [`part3-ai-workflow.md`](part3-ai-workflow.md) | Where AI was used, verbatim prompts, the boundary |
| [`part4-build-log.md`](part4-build-log.md) | The five build-log questions |
| [`NOTES.md`](NOTES.md) | What a full week would add |

Paths inside these files refer to the layout at the time (for example `/prototype`, now `apps/web`).

## What happened next

[`../v2-plan.md`](../v2-plan.md) is the plan for turning the submission into a product. It includes an audit of what v1 got wrong.
