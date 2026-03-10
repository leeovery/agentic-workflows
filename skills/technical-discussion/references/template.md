# Discussion Document Template

*Reference for **[technical-discussion](../SKILL.md)***

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

## Questions

- [ ] How should we handle X?
      - Sub-question about edge case
      - Context: brief note if needed
- [ ] What's the right approach for Y?
- [ ] Should Z be separate or combined with W?
      - Related: how does this affect A?
- [ ] ...

---

*Each question above gets its own section below. Check off as completed.*

---

## How should we handle X?

### Context
Why this question matters, what's at stake.

### Options Considered
The approaches we looked at. If pros/cons naturally emerged:

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

## What's the right approach for Y?

*(Same structure: Context → Options → Journey → Decision)*

---

## Summary

### Key Insights
1. Cross-cutting learning from the discussion
2. Something that applies broadly

### Current State
- What's resolved
- What's still uncertain

### Next Steps
- [ ] Research X
- [ ] Validate Y
```

## Usage Notes

**When creating**:
1. Ensure discussion directory exists: `.workflows/{work_unit}/discussion/`
2. Create file: `.workflows/{work_unit}/discussion/{topic}.md`
3. Start with context: why discussing?
4. List questions: what needs deciding?
5. Set status via manifest CLI (the skill handles this)

**During discussion**:
- Work through questions one at a time
- Document options, journey, and decision for each
- Check off questions as completed
- Keep journey contextual - false paths, debates, and "aha" moments belong with the question they relate to

**Per-question structure**:
- **Context**: Why this specific question matters
- **Options Considered**: Approaches explored - include pros/cons if they naturally emerged
- **Journey**: The exploration - what we thought, what changed, false paths, debates, insights
- **Decision**: What we chose, why, the deciding factor

**Flexibility**: Not every question needs all sections. Some questions have clear options with pros/cons. Some have heated debate worth capturing. Some are straightforward. Document what naturally came up - don't force structure onto a simple discussion.

**Anti-patterns**:
- Don't pull false paths into a separate top-level section - keep them with the question they relate to
- Don't turn into plan (no implementation steps)
- Don't write code - unless it came up in discussion (e.g., API shape, pattern example) and is relevant to capture
- Don't summarise the journey - document it

**Complete when**:
- Major questions completed with rationale
- Trade-offs understood
- Path forward clear
