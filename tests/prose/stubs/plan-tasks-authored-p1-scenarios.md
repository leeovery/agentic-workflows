# stub: plan-tasks-authored-p1-scenarios

The task-author agent's product for Phase 1 of the pay plan under the
current template: Problem, Solution, Outcome, scenario Acceptance
Criteria, a **Do** only on the task whose how the record decided,
Context where the specification carries one, and a Spec Reference
naming the sections each task traces to. No Tests field and no Edge
Cases field — a decided edge is a criterion, and the executor names the
tests from the criteria. Write the content below to the path the prose
names (`.workflows/pay/planning/pay/phase-1-tasks.md`); it is the
file's exact bytes, and the agent returns after writing it.

---

# Phase 1: Payment Intent Core — 2 tasks

## pay-1-1

### Task 1: Create Payment Intent

**Problem**: Checkout has no way to open a payment against the gateway, so nothing downstream has a payment to confirm.

**Solution**: Create a gateway payment intent when checkout begins, card-only enforced at creation.

**Outcome**: Every checkout start yields exactly one card-only intent, and a refused one leaves the shopper something they can act on.

**Acceptance Criteria**:
- [ ] Checkout begins on an order with no intent and one payment intent exists against the gateway account
- [ ] A shopper reaches checkout with a non-card method saved and the intent accepts card alone
- [ ] The gateway refuses the intent and the shopper is shown a checkout error they can read

**Do**: Open the intent against the existing gateway account — the specification takes no new provider onboarding. The work lives on the checkout-start path.

**Context**:
> The specification's Payment Intent section decides card-only for v1, with wallet flows out of scope, and that a gateway rejection is something the shopper sees rather than a silent failure.

**Spec Reference**: `.workflows/pay/specification/pay/specification.md` — §1 Payment Intent

## pay-1-2

### Task 2: Attach Intent To Order

**Problem**: Capture confirmation cannot find the payment without a link from the order, and a shopper who starts checkout twice has nothing tying the second attempt to the first.

**Solution**: Persist the intent id on the order at creation time and reuse it when checkout starts again.

**Outcome**: Every order carries exactly one intent id, whatever the shopper does at checkout.

**Acceptance Criteria**:
- [ ] Checkout starts on an order carrying no intent id and the order takes the id of the intent just created
- [ ] Checkout starts again on an order that already carries an intent id and the same intent is used, with no second intent created

**Spec Reference**: `.workflows/pay/specification/pay/specification.md` — §1 Payment Intent, §2 Capture Webhooks
