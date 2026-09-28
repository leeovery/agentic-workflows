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
ranker. Synonyms and misspellings are handled by a hand-maintained
list nobody trusts. And there is no way to tell whether a relevance
change makes results better or worse, so every tweak is decided by
argument. Agreed to take the whole area on as one epic rather than
patch a single piece; the parts still need exploring properly
before any topics are named.

Worked through the behavioural signals first. The events pipeline
is reliable — clicks and purchases already land there and nobody
doubts the data; the gap is that nothing carries it back into
ranking. The user holds the shape plainly: click-through and
purchase rates per query–product pair, fed to the ranker as a boost
on top of the text score, so a product people actually choose for a
query rises for that query. Decided on that shape. Considered dwell
time on the product page as a third signal and dropped it: the
events pipeline does not record it, and adding that instrumentation
is a separate project nobody wants to start now. One choice is left:
whether the boost is recomputed in a nightly batch or kept current
by a streaming update off the events pipeline. In the user's words,
"we just need to decide between nightly and streaming" — both
patterns are familiar to them; it is a trade between simplicity and
freshness, not an unknown.

Then the synonym and misspelling list. It has grown by hand for
years, its entries contradict each other, and nobody on the team
trusts it enough to edit it. The user: "I suspect we should bin it
and replace it rather than clean it up, but I honestly don't know
what with." They have no view on the options — whether
Elasticsearch's own analysers and fuzzy matching go far enough on
their own, whether there are services that do this, or what a
learned approach would take to build and run. Claude suggested
mining query reformulations from the search logs — a search that
finds nothing followed by a corrected search that gets a click — as
a source of synonym and misspelling pairs. The user did not take
that up; they want to see what is out there before settling on
anything.

Last, measurement. There is no evaluation set and no metric; a
relevance change ships when whoever argues for it wins. Agreed that
a relevance change should be judged against numbers rather than
argument — that much is settled; how to get the numbers is not. The
user holds this as the part they understand least: "I've never
built an evaluation harness and I don't know what a good one looks
like." They do not know what it would take to build a set of judged
queries, or whether two engineers owning search part-time could keep
one current.

Constraints that came up along the way: the search stack is
Elasticsearch, and two engineers own search part-time.

## Edits

(none)

## Topics Identified

(none)

## Conclusion

(none)
