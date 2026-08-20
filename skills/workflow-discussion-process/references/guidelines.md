# Discussion Documentation Guidelines

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

Best practices for documenting discussions. For DOCUMENTATION only - no plans or code.

## Core Principles

**Follow the conversation**: Explore subtopics in whatever order makes sense. The Discussion Map tracks coverage — you don't need to force sequencing.

**Multiple-choice preferred**: When a genuine choice is being put to the user, concrete options are easier to reason about than open-ended questions. Present 2-3 approaches with trade-offs.

**Concrete before abstract**: Lead with a worked instance, not a description of a mechanism. Show the case — specific values, named actors, an actual sequence, a small ASCII diagram or step-by-step walkthrough where shape helps — then generalise. A reader who can picture the failure can judge the fix; a reader parsing a mechanism is still building the picture when the question arrives.

**YAGNI ruthlessly**: Remove unnecessary features from all designs. If not discussed, don't add it.

**Explore alternatives**: Propose 2-3 approaches before settling where the record leaves the choice open. Show trade-offs. A point the record settles is called and queued (ask-or-decide.md), never surveyed.

**Be flexible**: Go back and clarify when something doesn't make sense. Circle back to partially explored subtopics when new context changes the thinking.

**Ask questions**: Clarify ambiguity. Better to ask than assume.

**Journey over destination**: "Explored MySQL, PostgreSQL, MongoDB. MySQL familiar but PostgreSQL better for JSON + ACID. Deciding factor: complex joins + JSON support" not just "Use PostgreSQL"

**"Why" over "what"**: "Repository pattern lets us swap data sources (DB/API/cache) without changing actions. Eloquent would tightly couple us" not just "Use repository"

**False paths valuable**: "Tried query scopes - don't cascade to relationships, security hole. Learning: need global scopes for isolation"

## Anti-Hallucination

**Don't assume**: If uncertain, say "Need to research cache race conditions" not "Cache handles race conditions with atomic locks"

**Document uncertainty**: "Confidence: Medium. Confirmed throughput OK. Uncertain on memory/cost at scale"

**Facts vs assumptions**: A fact-shaped claim about the codebase is measured before it's asserted — for everything else, label what's verified, what's assumed, what needs validation

## When to Document

**Create discussion doc when**:
- Multiple valid approaches exist
- Architectural/technical decisions needed
- User explicitly asks to "discuss" or "explore"

**Skip for**:
- Obvious/trivial decisions
- Following established patterns
- Pure implementation tasks

## Structure

**Context**: Why discussing, problem, pain point
**Options**: Approaches with trade-offs
**Debates**: Back-and-forth, what mattered
**Decisions**: What chosen, why, deciding factor
**False Paths**: What didn't work, why
**Impact**: Who benefits, what enabled

## Write to Disk as Discussing

At natural pauses — not every exchange, but when something meaningful has been completed, explored, or uncovered — update the file on disk:

- Record Discussion Map state changes as subtopics progress (engine `discussion-map set`) and new subtopics as they emerge (engine `discussion-map add`)
- Document subtopics when they reach `decided`
- Document false paths when identified
- Record decisions (even provisional ones) with rationale
- Capture provisional thinking for in-progress subtopics before context refresh

Then commit. The file and manifest are the source of truth, not the conversation.

## Common Pitfalls

**Jumping to implementation**: Discussion ends at decisions, not at "here's how to build it"

**Erasing false paths**: "Tried file cache, too slow for 1000+ users. Redis 10x faster. Lesson: file cache doesn't scale for high-frequency reads"

**Missing "why"**: "Chose PostgreSQL because need JSON queries + ACID at scale + complex joins. MySQL JSON support limited" not just "Use PostgreSQL"

**Too much detail too soon**: "Need user-specific cache keys with query params" not "Cache key: metrics:{user_id}:{date}:{SHA256(params)}"

**Scope creep**: If a concern belongs to a different topic, reroute it to that topic rather than stuffing it into the current discussion

## Quality Check

Before marking discussion complete:
- ✅ All Discussion Map subtopics are `decided` or `deferred`
- ✅ Context clear
- ✅ Options explored with trade-offs
- ✅ False paths documented
- ✅ Decisions have rationale
- ✅ Confidence stated where uncertain
- ✅ No hallucination
- ✅ Open threads noted in Summary

→ Return to caller.
