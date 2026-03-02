# Plan Integrity Review

*Reference for **[plan-review](plan-review.md)***

---

Review the plan **as a standalone document** for structural quality, implementation readiness, and adherence to planning standards.

**Purpose**: Ensure that the plan itself is well-structured, complete, and ready for implementation. An implementer (human or AI) should be able to pick up this plan and execute it without ambiguity, without needing to make design decisions, and without referring back to the specification.

**Key distinction**: The traceability review checked *what's in the plan* against the spec. This review checks *how it's structured* — looking inward at the plan's own quality.

Read the plan end-to-end — carefully, as if you were about to implement it. For each phase, each task, and the plan overall, check against the following criteria:

## What You're NOT Doing

- **Not redesigning the plan** — You're checking quality, not re-architecting
- **Not adding content from outside the spec** — If a task needs more detail, the detail must come from the specification
- **Not gold-plating** — Focus on issues that would actually impact implementation
- **Not second-guessing phase structure** — Unless it's fundamentally broken, the structure stands

---

## What to Look For

1. **Task Template Compliance**
   - Every task has all required fields: Problem, Solution, Outcome, Do, Acceptance Criteria, Tests
   - Problem statements clearly explain WHY the task exists
   - Solution statements describe WHAT we're building
   - Outcome statements define what success looks like
   - Acceptance criteria are concrete and verifiable (not vague)
   - Tests include edge cases, not just happy paths

2. **Vertical Slicing**
   - Tasks deliver complete, testable functionality
   - No horizontal slicing (all models, then all services, then all wiring)
   - Each task can be verified independently
   - Each task is a single TDD cycle

3. **Phase Structure**
   - Phases follow logical progression (Foundation → Core → Edge cases → Refinement)
   - Each phase has clear acceptance criteria
   - Each phase is independently testable
   - Phase boundaries make sense (not arbitrary groupings)

4. **Dependencies and Ordering**
   - Task dependencies are explicit and correct — each dependency reflects a genuine data or capability requirement
   - No circular dependencies exist in the task graph
   - Priority assignments reflect graph position — foundation tasks and tasks that unblock others are prioritised appropriately
   - Tasks within a phase execute in natural order (by task ID) unless dependencies or priorities override it. Do not flag missing dependencies for sequential intra-phase tasks where natural order already produces the correct sequence. Only flag dependency issues where: execution would happen in the wrong order without an explicit dependency, a cross-phase dependency is missing, or a convergence point (task needing multiple predecessors) lacks explicit edges.

5. **Task Self-Containment**
   - Each task contains all context needed for execution
   - No task requires reading other tasks to understand what to do
   - Relevant specification decisions are pulled into task context
   - An implementer could pick up any single task and execute it

6. **Scope and Granularity**
   - Each task is one TDD cycle (not too large, not too small)
   - No task requires multiple unrelated implementation steps
   - No task is so granular it's just mechanical boilerplate

7. **Acceptance Criteria Quality**
   - Criteria are pass/fail, not subjective
   - Criteria cover the actual requirement, not just "code exists"
   - Edge case criteria are specific about boundary values and behaviors
   - No criteria that an implementer would have to interpret

8. **External Dependencies**
   - All external dependencies from the specification are documented in the plan
   - Dependencies are in the correct state (resolved/unresolved)
   - No external dependencies were missed or invented

---

## Tracking File

After completing the analysis, create a tracking file at `.workflows/{work-unit}/planning/review-integrity-tracking-c{N}.md` (where N is the current review cycle).

Categorize each finding by severity:

- **Critical**: Would block implementation or cause incorrect behavior
- **Important**: Would force implementer to guess or make design decisions
- **Minor**: Polish or improvement that strengthens the plan

Tracking files are **never deleted**. After all findings are processed, the orchestrator marks `status: complete`. Previous cycles' files persist as review history.

**Format**:
```markdown
---
status: in-progress
created: YYYY-MM-DD  # Use today's actual date
cycle: {N}
phase: Plan Integrity Review
topic: {Topic Name}
---

# Review Tracking: {Topic Name} - Integrity

## Findings

### 1. [Brief Title]

**Severity**: Critical | Important | Minor
**Plan Reference**: [Phase/task in plan]
**Category**: [Which review criterion — e.g., "Task Template Compliance", "Vertical Slicing"]
**Change Type**: [update-task | add-to-task | remove-from-task | add-task | remove-task | add-phase | remove-phase]

**Details**:
[What the issue is and why it matters for implementation]

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

Commit the tracking file after creation: `planning({topic}): integrity review cycle {N}`
