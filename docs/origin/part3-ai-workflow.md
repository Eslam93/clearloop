# Part 3 — AI Workflow

## Where AI was used, why, and what changed afterward

This entire submission was built with **Claude Code** (Anthropic's CLI; model `claude-opus-4-7`). It was used in four places, in this order:

### 1. Planning

I wrote `TAKEHOME_KICKOFF.md` myself first — the spec the take-home is built around. It's my framing of the brief, the cut line, the time budget (3–4 hours, not 4–6), the output format I wanted back (nine numbered outputs before any code), and the lessons-from-prior-work I wanted carried forward. I then handed that doc to Claude Code and asked it to produce the nine outputs before touching the filesystem.

The plan went through **three external review rounds** before it was greenlit. After each round I pasted the reviewer's feedback back into the session, told Claude Code to *critically analyse* rather than accept on reflex, and let it push back. It did push back once: when the second reviewer claimed the session was Codex (OpenAI's CLI) rather than Claude Code, Claude Code rejected that point on system-prompt evidence (`claude-opus-4-7` is not an OpenAI model) and accepted the *underlying* critique — that unverifiable meta-claims about "the tool running this conversation" should be dropped because reviewers can't audit them from their seat. The plan now names the tool with model ID and points reviewers at this document.

**What changed across the three rounds:**

- `tenant_id` was added to four root entities so the cross-tenant edge case in `part2-technical.md` is enforceable at the data layer, not just described as policy.
- The riskiest assumption was reframed from *"does a dashboard solve CSAT"* to *"will AMs use Notify proactively, rather than wait for the customer to ask first"* — the chosen solution already includes Notify, so the behavioural adoption question is the real bet now.
- Six pause-and-verify build checkpoints were collapsed to two (after the table renders, and after Notify works end-to-end).
- The README's three key decisions were rewritten as decisions-with-consequences instead of descriptions ("chose X over Y because Z, with this consequence").
- A contingent backend route handler was added — tied to a pre-committed rule that fires only if Checkpoint 2 lands inside minute 70. The rule fired.
- Two tenants and two account managers were added to the static dataset so the cross-tenant edge case has a visible referent, not just a theoretical one.

### 2. Document drafting

Once the plan was approved, Claude Code expanded each output into the matching `.md` file: this one, `part1-product.md`, `part2-technical.md`, `part4-build-log.md`, `NOTES.md`, `README.md`. I directed the structure (every doc reads standalone, no cross-references between submission files — a reviewer-friction tax) and tone (soften "engineers tolerate DB queries" to "internal teams can work around missing UI longer than AMs can," which is true and not dismissive).

### 3. Prototype scaffolding and component code

Claude Code ran `create-next-app`, initialised shadcn/ui with the Radix variant, scaffolded `lib/data.ts` (14 requests across two tenants, with AM Sarah filtering Tenant B out), and built the prototype files in the build order set by the plan: `app/page.tsx`, `lib/data.ts`, `components/sla-badge.tsx` + `components/request-row.tsx`, `components/filter-chip.tsx`, `components/request-drawer.tsx` (timeline + Notify CTA), `components/ui/sonner.tsx` (the toast confirmation, used by the drawer).

### 4. The contingent backend route handler

Checkpoint 2 (Notify works end-to-end) landed earlier than the plan's minute-70 ceiling, so the pre-committed rule fired. Claude Code wrote `app/api/requests/[id]/notify/route.ts` — a thin Next.js route handler that persists notifications to a module-level `Map` and returns `{ notification_id, sent_at, channel, status_at_send, idempotent }`. The drawer's `handleNotify` was rewired from a local `setTimeout` to a real `fetch`. The endpoint was smoke-tested with `curl` (see `part4-build-log.md`) before being declared done. This changes the prototype's honest claim from *"notification mocked"* to *"notification persisted server-side; channel delivery mocked."*

## Exact prompts used — verbatim, no cleanup

The actual prompts I typed into Claude Code are reproduced here without editing. Typos are preserved — the brief explicitly says *"do not clean it up or rewrite it after the fact."*

**Seed prompt:**

> Hi, Read TAKEHOME_KICKOFF.md and lets get start with the plan

The kickoff doc itself is the master spec for everything downstream — its full text is in the repo at `TAKEHOME_KICKOFF.md`, structured as nine numbered outputs Claude Code had to produce before writing any file.

**Round 2 review prompt (after the first review round had already revised the plan once):**

> here is the new revision (I forgot to tell you, this is a 3rd party revision not mine, so you have the liberity to push back with a reason (reject points) even in the last revision as well. here is the new one, critically analyze it, and you can accept or reject any point

This is the prompt in the conversation that most shaped the output. Telling the AI explicitly that it could *reject* reviewer points — and that the reviewer was a third party, not me — moved Claude Code from "accept all feedback" mode into "evaluate each point on its merits." That's how the Codex-vs-Claude-Code rejection happened in round 2, and it's how the plan stayed coherent across three reviewers rather than drifting toward consensus.

**Round 3 review prompt:**

> Here is another revision from another party check it please and give me your thoughts first before we accept it

Same shape as round 2, but I asked for the AI's thoughts *first* before committing to any of the eight feedback points. This forced Claude Code to articulate trade-offs (the backend route handler vs. the kickoff's "no backend unless necessary" rule) before applying changes, and to surface a priority rule (multi-tenant static dataset first, route handler second) that pre-committed time-aware sequencing.

**Greenlight to start building:**

> tes please

Typo of "yes." Left in.

**The hypothetical first prompt the plan recorded for the prototype phase — left in `part4-build-log.md` as the literal sentence I *would have* typed had I been switching to a fresh Claude Code session for the build:**

> Read part1-product.md (chosen solution + value-moment screen) and part2-technical.md (data model + API endpoints). Scaffold /prototype as a Next.js 15 App Router app with TypeScript, Tailwind, and shadcn/ui. Implement these files in order: app/page.tsx, lib/data.ts, components/sla-badge.tsx + components/request-row.tsx, components/filter-chip.tsx with sort wiring, components/request-drawer.tsx with timeline, components/notify-toast.tsx with drawer wiring. Pause after the table renders with seed data (Checkpoint 1) and again after Notify works end-to-end (Checkpoint 2).

In practice the build happened in the same session as the planning, so the literal prompt above was never typed — the approved plan served as the spec and Claude Code followed it. The build log records the actual first failure that occurred during scaffolding, which was **not** the predicted failure (shadcn drawer SSR), but `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND` from `pnpm dlx` on Windows — handled by falling back to `npx`.

## What I did not delegate to AI, and why

I did not delegate the choice of *who the primary user is*, the cut line under time pressure, or the riskiest-assumption framing — those are the judgment surfaces this brief grades on, and outsourcing them would have made the submission evidence that AI used me rather than the other way around. The behavioural reframe in particular (the riskiest assumption is AM adoption, not whether dashboards work) came from a human reviewer noticing that the chosen solution had already implicitly answered the prior framing — exactly the kind of move that requires reading the plan *against the rubric*, not against best practices.
