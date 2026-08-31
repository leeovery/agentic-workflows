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
   - Every cross-phase deferral recorded in a task → appears in the receiving phase's acceptance criteria

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

## The Move

Every finding names the **move** it owes the reader — what they have to do about it. The move, never the Type, decides how the finding is presented.

- **settled** — the record admits exactly one defensible answer. Write the **Proposal**: the fix and what determined it. Most traceability findings are this: the specification already decided, and carrying its decision into the plan is not a new decision.
- **choice** — real options exist and only the reader can pick between them — a verdict earned by searching, never a default: anything the specification or the plan's own shape yields is `settled`, that derivation its Proposal. A staged choice names what was searched and where the record ran out. Write the **Options**, one line each, at most one marked `(recommended)`. Write no Proposal: a choice dressed as a decision already made is the failure this field exists to prevent.
- Planning findings never route: the plan is the document under review, and its answers live in the specification or the record.

A fix you cannot yourself stand behind is a **choice**, never a settled answer written on the reader's behalf. Classification only ever moves toward the reader.

The **Problem** is what is wrong in the terms the reader cares about — the product, the end result. Never the analysis that found it, and never the plan's own wording read back at them.

## Tracking File

After completing the analysis, create a tracking file at `.workflows/{work_unit}/planning/{topic}/review-traceability-tracking-c{N}.md` (where N is the current review cycle).

Tracking files are **never deleted** — pure markdown, no frontmatter; previous cycles' files persist as review history. The orchestrator records each file's gate state in the manifest (`tracking.{file stem}`: `in-progress` at dispatch, `complete` when all findings are processed).

**Format**:
```markdown
# Review Tracking: {Topic Name} - Traceability

## Findings

### 1. [Brief Title]

**Type**: Missing from plan | Hallucinated content | Incomplete coverage
**Spec Reference**: [Section/decision in specification, or "N/A"]
**Plan Reference**: [Phase/task in plan, or "N/A" for missing content]
**Move**: settled | choice
**Change Type**: [update-task | add-to-task | remove-from-task | add-task | remove-task | add-phase | remove-phase]

**Problem**:
[What this would build wrong, or fail to build, in the terms the reader cares about. Name the consequence, not the trace that found it.]

**Proposal**:
[Move `settled` — the fix and what determined it. Omit for `choice`.]

**Options**:
[Move `choice` — one line per option, "(recommended)" on at most one. Omit for `settled`.]

**Current**:
[Move `settled` only — the existing content as it appears in the plan. Omit for add-task/add-phase, and always for `choice`: a choice carries no fix content.]

**Proposed Text**:
[Move `settled` only — the replacement/new content in full plan format. Omit for remove-task/remove-phase, and always for `choice`: a choice carries no fix content. Older tracking files name this field **Proposed** — read both as the same field.]

**Resolution**: Pending
**Notes**:

---

### 2. [Next Finding]
...
```
