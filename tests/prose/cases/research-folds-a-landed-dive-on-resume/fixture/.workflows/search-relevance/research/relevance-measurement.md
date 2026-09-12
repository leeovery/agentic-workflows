# Research: Relevance Measurement

How to tell whether a relevance change makes results better or worse
— there is no evaluation set and no metric, so every ranking tweak is
decided by argument. Measurement comes before tuning.

## Starting Point

What we knew going in:
- No evaluation set and no metrics; every ranking change is argued
  rather than scored.
- Measurement before tuning was settled at shaping — without a way to
  score a change, nothing else on the map can be judged.
- The user has never built an evaluation harness and holds this as
  the part they understand least.
- The stack is Elasticsearch; two engineers own search part-time.

---

## Candidate Metrics

Three offline metrics were weighed against what the shop can actually
collect. Precision@k is the easiest to explain and the flattest: it
says how many of the top results are relevant and nothing about their
order. MRR rewards getting one right answer to the top, which fits a
shopper typing a product name and misreads a shopper browsing, where
several results are equally good. NDCG@10 grades the whole first page
by position and takes graded judgments, which is what click data
yields. NDCG@10 is the leading candidate; the other two stay here as
the simpler fallbacks if graded judgments turn out too thin to trust.

## Judgment Collection

Nobody is going to hand-label a catalogue of four hundred thousand
items. Judgments come from the clicks and purchases already in the
events pipeline: a purchase after a search is a strong positive for
that result, a click a weak one, a skip past a shown result a weak
negative. Position bias is the known hazard — the top result gets
clicked because it is on top — so judgments are normalised by
position before they are used. This is the working position, not a
decision: it is what the harness would be built on unless something
better turns up.

## Human Raters

A small panel of human raters scoring a fixed query set was
considered as a check on click-derived judgments — the one way to
catch a systematic bias in the clicks themselves. It needs a budget
line the shop does not have this year. Set aside, not rejected.

## Label Freshness

Click-derived judgments age: a product that was the right answer last
season may be discontinued, repriced, or outranked by a newer line.
How often the judgments need refreshing before they mislead is open;
nothing in the surveyed harnesses settles it, since none of them
derives judgments at all.
