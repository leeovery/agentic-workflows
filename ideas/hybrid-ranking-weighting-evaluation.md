# Hybrid Search Ranking — Evaluate Text/Vector Weighting & Re-rank on a Real Corpus

## The Idea

Validate (and likely retune) the knowledge base's hybrid retrieval ranking
against a **mature, workflow-enabled project** with many real artifacts. There
is evidence the weighted BM25+vector fusion can invert a *correct* vector
ranking on small or keyword-disjoint corpora — surfacing the wrong artifact
first. This needs measuring on realistic data before changing anything.

## How It Surfaced

While smoke-testing the `openai-compatible` provider (idea #23) against a local
Ollama `nomic-embed-text` endpoint, a 4-doc toy corpus (one each:
rate-limiting, login, caching, payment-webhooks — all `discussion` phase, all
indexed the same day) produced poor ordering for queries that were
semantically clear but lexically disjoint from the target doc. Example:

- Query: *"securely signing users in and keeping them logged in"*
- CLI `knowledge query` ranked the **login** doc **last** of four.
- But a direct cosine-similarity check on the *same* embeddings ranked
  **login top (0.646)**, comfortably ahead of the others — with **and**
  without `nomic`'s `search_query:`/`search_document:` task prefixes.

So the embeddings were correct; the *ranking* inverted them.

## What It Is NOT

- **Not the provider/model.** Raw cosine similarity put the right doc first.
  The `openai-compatible` driver returns correct 768-dim vectors. Provider-
  agnostic — the same fusion runs for OpenAI cloud embeddings.
- **Not phase/confidence weights.** All four docs were the same phase (same
  confidence tier) and same index time, so the `rerank()` tier/recency boosts
  were identical across them and could not have changed their relative order.

## Where It Lives

- `src/knowledge/store.js` → `searchHybrid()`: Orama `mode: 'hybrid'` with
  `hybridWeights: { text: 0.4, vector: 0.6 }`. Orama normalises text and vector
  scores *within the result set* before combining.
- `src/knowledge/index.js` → `rerank()`: adds confidence tier (0–0.04, additive
  `rank*0.01`), recency (0–0.05), and user `--boost` (+0.1 each) on top of the
  base hybrid score, then sorts.
- `src/knowledge/index.js` query path: runs one search per search-term and
  merges with "highest score wins" per chunk id (`allResults` map).

## Suspicions (for whoever picks this up)

1. **Normalisation penalises zero-keyword docs.** A doc with a strong vector
   match but ~zero BM25 overlap effectively forfeits the 0.4 text weight, so a
   mediocre-vector doc that happens to share common tokens ("users", "in",
   "server") can overtake it. The toy queries were deliberately lexically
   disjoint — worst case for this.
2. **Additive boosts may be mis-scaled** relative to the base hybrid score.
   Confirm the magnitude/scale of Orama's returned hybrid score vs the additive
   `+0.01`/`+0.05`/`+0.1` constants — if the base score range differs from
   assumptions, boosts could dominate or vanish.
3. **Weighted-sum fusion may be the wrong tool.** Reciprocal Rank Fusion (RRF)
   over the two ranked lists is often more robust than score-weighted blending
   and sidesteps cross-modal normalisation entirely. Worth A/B-ing.
4. **A minimum-vector-similarity floor / gate** might help: don't let the text
   component demote a high-similarity vector hit below low-similarity noise.
5. **Per-term "highest score wins" merge** across multiple search terms may
   interact oddly with normalisation — check multi-term queries specifically.

## Proposed Approach

- Build a small **labelled eval set** (query → expected artifact) drawn from a
  real workflow-enabled project with hundreds of genuine research/discussion/
  specification artifacts. **Do not tune on synthetic toy corpora** — that is
  how you regress real queries.
- Measure top-1 / top-3 / MRR across variants: vector-only, current weighted
  hybrid, alternative text/vector weights, RRF, with/without a min-similarity
  gate, and tier/recency on vs off.
- Decide from data. Consider exposing the lever as config (alongside the
  existing `similarity_threshold`) — e.g. `text_weight`/`vector_weight` — so
  projects can adjust without code changes.

## Why It Matters

Retrieval quality underpins every cross-cutting knowledge query and the
background-surfacing protocols. A silent mis-rank degrades the whole system
invisibly — users just see "the KB didn't find the obvious thing" and lose
trust. But it's also easy to over-correct: any change to global ranking risks
regressions, so it must be driven by metrics on a representative corpus, not by
the 4-doc repro that surfaced it (that repro lives only in the dev conversation
that spawned this idea).

## Test Environment

Run against a mature `_workflow`-enabled project (lots of completed artifacts),
not the authoring repo. The `openai-compatible` + local Ollama path is a cheap,
free way to iterate on weights without burning cloud embedding spend.
