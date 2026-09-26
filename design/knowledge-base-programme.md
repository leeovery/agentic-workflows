# Knowledge Base Programme — measured retrieval, a chosen store, a module in the engine

The knowledge base was built early, before the engine existed in its current
form, and it has not been revisited since. This is the design log for
bringing it forward: first measuring what it retrieves, then choosing its
store on measured merit, then moving it into the engine, then improving what
it hands back. Opened 2026-09-25.

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
- **Semantic search stays, and keyword-only is a first-class mode.** Any
  store runs the vectors through a brute-force cosine scan. Keyword-only is
  supported, never merely tolerated.
- **The store is decided on measured merit.** The candidates are talked
  through properly before anything is built, keeping today's store is a
  valid outcome, and the decision rests on a benchmark with retrieval
  quality held by the eval harness.
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
3. **Store benchmark and decision.** The conversation comes first, ahead of
   step 2: which candidates, which criteria, and whether the store changes at
   all. Step 2 draws the line between our ranking code and the store, and
   that line has to fit every candidate on the table. The measurement comes
   after step 2, each candidate behind the same line: eval quality, load,
   query and index time, and size. Keeping Orama is a valid outcome.
4. **KB into the engine**, on the winning store. The retrieval work that
   follows lands in its final home.
5. **The rest of retrieval quality:** the relevance floor, printed scores,
   content-only search, heading paths and line ranges, a per-file cap,
   excerpts, and lifecycle markers. The keyword side's stop words and
   stemming are settings of the store's own tokenizer, so they wait for the
   store decision. A floor drawn from vector scores needs neither, and may
   come forward into step 2 (see step 1's findings).
6. **Lifecycle ranking within a topic.** It reads manifest state, which
   becomes a function call once the KB is in the engine.
7. **Catalogue and decisions register.** Scope still open: part of this
   programme, or an entry in `ideas/`.

Each step is designed in full here when it is reached. Steps 2–7 below
record only what is already decided and what is known to be open.

Each step ships as its own stack and its own release, never as one
programme-long branch. A store change is a release of its own, because every
install rebuilds its store once on first start. A fix found along the way
ships standalone.

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
primary. The top ten of both modes, keyword and hybrid, is then pooled, and
any result not yet judged is read and adjudicated to the same bar. Pooling
completes the judgments without letting the system define them.

A judgment names a source file and an **anchor**: a short verbatim phrase
from one line of the relevant passage. A returned chunk matches when it
comes from that file and contains the anchor, so the judgments survive any
change to chunk size or boundaries. Validation keeps the judgments honest
when the corpus moves: an anchor must occur exactly once in its file, a
primary must sit inside its case's filters, and after the build every
judgment must match an indexed chunk.

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

Every metric is reported per project and overall; overall pools the cases.

### The pinned baseline

The keyword mode is deterministic, so its numbers are pinned in
`tests/fixtures/knowledge-eval/baseline.json`, and the test fails on any
movement, in either direction. Re-pinning is deliberate: the harness
script's `--pin` rewrites the baseline, so the PR that moves retrieval
carries the before and after in its diff. The failure names the metrics
that moved, and each case whose best rank changed.

### Where it runs

- **`npm test`**: `tests/scripts/test-knowledge-eval.cjs`, hermetic and
  keyword-only. It validates the cases, builds the three stores, runs every
  case in process, and compares against the baseline.
- **By hand**: `node tests/scripts/knowledge-eval.cjs`, the same run with a
  per-case report. `--pin` rewrites the baseline, `--case <id>` shows one
  case's ranking against its judgments, `--pool` lists unjudged results for
  adjudication, and `--hybrid` runs the hybrid mode. The hybrid mode needs
  an API key and is outside the gate, like the OpenAI smoke test:
  - it takes only the provider identity from the machine, and runs on
    default tuning;
  - it builds the projects one at a time, each under the provider's
    per-minute limit;
  - its embedded stores are cached in a gitignored directory, keyed on the
    chunk set, the store format and the provider identity, so a ranking
    change reuses the embeddings and a chunking change re-embeds;
  - `baseline-hybrid.json` records the provider it was pinned with, and a
    run under another provider refuses to compare.

### The query function

The harness calls retrieval in process, not through the CLI. `cmdQuery`
splits into `querySettings` (the mode and ranking settings a store and
config resolve to), `queryStore(db, settings, { terms, options, workUnits })`
(ranked results, taking the options exactly as the CLI parses them) and
`renderQuery` (the text `query` prints). The CLI and the harness call
`queryStore` the same way. Every later step changes what happens inside it;
none changes how it is called.

`query --explain` (each result's rank in each leg, and what fusion, decay
and boosts did to it) belongs to step 2, where the legs first exist
separately.

### The measured baseline

58 cases (49 positive, 9 negative) and 698 judged passages, pinned in both
modes (the negatives at their harvested limits):

| metric | keyword | hybrid |
|---|---|---|
| hit@5 | 0.857 | 0.980 |
| primary hit@5 | 0.592 | 0.959 |
| MRR@10 | 0.691 | 0.934 |
| recall@10 | 0.431 | 0.678 |
| file hit@5 | 0.959 | 1.000 |
| bytes per query | 49.4 KB | 42.0 KB |
| results on a negative (mean) | 9.4 | 9.4 |

### What the eval showed

Measured over the pinned cases and the cached embedded stores.

**Vector scores separate a question with an answer from one without.** The
best vector score each query framing reaches:

| | lowest | median | highest |
|---|---|---|---|
| positive framings (118) | 0.36 | 0.55 | 0.71 |
| negative framings (16) | 0.23 | 0.37 | 0.43 |

A cut at 0.44 turns away every negative framing and keeps 111 of the 118
positive ones; at 0.42 it keeps 115 and lets 2 of 16 negatives through.
Today nothing is turned away: the configured vector threshold is 0.3, below
most negatives' best score, and when the vector side comes back empty the
keyword side still fills every slot — every negative, in either mode,
returns its full limit, averaging 39–46 KB. The threshold's calibration note (noise
peaking near 0.2) does not hold for the long natural-language framings
agents write: off-topic noise reaches 0.43. The nine negatives are all
clearly off-topic; a floor is set only after the set gains near-miss
negatives — a related subject the project never decided.

**Keyword-only has a real gap, not a tuning problem.** Agents write long
natural-language framings, as the query guidance asks, and batch three or
four in one call: the worst case for BM25 with no stop words and no
stemming. The right file is in the keyword top five 96% of the time, but:

- its first result is one the adjudication ruled irrelevant in 21 of 49
  positive cases;
- in multi-framing queries, 29 of 105 framings get no judged passage in the
  top ten (hybrid: 3 of 105);
- when its first result is relevant, a restatement (a summary or
  current-state section) beats the passage where the answer is recorded,
  15 to 13. Hybrid ranks the other way, 32 to 12.

**Supersession lives inside documents.** A decision amended in place keeps
its old text beside the new — a platform floor moved from macOS 14 to 15, a
login-item default turned to opt-in, a component count corrected from 15 to
18 by corrigendum. Judges in all three projects met it. Ranking one phase's
document above another's does not reach it.

**Restatement-heavy documents are not crowding the top.** Discovery logs and
seeds rank first in 1–2 of 49 cases. In the hybrid mode 61% of the returned
text is judged passages (keyword: 33%). The byte cost is chunk size: the
median returned chunk is 3.1–3.7k characters and a quarter run past 5.7–8k.

**Two defects surfaced in the harvest and the build.**

- Planning entry's cross-cutting check
  (`workflow-planning-entry/references/cross-cutting-context.md`) runs its
  knowledge query, filtered to `--work-type cross-cutting`, even when the
  project has no cross-cutting unit — a query that can only return nothing.
  It is 10 of the 155 real queries harvested.
- Embedding a large corpus hit OpenAI's rate limit (1M tokens a minute at
  the lowest tier; portal's corpus is ~0.93M), and the retry ignored the
  wait the provider named. Fixed separately (#1309): a rate-limited request
  waits the time named, and a command waits at most 60 s in all, so a rate
  limit never outlasts the time limit of the call running it.

## Step 2 — ranking in our own code

Decided:

- The keyword and vector searches run separately and merge by RRF, with a
  per-framing merge that rewards a chunk several framings agree on.
- Decay, boosts and the confidence tier apply after fusion, and decay
  stays unchanged.
- A failed embed degrades to keyword-only with a note, and `query` exits 0.
- `query --explain` shows each result's journey.

Open:

- The RRF constant, and whether the original framing is weighted above the
  others.
- Whether the relevance floor comes forward into this step as a gate on
  vector scores (the evidence is in step 1's findings), and what it does on
  a keyword-only store, which has no vector score to gate on.
- How strongly `--boost:work-unit` counts once scores are ranks. The case
  set cannot judge that yet: 11 of its 12 boosted cases have their answer
  inside the boosted unit, so a stronger boost only ever looks better. Tuning
  it needs cases where the boosted unit holds nothing the query wants.

## Step 3 — store benchmark and decision

The eval narrows the question. Hybrid retrieval on today's Orama store finds
the passage holding the answer in its top five 96% of the time, and nearly
every weakness found — no floor, a weak keyword side, oversized results —
sits in ranking and rendering, above the store. What the store decides:

- **Speed.** The whole store loads on every query, and every index rewrites
  the whole file.
- **Size.** Fumi's store is 15 MB, ~49 KB per chunk against ~6 KB of text.
- **Footprint.** Dependencies, and what the KB becomes once it is an engine
  module.
- **Control of the keyword side.** Stop words and stemming, where the
  keyword gap lives.

The candidates:

- **Orama, trimmed.** Float32 vectors stored once, no sort index, only
  content full-text indexed. The least change.
- **`node:sqlite`.** FTS5 for the keyword side, vectors as float32 blobs
  scanned by our own cosine; writes incrementally; no dependency. Needs
  Node ≥ 22.13 unflagged, a floor weighed in the decision.
- **No database.** Chunks plus a vector file, our own BM25 and a
  brute-force vector scan. At this scale — portal is ~1,100 chunks — it
  all fits in memory and a scan takes milliseconds. No dependency, full
  control of the tokenizer; the cost is owning BM25's correctness.
- **A smaller search library** (MiniSearch or similar) with our own vector
  scan. A middle ground.

Ruled out: native add-ons (sqlite-vec, LanceDB, DuckDB). An install copies
files with no build step, so a native binary cannot ship.

Beside the store, one question the eval can answer: **where embeddings come
from.** A local embedding model would give every install semantic search
without an API key — which matters now that keyword-only is measured this
far behind. It costs a model download and CPU time at indexing; the eval
measures it against OpenAI.

Measured for each, behind the line step 2 draws: eval quality (must hold or
improve), query time including load, full and single-file index time, store
size, install footprint, and the Node version it requires.

Known before measuring: Orama's filtered reads pre-allocated their `limit`,
fixed separately (#1305). Insert and save remain most of a fresh index's
time. A rate-limited embed waits the time the provider names, request by
request, within 60 s per command (#1309).

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

Open: supersession inside a single document. The eval found decisions
amended in place, old text beside new, in all three projects; ranking one
phase's document above another's does not reach it.

## Step 7 — catalogue and decisions register

A catalogue: one line per concluded artifact, which an agent reads to pick
files, with chunk search as the fallback. And a register of decisions, with
rationale and rejected alternatives, extracted at conclusion. Scope open.
