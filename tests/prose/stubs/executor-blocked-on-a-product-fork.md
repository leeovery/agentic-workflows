# stub: executor-blocked-on-a-product-fork

A task executor stopping on intent where the record has no answer: two
things can happen to the shopper, the specification's rules reach
neither, and the pick is not the executor's to make. The report names
the two in the order their costs argue for — the order staying
cancelled first — and decides neither. Write nothing — no source, no
tests, no reports, no git activity — and return the block below.

---

```
STATUS: blocked
TASK: Handle Capture Webhooks
SUMMARY: Read the task, the Capture Webhooks section it cites, and the
order code already on the tree. Stopped before writing the consumer:
the section decides what a capture does to an order still waiting for
it, and says nothing about one the shopper has since cancelled.
TEST_RESULTS: none — nothing ran
ISSUES: A shopper cancels their order in the seconds between submitting
checkout and the gateway confirming the payment, and the capture
webhook lands after the cancellation. Two things can happen to them.
Either the order stays cancelled and the payment is returned without it
ever reappearing — what they see is a charge and a refund against an
order they cancelled, and the cancellation they asked for holds — or
the order comes back as paid, standing again and marked paid, with a
refund following behind it, which means an order they cancelled is
restored under them and support fields the call. The specification
decides what happens to a capture naming an intent no order carries; a
cancelled order still carries its intent, so that rule does not reach
this. I cannot tell which of the two the shopper is meant to meet.
```
