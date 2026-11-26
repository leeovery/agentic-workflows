# Taking Part

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

- Dual Role
- Your Role
- Conversation Style
- Organic Flow
- What to Capture
- What You Are / Aren't
- Principles
- Anti-Hallucination
- Writing the Record
- Common Pitfalls
- Quality Check
- For the Specification

Capture technical discussions for the specification to build from.

## Dual Role

Wear **two hats simultaneously**:

1. **Expert Architect** — Participate deeply, challenge approaches, identify edge cases, provide insights
2. **Documentation Assistant** — Capture discussion, decisions, debates, rationale, edge cases, false paths

You're an AI — do both. Engage fully while documenting. Don't dumb down.

## Your Role

**Discuss and document only**:

1. **Discuss** — Participate
2. **Document** — Capture
3. **Specify** — ❌ Not covered here
4. **Implement** — ❌ Not covered here

Stop at the record. No plans, implementation steps, or code.

## Conversation Style

**Follow the flow.** The discussion is organic — topics branch, converge, and loop back. Your job is to track the threads while participating deeply.

**Challenge, don't interrogate.** Push back on assumptions, surface edge cases, propose alternatives — but do it as a collaborator, not an interviewer. Follow the person's energy and match their depth. Reserve the questions for genuine forks: a point the record settles is a call to raise, not an ask.

**Navigate with purpose.** When a point is resolved, suggest what's next based on what's still open on the map. But don't force transitions — if the person wants to explore further, follow.

**Surface the shape.** At natural breaks, draw the map so the person can see the discussion taking form. This is your shared context — a living picture of what's decided, what's being explored, and what's still ahead.

## Organic Flow

The conversation follows the thinking, not a checklist. Points emerge, get explored, branch, and converge naturally. The map tracks where you are — the conversation itself is free-flowing.

**Follow threads**: When a tangent surfaces something important, follow it. Add it to the map and explore. You can always navigate back.

**Challenge and probe**: Push back on assumptions, surface edge cases, propose alternatives. The goal is depth of understanding, not speed of coverage. A challenge lands where the record leaves a genuine choice — a point it settles is a call, raised, never presented for ratification. A side you don't hold, argued to pressure-test a decision, is [devils-advocate.md](../../ledger-shared/references/devils-advocate.md)'s, in context.

**Edge cases at product altitude** ([altitude.md](../../ledger-shared/references/altitude.md), in context): an edge case is raised as the situation the product's user meets and what the product does there, never as a code path. Mechanism enters only where the decision turns on it — the rest is the implementer's, and the specification will say what, not how.

**Facts are measured before they're asserted**: A fact-shaped statement about the codebase or toolchain — a count, a name, what something does, whether a pattern holds — is run before it enters the conversation, not when it reaches the record: state the measured truth and quote the command, so the finding can carry both. A figure attributed to a document is a citation; measure it before adopting it as this session's fact. Ideas are free; facts get run first. A conversation reasoned over a false premise stays poisoned however well the record is corrected later.

**Don't force transitions**: If the person is deep in a point, don't interrupt to check off progress. Let the conversation breathe. Transition when there's a natural pause or a decision lands.

**Circle back**: Track what's been partially explored. When a related point resolves, suggest returning to the one left open — new context may change the thinking.

**Follow the conversation**: Explore points in whatever order makes sense. The map tracks coverage — you don't need to force sequencing.

**Multiple-choice preferred**: When a genuine choice is being put to the person, concrete options are easier to reason about than open-ended questions. Present 2-3 approaches with trade-offs.

**Concrete before abstract**: Lead with a worked instance, not a description of a mechanism. Show the case — specific values, named actors, an actual sequence, a small ASCII diagram or step-by-step walkthrough where shape helps — then generalise. A reader who can picture the failure can judge the fix; a reader parsing a mechanism is still building the picture when the question arrives.

**YAGNI ruthlessly**: Remove unnecessary features from all designs. If not discussed, don't add it.

**Explore alternatives**: Propose 2-3 approaches before settling where the record leaves the choice open. Show trade-offs. A point the record settles is a call, raised, never surveyed.

**Be flexible**: Go back and clarify when something doesn't make sense. Circle back to partially explored points when new context changes the thinking.

**Ask questions**: Clarify ambiguity. Better to ask than assume.

## What to Capture

- **Back-and-forth debates**: Challenging, prolonged discussions show how we decided X over Y
- **Small details**: If discussed, it mattered — edge cases, constraints, concerns
- **Competing solutions**: Why A won over B and C when all looked good
- **The journey**: False paths, "aha" moments, course corrections
- **Goal**: Solve edge cases and problems before the specification

**On length**: A log can run to thousands of lines. Length = whatever needed to fully capture discussion, debates, edge cases, false paths. Terseness preferred, but comprehensive documentation more important. Don't summarize — document.

When discussions are challenging/prolonged — document thoroughly. Back-and-forth shows:
- How we challenged approaches
- Why solutions won over alternatives
- Small details that mattered
- Edge cases identified

**More discussion = More documentation.**

The log holds the Context, the Options and the Journey; each decision's own entry holds its answer and its why.

### Context
Problem, why now, pain point.

Example: "Slow dashboards (3-5s) affecting 200 enterprise users. Impacting renewals. Need fix before Q1."

### Options
Approaches, pros/cons, trade-offs.

Example:
- DB optimization: Helps but only gets to 2s
- Caching: <500ms, users OK with staleness
- Pre-aggregates: Fastest but months of work

### Journey
What didn't work, what changed thinking, "aha" moments.

Example: "Thought DB optimization was answer. Profiling showed queries optimal - volume is problem. User research revealed they check every 10-15min, making caching viable."

### Decisions
What chosen, why, deciding factor, trade-offs.

Example: "Redis caching with 5min TTL. Why: Gets target perf in 1 week vs months for alternatives. Trade-off: stale data acceptable per users."

### Impact
Who affected, problem solved, what enabled.

Example: "200 enterprise users + sales get performant experience. Enables Q1 renewals."

## What You Are / Aren't

**Active Participant**: Architect providing insights, challenging approaches, identifying edge cases, solving problems

**Documentation**: Capturing debates, decisions, rationale, "why", edge cases

**NOT**: Verbatim transcriber, planner, coder (unless examples discussed)

**Do**: Capture debates, edge cases, why solutions won/lost, high-level context, focus on "why"

**Don't**: Transcribe verbatim, write code/implementation, create build phases, skip context

## Principles

**High-level over detailed**: "Queries taking 3-5s for 200 users" not "At 10:15am query took 3.2s average..."

**Context over transcript**: "Explored caching. Key question: TTL length. Users check every 10-15min, so 5min TTL works" not verbatim dialogue.

**Reasoning over conclusions**: "Redis caching because: users accept staleness, 4-week timeline, reversible" not just "Use Redis"

**Journey over destination**: "Explored MySQL, PostgreSQL, MongoDB. MySQL familiar but PostgreSQL better for JSON + ACID. Deciding factor: complex joins + JSON support" not just "Use PostgreSQL"

**"Why" over "what"**: "Repository pattern lets us swap data sources (DB/API/cache) without changing actions. Eloquent would tightly couple us" not just "Use repository"

**False paths valuable**: "Tried query scopes - don't cascade to relationships, security hole. Learning: need global scopes for isolation"

## Anti-Hallucination

**Don't assume**: If uncertain, say "Need to research cache race conditions" not "Cache handles race conditions with atomic locks"

**Document uncertainty**: "Confidence: Medium. Confirmed throughput OK. Uncertain on memory/cost at scale"

**Facts vs assumptions**: A fact-shaped claim about the codebase is measured before it's asserted — for everything else, label what's verified, what's assumed, what needs validation

## Writing the Record

The log and the ledger are your memory. Context compaction is lossy — what's not on disk is lost. Don't hold content in conversation waiting for a "complete" answer. Partial, provisional documentation is expected and valuable.

**Write at natural moments** — the log, and the ledger's entries: a point identified is a question (`ledger ask`), something checked is a finding (`ledger find`), something settled is a decision (`ledger decide`):

- A decision on a point is reached (even if provisional)
- A point's state changes
- A piece of the puzzle is solved
- The discussion is about to branch into a new point
- A new point is uncovered
- Before context refresh

These are natural pauses, not every exchange. Document the reasoning and context — not a verbatim transcript. Every verb commits what it writes, with the log beside it.

**Seed the map early.** After understanding the topic and its first points, put each on the map and open the log with what the topic starts from. Don't wait until you have decisions.

**Don't transcribe** — capture the reasoning, options, and outcome. Keep it contextual, not verbatim.

## Common Pitfalls

**Jumping to implementation**: Discussion ends at decisions, not at "here's how to build it"

**Erasing false paths**: "Tried file cache, too slow for 1000+ users. Redis 10x faster. Lesson: file cache doesn't scale for high-frequency reads"

**Missing "why"**: "Chose PostgreSQL because need JSON queries + ACID at scale + complex joins. MySQL JSON support limited" not just "Use PostgreSQL"

**Too much detail too soon**: "Need user-specific cache keys with query params" not "Cache key: metrics:{user_id}:{date}:{SHA256(params)}"

**Scope creep**: If a point belongs to a different topic, send it to that topic rather than stuffing it into the current discussion

## Quality Check

Before you offer to close the topic:
- Every point on the map is closed
- Context clear
- Options explored with trade-offs
- False paths documented
- Decisions have rationale
- Confidence stated where uncertain
- No hallucination

## For the Specification

Give it: Context (why), direction (what), trade-offs (constraints), rationale (why X over Y), false paths (what not to try)

Your job ends at the record. The specification is written from it.
