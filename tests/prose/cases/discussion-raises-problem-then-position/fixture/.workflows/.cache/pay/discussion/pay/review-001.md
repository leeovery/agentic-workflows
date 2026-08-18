# Discussion Review — review-001

## Summary

A forming document — two subtopics decided, retries exploring.
Both findings are open choices this topic owns; neither is
settled by anything on the page.

## Gaps Identified

### F1: A retry has no payment-intent story, and the capture decision makes that dangerous

**Lane:** ask

Both retry options assume "the shopper pays again", but nothing
says what a second attempt does with the payment intent: reuse
the intent the first attempt opened, or mint a fresh one. The
decided capture ground is what makes the gap sharp. Trace it:
attempt one submits, the gateway declines, the shopper retries,
and the first attempt’s capture webhook is still in flight when
the second attempt submits. With a fresh intent per attempt the
order now has two live intents and the webhook consumer marks it
paid whichever lands — a double-charge window the capture
decision never contemplated, since it assumes one intent per
order. Reuse has its own costs: the gateway’s idempotent-retry
semantics need confirming, and an intent can expire between
attempts, which turns a retry into a failure with no path back.
A fresh-intent rule also leaves orphaned intents behind every
decline — reconciliation has to sweep them or reporting
over-counts open payments — and the refund path sketched under
capture confirmation assumes exactly one intent per order, so a
multi-intent order breaks refunds too. The document decides
neither way; the choice is structural and this topic owns it.

### F2: The retry ceiling is unstated

**Lane:** ask

Neither option says how many declines end the conversation —
whether the checkout caps attempts at all, and at what number.
The gateway account’s own velocity rules would make the product
answer moot if they are stricter; the account’s configured
limits are not in the document.

## Observations

- The Options blocks under retries are thin on messaging copy;
  the conversation will get there — not raised.

STATUS: gaps_found
FINDINGS: F1,F2
GAPS_COUNT: 2
QUESTIONS_COUNT: 0
SUMMARY: Two open choices under retries — the payment-intent story and the attempt ceiling; the capture decision makes the first structural.
