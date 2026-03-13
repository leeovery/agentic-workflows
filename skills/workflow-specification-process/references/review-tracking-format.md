# Review Tracking Format

*Reference for **[spec-review](spec-review.md)***

---

Review tracking files capture analysis findings so work persists across context refresh.

## Location

Store tracking files in the specification directory (`.workflows/{work_unit}/specification/{topic}/`), cycle-numbered:
- `review-input-tracking-c{N}.md` — Phase 1 findings for cycle N
- `review-gap-analysis-tracking-c{N}.md` — Phase 2 findings for cycle N

Tracking files are **never deleted**. After all findings are processed, mark `status: complete`. Previous cycles' files persist as analysis history.

## Format

```markdown
---
status: in-progress | complete
created: YYYY-MM-DD
cycle: {N}
phase: Input Review | Gap Analysis
topic: [Topic Name]
---

# Review Tracking: [Topic Name] - [Phase]

## Findings

### 1. [Brief Title]

**Source**: [Where this came from — file/section reference, or "Specification analysis" for Gap Analysis]
**Category**: Enhancement to existing topic | New topic | Gap/Ambiguity
**Affects**: [Which section(s) of the specification]

**Details**:
[Explanation of what was found and why it matters]

**Proposed Addition**:
[What you would add to the specification — leave blank until discussed]

**Resolution**: Pending | Approved | Adjusted | Skipped
**Notes**: [Any discussion notes or adjustments made]

---

### 2. [Next Finding]
...
```

## Workflow with Tracking Files

1. Complete your analysis and create the tracking file with all findings
2. Commit the tracking file — ensures it survives context refresh
3. Present the summary to the user (from the tracking file)
4. Work through items one at a time:
   - Present the item
   - Discuss and refine
   - Get approval
   - Log to specification
   - Update the tracking file: mark resolution, add notes
5. After all items resolved, mark tracking file `status: complete`

**Why tracking files**: If context refreshes mid-review, you can read the tracking file and continue where you left off. The tracking file shows which items are resolved and which remain. This is especially important when reviews surface 10-20 items that need individual discussion.
