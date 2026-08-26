# Research: Relevance Measurement

How to tell whether a relevance change makes results better or
worse. No evaluation set and no metrics exist today.

## Starting Point

What we know so far:
- Click and purchase events land reliably in the events pipeline,
  which exposes nightly batch aggregates.
- The team has never built an evaluation harness.

---

## Candidate Metrics

NDCG@10 is the leading offline candidate — rank-sensitive, standard,
comparable across runs. Interleaving win-rate answers a different
question and needs live traffic.

## Judgment Collection

Click-derived labels are free and plentiful; a small graded set
guards regressions. A hybrid is the pattern that keeps recurring
for teams this size.

## Signal Timeliness

Every metric here reads the same aggregates ranking reads, so how
fresh those aggregates are shapes what a measurement even means.
The pipeline's freshness guarantees are recorded nowhere.

## Open Questions

- How large must an eval query set be before per-run comparisons
  are trustworthy?
