# stub: spec-input-unsourced-weighting

An input review agent returning one finding and nothing else: the
specification states a weighting no source decides, over ground the
record frames no alternatives for. Write the tracking file to
`.workflows/{work_unit}/specification/{topic}/review-input-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Behavioural Ranking - Input Review

## Findings

### 1. The Behavioural Score's Weighting Is Nobody's Decision

**Source**: No source decides this
**Category**: Unsourced decision
**Move**: route
**Affects**: Ranking Features

**Problem**:
The specification says the behavioural score combines click-through
rate and purchase rate, weighted 30/70 in favour of purchases. The
discussion settles how the signals reach ranking — a nightly batch
over the events pipeline, streaming rejected — and stops there. It
never says the two rates combine into a single score, and it never
says what either is worth against the other.

The weighting is what the ranker optimises for, so it is what a
shopper sees: under 30/70 the first page fills with what people buy,
under 70/30 with what people open and put back. Searched the
discussion end to end, the other concluded discussion, and the
discovery session log: nothing names a target, nothing ranks clicks
against purchases, and no measurement can break the tie either —
relevance measurement is still an unexplored topic on this epic, so
there is no evaluation set to test a weighting against.

**Resolution**: Pending
**Notes**:

---
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 1
SUMMARY: The behavioural score's 30/70 weighting is a decision no source makes, and it decides what the ranker optimises for.
```
