# Review Checklist

*Reference for **[workflow-review-process](../SKILL.md)***

---

## Per-Task Verification Criteria

For each task, the workflow-review-task-verifier checks:

### Implementation

- Is the task implemented?
- Does the implementation match the acceptance criteria?
- Does it align with spec context (load relevant spec section)?
- Any drift from what was planned?

### Test Adequacy

**Not under-tested:**
- Does a test exist for this task?
- Does the test verify the acceptance criteria?
- Are edge cases from the spec covered?
- Would the test fail if the feature broke?

**Not over-tested:**
- Are tests focused on what matters?
- No redundant assertions testing the same thing?
- No unnecessary mocking or setup?
- Tests aren't testing implementation details instead of behavior?

### Code Quality

Review as a senior architect would:

**Project conventions** (check `.claude/skills/` for project-specific guidance):
- Framework and architecture guidelines defined for the project
- Code style and patterns specific to the codebase

**General principles** (always apply):
- **SOLID**: Single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion
- **DRY**: No unnecessary duplication (without premature abstraction)
- **Low complexity**: Reasonable cyclomatic complexity, clear code paths
- **Modern idioms**: Uses current language features appropriately
- **Readability**: Self-documenting code, clear intent
- **Security**: No obvious vulnerabilities (injection, exposure, etc.)
- **Performance**: No obvious inefficiencies (N+1 queries, unnecessary loops, etc.)

## Plan Completion Check

After task-level verification, check overall plan completion:

### Phase Acceptance Criteria

For each phase:
- Are all phase-level acceptance criteria met?
- Were all tasks in the phase completed?

### Scope

- Was anything built that wasn't in the plan? (scope creep)
- Was anything in the plan not built? (missing scope)
- Any unplanned files or features added?

## Common Issues

**Incomplete task**: Task marked done but not fully implemented

**Under-tested**: Missing tests, or tests don't verify acceptance criteria

**Over-tested**: Redundant tests, testing implementation details, excessive mocking

**Requirement drift**: Implementation doesn't match what was planned

**Missing edge cases**: Spec mentions edge cases not implemented or tested

**Scope creep**: Extra features not in plan

**Orphaned code**: Code added but not used or tested

**Poor readability**: Code works but is hard to understand

## Writing Feedback

Be specific and actionable:

- **Bad**: "Tests need improvement"
- **Good**: "Test `test_cache_expiry` doesn't verify TTL, only that value is returned"

Reference the plan task:

- **Bad**: "This wasn't done correctly"
- **Good**: "Plan Phase 2, Task 3 says 'implement Redis cache' with acceptance 'cache stores values for configured TTL' → implementation uses file cache with no TTL. Task incomplete."

Flag test balance issues:

- **Under-tested**: "Task 2.1 has no test for the error case mentioned in spec section 3.2"
- **Over-tested**: "Task 2.1 has 5 tests that all verify the same happy path with slight variations"

Distinguish blocking vs non-blocking:

- **Blocking**: Incomplete tasks, missing tests, broken functionality
- **Non-blocking**: Code style suggestions, minor readability improvements
