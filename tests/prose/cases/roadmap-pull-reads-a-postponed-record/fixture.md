# Fixture — roadmap-pull-reads-a-postponed-record

The `search-relevance` epic did its thinking a year ago: behavioural
ranking settled — signals reach the ranker as a nightly batch
aggregation, and no live signal stream will be built — and synonym
handling settled too, retiring the hand-maintained list in favour of
behaviour-driven expansion, with the expansion service reading the live
click-signal stream at query time. Then synonym handling was postponed
to a `v2` horizon, for the managed search product landing the following
year.

Two more capabilities were parked out of the same epic as it ran —
query understanding into `v2`, personalised ranking into `v3` — so the
roadmap now holds three waiting items. Only one of them was ever a
topic: the postponed one, which records where it came from and lists the
topic's brief and discussion as its sources.

One thing about that topic is in neither list. After it had already
left, behavioural ranking routed it a concern — the stream the expansion
decision reads is the one nobody will build — and that concern is still
sitting in the epic's triage queue, undelivered, with the topic it was
meant for.

The user is back, ready to commit the managed search work to building.
