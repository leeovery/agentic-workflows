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
upkeep and quality. For freshness we want expansions reacting
within the session, so the expansion service reads the live
click-signal stream at query time.

### Decision
Synonym expansion is behaviour-driven: the expansion service
consumes the live click-signal stream at query time, keyed on
reformulation-and-click pairs. The hand-maintained list is retired
once behavioural coverage matches it.

---

## Summary

### Key Insights
1. Any curated list recreates the upkeep problem — derive
   expansions from behaviour instead.

### Current State
- Expansion source decided: behaviour-driven, reading the live
  click-signal stream.
