### Measurement gates for ranking changes
*From: behavioural-ranking · discussion · 2026-01-02*

behavioural-ranking settled signal ingestion as batch nightly
aggregation, so ranking changes ship against day-old signals.
Working that through produced three revisions to how ranking
quality should be measured — three consequences, each this
topic's to accept or reject.

**1. An offline baseline computed from the batch aggregates.**

Every ranking change is judged against an offline metrics baseline
recomputed nightly from the same aggregates the ranker reads.
Which metrics constitute the baseline is this topic's decision —
behavioural-ranking only needs one to exist before changes ship.

**2. Baseline movement gates a ship.**

A ranking change whose offline metrics move against the baseline
beyond a tolerance is blocked from shipping. Where the tolerance
sits, and whether a human can override the block, are open — but
without some gate the baseline is decoration.

**3. Judged sampling replaces live A/B for expansion-affected queries.**

Because signals are day-old, live A/B on expansion-affected
queries reads noise. A judged sample of reformulated queries
replaces it; sample size and refresh cadence are open.

**Written firmly, open to challenge.** If this topic's model makes
any of it wrong, say so and behavioural-ranking reopens.
