# Research: Behavioural Ranking

Per-query signal density in the events warehouse — measured so the
discussion's weighting stands on a number rather than an assumption.

## Starting Point

What we know so far:
- The discussion has settled batch nightly aggregation and a
  purchase-weighted blend of clicks and purchases per query.
- A concern rerouted from relevance-measurement asked whether most
  queries carry enough behavioural signal to rank on at all.

---

## Per-Query Signal Density

Queried the events warehouse for the click and purchase distribution
per distinct query over the last thirty days. Findings:
- 4% of distinct queries account for 71% of all clicks; the median
  query collects two clicks in the window.
- Purchases are sparser still: 11% of distinct queries see any
  purchase in thirty days.
- Above roughly fifty clicks in the window, per-query aggregates are
  stable week to week; below it they swing with single sessions.

## What This Means for Weighting

A per-query blend is well-defined only for the head — the few percent
of queries above the stability line. For the tail, any per-query
aggregate is noise dressed as signal, and a purchase weighted as five
clicks amplifies a single event into a ranking swing.

## Carried into discussion

- The weighting decision needs a head/tail split it does not yet
  have: the per-query blend above the stability line, and something
  else beneath it — a category-level aggregate, or no behavioural
  feature at all.
- Whether the stability line (about fifty clicks in thirty days) is a
  fixed threshold or recomputed with each nightly run.

## Triage

### How dense is the behavioural signal per query?
*From: relevance-measurement · research · 2026-01-01*

Folded into Per-Query Signal Density above — the measurement the
concern asked for.
