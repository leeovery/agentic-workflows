# Discussion Documentation Guidelines

*Reference for **[technical-discussion](../SKILL.md)***

---

Best practices for documenting discussions. For DOCUMENTATION only - no plans or code.

## Core Principles

**One question at a time**: Don't overwhelm with multiple questions. Focus on single issue, get answer, move forward.

**Multiple-choice preferred**: Easier to answer than open-ended. Present 2-3 options with trade-offs.

**YAGNI ruthlessly**: Remove unnecessary features from all designs. If not discussed, don't add it.

**Explore alternatives**: Always propose 2-3 approaches before settling. Show trade-offs.

**Be flexible**: Go back and clarify when something doesn't make sense. Don't forge ahead on assumptions.

**Ask questions**: Clarify ambiguity. Better to ask than assume.

**Journey over destination**: "Explored MySQL, PostgreSQL, MongoDB. MySQL familiar but PostgreSQL better for JSON + ACID. Deciding factor: complex joins + JSON support" not just "Use PostgreSQL"

**"Why" over "what"**: "Repository pattern lets us swap data sources (DB/API/cache) without changing actions. Eloquent would tightly couple us" not just "Use repository"

**False paths valuable**: "Tried query scopes - don't cascade to relationships, security hole. Learning: need global scopes for isolation"

## Anti-Hallucination

**Don't assume**: If uncertain, say "Need to research cache race conditions" not "Cache handles race conditions with atomic locks"

**Document uncertainty**: "Confidence: Medium. Confirmed throughput OK. Uncertain on memory/cost at scale"

**Facts vs assumptions**: Label what's verified, what's assumed, what needs validation

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

At natural pauses — not every exchange, but when something meaningful has been concluded, explored, or uncovered — update the file on disk:

- Check off answered questions
- Add options as explored
- Document false paths when identified
- Record decisions (even provisional ones) with rationale
- Capture new questions as they emerge
- Keep "Current Thinking" updated

Then commit. The file is the source of truth, not the conversation.

## Common Pitfalls

**Jumping to implementation**: Discussion ends at decisions, not at "here's how to build it"

**Erasing false paths**: "Tried file cache, too slow for 1000+ users. Redis 10x faster. Lesson: file cache doesn't scale for high-frequency reads"

**Missing "why"**: "Chose PostgreSQL because need JSON queries + ACID at scale + complex joins. MySQL JSON support limited" not just "Use PostgreSQL"

**Too much detail too soon**: "Need user-specific cache keys with query params" not "Cache key: metrics:{user_id}:{date}:{SHA256(params)}"

## Quality Check

Before marking discussion complete:
- ✅ Context clear
- ✅ Questions answered (or parked)
- ✅ Options explored with trade-offs
- ✅ False paths documented
- ✅ Decisions have rationale
- ✅ Impact explained
- ✅ Confidence stated
- ✅ No hallucination
