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

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. Not every subtopic needs its own section — minor items resolved in passing can be folded into their parent. The Discussion Map (which subtopics exist and their states) lives in the manifest, not this file.*

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
- Concerns rerouted to other topics (with links)

### Current State
- What's resolved
- What's still uncertain

## Triage

(none)
```

## Usage Notes

**When creating**:
1. Ensure discussion directory exists: `.workflows/{work_unit}/discussion/`
2. Create file: `.workflows/{work_unit}/discussion/{topic}.md`
3. Start with context: why discussing?
4. Register in the manifest and seed the Discussion Map via the engine `map add` command (the skill handles this)

**During discussion**:
- Follow the conversation organically — don't force a rigid question order
- Track subtopics on the Discussion Map (manifest state, maintained via the engine `map` commands)
- Document subtopics when they reach `decided` (or accumulate enough exploration to capture)
- New subtopics emerge naturally — record them on the map as `pending`
- Minor items resolved in passing can be folded into their parent subtopic's documentation

**Per-subtopic structure** (when documenting):
- **Context**: Why this specific subtopic matters
- **Options Considered**: Approaches explored — include pros/cons if they naturally emerged
- **Journey**: The exploration — what we thought, what changed, false paths, debates, insights
- **Decision**: What we chose, why, the deciding factor

**Discussion Map**:
- Subtopic states (`pending`, `exploring`, `converging`, `decided`, `deferred`) live in the manifest — the file holds the knowledge, the map holds the live state
- New child subtopics can be added under top-level parents (two levels max)
- The map is the user's visibility into discussion shape and your tracking mechanism

**Flexibility**: Not every subtopic needs all sections. Some have clear options with pros/cons. Some have heated debate worth capturing. Some are straightforward. Document what naturally came up — don't force structure onto a simple discussion.

**Anti-patterns**:
- Don't pull false paths into a separate top-level section — keep them with the subtopic they relate to
- Don't turn into plan (no implementation steps)
- Don't write code — unless it came up in discussion (e.g., API shape, pattern example) and is relevant to capture
- Don't summarise the journey — document it
- Don't stuff concerns that belong to a different topic into subtopics — reroute them to that topic

**Triage section**:
- `## Triage` is a fixed terminal landing zone for off-topic concerns rerouted from other topics; working discussion content stays above it; left as `(none)` until an entry lands

**Complete when**:
- All subtopics on the Discussion Map are `decided` (or `deferred`)
- Trade-offs understood
- Path forward clear
- No new subtopics emerging without breaking scope
