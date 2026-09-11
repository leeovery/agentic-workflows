# stub: discussion-review-gaps

A background review agent's report on a discussion at its close: two
ask-laned gaps on decided ground — questions the document leaves open,
neither settled by anything already decided. The content below is
written to the path the dispatch response returned; the STATUS block is
also what the agent returns to its caller.

---

# Discussion Review

## Summary

Read fresh, the discussion holds a clear context and three subtopics
that each carry a decision with its rationale — alternatives explored
and trade-offs acknowledged. Two consequences of those decisions are
left open by the document and nothing already decided settles them.

## Gaps Identified

### F1: What happens when the capture webhook never arrives

**Lane:** ask

Capture is confirmed by the gateway's webhooks and the checkout never
polls. The document does not say what the order does when no webhook
arrives — a delivery failure on the gateway's side, or an endpoint
outage on ours. Is the order held, released, or reconciled later, and
by what? The decision rules out polling; it does not say what stands
in for it when the webhook is lost.

### F2: Whether the retry counter survives a changed card

**Lane:** ask

Three attempts per payment, exponential backoff, counter resets only on
a new checkout. A customer who swaps cards mid-checkout is on the same
checkout — do their three attempts carry over from the declined card,
or does the new card start fresh? The document's rationale (never
re-run a hard decline all day) points one way for the same card and
says nothing about a different one.

## Open Questions

None identified.

## Observations

- Hosted fields settle the PCI question cleanly; nothing to add.

STATUS: gaps_found
FINDINGS: F1,F2
GAPS_COUNT: 2
QUESTIONS_COUNT: 0
SUMMARY: Two consequences of decided ground are left open — lost webhooks, and a swapped card's retry budget.
