# Discussion: Relevance Measurement

## Context

Every ranking change is decided by argument. This discussion settles
how a change is scored before it ships.

---

## Evaluation Set

### Decision
Relevance is scored offline against a judged query set drawn from
the events pipeline's nightly click aggregates; a ranking change
ships only when it does not lower the set's score.
