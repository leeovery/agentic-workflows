### Expansion Source
*From: behavioural-ranking · discussion · 2026-01-01*

Behavioural-ranking settled signal ingestion as a batch nightly
aggregation job — real-time streaming rejected as over-engineering,
the events pipeline exposes batch aggregates only, and no live
signal stream will be built. The expansion-source decision here
rests on the expansion service consuming a live click-signal stream
at query time — infrastructure that decision says will not exist.
The freshness assumption needs re-deciding against batch-only
signals: either the expansion design works from the nightly batch
aggregates, or this discussion makes the case for the stream
against the earlier decision.
