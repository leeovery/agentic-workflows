### Expansion reads a stream nobody will build
*From: behavioural-ranking · discussion · 2026-01-08*

Synonym handling settled that the expansion service consumes the
live click-signal stream at query time, keyed on
reformulation-and-click pairs. Signal ingestion settled the
opposite side of the same wire: the events pipeline exposes batch
aggregates only, and no live signal stream will be built — a
streaming layer was rejected as infrastructure for a benefit
nobody could name.

So the expansion decision rests on a capability that will not
exist. Three shapes were weighed here before this was routed on.

1. Expansion reads the nightly aggregates. A shopper who reformulates
   today gets the benefit of it tomorrow; head terms are unaffected,
   because their pair-counts are large and stable overnight. The cost
   is a new term — a product launched this morning, a misspelling
   that starts trending at lunchtime — going a day without
   expansions.
2. Expansion keeps its own in-session store, separate from ranking:
   the reformulation-and-click pairs of the current session only,
   held in the search tier. Fresh within the session, empty at the
   start of one, and a second store to operate.
3. Rejected here: build the streaming layer after all. It reverses a
   decision made on its own merits, for one consumer.

This session leans to the nightly aggregates: the freshness the
expansion decision reached for has a named consumer now, but a day
of lag on a brand-new term is a narrower cost than a second store
in the search tier.

What synonym handling needs to decide: what the expansion service
actually reads. Not in scope here: behaviour-driven expansion
itself, which is settled and not in question.
