### Expansion reads a stream nobody will build
*From: behavioural-ranking · discussion · 2026-01-08*

Synonym handling settled that the expansion service consumes the
live click-signal stream at query time. Signal ingestion settled
the opposite side of the same wire: the events pipeline exposes
batch aggregates only, and no live signal stream will be built.
So the expansion decision rests on a capability that will not
exist, and what the expansion service actually reads is a decision
synonym handling still owes.
