### How dense is the behavioural signal per query?
*From: relevance-measurement · research · 2026-01-01*

Sizing an evaluation set against the events warehouse showed most
queries collecting only a handful of clicks in a thirty-day window,
and purchases far fewer. Behavioural ranking's weighting rests on
those per-query aggregates existing — but nobody has measured what
share of queries actually carry enough signal to rank on, or where
the head/tail line falls. Settling this needs the warehouse queried
for the per-query click and purchase distribution over a real
window — a measurement, not a decision.
