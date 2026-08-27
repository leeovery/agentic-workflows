# Research: Vector Search Migration

Whether relevance is better served by replacing lexical retrieval
with an embedding index than by tuning the Elasticsearch stack that
exists.

## Starting Point

What we knew going in:
- The catalogue is roughly 400k items, served from a three-node
  Elasticsearch cluster two engineers own part-time.
- Recall complaints are real, but nobody had traced them to the
  retrieval model rather than to the query side.

---

## Cost Envelope

Three managed vector services were priced against the catalogue at
current query volume. All three land between six and nine times the
monthly cost of the entire existing search cluster, and the shape is
the same in each: the price is driven by keeping the whole index
resident, which a catalogue this size cannot amortise. Quotes are
from published pricing pages, sized at 400k vectors and the last
quarter of query volume.

Self-hosting removes the licence line and replaces it with an
embedding-refresh pipeline: every catalogue edit has to re-embed and
reindex, which is a new always-on job with its own failure modes.
Two part-time owners is the whole search team, and no one on it has
run a model-serving path in production.

## What Actually Motivated the Question

Working back through the recall complaints, none of the sampled
failures are cases a dense retriever answers. They are query-side:
the search term and the catalogue term are different words for the
same thing. That is not a retrieval-model gap.

## Conclusion

The answer is no, and it is not a close call. The cost is an order
of magnitude away from anything this catalogue can justify, the
operational shape needs a capability the team does not have, and the
problem that prompted the question is not the problem this would
solve. There is no version of this worth building at the current
size, and nothing here that would be chosen differently by weighing
options — the question is answered, not opened.

What is worth keeping is the sizing itself: if the catalogue or the
team changes shape by an order of magnitude, the arithmetic above is
the arithmetic to redo.
