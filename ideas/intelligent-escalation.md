# Intelligent Escalation

## The Idea

When review/analysis cycles aren't converging, diagnose *why* instead of just asking "continue or skip?"

## Why This Matters

Currently, safety caps (3 fix attempts, 5 review cycles) hit a wall and present a binary choice: keep going or give up. This is frustrating because the user has no visibility into what's stuck, what's improving, and what the actual blocker is.

## What It Would Look Like

When a cap is hit, instead of "continue or skip?", present:

```
Fix attempt 3 of 3 reached for task "API validation"

Converging:
  - Input parsing (fixed in attempt 2)
  - Error format (fixed in attempt 1)

Still stuck:
  - Edge case: empty array handling
    Attempts: 3 approaches tried, all fail same assertion
    Root cause: spec ambiguity — spec says "handle gracefully" but
    doesn't define behavior for nested empty arrays

Recommended:
  - Clarify spec for empty array edge case, then retry
  - Or: skip this edge case and log as known gap
```

## Broader Application

This pattern applies everywhere cycles exist:
- Implementation fix loops (executor ↔ reviewer)
- Planning review cycles (traceability + integrity)
- Specification review cycles (input + gap analysis)
- Post-implementation analysis loops

Each could track what's converging vs stuck and present a diagnostic when escalating.

## Implementation Notes

Would require agents to return structured diff data between attempts (what changed, what didn't). The orchestrating skill would track attempt history and present the convergence analysis at escalation time.
