# Deep Dive: Subset Regressions Under an Improving Aggregate

## Brief

What open-source ranking and evaluation stacks do when an aggregate
relevance metric improves while a class of queries regresses —
whether anything gates on the class, and how. Dispatched from the
per-query-class thread: NDCG@10 over all queries can rise while
long-tail product searches get worse, and the file had nothing on
what other harnesses do about it.

## Key Findings

### F1: Reference harnesses gate on per-slice deltas, never on the aggregate alone — three mechanisms in source

*Read in source.*

**(a) Hard block on any slice regression — `ltr-eval`'s slice guard.**
`ltr_eval/gate.py:18`:

```python
def gate(run, baseline, slices, tol=0.005):
    for s in slices:
        if ndcg(run, s) < ndcg(baseline, s) - tol:
            raise SliceRegression(s, ndcg(run, s), ndcg(baseline, s))
    return ndcg(run, ALL) > ndcg(baseline, ALL)
```

The aggregate is consulted only once every slice has held. `tol` is
half a point of NDCG; the slice list is a hand-maintained YAML
(`slices.yml`) of query classes. A regressing slice fails the run
outright, whatever the aggregate did.

**(b) Weighted aggregate — `rank_eval` with per-class weights
(Searchwright plugin).** The metric request carries a `weights` map
and the gate is a single number:

```json
{ "metric": { "ndcg": { "k": 10 } },
  "weights": { "head": 1.0, "torso": 1.0, "tail": 2.5 },
  "gate": { "min_delta": 0.0 } }
```

A tail loss counts two and a half times over; a change passes when
the weighted total is non-negative. The weights are the release
manager's to set, checked into the index config, and nothing else
looks at slices.

**(c) Flagged rollout with a per-slice alarm — `shopsearch`.**
`ranker/rollout.cc:41`:

```cpp
BASE_FEATURE(kRankerV2, base::FEATURE_DISABLED_BY_DEFAULT);
// alarm: tail NDCG@10 down > 1.0pt for 2 consecutive hourly windows -> flag off
```

Nothing gates before release. Per-slice NDCG is computed from live
clicks hourly, and a sustained tail drop flips the flag back — the
tail takes the regression for at least two hourly windows.

Sources: `ltr-eval` `gate.py` (github, main); Searchwright
`rank_eval` docs, "Weighted metrics"; `shopsearch` `rollout.cc`
(github, main).

### F2: Every harness's slice definitions are a hand-maintained list, refreshed at most quarterly

`ltr-eval` reads `slices.yml`; Searchwright's weights key on class
names the index config declares; `shopsearch` derives `tail` from a
query-frequency cut (`< 5/day`) recomputed by a quarterly job
(`jobs/slice_refresh.py`). None derives classes from the catalogue
or the season. A slice list falls behind the queries it protects —
a class that did not exist when the list was written is judged as
part of whatever it falls into.

Sources: as above; `shopsearch` `jobs/slice_refresh.py`.

## Limitations and Caveats

Three harnesses, all commerce or general web search; no marketplace
with a strongly seasonal catalogue was found in source. Tolerances,
weights, and alarm windows quoted are each project's shipped
defaults, not tuned values.

## Open Questions

1. Whether the click-derived labels the file leans on hold at the
   tail, where clicks are sparse.

## Sources

- github `ltr-eval` — `ltr_eval/gate.py`, `slices.yml`
- Searchwright docs — `rank_eval`, "Weighted metrics"
- github `shopsearch` — `ranker/rollout.cc`, `jobs/slice_refresh.py`

STATUS: complete
THREAD: subset regressions under an improving aggregate
FINDINGS: F1,F2
FINDINGS_COUNT: 2
SUMMARY: Reference harnesses never gate on the aggregate alone — a hard slice block, a weighted aggregate, and a flagged rollout with an alarm are the three shapes in source; every slice list is hand-maintained.
