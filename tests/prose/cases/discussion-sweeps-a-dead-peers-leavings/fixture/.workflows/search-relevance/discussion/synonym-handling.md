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

## Summary

### Current State
- Expansion source exploring.

## Triage

(none)
