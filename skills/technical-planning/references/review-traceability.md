# Traceability Review

*Reference for **[plan-review](plan-review.md)***

---

Compare the plan against the specification **in both directions** to ensure complete, faithful translation.

**Purpose**: Verify that the plan is a faithful, complete translation of the specification. Everything in the spec must be in the plan, and everything in the plan must trace back to the spec. This is the anti-hallucination gate — it catches both missing content and invented content before implementation begins.

Re-read the specification in full before starting. Don't rely on memory — read it as if seeing it for the first time. Then check both directions:

## What You're NOT Doing

- **Not adding new requirements** — If something isn't in the spec, the fix is to remove it from the plan or flag it with `[needs-info]`, not to justify its inclusion
- **Not expanding scope** — Missing spec content should be added as tasks; it shouldn't trigger re-architecture of the plan
- **Not being lenient with hallucinated content** — If it can't be traced to the specification, it must be removed or the user must explicitly approve it as an intentional addition
- **Not re-litigating spec decisions** — The specification reflects validated decisions; you're checking the plan's fidelity to them

---

## Direction 1: Specification → Plan (completeness)

Is everything from the specification represented in the plan?

1. **For each specification element, verify plan coverage**:
   - Every decision → has a task that implements it
   - Every requirement → has a task with matching acceptance criteria
   - Every edge case → has a task or is explicitly handled within a task
   - Every constraint → is reflected in the relevant tasks
   - Every data model or schema → appears in the relevant tasks
   - Every integration point → has a task that addresses it
   - Every validation rule → has a task with test coverage

2. **Check depth of coverage** — It's not enough that a spec topic is *mentioned* in a task. The task must contain enough detail that an implementer wouldn't need to go back to the specification. Summarizing and rewording is fine, but the essence and instruction must be preserved.

## Direction 2: Plan → Specification (fidelity)

Is everything in the plan actually from the specification? This is the anti-hallucination check.

1. **For each task, trace its content back to the specification**:
   - The Problem statement → ties to a spec requirement or decision
   - The Solution approach → matches the spec's architectural choices
   - The implementation details → come from the spec, not invention
   - The acceptance criteria → verify spec requirements, not made-up ones
   - The tests → cover spec behaviors, not imagined scenarios
   - The edge cases → are from the spec, not invented

2. **Flag anything that cannot be traced**:
   - Content that has no corresponding specification section
   - Technical approaches not discussed in the specification
   - Requirements or behaviors not mentioned anywhere in the spec
   - Edge cases the specification never identified
   - Acceptance criteria testing things the specification doesn't require

3. **The standard for hallucination**: If you cannot point to a specific part of the specification that justifies a piece of plan content, it is hallucinated. It doesn't matter how reasonable it seems — if it wasn't discussed and validated, it doesn't belong in the plan.

---

## Tracking File

After completing the analysis, create a tracking file at `.workflows/{work_unit}/planning/review-traceability-tracking-c{N}.md` (where N is the current review cycle).

Tracking files are **never deleted**. After all findings are processed, the orchestrator marks `status: complete`. Previous cycles' files persist as review history.

**Format**:
```markdown
---
status: in-progress
created: YYYY-MM-DD  # Use today's actual date
cycle: {N}
phase: Traceability Review
topic: {Topic Name}
---

# Review Tracking: {Topic Name} - Traceability

## Findings

### 1. [Brief Title]

**Type**: Missing from plan | Hallucinated content | Incomplete coverage
**Spec Reference**: [Section/decision in specification, or "N/A"]
**Plan Reference**: [Phase/task in plan, or "N/A" for missing content]
**Change Type**: [update-task | add-to-task | remove-from-task | add-task | remove-task | add-phase | remove-phase]

**Details**:
[What was found and why it matters]

**Current**:
[The existing content as it appears in the plan — omit for add-task/add-phase]

**Proposed**:
[The replacement/new content in full plan format — omit for remove-task/remove-phase]

**Resolution**: Pending
**Notes**:

---

### 2. [Next Finding]
...
```

Commit the tracking file after creation: `planning({topic}): traceability review cycle {N}`
