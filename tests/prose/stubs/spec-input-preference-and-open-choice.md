# stub: spec-input-preference-and-open-choice

An input review agent returning three findings: one `settled` call the
discussion determines; one staged as a `choice` over a presentational
fork in the refund confirmation's wording — which of its two facts
comes first — one option marked recommended and no search named; and
one `choice` the sources leave genuinely open, its search named and
each side's cost to the customer stated. Write the tracking file to
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

### 2. Refund Confirmation Order Unstated

**Source**: discussion/pay.md · Refunds
**Category**: Gap/Ambiguity
**Move**: choice
**Affects**: Refunds

**Problem**:
When a refund lands, the confirmation the customer reads carries two
facts, the amount and the card it went back to, and nothing says which
comes first. One build writes "Refunded £42.00 to the card ending
4242" and another "The card ending 4242 has been refunded £42.00";
both carry the same two facts, and the specification does not pick.

**Options**:
- Amount first, then the card — "Refunded £42.00 to the card ending 4242" (recommended)
- Card first, then the amount — "The card ending 4242 has been refunded £42.00"

**Resolution**: Pending
**Notes**:

---

### 3. Failed-Webhook Retry Ceiling Open

**Source**: discussion/pay.md · Gateway Integration
**Category**: Gap/Ambiguity
**Move**: choice
**Affects**: Gateway Integration

**Problem**:
When the gateway's webhook delivery fails, nothing says how long the
checkout keeps waiting before it treats the payment as unconfirmed. A
customer whose bank is slow either gets their order or gets told the
payment failed, and the record does not decide which. Searched the
discussion end to end — its Gateway Integration decision confirms
capture by webhook and rules out polling, its Quoted Total decision
governs the amount and not the confirmation, and its Refunds decision
is silent on confirmation — and the specification's Gateway
Integration, Quoted Total, and Refunds sections: no source states a
ceiling, no other timeout in either document sets a precedent, no
measurement pins one, and the feature's premise (confirm by webhook,
never poll) holds under either side. The record ran out at the trade
itself, which is appetite: a customer's order lost against a
customer's order held in limbo — each side costs a customer something
the other does not.

**Options**:
- Give up after three delivery attempts and mark the payment unconfirmed — the customer hears within minutes, and a customer whose bank is slow loses the order (recommended)
- Keep accepting delivery for 24 hours and reconcile late confirmations — no customer loses an order, and a customer whose bank is slow waits up to a day with no confirmation and no dispatch

**Resolution**: Pending
**Notes**:

---
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 3
SUMMARY: The 30-day refund window the discussion decides is missing; the refund confirmation's order of amount and card is unstated; how long a failed webhook keeps retrying is genuinely open.
```
