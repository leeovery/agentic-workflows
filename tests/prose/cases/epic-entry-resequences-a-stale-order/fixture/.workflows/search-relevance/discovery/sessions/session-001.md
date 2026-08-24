# Discovery Session 001

Date: 2026-01-01
Work unit: search-relevance

## Description (as of session)

Overhaul search relevance across the catalogue.

## Seed

(none)

## Imports

(none)

## Map State at Start

(empty — first session)

## Exploration

Search relevance across the catalogue is poor, and the shaping
settled that it is several problems at once rather than one.
Ranking barely uses behavioural signals — click and purchase events
land in the events pipeline but nothing feeds them back into the
ranker; the pipeline itself is reliable, so the work is choosing
the signals. Synonyms and misspellings are handled by a
hand-maintained list nobody trusts — replace rather than clean was
the leaning, though with what is unknown. And there is no way to
tell whether a relevance change makes results better or worse — no
evaluation set, no metrics, every tweak decided by argument. The
user has never built an evaluation harness and holds measurement as
the part they understand least. The stack is Elasticsearch; two
engineers own search part-time.

## Edits

(none)

## Topics Identified

### behavioural-ranking

- Routing: discussion
- Why: Close the loop from click and purchase events into the ranker.

### synonym-handling

- Routing: research
- Why: Replace the hand-maintained synonym and misspelling list.

### relevance-measurement

- Routing: research
- Why: How to tell whether a relevance change makes results better or worse.

## Conclusion

3 topic(s) added. Map now has 3 topics.
