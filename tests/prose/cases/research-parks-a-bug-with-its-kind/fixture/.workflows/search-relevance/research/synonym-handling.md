# Research: Synonym Handling

What replaces the hand-maintained synonym and misspelling list, and
what it would take to run.

## Starting Point

What we knew going in:
- The list holds roughly 1,200 hand-written pairs, edited by whoever
  last fielded a complaint, and nobody trusts it.
- Replace rather than clean was settled at shaping; with what is the
  open question.

---

## The Shapes on Offer

Three shapes came up. A managed expansion service takes the list off
our hands and puts the upkeep on someone else — cheap to adopt, and
the catalogue vocabulary is ours, not theirs, so coverage on the
terms that actually fail is unknown. Deriving expansions from search
behaviour — reformulation-and-click pairs — needs the behavioural
signals to reach the query path, which is another topic entirely.
An embedding-based expansion sits between the two and is the least
explored.

## Open

Nothing here is settled yet. What the failing queries actually look
like has not been sampled, and without that none of the three shapes
can be told apart on coverage.
