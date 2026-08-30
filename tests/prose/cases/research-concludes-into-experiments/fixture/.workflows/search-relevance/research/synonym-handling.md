# Research: Synonym Handling

What replaces the hand-maintained synonym and misspelling list.
Replace-rather-than-clean was settled at shaping; this research
explores what the replacement could be.

## Starting Point

What we knew going in:
- The list is hand-maintained, untrusted, and its upkeep never ends.
- The search stack is Elasticsearch; two engineers own it part-time.

---

## Candidate Replacements

A managed curated list moves the upkeep problem to a vendor without
removing it — every synonym still has to be judged by someone. A
behaviour-driven approach derives expansions from what users do:
when a query fails and the user reformulates and then clicks, the
pair (failed term, clicked term) is an expansion candidate observed
in the wild rather than curated.

## The Load-Bearing Unknown

Behaviour-driven expansion only works if the pairs exist in volume.
The session logs record reformulations, but nobody knows what
fraction of failed queries actually have a reformulation-and-click
pair in the same session. If coverage is high, the approach funds
itself; if it is low, the derived list would be too sparse to
retire the hand-maintained one. This is a number, it sits in logs
we already have, and the replace decision leans on it directly.

## Conclusion

Behaviour-driven expansion is the leading candidate — it is the
only option that removes the upkeep rather than relocating it. The
question that decides it is empirical: pair coverage over failed
queries. That number should be collected properly, with the rule
for reading it written down first, before any discussion decides
the replacement.
