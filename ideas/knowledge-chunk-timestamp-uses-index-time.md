# Knowledge Base Temporal Model: Honest Timestamps + Progress-Driven Decay

> **Scope note.** This started as a narrow bug — chunks stamped with index time, not document date (see *Part 1*). Discussion surfaced that the bug shares a root assumption with the KB's whole decay model: **that wall-clock time is the right measure of staleness.** It isn't. So this idea folds two pieces of work into one coherent change: fix the dishonest timestamp, and replace wall-clock decay with a *project-progress* clock. Ship them as the phased PRs in *Part 4*.

---

## Part 1 — The Timestamp Bug

Every chunk indexed into the knowledge base is stamped with `Date.now()` at index time, not with the source document's actual date. The `query` command then renders that timestamp in each result's header — `[phase | work-unit/topic | confidence | DATE]` — where it reads as the *provenance* of the decision/finding. It isn't. It's "when the store was last (re)built for that chunk."

When indexing happens incrementally as documents are authored, the two coincide and nobody notices. They diverge — badly — the moment a corpus is **bulk-indexed**: a fresh install of the knowledge base into an existing project, a full reindex, or a migration. Every legacy document, regardless of true age, gets stamped with today's date.

### How it surfaced

A configless-install research session in the `agntc` project queried the KB for prior context. Ten chunks came back spanning multiple v1 work units and phases — all stamped `2026-06-04`. The orchestrator cited that as the decision date. The user immediately flagged it: *"there's no way that's true, I haven't worked on this project for months."*

Ground truth: the v1 docs were last committed `2026-03-21` (a migration commit; original authoring earlier still). The `2026-06-04` stamp was simply the day the user had freshly installed and indexed the KB into that project. The store's `metadata.last_indexed` matched it exactly: `2026-06-04T11:11:35.083Z`.

### Why it matters

The date in a query result is load-bearing context, and right now it lies:

- **Every phase that surfaces KB context and cites a date misreports it.** Research, discussion, investigation all do this. The orchestrator above stated a false decision date and only caught it because the user had personal memory to contradict it.
- **It also distorts ranking, not just display.** `rerank()` (`index.js` ~L1239) applies an always-on recency boost (up to +0.05) derived from this same `timestamp`. On a *mixed* store (bulk-indexed legacy + later incremental edits), every bulk doc looks like "today," so stale context ties with or outranks genuinely recent work in the recency component.
- **Recency / staleness judgments are silently broken.** "Is this decision still current?" / "what's the most recent thinking on X?" can't be answered when every chunk looks like it was decided today.
- **It re-stamps on every reindex.** The real authoring date isn't just hidden — after a reindex it's *unrecoverable from the store*, because `Date.now()` overwrites it each time.

### Root cause

`src/knowledge/index.js`, in `indexSingleFile` (chunk-document build, ~L578):

```js
const now = Date.now();
// ...
const doc = {
  // ...
  source_file: sourceFile,
  timestamp: now,        // ← every chunk for every doc gets "right now"
};
```

`timestamp` flows into the stored chunk (`store.js` schema ~L51, read back ~L248), is formatted into the query header by the timestamp formatter in the query renderer, and feeds the recency term in `rerank()`.

### The fix

The chunk already knows its source document, and that document's path is already resolved in the same function as `absSource` (`path.resolve(sourceFile)`, ~L504). `fs` is already imported. So derive the timestamp from the document instead of the clock:

```js
// minimal — mtime of the source document
const stat = fs.statSync(absSource);
const now = stat.mtimeMs;
```

**Source strategy (decided): mtime baseline, frontmatter as optional enhancement.**
- **mtime** — zero dependencies, instant, in scope right now. Caveat: a migration/reformat that rewrites the file bumps mtime, so it tracks "last meaningful edit" rather than original authoring (the v1 docs would date to `2026-03-21`, the migration, not their true origin). Still vastly better than "today," and correct for recency judgments in the common case.
- **frontmatter date** — some doc types carry an explicit date (e.g. discovery session logs have a `Date:` line). Layer a frontmatter parse *in front of* mtime for those types as a fast-follow: **frontmatter date → mtime → `Date.now()`** (final fallback only when no document date is obtainable).
- **git first-commit date** — most accurate authoring date but adds a git dependency, is slow per-file, and is distorted by squashes/migrated history. Rejected.

**Backfill.** Existing stores already carry wrong timestamps and won't self-correct until rechunked. A one-shot reindex after the fix lands repairs them (subject to the mtime caveat above). Relates to idea #22 (corrigendum + reindex convention).

---

## Part 2 — The Deeper Problem: Wall-Clock Decay

Fixing the timestamp gives the KB an **honest document date**. But it exposes that the KB's *decay* model rests on the same flawed assumption. There are three time-driven mechanisms, and they don't share a clock:

| Mechanism | Keys on | Touched by Part 1 |
|---|---|---|
| Display date in query header | chunk `timestamp` | ✅ |
| Recency boost in `rerank()` (~L1239) | chunk `timestamp` | ✅ |
| Decay / `compact` (the 6-month TTL) | `completed_at` from manifest | ❌ |

`compact` (`index.js` ~L2055) removes a completed work unit's **non-spec** chunks (specs are exempt, ~L2061) once `completed_at + decay_months <= now()`. It's pure wall-clock.

**The flaw:** a work unit completed 7 months ago is compacted whether or not the project has been touched since. If a project lies dormant, its context is exactly as valid as the day it was written — but the clock keeps ticking and the KB drops it. The model conflates *"old in calendar time"* with *"superseded by newer work."* Those are different things, and only the second one means "stale."

A naive fix — measure age relative to the project's *newest* completion instead of `now` — fails too: a project worked on, left dormant five months, then resumed would charge the dead gap as aging (the original work is suddenly "6 months older than newest" the instant new work lands). **The dead gap must contribute nothing.** That requires measuring decay in *forward movement*, not time.

---

## Part 3 — The Model (grounded in prior art)

Two established bodies of work map onto the two instincts here ("time *and* progress"):

- **Event-time & watermarks** (stream processing — Flink/Beam). Formalizes "gaps shouldn't count": a *logical clock* that advances only when events arrive, decoupled from wall-clock. "The progress of time depends on the data, not on any wall clock." A dormant pipeline's event-clock doesn't move. → This is our **project progress clock**.
- **FSRS / DSR memory model** (spaced repetition). Decay curve `R = 0.9^(t/S)` — decay is `t/S`, time over **stability**, and stability *grows each time an item is reinforced*. → This is our **decay shape + reinforcement**.

Supporting: **LRFU** cache eviction (blend two signals with one tunable λ); **time-decay recommenders** (use a *half-life* and **down-weight rather than delete**).

### The synthesis

**Decay over a logical project clock (watermark), shaped by reinforcement (FSRS), expressed as a soft down-rank rather than deletion.**

1. **Project "progress clock" (watermark) — replaces wall-clock.** Advances on *forward movement*, not calendar time. **Decided: workflow-native** — work units / topics completed, ordered by `completed_at`; each completion is one tick. Dormant gap → clock frozen → no aging. (Git churn was considered as a richer "code moved on" signal but rejected for v1: the KB is project-agnostic and self-contained; reaching into the host repo adds a dependency + noise. Noted as possible future enrichment only.)

2. **Decay as `progress-elapsed / stability` (FSRS shape).** A unit's exploratory context fades as project-progress accumulates *after* it — and **stability extends each time that context is reinforced** (re-queried, imported into a later unit, cited as a seed). Context the project keeps leaning on stays sharp; context nothing builds on fades. A **calendar floor** is retained as a secondary guard so a *burst* (many units in days) doesn't nuke genuinely recent context — decay requires *both* enough progress *and* a minimum age.

3. **Soft down-rank, not delete — decided.** Today decay = physical chunk removal (irreversible without reindex). Shift to: keep the chunk, apply a fading relevance weight in `rerank()`. You **never lose** valid context — it sinks when newer, more-reinforced work outranks it, and resurfaces if nothing better matches. **Hard deletion survives only as a conservative storage-size backstop** (much longer horizon), specs always exempt.

Fused: Part 1 gives an honest document date; the progress clock gives a fair age; FSRS gives the decay shape; reinforcement protects living context; soft down-rank means nothing is ever wrongly destroyed.

---

## Part 4 — Phased Implementation

Each phase is independently shippable as its own PR (one PR per change).

**Phase A — Honest document timestamp** *(Part 1; smallest, immediately valuable)*
- `indexSingleFile`: derive `timestamp` from `absSource` mtime instead of `Date.now()`.
- Document the header's date semantics (document-date, not index-date) so consumers know what it means.
- Note the one-shot reindex backfill.
- No schema change.

**Phase B — Project progress clock (watermark)** *(foundation for C & D)*
- Compute a logical progress ordinal from completed work units ordered by `completed_at`. Each completion = one tick. (Topic-level granularity for epics: decide during build.)
- Expose "progress position at completion" + "current progress" so C/D can compute progress-distance.

**Phase C — Progress-based decay in `compact`** *(fixes the dormant/gap problem)*
- Replace `completed_at + decay_months <= now` with: decay when ≥ K units completed *after* this one **and** a minimum calendar age has passed (both must hold — burst guard).
- Specs remain exempt.

**Phase D — Soft down-rank + deletion-as-backstop** *(overlaps idea #28 — coordinate)*
- `rerank()`: replace the flat recency boost with an FSRS-shaped decay weight over *progress-age* (`R = 0.9^(progressElapsed / S)`).
- Convert `compact` deletion into a conservative storage-size backstop (long horizon), not the relevance mechanism.
- **Coordinate with idea #28** (hybrid ranking weighting) — same `rerank()` surface.

**Phase E — Reinforcement / stability (FSRS `S` grows)** *(richest; fast-follow)*
- Track reinforcement events: artifact imported into a later unit (`imports`/`seeds`), surfaced, or cited → bump stability → slower decay.
- Schema change in `store.js` (stability + reinforcement count fields).

---

## Scope / files

- `src/knowledge/index.js` — `indexSingleFile` timestamp derivation (A); `compact` decay logic (C); `rerank()` decay weight (D).
- `src/knowledge/store.js` — schema fields for stability/reinforcement (E only; A–D need none).
- Progress-clock computation reads work-unit `completed_at` (manifest) — B.
- Rebuild the bundle (`npm run build`) and add/extend `tests/scripts/test-knowledge-*` for every phase.
- Cross-refs: **#28** (rerank weighting — shared surface with D), **#22** (corrigendum + reindex — backfill for A).
