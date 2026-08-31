# stub: synthesizer-stages-import-and-unset-bound

A synthesis over the cycle's three findings files that stages one
proposal — the import-declaration refactor carrying its consolidation
class — and records the standards agent's specification finding as a
spec defect: an unset companion bound the section's own recorded
reasoning bears on. Write both files to the paths the agent's
conventions name
(`.workflows/{work_unit}/implementation/{topic}/analysis-report-c{N}.md`
and `.workflows/{work_unit}/implementation/{topic}/analysis-tasks-c{N}.md`)
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no code writes, no git activity,
no manifest writes, no other files.

---

The report file:

```markdown
# Analysis Report: Pay (Cycle 1)

## Stats

- Total findings: 2
- Deduplicated findings: 2
- Proposed tasks: 1

## Summary

The two modules the phase built take their collaborators from ambient
scope. Nothing is duplicated between them. One standards finding
indicts the specification rather than the code: the client-bounds
section requires both external calls bounded and never set the second
bound.

## Spec Defects

### S1: The specification never set the order write's client bound
- **Claim**: (omission — § Client call bounds) The section requires the feature's two synchronous external calls to run under explicit client timeouts on the shared clients, bounds intent creation at 4 seconds with its recorded reason (twice the gateway's documented p99 of 2 seconds), records the orders store's documented p99 of 250 milliseconds for the order write, and never states the order write's bound.
- **Observed**: the bounds live on the shared client configuration and the shared clients are ambient — `grep -rn "timeout" src tests` returns nothing — so no landed change and no measurement against this tree yields the value.
- **Read**: genuinely open — nothing the record states settles the bound directly, and nothing about it reaches the shopper: the webhook path is background work by the section's own line. The section records its reasoning for the sibling bound.

## Discarded Findings
- none
```

The staging file:

```markdown
# Analysis Tasks: Pay (Cycle 1)

## Task 1: Declare the gateway and order collaborators as imports
severity: drift
sources: architecture

**Problem**: `src/checkout/payment-intent.js` reaches `gateway` and `src/webhooks/capture.js` reaches `orders` as free identifiers — neither module declares the dependency it uses, and neither can be exercised without whatever ambient definition happens to be in scope.
**Solution**: Import each collaborator explicitly at its call site, leaving both call expressions as they are. Behaviour is unchanged and the existing tests stay green.
```

The status block:

```
STATUS: tasks_proposed
TASKS_PROPOSED: 1
SUMMARY: One proposal — the import-declaration refactor. One specification defect recorded: the order write's client bound was never set.
```
