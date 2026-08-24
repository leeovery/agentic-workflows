# stub: spec-input-settled-pair

An input review agent returning two `settled` findings: one the
discussion determines, carrying a Current field and its replacement
wording; one spec-native with no Current, whose Proposed Text is a
single sentence. Write the tracking file to
`.workflows/{work_unit}/specification/{topic}/review-input-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Input Review

## Findings

### 1. Refund Window Missing

**Source**: discussion/pay.md · Refunds
**Category**: Enhancement to existing topic
**Move**: settled
**Affects**: Refunds

**Problem**:
The specification says refunds are supported but never says for how
long, so a customer refunded on day 40 and one refused on day 40 are
both defensible builds.

**Proposal**:
The discussion's Refunds decision fixes the window at 30 days from
capture. Carrying it across is not a new decision — I would state it in
the Refunds section.

**Current**:
- Refunds are issued against the original payment intent.

**Proposed Text**:
- Refunds are issued against the original payment intent, within 30
  days of capture.

**Resolution**: Pending
**Notes**:

---

### 2. Partial Refund Amounts Have No Rounding Rule

**Source**: discussion/pay.md · Refunds (adjacent ground — no source states a rounding rule)
**Category**: Gap/Ambiguity
**Move**: settled
**Affects**: Refunds

**Problem**:
A per-line-item refund can compute to a fraction of the smallest
currency unit, and nothing says which way it rounds — two builders
would refund two different amounts for the same line.

**Proposal**:
The gateway settles amounts to the nearest smallest currency unit,
half away from zero, on its own statements — matching it is the only
answer that reconciles a refund with the settlement it reverses.
Nothing turns on inventing a different rule, so I would state the
gateway's in one line under Refunds.

**Proposed Text**:
- Partial refund amounts round to the nearest smallest currency unit, half away from zero.

**Resolution**: Pending
**Notes**:

---
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 2
SUMMARY: The 30-day refund window the discussion decides is missing from the spec; partial refund amounts carry no rounding rule.
```
