# Deep Dive: How do search evaluation harnesses handle a change that lifts the aggregate metric while a query slice regresses?

## Brief

The relevance-measurement research has NDCG@10 over click-derived
judgments as its working metric and noticed that the aggregate can
climb while long-tail product searches get worse. The brief asked how
evaluation harnesses with public code or documentation handle a change
that lifts the aggregate while a query slice regresses — whether the
release is held on the slice and how that is expressed, and how a
slice is defined and kept current as the catalogue changes. A survey
of four harnesses; nothing was run.

## Answers

### A1: Do harnesses hold a release on a slice regression, and how is the hold expressed?

Three of the four hold; the fourth weights. In es-rank-eval the hold
is a per-slice floor in `rank_eval/guards.py`:

    def assert_slice_floor(run: Run, metric: str = "ndcg@10",
                           slices: list[str] = SLICES,
                           tolerance: float = 0.005) -> None:
        for s in slices:
            drop = run.baseline[s][metric] - run.candidate[s][metric]
            if drop > tolerance:
                raise SliceRegression(slice=s, drop=drop)

`SliceRegression` propagates out of the `rank-eval-guard` step of
`ci/evaluate.yml`, so the job exits non-zero and the candidate ranking
config is never promoted. trec-eval-ci reaches the same outcome
differently: `trec_eval -q` emits per-query scores, `slice_floor.py`
groups them by `topics/slices.json` and exits 1 when any slice lands
below `baseline - TOLERANCE`. Vespa's evaluation notebook calls
`evaluate_slices(run, fail_on_regression=True)`, which raises rather
than returns when a slice regresses. ranx has no hold at all:
`compare(runs, weights=SLICE_WEIGHTS)` folds the slices into
`weighted_ndcg`, and the candidate ships on that single weighted
number even when the tail slice fell. Sources: es-rank-eval
`rank_eval/guards.py` and `ci/evaluate.yml`; trec-eval-ci
`slice_floor.py`; Vespa sample-apps `evaluate_slices.ipynb`; ranx
docs, `compare`.

### A2: How is a query slice defined and kept current as the catalogue changes?

Declared, then rebuilt on a schedule — or derived at evaluation time.
es-rank-eval reads `slices.yaml`: one entry per slice with a `match`
predicate over the query log (the sample `tail` slice is
`impressions_90d < 50`) and a `min_queries: 50` floor beneath which
the slice is dropped from the guard with a warning;
`jobs/rebuild_slices.py` runs nightly (`0 3 * * *`), re-evaluates
every predicate over the last ninety days of the log, and rewrites
`slices.generated.yaml`. trec-eval-ci pins slices by hand in
`topics/slices.json` and documents a quarterly refresh. Vespa derives
slices at evaluation time from query-frequency deciles —
`slices = decile_buckets(query_log, n=10)` — so nothing is stored
between runs. ranx has no slice notion beyond the `weights` dict the
caller passes to `compare`. Sources: es-rank-eval `slices.yaml`,
`jobs/rebuild_slices.py`; trec-eval-ci `topics/README.md`; Vespa
`evaluate_slices.ipynb`.

## Material

**Where the hold sits.** In every harness that holds, the check runs
in the evaluation job before promotion — never at query time and never
in the ranking service. The candidate configuration is scored against
the baseline over the same judgment set, per slice, and the job's
exit code is the whole mechanism (es-rank-eval `ci/evaluate.yml`;
trec-eval-ci `Makefile`, target `guard`).

**Tolerance.** All three holds allow a small drop before failing:
es-rank-eval defaults to 0.005 NDCG, trec-eval-ci to 0.01, Vespa to 0.
None documents how the figure was chosen.

**Slice sizing.** es-rank-eval is the only harness that refuses to
score a slice below a query floor (`min_queries: 50`); the others
score whatever the slice holds, and trec-eval-ci's README warns that
slices under roughly fifty topics produce noisy verdicts.

**Weighting instead of holding.** ranx's `SLICE_WEIGHTS` is a plain
dict; the sample config weights the tail slice at 2.5 against 1.0 for
the head, so a tail loss counts two and a half times over, but a large
enough head gain still carries the release.

**What is judged.** Every harness scores against pre-collected
judgments; none derives judgments inside the evaluation run. Where the
judgments come from is out of scope for all four.

## Opened

- A slice whose queries are too rare to accumulate clicks has no
  click-derived judgments to score against — how any of the four labels
  such a slice is undocumented
- How many of the shop's searches fall below a fifty-impression floor
  over ninety days: count the distinct normalised queries under the
  floor in the query log against the total — the share decides whether
  a tail slice can be formed at all, and so whether holding a release
  on a slice floor is available to the shop or only a weighted
  aggregate is

## Limitations

The four harnesses were read from their repositories and
documentation; none was run. Tolerance defaults were taken from source,
not from a maintainer's account of why. ranx's weighting sample is the
library's own example, not a production configuration.

## Sources

- es-rank-eval repository — `rank_eval/guards.py`, `ci/evaluate.yml`,
  `slices.yaml`, `jobs/rebuild_slices.py`
- trec-eval-ci template — `slice_floor.py`, `topics/slices.json`,
  `topics/README.md`, `Makefile`
- Vespa sample-apps — `evaluate_slices.ipynb` and its README
- ranx documentation — `compare` and the weighted comparison example
