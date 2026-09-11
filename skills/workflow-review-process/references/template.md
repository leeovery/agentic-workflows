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
[One sub-heading per change-set section, carrying that section's COVERAGE entries as its file records them; a section whose agent failed is named as not covered. The change-set files stay authoritative]

#### {Section name}
- [The section's coverage entries — the property, where it lives, how it was checked]

### Plan Completion
- [ ] Phase N acceptance criteria met, except any named below as not measured
- [ ] All tasks completed or deliberately discarded (list any skipped/cancelled tasks here — discards are disclosed, never silent)
- [ ] No scope creep

**Criteria not measured**
[The criteria neither reading nor the change-set verification could settle — each quoted with its task suffix — or `none` when every criterion was settled or measured]

### Code Quality
[Issues or "No issues found"]

### Test Quality
[Issues or "Tests adequately verify requirements"]

### Blocking Issues (if any)
1. [Only what was not corrected — the `replan` actions carrying `blocking`: the acceptance criterion unmet in substance, or the behaviour that is broken, still outstanding. A blocking issue corrected in this session is named under Corrected in this session, never here]

## Findings

### Needs planning
[Why the review failed — what is wrong, the failure it causes, how far the fix reaches; a blocking action carries the marker `**blocking**` on its row. Omit section if none]

### Corrected in this session
[Applied count; each action as the record shows it, a blocking one carrying the marker `**blocking** — corrected` on its row; anything skipped or reverted with its reason (a reverted action is still owed); and the suite's final state. Omit section if none]

### Out of scope
[Held for the user's call at a pass — each with its kind: feature, bug, or quick-fix. Omit section if none]

### Discarded
[Count, then each discarded item with its reason. Omit section if none]
```

## Verdict Guidelines

The verdict is derived, never chosen: any action routed to `replan` means **Fail** — the work is not delivered while something needs going back to plan. Otherwise **Pass**: corrected work is already applied — a blocking issue corrected in this session included, since nothing of it is outstanding — and out-of-scope findings were never part of this specification.
