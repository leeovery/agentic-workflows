# Review Template

*Reference for **[workflow-review-process](../SKILL.md)***

---

## Template

```markdown
# Implementation Review: {Topic / Product}

**Plan**: {work_unit}
**Verdict**: Pass | Fail

## Summary
[One paragraph overall assessment]

## QA Verification

### Specification Compliance
[Implementation aligns with specification / Note any deviations]

### Plan Completion
- [ ] Phase N acceptance criteria met
- [ ] All tasks completed or deliberately discarded (list any skipped/cancelled tasks here — discards are disclosed, never silent)
- [ ] No scope creep

### Code Quality
[Issues or "No issues found"]

### Test Quality
[Issues or "Tests adequately verify requirements"]

### Blocking Issues (if any)
1. [The acceptance criterion unmet in substance, or the behaviour that is broken — never a finding whose entire remedy is comment or documentation text]

## Findings

### Needs planning
[Why the review failed — what is wrong, the failure it causes, how far the fix reaches. Omit section if none]

### Corrected in this session
[Applied count, anything skipped or reverted with its reason (a reverted action is still owed), and the suite's final state. Omit section if none]

### Out of scope
[Held for the user's call at a pass — each with its kind: feature, bug, or quick-fix. Omit section if none]

### Discarded
[Count, then each discarded item with its reason. Omit section if none]
```

## Verdict Guidelines

The verdict is derived, never chosen: any blocking issue or any finding routed to `replan` means **Fail** — the work is not delivered while something needs going back to plan. Otherwise **Pass**: corrected work is already applied, and out-of-scope findings were never part of this specification.
