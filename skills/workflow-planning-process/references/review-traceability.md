# Traceability Review

*Reference for **[plan-review](plan-review.md)***

---

Compare the plan against the specification **in both directions** to ensure complete, faithful translation.

**Purpose**: Verify that the plan is a faithful, complete translation of the specification. Everything in the spec must be in the plan, and everything in the plan must trace back to the spec. This is the anti-hallucination gate — it catches both missing content and invented content before implementation begins.

Re-read the specification in full before starting. Don't rely on memory — read it as if seeing it for the first time. Then check both directions:

## What You're NOT Doing

- **Not adding new requirements** — where the plan requires something of the product the spec never decided, the fix is to take it out of the plan, or to name the ground the specification owes and never decided; never to justify its inclusion. A mechanism the specification does not decide comes out on the same terms — the plan states none
- **Not expanding scope** — Missing spec content should be added as tasks; it shouldn't trigger re-architecture of the plan
- **Not being lenient with hallucinated content** — product content that cannot be traced to the specification comes out of the plan, or stands as a gap the record must answer; it is never approved into the plan as an intentional addition
- **Not re-litigating spec decisions** — The specification reflects validated decisions; you're checking the plan's fidelity to them

---

→ Load **[finding-floor.md](../../workflow-implementation-process/references/finding-floor.md)** — the floor every finding clears. At planning it reads: a finding names what the implementer builds wrong or fails to build, for whom, and how it would be noticed — or it is not written.

## Direction 1: Specification → Plan (completeness)

Is everything from the specification represented in the plan?

1. **For each specification element, verify plan coverage**:
   - Every decision → has a task that implements it
   - Every requirement → has a task with matching acceptance criteria
   - Every edge case → has a task or is explicitly handled within a task
   - Every constraint → is reflected in the relevant tasks
   - Every data model or schema → appears in the relevant tasks
   - Every integration point → has a task that addresses it
   - Every validation rule → has a task whose criteria prove it
   - Every cross-phase deferral recorded in a task → appears in the receiving phase's acceptance criteria

2. **Check depth of coverage** — It's not enough that a spec topic is *mentioned* in a task. The task carries what the record decided about it and names where the rest lives. Summarizing and rewording is fine, but the essence and instruction must be preserved.

## Direction 2: Plan → Specification (fidelity)

Is everything in the plan actually from the specification? This is the anti-hallucination check.

1. **For each task, trace its content back to the specification**:
   - The Problem statement → ties to a spec requirement or decision
   - The Solution approach → matches the spec's architectural choices
   - The implementation details → a mechanism the specification decides is carried; one it does not decide is not in the plan
   - The acceptance criteria → verify spec requirements, not made-up ones
   - The edge cases → are from the spec, not invented

2. **Flag anything that cannot be traced**:
   - Content that has no corresponding specification section
   - Technical approaches the specification decides differently
   - Mechanisms the specification never decided — a seam, the state a component keeps, a byte, a cap, an ordering inside a task, a helper's shape
   - Requirements or behaviors not mentioned anywhere in the spec
   - Edge cases the specification never identified
   - Acceptance criteria testing things the specification doesn't require

3. **The standard for hallucination**: If the plan requires something of the product — a behaviour, a scope, a rule the user meets — and you cannot point to a specific part of the specification that decides it, it is hallucinated. The same standard covers any mechanism the plan states: the specification decides it, or the plan does not say it. It doesn't matter how reasonable it seems — if it wasn't discussed and validated, it doesn't belong in the plan. The fix is removal, never justification.

---

## The Move

Every finding names the **move** it owes the reader — what they have to do about it. The move, never the Type, decides how the finding is presented.

- **settled** — the record admits exactly one defensible answer. Write the **Proposal**: the fix and what determined it. Most traceability findings are this: the specification already decided, and carrying its decision into the plan is not a new decision.
- **choice** — real options exist and only the reader can pick between them — a verdict earned by searching, never a default: anything the specification, the plan's own conventions, or a measurement yields is `settled`, that derivation its Proposal. It holds only where the fork is what the product's user gets or how it behaves, nothing in the specification, the plan's own conventions, or a measurement breaks the tie, a side visibly costs the user, and the tie-break is the reader's — appetite, product intent, or a fact only they hold. A fork in how the work is cut — phase ownership, task grouping, order, dependencies — is the planner's and settles on what leans; a fork in how the code does it is the builder's and is not a finding at all. A fork every side of which leaves the user well served is a preference, not a decision. A staged choice names what was searched and where the record ran out. Write the **Options**, one line each, at most one marked `(recommended)`. Write no Proposal: a choice dressed as a decision already made is the failure this field exists to prevent.
- A finding that indicts the specification — the plan cannot trace because the record is silent or wrong on what the product does — names that in the Problem and takes `settled` or `choice` like any other; the walk lands the answer in the record before disposing it.

A fix you cannot yourself stand behind is a **choice**, never a settled answer written on the reader's behalf. A choice that names no search is re-derived from scratch: name it. A preference no side of which costs the user is the builder's, never staged as a choice.

**Builder's — not a finding.** A mechanism, boundary, byte, ordering, or format detail any competent implementer settles the same way, or one where either way leaves the user well served, is theirs to settle with the code in front of them; the plan is not defective for leaving it open. A finding whose whole remedy is mechanism the specification leaves open is not written, and no Proposal supplies one; at most it is an Observation. A finding may name that a prescribed mechanism builds the wrong behaviour — its Proposal then restates the behaviour the task must deliver and the criterion that proves it, and removes the mechanism the record never decided, never one mechanism swapped for another.

The **Problem** is what is wrong in the terms the reader cares about — the product, the end result. Never the analysis that found it, and never the plan's own wording read back at them.

## Tracking File

After completing the analysis, create a tracking file at `.workflows/{work_unit}/planning/{topic}/review-traceability-tracking-c{N}.md` (where N is the current review cycle).

Tracking files are **never deleted** — pure markdown, no frontmatter; previous cycles' files persist as review history. The orchestrator records each file's gate state in the manifest (`tracking.{file stem}`: `in-progress` at dispatch, `complete` when all findings are processed).

`## Observations` closes the file and holds what is below the floor — a point that names no failure the implementer would build, and anything minor enough that landing it would only be polish. One line each, never walked, never counted, never re-raised. Size never demotes what the record already answers: a user-facing string, value, or behaviour the specification holds is a `settled` finding whatever its size, and plan content that contradicts the specification is a finding; neither is ever an Observation.

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

## Observations

- [One line each — a point below the floor, or one minor enough that landing it would only be polish. Never walked, never counted.]
```
