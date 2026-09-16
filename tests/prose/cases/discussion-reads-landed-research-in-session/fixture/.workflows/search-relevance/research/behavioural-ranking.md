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

## Carried into discussion

- How signals reach ranking — batch aggregation, or a stream the
  pipeline does not offer.
- How much each signal counts for, given how sparse purchases are.
