# Research: Synonym Handling

What replaces the hand-maintained synonym and misspelling list —
replace-rather-than-clean was settled at shaping; this research
explores what the replacement source could be.

## Starting Point

What we knew going in:
- The list is hand-maintained, untrusted, and its upkeep never ends.
- Search runs on Elasticsearch; two engineers own it part-time.

---

## Candidate Sources

**Curated managed list.** A vendor-maintained expansion set swapped
in for the hand-rolled one. Known shape, quick to adopt — and it
recreates the upkeep problem one step removed: someone still owns
the deltas between the vendor vocabulary and the catalogue.

**Behaviour-driven expansion.** Derive expansions from what
searchers do when a query fails: a zero-result query followed, in
the same session, by a reformulation that returns results and gets
a click is a synonym pair the users themselves supplied. No
curation to own — but it only works if searchers actually recover
this way often enough to feed it.

## The Open Number

The choice turns on the in-session recovery share: what fraction of
zero-result searches recover because the searcher reformulates
within the same session. High enough and behaviour-driven expansion
has the signal it needs; low and only a curated source is viable.
A day of sandbox search-session activity is exported at
logs/search-sessions.log.

Handed to the laboratory 2026-01-01 — awaiting E1; the source
choice waits on its evidence.
