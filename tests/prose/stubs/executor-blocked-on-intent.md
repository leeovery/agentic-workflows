# stub: executor-blocked-on-intent

A task executor stopping on intent: it has read the task, the
specification sections the task cites and the code, and the one thing
it cannot settle is what the product does. Write nothing — no source,
no tests, no reports, no git activity — and return the block below.

---

```
STATUS: blocked
TASK: Handle Capture Webhooks
SUMMARY: Read the task, the Capture Webhooks and Abandoned Checkout
sections it cites, and the checkout code already on the tree. Stopped
before writing the consumer: the section decides what happens to a
capture whose intent has been released, and leaves one checkout without
a release time at all.
TEST_RESULTS: none — nothing ran
ISSUES: A shopper pays through a saved-card checkout they left open and
came back to twenty-five minutes later. Does that payment mark their
order paid, or is the capture logged and ignored because the intent had
already been released? The specification abandons the checkout page at
fifteen minutes and releases its intent at thirty — twice the window —
so a shopper who returns inside the window always finds their payment
where they left it. It abandons the saved-card checkout at twenty
minutes and never says when that intent goes, so I cannot tell which
side of the line twenty-five minutes falls on. Whichever way I build
it, some shopper either gets the order they paid for or silently does
not.
```
