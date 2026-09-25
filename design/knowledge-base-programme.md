# Knowledge Base Programme — measured retrieval, a chosen store, a module in the engine

The knowledge base was built early, before the engine existed in its current
form, and it has not been revisited since. This is the design log for bringing it forward: first
measuring what it retrieves, then choosing its store on measured merit, then
moving it into the engine, then improving what it hands back. Opened
2026-09-25.

## Motivation

### Where it stands

The subsystem lives in `src/knowledge/`, bundled by esbuild into
`skills/workflow-knowledge/scripts/knowledge.cjs`. It keeps an in-process
Orama store, persisted as msgpack at `.workflows/.knowledge/store.msp`. A
query runs Orama's hybrid mode, a weighted blend of BM25 and cosine
similarity over OpenAI `text-embedding-3-small` vectors. It then re-ranks by
progress decay, `--boost` directives and a confidence tier, and prints the
top ten chunks in full.

The index is already sound. A document is chunked within the embed limit,
every chunk records its source file's hash, and every boot's bulk index
brings the store in line with the files. The whole `.workflows/.knowledge/`
directory is local to each checkout. What has never been examined is
retrieval itself, meaning what comes back and in what order. Nothing
measures it.

### What an audit of retrieval found

Measured against real stores (fumi, portal):

- **There is no relevance floor.** An off-topic query in fumi returned ten
  results and 47 KB of text. BM25 matches any single shared word, with no
  stop words and no stemming (Orama 3.1 ships both, off by default). Only the
  vector side has a threshold (0.3). The chunk id and the source path are
  full-text indexed, so the word "discussion" hits 294 chunks, only 105 of
  them by content. Each query costs 10–17k tokens.
- **Results are large, headless and clustered.** The median chunk is ~3.5k
  characters and the 90th percentile 15k. 211 of 346 chunks start at an H3
  with no parent heading or document title. `Source:` is a bare path. There
  is no per-file cap, so five of ten hits can come from one file.
- **Reopened topics are served as settled.** A reopen keeps its chunks by
  design, and nothing in the result says the topic is open again.
- **A query fails outright when the embed fails.** With no key or the
  provider down, `query` exits non-zero. `contextual-query.md` sends that
  to `knowledge-usage.md` §D, which pauses the workflow behind a retry/skip
  stop at the start of the phase.
- **The ranking maths is loose.** Multi-framing queries merge by keeping
  each chunk's highest per-framing score. Those scores are normalised per
  search, so they are not comparable across framings, and a chunk several
  framings agree on gains nothing. The confidence tier adds 0.01 per step.
- **The store is heavy.** It holds ~49 KB per chunk against ~6 KB of text:
  vectors are stored twice as float64, plus an unused sort index. The whole
  store is loaded on every query.
- **The structure is split.** `index.js` is ~2.6k lines. The KB launches the
  engine as a child process to read manifests, and the engine launches the
  KB and parses its stderr. Two lists are mirrored across that boundary and
  pinned equal by tests: `ARTIFACT_PATHS` with the engine's indexed-artifact
  list, and `RETIRED_ITEM_STATUSES` with `TERMINAL_STATUSES`.

### What the literature says

Drawn from the owner's dex-engineering knowledge base:

- **Hybrid stays, keyword is first-class.** Coding agents do well with
  lexical search, and BM25 suits a searcher who is also the author (Cherny,
  Bergum, Liu). Semantic search earns its place where the query shares no
  keywords with the answer (Turbopuffer: file precision 65% → 87%).
- **Fuse by rank, not by blended score.** Reciprocal rank fusion (RRF) is
  robust where score scales differ. Distribution-based fusion edges it
  slightly (AutoRAG: DBSF 0.696, RRF 0.676, convex blend 0.653).
- **Supersession comes from lifecycle, not similarity.** Cosine separates a
  contradiction from a duplicate at AUROC 0.59. A deterministic lifecycle
  key serves the stale value close to never (MemStrata).
- **Contextual chunk headers pay.** Prepending the document and section
  path cuts retrieval failures (Anthropic: −35% with contextual embeddings,
  −49% with contextual BM25 added).
- **Skip rerankers and query expansion** (HyDE, multi-query). Measured below
  baseline more often than above.
- **Evaluate on real queries.** Leaderboard orderings inverted on real data
  (Chroma), so the set is steered by the queries agents actually issue.

## Standing rulings

- **Pruning and progress decay stay.** Decay across work units is unchanged
  throughout. An epic still in progress never decaying is by design.
  Lifecycle ranking within a topic is *added* alongside decay, never in
  place of it.
- **The knowledge directory is local to each checkout.** Store, metadata and
  config alike are never committed.
- **Semantic search stays, and keyword-only is a first-class mode.** Either
  store runs OpenAI vectors through a brute-force cosine scan. Keyword-only
  is supported, never merely tolerated.
- **The store is decided on measured merit.** Trimmed Orama against
  `node:sqlite`, by benchmark, with retrieval quality held by the eval
  harness.
- **The KB becomes an engine module.** It is controlled by the engine and
  runs in process. It was kept separate only while the engine itself was in
  flux.
- **Decisions come before the work they would force us to redo.** The order
  below follows that rule and may change when it demands.

## The order

1. **Eval harness.** Measure today's retrieval, so every later step is
   judged by what it does to results.
2. **Ranking in our own code.** Run the keyword and vector searches
   separately and merge them by RRF, still on Orama. Today Orama blends the
   two itself, and `node:sqlite` has no hybrid mode, so a comparison across
   stores would otherwise change store and merge at once, and the harness
   could not tell which moved a result. Two separate searches also give the
   keyword fallback for free: a failed embed leaves the keyword results
   standing, with a note, and nobody is stopped.
3. **Store benchmark and decision.** The same ranking code runs over both
   candidates: load, query and index time, and file size, at ~3,000
   chunks. The harness holds retrieval quality equal or better.
4. **KB into the engine**, on the winning store. The retrieval work that
   follows lands in its final home.
5. **The rest of retrieval quality:** the relevance floor, printed scores,
   content-only search, heading paths and line ranges, a per-file cap,
   excerpts, and lifecycle markers. The floor's stop words and stemming
   are settings of the store's own tokenizer, so they wait for the store
   decision.
6. **Lifecycle ranking within a topic.** It reads manifest state, which
   becomes a function call once the KB is in the engine.
7. **Catalogue and decisions register.** Scope still open: part of this
   programme, or an entry in `ideas/`.

Each step is designed in full here when it is reached. Steps 2–7 below
record only what is already decided and what is known to be open.

## Step 1 — the eval harness

### What it answers

For a fixed set of real queries over real documents: how often the passage
an agent needed comes back, and how high. It also measures how much text an
answer costs, and how much comes back when nothing should. Each is a number
a later step moves, and the harness makes the move visible in the PR that
causes it.

### The corpus

Real workflow documents from three projects, snapshotted once: portal and
tick (the oldest, rich in specifications) and fumi (newer, dense with
research and discussion, no specification yet). Each project keeps its own
store, because a knowledge base is per project and a query only ever
searches its own.

The fixture holds what the bulk index reads: every indexed markdown file,
plus every manifest the index decides from. Planning, implementation and
review files, the cache, and non-markdown imports are left out, because the
index never reads them. The fixture lives at
`tests/fixtures/knowledge-eval/{portal,tick,fumi}/.workflows/`, and the test
indexes each tree through the real bulk index, keyword-only, into a temp
copy. A change to chunking or indexing therefore reaches the measurement.

The snapshot is frozen. The source projects move on, and the fixture does
not follow them. A deliberate refresh is a re-snapshot, a re-judge and a
re-pin, in one PR.

### The cases

A case is one query invocation: its terms (one or several framings), the
options it ran with (`--boost:*`, filters, `--limit`), and its judged answer.

- **Harvested.** Agents' own queries from the three projects' session
  history, shell tails stripped, near-duplicates collapsed. Two shapes
  dominate, and both are kept: the phase-start contextual query (several
  framings, `--boost:work-unit`) and the fact lookup a review agent runs
  mid-phase (one framing, often `--phase`/`--work-unit` filters and a small
  limit).
- **Written.** Where a project's history is thin (tick), a few cases in the
  same shapes, marked as written.
- **Negative.** Queries whose right answer in that store is nothing:
  harvested queries from one project run against another, each confirmed
  to have no answer in the target corpus. These measure the floor.

### Judging

Relevance is judged from the documents, never from the KB's results;
otherwise the baseline would grade the system against itself. For each
case, the judge searches the corpus directly and records every passage an
agent issuing that query would want to read: a decision, finding or
constraint on the query's subject, never a passing mention. Each passage is
graded **primary**, where the answer is recorded (the decision or finding in
its home document), or **supporting**, a passage that restates, summarises
or bears on it; a superseded ruling is supporting and the current one
primary. The top ten of both legs, keyword and hybrid, is then pooled, and
any result not yet judged is read and adjudicated to the same bar. Pooling
completes the judgments without letting the system define them.

A judgment names a source file and an **anchor**: a short verbatim phrase
from one line of the relevant passage. A returned chunk matches when it
comes from that file and contains the anchor, so the judgments survive any
change to chunk size or boundaries. The test fails if an anchor is missing
from its file, which keeps the judgments honest when the corpus moves.

### Metrics

Over the positive cases:

- **hit@5**: the share of cases with a judged passage in the top five.
- **primary hit@5**: the same, counting primary passages alone.
- **MRR@10**: the mean reciprocal rank of the first judged passage.
- **recall@10**: the mean share of a case's primary passages found in the
  top ten.
- **file hit@5**: hit@5 at file grain, where any chunk of a judged file
  counts.

Over every case, the **output size**: the mean bytes of the CLI's rendered
result, which is what an agent pays for. Over the negative cases, the
**results returned** and their bytes, where lower is better.

Every metric is reported per project and overall.

### The pinned baseline

The keyword leg is deterministic, so its numbers are pinned in
`tests/fixtures/knowledge-eval/baseline.json`, and the test fails on any
movement, in either direction. Re-pinning is deliberate: the harness
script's `--pin` rewrites the baseline, so the PR that moves retrieval
carries the before and after in its diff. The failure names the metrics
that moved, and each case whose best rank changed.

### Where it runs

- **`npm test`**: `tests/scripts/test-knowledge-eval.cjs`, hermetic and
  keyword-only. It validates the corpus (case ids unique, every anchor
  present in its file), builds the three stores, runs every case in
  process, and compares against the baseline.
- **By hand**: `node tests/scripts/knowledge-eval.cjs`, the same run with a
  per-case report. `--pin` rewrites the baseline, `--case <id>` shows one
  case's ranking against its judgments, `--pool` lists unjudged results for
  adjudication, and `--vector` runs the hybrid leg. The hybrid leg needs an
  API key and is outside the gate, like the OpenAI smoke test. It embeds
  the corpus once into a gitignored cache and pins its own numbers in
  `baseline-vector.json`.

### The query function

The harness calls retrieval in process, not through the CLI. `cmdQuery`
splits into a search function (terms, filters, boosts and limit in; ranked
results out) and the renderer that prints them. The CLI's output stays
byte-identical. Every later step changes what happens inside the search
function; none changes how the harness calls it.

`query --explain` (each result's rank in each leg, and what fusion, decay
and boosts did to it) belongs to step 2, where the legs first exist
separately.

### The measured baseline

58 cases (49 positive, 9 negative) and 698 judged passages, pinned on both
legs:

| metric | keyword | hybrid |
|---|---|---|
| hit@5 | 0.857 | 0.980 |
| primary hit@5 | 0.592 | 0.959 |
| MRR@10 | 0.691 | 0.934 |
| recall@10 | 0.431 | 0.678 |
| file hit@5 | 0.959 | 1.000 |
| bytes per query | 49.5 KB | 41.9 KB |
| results on a negative | 10 | 10 |

What it says for the steps ahead:

- **The vector leg carries retrieval.** Keyword-only finds the right file
  almost every time but the passage holding the answer in its top five
  only 59% of the time. A first-class keyword mode has to close most of
  that gap: the target of step 5's stemming, stop words and content-only
  indexing.
- **Nothing is ever turned away.** Every negative, on either leg, returns a
  full ten results and 40–47 KB. The floor is measured from zero.
- **Recall is the weakest number on both legs**, because a multi-framing
  query's answer spans several passages and the top ten is shared among
  the framings.

## Step 2 — ranking in our own code

Decided:

- The keyword and vector searches run separately and merge by RRF, with a
  per-framing merge that rewards a chunk several framings agree on.
- Decay, boosts and the confidence tier apply after fusion, and decay
  stays unchanged.
- A failed embed degrades to keyword-only with a note, and `query` exits 0.
- `query --explain` shows each result's journey.

Open: the RRF constant, and whether the original framing is weighted above
the others.

## Step 3 — store benchmark and decision

The candidates:

- **Trimmed Orama**: float32 vectors stored once, no sort index, only
  content full-text indexed.
- **`node:sqlite`**: FTS5 for the keyword leg, vectors as float32 blobs
  scanned by our own cosine, and no dependency.

Measured at ~3,000 chunks: load, query and index time, and file size.
`node:sqlite` needs Node ≥ 22.13 unflagged, and the floor it sets is
weighed in the decision. The harness must hold retrieval equal or better
across the switch.

Known before measuring: Orama's filtered reads pre-allocated their `limit`,
fixed separately (#1305). Insert and save remain most of a fresh index's
time.

## Step 4 — the KB in the engine

The KB runs in process as an engine module. It reads manifests directly,
with no child process and no parsing of stderr, and each mirrored list
collapses to one. If `node:sqlite` wins, the esbuild bundle is retired and
the KB becomes plain engine source. The loose ends from the audit land here:
config keys validated, reconfiguration keeping tuning overrides,
`base_url` recorded, the base-stability default reconciled with its
documentation, and store creation single-homed.

## Step 5 — the rest of retrieval quality

Planned: a relevance floor (stop words, stemming, content-only indexing, a
per-leg minimum), printed scores, a heading path on every chunk (indexed,
and shown with a line range, `path:L120-188`), a per-file cap, excerpts by
default with `--full`, and a marker on a reopened or in-progress topic's
chunks. Contextual chunk headers are measured here.

## Step 6 — lifecycle ranking within a topic

Within one topic, the later record outranks the earlier: specification
over discussion over research, with a reopened topic marked. This sits
alongside progress decay across work units and never replaces it.

## Step 7 — catalogue and decisions register

A catalogue: one line per concluded artifact, which an agent reads to pick
files, with chunk search as the fallback. And a register of decisions, with
rationale and rejected alternatives, extracted at conclusion. Scope open.
