# stub: synthesizer-stages-pair-and-defect

A synthesis over the cycle's three findings files that stages two
proposals — one a pure refactor carrying its consolidation class, one
graded — and records the standards agent's specification finding as a
spec defect the tree settles. Write both files to the paths the agent's
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

- Total findings: 3
- Deduplicated findings: 3
- Proposed tasks: 2

## Summary

The two modules the phase built take their collaborators from ambient
scope and assert guarantees in comments that neither body implements.
Nothing is duplicated between them. One standards finding indicts the
specification rather than the code: a design note pointing at a file
that does not exist.

## Spec Defects

### S1: The specification names a checkout path the tree does not have
- **Claim**: "Intent creation lives in `src/checkout/intent.js`." (§ Design notes)
- **Observed**: `ls src/checkout` lists `payment-intent.js` and nothing else; `createPaymentIntent` is defined at src/checkout/payment-intent.js:4
- **Read**: spec stale — the path is a factual value the tree settles by direct measurement, not a design question

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

## Task 2: Implement the guarantees the module headers assert
severity: medium
sources: standards

**Problem**: Both module headers state behaviour the bodies do not carry — gateway rejection surfacing as a checkout error, a duplicate checkout start reusing the existing intent, duplicate webhook deliveries being idempotent. Each body is a single unguarded call, and both of the phase's named tests are empty stubs.
**Solution**: Implement the three guarantees behind the existing entry points and cover each with the test its task already names.
```

The status block:

```
STATUS: tasks_proposed
TASKS_PROPOSED: 2
SUMMARY: Two proposals — an import-declaration refactor and the unimplemented header guarantees. One specification defect recorded: a design note naming a path the tree does not have.
```
