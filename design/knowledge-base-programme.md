# Knowledge Base Programme — measured retrieval, our own store, a module in the engine

The knowledge base was built early, before the engine existed in its current
form, and it has not been revisited since. This is the design log for
bringing it forward. First we measure what it retrieves. Then we replace its
store with our own, ranking included, and move it into the engine. Last, we
improve what it hands back. Opened 2026-09-25.

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
  slightly (AutoRAG: DBSF 0.696, RRF 0.676, convex blend 0.653). Our own
  eval overturned this; see step 2's ranking.
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
- **Semantic search stays, and keyword-only is a first-class mode.** The
  vectors go through a brute-force cosine scan. Keyword-only is supported,
  never merely tolerated.
- **The store is our own.** It is our own BM25, a float32 vector file and our
  own file format, with no dependencies. It runs on every Node version the
  product already supports, so the store never raises the Node floor. It
  still has to earn its place: it ships only if the eval holds or improves
  on today's pinned numbers. Step 2 records why.
- **The KB becomes an engine module.** It is controlled by the engine and
  runs in process. It was kept separate only while the engine itself was in
  flux.
- **Decisions come before the work they would force us to redo.** The order
  below follows that rule and may change when it demands.

## The order

1. **Eval harness.** Measure today's retrieval, so every later step is
   judged by what it does to results.
2. **Our own store, with ranking in our own code.** Our own BM25, a float32
   vector file and our own file format replace Orama. The keyword and vector
   searches run separately and blend by score. A failed embed leaves the
   keyword results standing, with a note, and nobody is stopped. The keyword
   side gains its stemming and stop words. Orama and msgpack leave with it,
   so the KB has no dependencies. This step comes
   before the engine move because the engine is plain source with only
   Node's built-ins, and carrying Orama into it would give the engine a
   build step.
3. **Local embeddings, measured.** Run the eval's hybrid mode with a local
   model in place of OpenAI's. How a local model would ship is designed only
   if one holds up.
4. **KB into the engine.** With nothing to bundle, the KB becomes plain
   engine source. The retrieval work that follows lands in its final home.
5. **The rest of retrieval quality:** printed scores, heading paths and line
   ranges, a per-file cap, excerpts, and lifecycle markers. The relevance
   floor is reassessed here and in step 3.
6. **Lifecycle ranking within a topic.** It reads manifest state, which
   becomes a function call once the KB is in the engine.
7. **Catalogue and decisions register.** Scope still open: part of this
   programme, or an entry in `ideas/`.

Each step is designed in full here when it is reached. The steps after the
one in hand record only what is already decided and what is known to be
open.

Each step ships as its own stack and its own release, never as one
programme-long branch. Within a stack, every layer that moves retrieval
re-pins the eval, so each change's effect shows in the PR that makes it. A
store change is a release of its own, because every install rebuilds its
store once on first start. A fix found along the way ships standalone.

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
  - every vector it makes is cached in a gitignored directory, chunks and
    query terms alike, by provider identity and exact text. A store or
    ranking change embeds nothing; only new text reaches the provider;
  - `--timings` adds each project's store size and its index, load and
    query times, which are never pinned;
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

`query --explain` (each result's score in every search and framing, and
what decay, boosts and the tier did to it) belongs to step 2, where the
searches first run separately.

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

**Vector scores separate an off-topic question from one with an answer.**
The best vector score each query framing reaches:

| | lowest | median | highest |
|---|---|---|---|
| positive framings (118) | 0.36 | 0.54 | 0.71 |
| negative framings (16) | 0.23 | 0.37 | 0.43 |

A cut at 0.44 turns away every negative framing and keeps 109 of the 118
positive ones; at 0.42 it keeps 115 and lets 2 of 16 negatives through.
Near-miss negatives, added in step 2, do not separate this way (see step 2's
relevance floor).
Today nothing is turned away: the configured vector threshold is 0.3, below
most negatives' best score, and when the vector side comes back empty the
keyword side still fills every slot — every negative, in either mode,
returns its full limit, averaging 39–46 KB. The threshold's calibration note (noise
peaking near 0.2) does not hold for the long natural-language framings
agents write: off-topic noise reaches 0.43. The nine negatives are all
clearly off-topic; a floor is set only after the set gains near-miss
negatives — a related subject the project never decided.

**Keyword-only lagged far behind.** Most of the lag turned out to be
Orama's keyword scoring: once step 2 scored BM25 correctly, keyword-only
primary hit@5 rose from 0.592 to 0.959. Agents write long natural-language
framings, as the query guidance asks, and batch three or four in one call.
On Orama the right file was in the keyword top five 96% of the time, but:

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
  It is 10 of the 155 real queries harvested. Fixed separately (#1311): the
  query runs only when a cross-cutting unit has a completed specification.
- Embedding a large corpus hit OpenAI's rate limit (1M tokens a minute at
  the lowest tier; portal's corpus is ~0.93M), and the retry ignored the
  wait the provider named. Fixed separately (#1309): a rate-limited request
  waits the time named, and a command waits at most 60 s in all, so a rate
  limit never outlasts the time limit of the call running it.

## Step 2 — our own store, with ranking in our own code

### Why our own store

Step 1 narrowed the question. Hybrid retrieval already finds the passage
holding the answer in its top five 96% of the time, and nearly every weakness
it found sits in ranking and rendering, above the store. So the store decides
four things: speed, size, footprint, and control of the keyword side. Four
candidates were researched against them.

The numbers below are research probes, not a benchmark. They come from a
stand-in of 1,100 chunks cut from this repo's own markdown, with random
1,536-dim vectors:

| | Orama (today) | MiniSearch | `node:sqlite` | our own |
|---|---|---|---|---|
| on disk | ~50 MB | 3.7 MB index, text not stored | 15.9 MB | 2.4 MB index, 6.8 MB vectors, plus text |
| load per query | 0.5–0.6 s | 0.12–0.15 s | under 1 ms | 16–17 ms |
| keyword query | 2–82 ms | 10–29 ms | 4–5 ms | under 0.25 ms |
| dependency | 80 KB of the 188 KB bundle | 6 KB gzipped | built into Node | none |
| Node | declares ≥ 20 | any | 22.16 (warns on 22.x), 24.15 silent | any |

- **Orama scores keywords wrongly, and no setting fixes it.**
  - By default its tokenizer de-duplicates a chunk's words before scoring
    (`tokenizer/index.js:63` in 3.1.18). A word said five times counts once,
    and a chunk's length is its count of distinct words.
  - Its `allowDuplicates` option counts every occurrence as a document
    instead (`components/index.js:147-151`). A common word's document count
    can then pass the number of chunks, and its weight turns negative.
  - Once the two searches run separately, the vector side is a few lines of
    our own. That would leave Orama doing only the keyword side, which is the
    part it gets wrong.
  - It has had no npm release since December 2025.
- **MiniSearch scores correctly** and lets us own tokenization. But it is a
  dependency standing in for about two hundred lines of code, it applies
  filters after scoring, and it has had no commit since September 2025.
- **`node:sqlite` gives the most, and costs the Node floor.**
  - It brings FTS5's BM25, a Porter stemmer, incremental writes, and readers
    that keep working during a write.
  - It needs Node 22.16 for FTS5, where every run prints an experimental
    warning on stderr, or 24.15 to run silently. Below that, the KB would not
    run at all.
  - It is still a release candidate, with its main classes being renamed.
  - A custom tokenizer cannot be registered from JavaScript.
  - Natural-language text has to be escaped into an OR query.
  - On Node 22 a filtered query needs a forced plan. Without one it takes
    73 ms at 1,100 chunks and 2.3 s at 10,000.
  - What it adds over our own store starts to matter past 10,000 chunks.
    Portal, the largest project, has ~1,100.
- **Native add-ons are ruled out** (sqlite-vec, LanceDB, DuckDB). An install
  copies files, with no build step.

Every dependency also collides with step 4: the engine is plain source with
only Node's built-ins.

The cost of our own store is owning BM25's correctness. A reference
implementation runs 130–250 lines, and the known mistakes are few and
testable:
- count documents by chunk, not by occurrence;
- use raw term counts, and token counts for length;
- use an IDF that never goes negative (Lucene's
  `log(1 + (N − n + 0.5)/(n + 0.5))`);
- keep word maps safe against keys like `constructor`;
- use one tokenizer for both index and query.

The eval guards the rest.

### The store

- **One file.** `store.bin` replaces `store.msp` in `.workflows/.knowledge/`.
  - It holds a header naming the format version, then every chunk, then
    every vector as raw float32. Each chunk carries its text, its metadata,
    its source file's hash, the hash of its own text, and the counts BM25
    needs.
  - A query reads the file whole. At portal's size that is expected to take
    tens of milliseconds, and layer 1 measures it. (The probe loaded
    everything but the text in 16–17 ms.)
  - Every write rewrites the file under the writer lock and renames it into
    place. The lock, the rename and the metadata sidecar carry over
    unchanged.
- **BM25 done right.**
  - Raw term counts, and a chunk's length in tokens.
  - Document frequency counted by chunk.
  - Lucene's IDF, which never goes negative, with k1 1.2 and b 0.75.
  - Word maps safe against keys like `constructor`.
  - Each mistake the research listed gets a test.
  - The statistics are store-wide: a filter decides which chunks may be
    returned, never how one scores.
- **The tokenizer starts where today's is.**
  - It lowercases, and splits on anything but letters, digits, `_`, `'` and
    `-`.
  - No stemming and no stop words.
  - It searches the same three fields as today (content, source path, chunk
    id), scoring each on its own and summing them.
  - Orama's prefix matching, where a query word matches every word it
    begins, is not carried over. Stemming, measured in its own layer, is the
    principled way to the same recall.
- **Vectors are keyed by their text.**
  - Each chunk records the hash of the text it embedded. An index reuses the
    vector of any chunk whose text the store already holds.
  - So an edit re-embeds only the chunks it changed.
  - A rebuild that leaves chunk text alone calls no provider.
- **The upgrade.**
  - The first start after the release finds no `store.bin` and reads as
    `buildable`. The bulk index then builds the store from the files: the
    keyword side first, in seconds, then the vectors, saved as they land.
  - Nothing is carried over from the old store. For scale, step 1's hybrid
    build embedded all three eval projects together in 48 s at the lowest
    rate tier.
  - Once the new store is written, the old `store.msp` is deleted, and
    boot's `.worktreeinclude` sync lists `store.bin` in its place.

### What the store changed

Measured with today's blend rebuilt on the new searches, so only the store
moved:

| metric | keyword before → after | hybrid before → after |
|---|---|---|
| primary hit@5 | 0.592 → 0.959 | 0.959 → 0.980 |
| MRR@10 | 0.691 → 0.925 | 0.934 → 0.969 |
| recall@10 | 0.431 → 0.709 | 0.678 → 0.785 |
| bytes per query | 49.4K → 53.9K | 42.0K → 47.2K |

- **Portal's store** loads in ~8 ms (it took ~220 ms), and stores are less
  than half the size.
- **The bundle** falls from 188 KB to 90 KB.
- **Bytes rose.** Correct BM25 favours the long sections that repeat a
  query's words.

### Ranking

- **Two searches per framing.**
  - A keyword search runs for every framing.
  - When the query has a vector, a vector search runs too: a brute-force
    cosine over every chunk the filters admit, ~1.5 ms per thousand chunks.
- **Blended by score.**
  - Each search's scores are divided by that search's best score.
  - They are weighted 0.4 keyword and 0.6 vector, summed per chunk, and cut
    to twice the limit.
  - Keyword-only, a framing keeps its raw BM25 scores.
- **The best framing wins.** Each chunk keeps its best framing's score.
- **Then re-ranked.** Decay, the `--boost` directives (+0.1 each) and the
  confidence tier (+0.01 per step) apply as before.
- **`query --explain`** prints beneath each result:
  - its score in every search and framing;
  - the framing whose score it kept;
  - what decay, boosts and the tier did to it.
- **Rank fusion was measured and dropped.** Weighted RRF summed across
  framings made retrieval worse: keyword primary hit@5 fell 0.959 → 0.857,
  hybrid 0.980 → 0.898.
  - An agent's framings are angles on one question. The passage holding the
    answer usually tops one framing, while broad summaries sit halfway down
    all of them. Summing rewards being everywhere.
  - 22 variants were measured: blend or RRF within a framing, best or sum
    across framings, k from 1 to 60. None beat the blend on both primary
    hit@5 and recall in either mode, and every summed variant lost.
  - The literature's case for RRF (robust where score scales differ) does
    not survive dividing each search by its best score.

### Without a vector

- **A query never stops for want of a vector.**
  - It embeds all its framings in one request.
  - It runs keyword-only whatever keeps it from a vector the store can
    compare:
    - no key;
    - the provider down or silent;
    - a rate limit;
    - an account out of quota;
    - a store built with another model.
  - It prints a note naming the cause and its fix, and exits 0.
  - A query waits at most 5 s on a rate limit, and tries a silent endpoint
    twice at 5 s each. An index keeps its 60 s budget.
  - `query` exits non-zero only when the store itself cannot be read.
    `knowledge-usage.md` §D, the pause for a failed query, narrows its likely
    causes to match.
- **An index never drops a chunk for want of a vector.**
  - A file's chunks are written with their keywords first, searchable at
    once.
  - The vectors follow in batches, saved as each lands, so a failure keeps
    what landed. The next start embeds every chunk still waiting.
  - A missing key is a waiting vector, not a refusal. Over a store whose key
    does not resolve, the bulk index still exits non-zero naming the fix, so
    boot warns at every start until it resolves.
  - A file the endpoint refuses is embedded text by text, so only the
    refused chunk waits. A file with waiting chunks is re-chunked at each
    bulk index, and counts as changed only when its chunk texts differ, so a
    chunker fix reaches it.
  - The command still exits non-zero, naming the failure, so every caller's
    warning path carries it as it does today.
  - `status` counts the chunks waiting, and a query over a store with any
    waiting says so in its note.
- **A keyword-only store fills in.**
  - When a provider is configured over a keyword-only store, the next index
    adopts it and fills the vectors the same way.
  - The `upgrade-available` state goes, and with it the `knowledge rebuild`
    it asks for.
  - A store built with one model still refuses another. That stays a
    rebuild.

### The relevance floor: measured, not built

The floor would have turned away a framing whose best vector score fell
below a threshold. Near-miss negatives (questions close to a project's
material that it never answered) overlap real answers. The best vector score
each framing reaches:

| | lowest | median | highest |
|---|---|---|---|
| positive framings (118) | 0.36 | 0.54 | 0.71 |
| near-miss framings (27) | 0.33 | 0.41 | 0.57 |
| off-topic framings (16) | 0.23 | 0.37 | 0.43 |

The highest floor at which no positive case loses a judged passage from its
top five is 0.36. There it turns away:
- 1 of 12 near-miss queries;
- 2 of 9 off-topic queries.

At 0.43 three positive cases already lose answers. The value is also
specific to the embedding model: `similarity_threshold` is one number, not
set per provider or model. So the floor is not built.

It is reassessed at two points:
- **In step 3**, where other models are measured and each would need its
  own calibration. A floor that returns does so set per provider and model.
- **After step 5's excerpts**, which cut what a weak result costs and may
  show the floor is not needed.

### The keyword side

Three changes land a layer each, and each stays only if the eval improves:
- **Stemming:** Porter2, the Snowball English stemmer.
- **Stop words:** a standard English list, starting from Lucene's 33 words.
  Never the project's own vocabulary, which IDF already weighs.
- **Searching content alone:** the chunk id and source path are dropped from
  the searched fields.

A tokenizer change rebuilds the keyword side alone, locally, in seconds.

### The eval

- **Hard cases.** 17 cases join the 58, making 75.
  - 12 near-miss negatives, each confirmed absent by searching the corpus
    and by reading every top-10 result in both modes. They are reported apart
    as `near_miss_results` and `near_miss_bytes`.
  - 5 wrong-boost counter-cases: harvested queries boosted toward a unit
    that holds nothing they want but sits in the candidate pool. Fumi has one
    work unit, so it has none.
- **Embeddings cached by text.** The hybrid mode caches every embedding by
  provider identity and text. A change to the store or the ranking then
  embeds nothing.
- **Timings.** `--timings` reports store size, plus load, query and index
  times.
- **Re-pinned per layer.** Every layer that moves retrieval re-pins keyword
  mode in the gate and hybrid mode by hand.

### The stack

1. **The eval's embedding cache and timings** (#1313).
2. **Our own store** (#1314), with today's blend rebuilt on its searches.
3. **Ranking in its own module, and `--explain`** (#1316). Retrieval is
   unchanged.
4. **Without a vector** (#1322).
5. **The hard eval cases** (#1326).
6. **The zero-results branches** (#1338). `contextual-query.md` and
   `cross-cutting-context.md` read the count line: a note can now precede
   `[0 results]`.
7. **The keyword side** (#1342). All eight combinations were measured:
   - stemming (Porter2) and stop words (Lucene's 33) stay, the pair lifting
     keyword primary hit@5 to 0.981 and hybrid recall to 0.778;
   - searching content alone changed nothing and was dropped;
   - the store header records a tokenizer version, so a tokenizer change
     re-derives the keyword side from stored text and never re-embeds.
8. **Tuning** (#1343). Each open value was measured, and today's values
   stand:
   - keyword weight 0.4 and over-fetch 2;
   - boost +0.1, the only strength that helps the in-unit cases without
     costing a counter-case. In keyword-only mode a boost and the tier only
     break near-ties;
   - scaling keyword-only scores so a boost acts there cost an answer, and
     scaled, the boost added nothing;
   - the tail cut's largest safe setting trimmed 0–2% of output, short of
     the 10% it had to earn.

Docs move in the layer that changes what they describe: the KB section of
`CLAUDE.md`, the knowledge skill's `SKILL.md` and references, and
`docs/knowledge-base.md`. A layer that touches skill prose names the prose
cases it intersects. The stack ships as one release.

### Where it ends

Every value the stack left open was settled by the eval inside it. Output
size did not fall: correct BM25 favours long sections, so a hybrid answer
runs ~46 KB. Step 5's excerpts are the answer to that.

## Step 3 — local embeddings, measured

Without an API key an install runs keyword-only. Step 1 measured that well
behind hybrid, but step 2's correct BM25 closed most of the gap: primary
hit@5 is 0.959 keyword-only against 0.980 hybrid, and recall 0.709 against
0.785. A local model would still give every install semantic search, and the
wider recall that comes with it.

The measurement needs little or no code of ours. The `openai-compatible`
provider already points at a local server (Ollama or LM Studio), and the
eval's hybrid mode takes whatever provider the machine names.

The model must read long chunks. The median chunk is ~900 tokens and the 90th
percentile ~4,000, so a model that stops at 512 tokens embeds only the start
of most of them.

Of the small models, `granite-embedding-small-english-r2` publishes scores
level with `text-embedding-3-small`. It has 48M parameters, is 52 MB at int8,
reads up to 8,192 tokens, and is licensed Apache-2.0.

| | granite-small-r2 | text-embedding-3-small |
|---|---|---|
| MTEB English retrieval | 53.9 | 53.5 |
| long documents (LongEmbed) | 61.9 | 61.5 |
| technical documentation (FreshStack) | 32.8 | 29.6 |

Leaderboards often do not carry over to real queries, so the eval decides.
Whether a local server offers the model is checked when the step is reached;
Ollama carries only granite's earlier release. Static embeddings (Model2Vec)
are out, because they score below BM25 on retrieval.

What follows the measurement:
- **If a local model holds,** a later step designs how it ships. One route
  is in process: transformers.js on its WebAssembly backend, which is ~16 MB
  of runtime plus a model downloaded on first use, and neither of its
  published builds bundles cleanly. The other is a guided local server.
- **If none holds,** it becomes an entry in `ideas/`.

The vector file takes any width, so step 2 does not wait on this.

The relevance floor is reassessed here (see step 2). Each model scores on its
own scale, so a floor that returns is set per provider and model, calibrated
by the eval's near-miss negatives.

## Step 4 — the KB in the engine

The KB runs in process as an engine module. It reads manifests directly,
with no child process and no parsing of stderr, and each mirrored list
collapses to one. Step 2 leaves nothing to bundle, so the esbuild bundle is
retired and the KB becomes plain engine source. The loose ends from the audit
land here:
- config keys validated;
- reconfiguration keeping tuning overrides;
- `base_url` recorded;
- the base-stability default reconciled with its documentation, and an
  invalid `decay_base_stability` refused as its sibling settings are;
- store creation single-homed, with the store's and metadata's file names
  held once for the KB and the engine alike;
- the KB's JSDoc types brought under `npm run typecheck`, which today reads
  only the engine.

## Step 5 — the rest of retrieval quality

Planned:
- printed scores;
- a heading path on every chunk, indexed and shown with a line range
  (`path:L120-188`);
- a per-file cap;
- excerpts by default, with `--full`;
- a marker on a reopened or in-progress topic's chunks.

Contextual chunk headers are measured here. A change to chunk text
re-embeds only the chunks whose text it changes, because step 2 keys every
vector by its text.

Excerpts cut what a weak result costs an agent, which is most of what a
relevance floor would have bought. Once they land, the floor is reassessed:
closed if the eval shows it is not needed, built per provider and model if it
is.

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
