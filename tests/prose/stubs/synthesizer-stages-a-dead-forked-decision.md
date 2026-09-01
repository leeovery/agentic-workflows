# stub: synthesizer-stages-a-dead-forked-decision

A synthesis over the cycle's three findings files that stages two
proposals — a plain webhook guard, and a proposal carrying a staged
**Decision** with its **Stakes** line over where an unmatched capture
surfaces, one side of which the guard proposal's approval forecloses.
Write both files to the paths the agent's conventions name
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
- Proposed tasks: 2

## Summary

The capture webhook trusts every intent id it is handed — an unknown
intent is marked paid like any other — and once it stops doing that,
a capture the store cannot match has no surface anywhere. Nothing is
duplicated and nothing indicts the specification.

## Discarded Findings
- none
```

The staging file:

```markdown
# Analysis Tasks: Pay (Cycle 1)

## Task 1: Guard the capture webhook against unknown intents
severity: medium
sources: standards

**Problem**: `handleCaptureWebhook` calls `orders.markPaid(event.intentId)` without looking the intent up, so a capture naming an intent the order store does not know is treated exactly like a match.
**Solution**: Resolve the intent against the order store before marking paid. On a miss, log the capture's intent id and acknowledge the delivery without changing any order; known intents behave exactly as today.

## Task 2: Surface unmatched captures
severity: medium
sources: standards

**Problem**: Money can move at the gateway for an intent the order store cannot match — a capture delivered before its intent record lands, or for a record that failed to persist. Once the webhook stops marking such captures paid, nothing anywhere shows they happened.
**Solution**: The miss is detected and logged at the webhook; where it surfaces beyond the log is the open question.
**Decision**: What does the product do with a capture that matches no order?
**Stakes**: An operator surface turns every unmatched capture into a person's follow-up — nothing is lost silently, at the cost of a review surface v1 never planned. Refusing the delivery makes the gateway redeliver until the intent record lands — ordering races heal themselves with nobody involved, at the cost of retry storms for captures that will never match. No log exists to say which mismatches dominate, and the appetite for an operator surface is the user's to weigh; the record side is recommended because a refused capture retries blind while a recorded one is inspectable.
1. Unmatched captures land on an operator-visible record and a person resolves each one — nothing redelivers, nothing vanishes (recommended)
2. Unmatched captures are refused and the gateway redelivers until the intent record lands — mismatches from ordering races heal with no operator involved
```

The status block:

```
STATUS: tasks_proposed
TASKS_PROPOSED: 2
SUMMARY: Two proposals — a webhook guard and the unmatched-capture surfacing question.
```
