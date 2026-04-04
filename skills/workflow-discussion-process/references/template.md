# Discussion Document Template

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

Standard structure for discussion files. DOCUMENT only - no plans or code. Location: `.workflows/{work_unit}/discussion/{topic}.md`.

This is a single file per topic.

**This is a guide, not a form.** Use the structure to capture what naturally emerges from discussion. Don't force sections that didn't come up. The goal is to document the reasoning journey, not fill in every field.

## Template

```markdown
# Discussion: {Topic}

## Context

What this is about, why we're discussing it, the problem or opportunity, current state.

### References

- [Related spec or doc](link)
- [Prior discussion](link)

## Discussion Map

A living index of subtopics tracked during the discussion. This is the structural backbone — it grows as the conversation branches, and converges as decisions land. Claude maintains this section throughout.

### States

- **pending** — identified but not yet explored
- **exploring** — actively being discussed
- **converging** — narrowing toward a decision
- **decided** — decision reached with rationale documented

### Map

  {Subtopic A} [decided]
  ├─ {Child subtopic} [decided]
  └─ {Child subtopic} [converging]

  {Subtopic B} [exploring]
  ├─ {Child subtopic} [exploring]
  └─ {Child subtopic} [pending]

  {Subtopic C} [pending]

  → Elevated: {sibling-topic} — discovered during discussion, seeded as separate topic

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. Not every subtopic needs its own section — minor items resolved in passing can be folded into their parent.*

---

## {Subtopic A}

### Context
Why this subtopic matters, what's at stake, how it fits the larger topic.

### Options Considered
The approaches explored. If pros/cons naturally emerged:

**Option A**
- Pros: ...
- Cons: ...

**Option B**
- Pros: ...
- Cons: ...

### Journey
The back-and-forth exploration. What we initially thought. What changed our thinking. False paths - "We considered A but realised B because C." The "aha" moments. Small details that mattered.

If there was notable debate:
- **Positions**: What each side argued
- **Resolution**: What made us choose, what detail tipped it

### Decision
What we chose, why, the deciding factor, trade-offs accepted, confidence level.

---

## {Subtopic B}

*(Same structure: Context → Options → Journey → Decision)*

---

## Summary

### Key Insights
1. Cross-cutting learning from the discussion
2. Something that applies broadly

### Open Threads
- Anything deliberately deferred or left for future discussion
- Subtopics that were elevated to separate topics (with links)

### Current State
- What's resolved
- What's still uncertain
```

## Usage Notes

**When creating**:
1. Ensure discussion directory exists: `.workflows/{work_unit}/discussion/`
2. Create file: `.workflows/{work_unit}/discussion/{topic}.md`
3. Start with context: why discussing?
4. Seed the Discussion Map with initial subtopics (derived from research, handoff, or user input)
5. Set status via manifest CLI (the skill handles this)

**During discussion**:
- Follow the conversation organically — don't force a rigid question order
- Update the Discussion Map as subtopics are identified, explored, and decided
- Document subtopics when they reach `decided` (or accumulate enough exploration to capture)
- New subtopics emerge naturally — add them to the map as `pending`
- Minor items resolved in passing can be folded into their parent subtopic's documentation

**Per-subtopic structure** (when documenting):
- **Context**: Why this specific subtopic matters
- **Options Considered**: Approaches explored — include pros/cons if they naturally emerged
- **Journey**: The exploration — what we thought, what changed, false paths, debates, insights
- **Decision**: What we chose, why, the deciding factor

**Discussion Map maintenance**:
- Update states as the conversation progresses
- New child subtopics can be added under parents
- The map is the user's visibility into discussion shape and Claude's tracking mechanism
- Elevated topics (siblings that became their own discussion) are noted with `→ Elevated:` on the map

**Flexibility**: Not every subtopic needs all sections. Some have clear options with pros/cons. Some have heated debate worth capturing. Some are straightforward. Document what naturally came up — don't force structure onto a simple discussion.

**Anti-patterns**:
- Don't pull false paths into a separate top-level section — keep them with the subtopic they relate to
- Don't turn into plan (no implementation steps)
- Don't write code — unless it came up in discussion (e.g., API shape, pattern example) and is relevant to capture
- Don't summarise the journey — document it
- Don't stuff sibling-level concerns into subtopics — elevate them to their own discussion topic

**Complete when**:
- All subtopics on the Discussion Map are `decided` (or deliberately deferred)
- Trade-offs understood
- Path forward clear
- No new subtopics emerging without breaking scope
