# Investigation Template

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

Use this structure for investigation documents.

```markdown
# Investigation: {Topic Title}

## Symptoms

### Problem Description

**Expected behavior:**
{What should happen}

**Actual behavior:**
{What actually happens}

### Manifestation

{How the bug surfaces:}
- Error messages
- UI glitches
- Data corruption
- Performance issues
- etc.

### Reproduction Steps

1. {Precondition or setup}
2. {Action that triggers the bug}
3. {Observe the result}

**Reproducibility:** {Always / Sometimes / Intermittent}

### Environment

- **Affected environments:** {Production, staging, local}
- **Browser/platform:** {If relevant}
- **User conditions:** {Specific user states, permissions, data}

### Impact

- **Severity:** {Critical / High / Medium / Low}
- **Scope:** {Number of users affected}
- **Business impact:** {Revenue, trust, compliance}

### References

- {Link to error tracking (Sentry, etc.)}
- {Link to support tickets}
- {Link to relevant logs}

---

## Analysis

### Hypotheses

**Checkpoint depth:** {straight-through | check-ins}

{Live ledger — statuses evolve through the analysis:}
- **{hypothesis}** [{suspected | tracing | confirmed | ruled-out}]
  {basis, then evidence as it accumulates}

### Code Trace

**Entry point:**
{Where the problematic flow starts}

**Execution path:**
1. {file:line - description}
2. {file:line - description}
3. {file:line - description}

**Key files involved:**
- {file} - {role in the bug}
- {file} - {role in the bug}

### Root Cause

{Clear, precise statement of what causes the bug}

**Why this happens:**
{Explanation of the underlying issue}

### Contributing Factors

- {Factor 1 - why it enables the bug}
- {Factor 2 - why it enables the bug}

### Why It Wasn't Caught

- {Testing gap}
- {Edge case not considered}
- {Recent change that introduced it}

### Blast Radius

**Directly affected:**
- {Component/feature}
- {Component/feature}

**Potentially affected:**
- {Component/feature that shares code/patterns}

---

## Fix Direction

### Chosen Approach

{High-level description of the chosen fix direction}

**Deciding factor:** {Why this approach was selected over alternatives}

### Options Explored

{List whatever approaches were discussed — could be one, could be several. For each unchosen option, note why it wasn't selected.}

### Discussion

{Journey notes from the fix discussion — user priorities, concerns raised, edge cases surfaced, what shifted thinking. Brief for simple bugs, detailed for complex.}

### Testing Recommendations

- {Test that should be added}
- {Test that should be added}
- {Existing test that should be modified}

### Risk Assessment

- **Fix complexity:** {Low / Medium / High}
- **Regression risk:** {Low / Medium / High}
- **Recommended approach:** {Hotfix / Regular release / Feature flag}

---

## Notes

{Any additional observations, questions for later, or context}
```

## Section Guidelines

### Symptoms Section

Gather all observable information about the bug before analyzing code. This creates a clear target for analysis and helps validate the fix.

### Analysis Section

Document your investigation journey. Even dead ends are valuable — they show what's NOT the cause and help others avoid the same paths. The Hypotheses ledger is live state — keep statuses current as the analysis moves.

### Fix Direction Section

Don't detail the implementation here — that's for the specification. Focus on high-level direction, options explored, and risk assessment. This section is written only when the fix discussion concludes — drafts live in cache until the direction is agreed. Capture the decision journey, not just the outcome.
