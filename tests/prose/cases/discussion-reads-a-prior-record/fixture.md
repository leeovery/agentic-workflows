# Fixture — discussion-reads-a-prior-record

Two epics, and one topic that has moved between them.

`search-relevance` overhauled search quality a year ago. It settled
behavioural ranking — signals reach the ranker as a nightly batch
aggregation, and no live signal stream will be built — and it settled
synonym handling: the hand-maintained list is retired in favour of
behaviour-driven expansion, with the expansion service reading the live
click-signal stream at query time. Then synonym handling was postponed
to a `v2` horizon, because the platform team had a managed search
product landing the following year and the expansion work belonged
beside it. A concern behavioural ranking had about that decision — the
stream it reads is the one nobody will build — landed in synonym
handling's triage queue after the topic had already left, and has waited
there with it ever since, never delivered.

`managed-search` is that following year. Its discovery session is closed
and its map holds one topic, `synonym-handling`, pulled forward from the
roadmap and recorded as coming from the earlier epic. Nothing crossed
with it: the brief, the concluded discussion and the queued concern are
all still where `search-relevance` wrote them.

The context was cleared at the phase boundary — this session opens cold
at the entry skill with nothing but the three arguments and what is on
disk.
