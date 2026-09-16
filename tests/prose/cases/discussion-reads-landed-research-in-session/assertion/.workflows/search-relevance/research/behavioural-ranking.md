# Research: Behavioural Ranking

What behavioural signal the events pipeline carries, and how dense it
is per query — the ground the ranking discussion stands on.

## Starting Point

What we know so far:
- Click and purchase events land in the events pipeline; the pipeline
  is reliable and exposes batch aggregates nightly.
- Nothing feeds those signals back into ranking today.

## Signal Availability

Clicks and purchases are captured per session with the query that
produced them. The pipeline exposes nightly batch aggregates only — no
live stream exists, and none is planned.

## Per-Query Signal Density

Queried the events warehouse for the click and purchase distribution
per distinct query over the last thirty days. Findings:
- 4% of distinct queries account for 71% of all clicks; the median
  query collects two clicks in the window.
- Purchases are sparser still: 11% of distinct queries see any
  purchase in thirty days.

## Stability Line

Re-measured 2026-01-03 over a ninety-day window, three thirty-day
slices compared week to week:
- Above roughly fifty clicks in a thirty-day window, a query's
  click and purchase aggregates are stable slice to slice.
- Below it they swing with single sessions: one purchase moves the
  tail query's aggregate more than a week of clicks does.
- A purchase weighted as five clicks amplifies a single event into a
  ranking swing on every tail query.

## Carried into discussion

- How signals reach ranking — batch aggregation, or a stream the
  pipeline does not offer.
- The weighting decision needs a head/tail split it does not yet
  have: a per-query blend above the stability line, and something
  else beneath it — a category-level aggregate, or no behavioural
  feature at all.
- Whether the stability line (about fifty clicks in thirty days) is a
  fixed threshold or recomputed with each nightly run.
