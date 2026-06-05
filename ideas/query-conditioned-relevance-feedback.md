# Query-Conditioned Relevance Feedback for the Knowledge Base

> Spun out of the idea #33 (KB temporal model) discussion. It is **not** part of #33 — that effort settled deliberately on a *global, query-independent* decay (`R`). This idea is the *other axis*: improving per-query relevance via feedback. Recorded so the thinking isn't lost; not yet scoped for implementation.

## The thread that led here

While designing #33's decay, we considered an FSRS-style **reinforcement** term — stability `S` growing each time a chunk is "used," so frequently-relied-on context decays slower. Two problems killed it as part of #33:

1. **No naturally-occurring signal.** Imports/seeds come from the inbox or user-shared files, never from earlier work units, so "a later unit reused this" never fires. A raw query-hit isn't a usefulness signal either — a search returns noise alongside signal.
2. **The real blocker — relevance is per-query.** Even with a *graded* signal (e.g. Claude classifying each result good/bad via the script), the judgment is about the **`(query, chunk)` pair**, not the chunk. A chunk irrelevant to query X may be central to query Y. So one query's "not relevant" verdict **cannot** license a global penalty on the chunk.

#33's `R` is a **global, query-independent** staleness multiplier. Query-relevance is a **separate axis** — the base similarity score, recomputed per query. Folding `(query, chunk)` feedback into the global decay term is a category error: it would punish a chunk across *all* future queries for one query's judgment. So feedback is a different system, layered on the query axis — not a knob on temporal decay.

## What this idea actually is

Standard **relevance feedback / learning-to-rank**, adapted to this KB:

- A graded signal per result — the natural producer is **Claude itself**: after a query, classify which returned chunks were genuinely useful for *that query* vs noise (a new `knowledge feedback` verb, or a flag on `query`).
- Signal is keyed on `(query or query-class, chunk)`, **never** the chunk alone.
- It adjusts **ranking for similar future queries**, not the chunk's global standing.

## Open problems (why it's only a sketch)

- **Generalising across queries.** A verdict on one exact query is nearly useless later (queries rarely repeat verbatim). Needs a notion of query *similarity*/clustering so feedback transfers — that's the hard part.
- **When feedback *could* go global.** Only if a chunk is judged irrelevant across *many diverse* queries does "globally low-value" become defensible — i.e. an aggregation subsystem, not a per-verdict penalty. That is the *one* path back to the #33 `S` seam.
- **Feedback-loop risk.** Down-ranked chunks surface less → get judged less → entrench. Same rich-get-richer hazard noted in #33.
- **Storage/model.** Per-`(query-class, chunk)` weights are new state — unlike #33's decay, which is fully derived. Likely a real schema/store addition.
- **Cost & trust.** Auto-classification adds an LLM pass per query (latency/$$) and assumes the classifier's "useful" judgment is itself reliable.

## Relationship to other work

- **#33** — provides the *global staleness* axis (`R`); explicitly leaves `S` constant and the seam open. This idea is the orthogonal *query-relevance* axis.
- **#28** (hybrid ranking weighting / `rerank()` evaluation) — the closer relative: both are about *ranking quality*. If pursued, this likely builds on #28's `rerank()` work and its real-corpus evaluation harness rather than on #33.

## Scope (if ever taken up)

- New feedback capture surface (`knowledge feedback` or a `query` flag) producing `(query, chunk, verdict)` records.
- Query-similarity/clustering so feedback generalises.
- `rerank()` consumes per-`(query-class, chunk)` adjustments (coordinate with #28).
- New persisted state in `store.js` (feedback records) — distinct from #33, which needs none.
