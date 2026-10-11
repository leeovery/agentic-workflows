# Discussion: Synonym Handling

## Context

The hand-maintained synonym and misspelling list is untrusted, and
replace-rather-than-clean was settled at shaping. This discussion
settles what replaces it.

---

## Expansion Source

### Context
If the list goes, something has to produce expansions at query time.

### Options Considered

**Curated replacement list (managed service)**
- Pros: known shape, quick to adopt
- Cons: recreates the upkeep problem that killed the current list

**Behaviour-driven expansion**
- Pros: learns from what users actually click after reformulating
- Cons: needs behavioural signals available to the expansion service

### Journey
A managed list just moves the upkeep somewhere else. Deriving
expansions from reformulation-and-click pairs kept winning on both
upkeep and quality. Signal ingestion is batch-only per
behavioural-ranking, and daily refresh is fine — the
reformulation-and-click derivation is the part that matters. That
does mean the nightly job has to expose the pairs themselves, which
its decided schema (click and purchase counts) does not.

### Decision
Sibling check: behavioural-ranking — signal ingestion is a batch
nightly aggregation job; no live stream will be built. Synonym
expansion is behaviour-driven, computed from the nightly batch
aggregates: expansions derive from reformulation-and-click pairs
and refresh daily. The hand-maintained list is retired once
behavioural coverage matches it.

---

## Summary

### Key Insights
1. Any curated list recreates the upkeep problem — derive
   expansions from behaviour instead.
2. Daily refresh suffices; the pair derivation is what matters.

### Open Threads
- Cross-topic note to carry → behavioural-ranking: expansion needs
  the nightly aggregation job to also emit reformulation-and-click
  pair aggregates — its decided schema covers click and purchase
  counts only, so the aggregation schema decision needs extending.

### Current State
- Expansion source decided: behaviour-driven, computed from the
  nightly batch aggregates, daily refresh.
