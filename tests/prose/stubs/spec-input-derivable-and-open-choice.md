# stub: spec-input-derivable-and-open-choice

An input review agent returning three findings: one `settled` call the
discussion determines; one staged as a `choice` that the record in fact
settles — the discussion ties a rule switch to exactly one named event,
the finding asks what the other events do, the derivation sits in its
own recommended option, and no search is named; and one `choice` the
sources leave genuinely open, its search named and each side's cost to
the customer stated. Write the tracking file to
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

### 2. Nothing Says What The Quoted Total Does When The Payment Step Re-Renders

**Source**: discussion/pay.md · Quoted Total — "The moment the customer edits the cart by hand from the payment step, the total re-quotes"
**Category**: Gap/Ambiguity
**Move**: choice
**Affects**: Quoted Total

**Problem**:
The payment step does not sit still once the total is quoted. The
customer comes back from a 3-D Secure challenge, a shipping-rate
refresh lands, the page reloads. The record only ever considered the
total re-quoting when the customer edits the cart by hand. If the
quote re-runs on any of those re-renders instead, a customer is
charged a figure they never saw — in precisely the flow this feature
exists to protect: see the total, confirm, pay that.

**Options**:
- The quoted total holds for as long as the cart stands untouched — every re-render reproduces it, and only a hand edit re-quotes (recommended)
- The total re-quotes on every re-render, so it can move with no keystroke from the customer

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
SUMMARY: The 30-day refund window the discussion decides is missing; the quoted total's behaviour on a re-render is unstated; how long a failed webhook keeps retrying is genuinely open.
```
