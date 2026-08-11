# Discussion Consolidation Analysis

## Recommended Groupings

### Expansion
- **behavioural-ranking**: settles the signal ingestion the expansion pipeline consumes
- **synonym-handling**: settles what replaces the hand-maintained list

**Coupling**: Expansion scoring is derived from the behavioural signals — one pipeline, one spec.
**Tension**: behavioural-ranking × synonym-handling — expansion freshness rests on a live click-signal stream that behavioural-ranking ruled will not be built.

## Analysis Notes
(none)
