# Research: Relevance Measurement

How to tell whether a relevance change makes results better or
worse. No evaluation set and no metrics exist — every ranking tweak
is decided by argument.

## Starting Point

What we know so far:
- Click and purchase events land reliably in the events pipeline.
- The team has never built an evaluation harness.
- Starting technical: candidate metrics, then how to collect
  judgments.

---

## Candidate Metrics

NDCG@10 is the leading candidate for the primary offline metric —
rank-sensitive, standard, and comparable across runs. Click-through
position as a cheap secondary signal.

RankBench note (benchmark survey, 2025): click-derived relevance
labels correlated 0.92 with human judgments at rank 10 across three
commerce datasets — strong enough to stand in for graded judgments
at the depth NDCG@10 reads.

## Judgment Collection

Click-derived labels suffice for the primary metric (RankBench
note above); human raters an option for spot-checks. The events
pipeline retains ninety days of click logs — enough history to
derive labels from.

## Per-Query-Class Behaviour

An aggregate NDCG@10 can rise while a class of queries regresses —
long-tail product searches in particular, where clicks are sparse
and a handful of results carry the whole class. Whether a tail
regression should hold a change back is the user's call and has
not been asked. What other harnesses do about it was sent to a
deep dive.

## Open Questions

- How large must an eval query set be before per-run comparisons
  are trustworthy?
