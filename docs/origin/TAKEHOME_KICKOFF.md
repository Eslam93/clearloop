# Product Engineer Take-Home — 3-4 Hour Sprint

## North star

**One screen, one interaction, one moment of "oh — that's the value." Plus the supporting docs that show I knew what I was doing.**

The submission is judged 60% on thinking (problem clarity, technical decisions, build log, AI maturity) and 20% on implementation. The prototype is leverage for the thinking, not the point.

## The problem (internalize, don't re-explain)

GCC/MENA SMB SaaS platform for managing customer requests across internal teams. Customers are unhappy because internal teams can't see request status without manually querying the DB. No unified dashboard, no notifications. CSAT dropped 18% last quarter. The most affected user is whichever role currently bears the cost of that information gap — figure out which.

The submission has four parts: product thinking, technical design, AI workflow, build log + prototype. Plus a `NOTES.md` (what I'd do with a full week) that the brief calls out as "often the most revealing part." Don't skip it.

## Time budget — 3 to 4 hours, not 4 to 6

The brief expects 4-6 hours. I'm doing it in 3-4. That means **the cut line matters more than usual** and the build log should honestly say "I worked in a tighter window than the brief expected, here's what I cut and why." That's strength, not weakness — speed with judgment is exactly what the brief says it's hiring for.

Rough split:
- 20 min — read brief, agree on the plan, set up repo skeleton
- 45 min — Part 1 (product thinking) + Part 2 (technical design) written
- 90 min — Part 4 (prototype) built and clickable
- 30 min — Part 3 (AI workflow doc) + build log + NOTES.md
- 15 min — README + final review + push

Treat these as ceilings. If product thinking takes 60 minutes, cut prototype scope, don't extend overall.

## Lessons from prior work that apply here

(I just finished a much bigger build with you; these patterns earned their keep, carry them forward.)

1. **Demo-first vertical slice.** One flow that works end-to-end beats five flows that almost work. The prototype shows *the* moment of value — not a tour.
2. **Mock everything not on the critical path.** Static data is the default. The brief explicitly allows this. Use it.
3. **Earliest useful verification beats most code written.** I want to see the screen working on localhost within the first hour of prototype time, even if ugly. Polish after.
4. **State the cut line up front, not retroactively.** Decisions made under time pressure look defensive in a build log. Decisions made in advance look like judgment.
5. **Stop and confirm the plan before coding.** Cheapest possible reroute happens before any code exists.

## Stack reality checks (do not rediscover)

- Prototype tool: **Claude Code** (or whatever you recommend — but I default to Claude Code unless you have a strong reason otherwise). The brief lists v0, Cursor, Replit, Lovable, Bolt as options. My tool choice signals how I think; let's make sure it signals well.
- I'm comfortable with: Next.js + TypeScript + Tailwind, Python/FastAPI, basic AWS. I'd rather build something static-but-real in a stack I know than fight a no-code tool.
- Static data is the path. No backend unless one screen genuinely cannot demonstrate value without it.
- Repo target: GitHub public.

## How we work this session

One session, one builder (me, with you advising). No parallel agents. No worktrees. You produce a plan, I sanity-check it, you (or I, depending on which output) build the artifacts in order. We never have more than one open question at a time.

**Source of truth:** this document and the assignment brief. If they conflict, ask.

## What I want you to produce in this response — in order — before any code

### Output 1: Problem framing (≤ 200 words)

Read the brief. Tell me:
- Who you think the **most affected user** is and why (one of: customer, internal team member, team lead, account manager, founder — pick one, justify in 2 sentences)
- The **root cause** in one sentence (not the symptom)
- What the **riskiest assumption** of any plausible solution is and how to validate it cheaply

This is the seed for Part 1. If your framing is off, everything downstream is off. I'd rather correct it now than rewrite later.

### Output 2: Solution recommendation (≤ 250 words)

- The **quick / medium / comprehensive** options as one-liners with tradeoffs
- **The one we should build** and why it scores best on the rubric (not necessarily the best solution in real life — the one that demonstrates the most judgment in 3-4 hours)
- The **one screen** that carries the value moment in the prototype
- What's **real / interactive** vs what's **static / decorative** in that screen

### Output 3: The two user stories (verbatim, ≤ 100 words)

The brief asks for two user stories with a why-these-two. Write them now. They'll go into `part1-product.md` directly.

### Output 4: Technical design sketch (≤ 300 words)

- Data model: 3-5 entities, relationships in one sentence each. Skip if your chosen solution doesn't need a backend.
- Two API endpoints (method, path, request shape, response shape) — even if the prototype mocks them, the doc shows you thought about them
- Two edge cases + how each gets handled

### Output 5: Prototype plan (≤ 200 words)

- Exact tool choice (with one sentence on why over alternatives)
- Files/screens to build, in build order
- Static dataset shape (one paragraph)
- The 90-minute walk: minute 0-30 scaffold, 30-60 the one screen rough, 60-90 the value moment polished
- What gets cut if minute 90 hits and it's not done

### Output 6: Repo structure with file stubs

Match the brief's required structure exactly:
```
/
├── README.md
├── part1-product.md
├── part2-technical.md
├── part3-ai-workflow.md
├── part4-build-log.md
├── /prototype
└── NOTES.md
```
For each `.md` file, give me a 3-5 bullet outline of what it'll contain. The README outline should be the 2-minute version: problem → solution → how to run prototype → key decisions → what I'd do next. No more.

### Output 7: Build log scaffolding

The build log questions from the brief, with **draft answers** based on the plan you're recommending. We'll update them as I work — but having a starting point means I'm not writing them at minute 200 when I'm tired.

- Before you started: what's the single thing that must work?
- First prompt: what will I literally type first?
- First failure: leave blank, fill in during build
- Scope cut: pre-fill with the cuts you're recommending in Output 5
- Manual work: pre-fill with what I should *not* delegate to AI (and why — see Output 8)

### Output 8: AI workflow note

The single sentence on what I will *not* delegate to AI and why. The brief explicitly weights this as a maturity signal. Think hard about this one — it's the line between "uses AI well" and "AI uses them."

### Output 9: Two open questions for me

Maximum two. The two things you're least sure about that, if answered, would lock the plan. Mark each `blocking` or `non-blocking`. Non-blocking ones get your best-guess default and we move.

## Bonus considerations (decide for me, don't ask)

The brief mentions four bonus angles: AI agents, MCP, spec-driven dev, reusable prompts/skills.

You decide which (if any) to weave in. The standard for inclusion is high: it has to *naturally improve the submission*, not look like inflation. My read is **spec-driven development is the natural fit** — this document arguably is the spec, and pointing the build log at "I wrote a spec first, the prototype matches it" is signal. But you decide.

## Hard constraints on this response

- No prose summaries between sections.
- No "best practices" filler.
- No emojis.
- File paths use forward slashes.
- If you'd cut a section of my plan, say so explicitly with one-line justification.
- If something needs my decision, it goes in Output 9, nowhere else.
- Total response under ~1500 words. Anything longer means you're padding.

## Begin

Produce Outputs 1-9 in order. When done, stop and wait for my go-ahead before writing any actual file content. Once I greenlight, we move file by file: `part1-product.md` first (highest grade weight, lowest risk), then `part2-technical.md`, then prototype, then the remaining docs.
