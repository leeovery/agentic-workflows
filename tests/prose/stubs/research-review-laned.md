# stub: research-review-laned

A background review agent's report on a mid-flight research file: one
apply-laned correction citing the file's own source, one explore-laned
thread. The content below is written to the path the dispatch response
returned; the STATUS block is also what the agent returns to its caller.

---

# Research Review

## Summary

The offline-metrics thread is well grounded and the file's sources are
strong. Two findings: the judgment-collection thread contradicts a
benchmark note the file itself carries, and no thread examines whether
a relevance change is judged overall or per query class.

## Unexplored Areas

### F1: No thread examines per-query-class behaviour

**Lane:** explore

Every metric discussed judges a ranking change over all queries at
once. Whether a change is judged overall or per query class is
untouched — an aggregate metric can improve while long-tail queries
regress, and nothing in the file says which classes matter or how a
per-class readout would work. An investigable thread: what query
classes exist in the logs, and what a per-class NDCG readout costs.

## Shallow Coverage

### F2: Judgment collection still assumes human raters the file's own benchmark note retires

**Lane:** apply

The judgment-collection thread states graded judgments need human
raters. The file's own RankBench note records click-derived labels
correlating 0.92 with human judgments at rank 10 — the correlation the
thread itself names as sufficient. Amend the judgment-collection
thread to cite the RankBench note: click-derived labels suffice for
the primary metric, with human raters an option for spot-checks.

## Unvalidated Assumptions

None identified.

## Observations

- The eval-set-size question is open and the file says so — not a gap.

STATUS: gaps_found
FINDINGS: F1,F2
GAPS_COUNT: 2
ASSUMPTIONS_COUNT: 0
SUMMARY: One correction the file's own source determines; one investigable thread on per-query-class behaviour.
