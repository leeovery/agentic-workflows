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
behavioural-ranking, and daily refresh is fine — the scores are
computed nightly from the click-weights table their job maintains.

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

### Current State
- Expansion source decided: behaviour-driven, computed nightly
  from the click-weights table.
