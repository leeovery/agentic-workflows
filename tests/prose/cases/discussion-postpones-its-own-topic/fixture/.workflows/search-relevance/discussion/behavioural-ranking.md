# Discussion: Behavioural Ranking

## Context

Click and purchase events land in the events pipeline but nothing
feeds them back into ranking. This discussion settles which signals
feed the ranker and how they get there.

---

## Signal Set

### Context
Which behavioural events are worth feeding the ranker at all.

### Options Considered

**Clicks alone**
- Pros: the densest signal, available for every result page
- Cons: rewards a tempting title over a satisfying one

**Clicks weighted by purchase**
- Pros: a click that ends in a purchase is the outcome we want
- Cons: sparse on the long tail, where relevance is worst

### Journey
Clicks alone kept surfacing the same failure — a result people open
and abandon reads as a good result. Weighting by purchase fixes that
where the data is dense and leaves the tail on clicks, which is no
worse than today.

### Decision
The ranker consumes clicks weighted by purchase, falling back to
unweighted clicks where purchase volume is too thin to weight.

---

## Summary

### Current State
- Signal set decided — clicks weighted by purchase, clicks alone on the tail.
- Refresh cadence still open — how often the ranking features are
  rebuilt from the pipeline, and what staleness costs.
