# Deep Dive: How do search evaluation harnesses handle a change that lifts the aggregate metric while a query slice regresses?

## Brief

The relevance-measurement research has NDCG@10 over click-derived
judgments as its working metric and noticed that the aggregate can
climb while long-tail product searches get worse. The brief asked
whether harnesses with public code or documentation hold such a
change back or weigh it, and what a declared query slice looks like.

## Answers

### A1: Do harnesses hold a slice-regressing change back, or weigh the loss against the gain?

Three of the four surveyed hold it back. Each declares its query slices
in a config file — `slices.yaml` in two of them — and a `guard_slices()`
step in the evaluation job raises `SliceRegression` when any declared
slice drops more than a tolerance (0.005 NDCG in the defaults) against
the baseline run; the promotion job treats the exception as a failed
gate. The fourth weighs: `slice_weights` in its metrics table multiplies
the tail slice's delta by 3.0 before it is summed into the headline
number, so a large enough gain elsewhere still carries the change. All
four size a slice with a minimum query count before it counts, and
rebuild slice membership from the query log on a schedule (nightly in
three, weekly in one) rather than declaring queries by hand.

## Material

The hold-back pattern: the evaluation job runs the candidate ranker
and the baseline over the same judged query set, computes the metric
per declared slice, and fails the run when any slice's delta is below
-tolerance. The weighted pattern: per-slice deltas are multiplied by a
declared weight and summed; the sign of the sum decides. Slice
declaration: a name, a membership rule (a query-frequency band, or a
category), a minimum size below which the slice reports no verdict.
Rebuild cadence is a scheduled job over the query log; two of the
four version the resulting membership so a verdict can be replayed.

## Opened

- How large must a declared tail group be before its verdicts are not
  noise — the surveyed floors range from 200 to 2,000 queries.
- Whether the shop's own query log holds a tail worth declaring: count
  the distinct queries with fewer than five impressions over ninety
  days against the total — a measurement, and it settles whether a
  tail slice exists to guard.

## Limitations

Only harnesses with public code or documentation were surveyed; the
weighting factor and tolerances are the projects' defaults, not
measured on this catalogue.

## Sources

- https://example.com/rank-eval/docs/slices — slice declaration and the guard step
- https://example.com/tail-aware-eval — the weighted alternative
