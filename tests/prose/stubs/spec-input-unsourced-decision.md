# stub: spec-input-unsourced-decision

An input review agent whose reverse-fidelity pass finds one design
decision the specification states and no source makes. Write the
tracking file to
`.workflows/{work_unit}/specification/{topic}/review-input-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Input Review

## Findings

### 1. Webhook Verification Mechanism Is Unsourced

**Source**: No source decides this
**Category**: Unsourced decision
**Affects**: Webhook Verification

**Details**:
The specification decides the webhook verification mechanism —
signatures verified as HMAC-SHA256 against the raw body, with a custom
five-minute tolerance window. The discussion decides that capture is
confirmed by gateway webhooks, and nothing more: no verification
mechanism, no tolerance, no custom window. Checked the sole source
(the pay discussion) end to end. A normative choice with real
consequence that no source makes.

**Proposed Change**:

**Resolution**: Pending
**Notes**:

---
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 1
SUMMARY: The spec decides the webhook verification mechanism; no source makes that decision — routed, not applied.
```
