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
- **git commit date** (`git log -1 --format=%ct -- <file>`) — the *only* clone-stable source: commit history travels with a clone, unlike mtime. It's **local, not a network call** (~ms), and would also fix healing (see Backfill). Rejected nonetheless: a subprocess per file, a non-git-repo fallback, and extra test scaffolding — not worth it given dates are a non-load-bearing nice-to-have and the audience is tiny. Revisit only if healing fresh-clone installs ever matters.

**Backfill.** Existing stores keep their wrong timestamps until rechunked. A one-shot `knowledge rebuild` re-chunks from source and picks up the new mtimes — **but only heals where the working tree's mtimes survived from authoring**: an in-place project never deleted-and-recloned (true for the author's own projects). `git checkout`/`pull`/`merge` and reformat/migration tools can still bump individual files to a *later* date — but the era, not "today," so still a net fix. On a **fresh clone**, though, every mtime is the clone time, so `rebuild` re-stamps "today" and heals nothing — the exact install case that surfaced this bug. That residual gap is **accepted**: dates are non-load-bearing and the only cure is the git-date source rejected above. Relates to idea #22 (corrigendum + reindex convention).

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
- **FSRS / DSR memory model** (spaced repetition). Decay curve `R = 0.9^(t/S)` — decay is `t/S`, time over **stability**. → We adopt the **curve**; `S` stays a constant seam (FSRS grows it on reinforcement, but reinforcement is the wrong layer here — it's query-conditioned, see synthesis).

Supporting: **LRFU** cache eviction (blend two signals with one tunable λ); **time-decay recommenders** (use a *half-life* and **down-weight rather than delete**).

### The synthesis — one number, `R`

Everything reduces to a per-chunk **retrievability** `R ∈ (0, 1]`:

```
R = 0.9 ^ (progressElapsed / S)
```

1. **Progress clock (watermark), not wall-clock.** `progressElapsed` = how many work units completed *after* a chunk's work unit, derived from `runManifest(['list'])` + `completed_at` ordering. Dormant gap → no completions → no aging. Workflow-native, work-unit granularity, **derived at read time — no stored state, no migration.** (Git churn rejected: the KB is project-agnostic; reaching into the host repo adds a dependency + noise.)

2. **`S` = stability, constant `S0`.** FSRS grows `S` on reinforcement, but **reinforcement belongs to the wrong layer here.** A graded "was this useful?" signal *is* obtainable (Claude could classify query results good/bad via the script) — but relevance is **per-query**: a chunk irrelevant to query X may be central to query Y, so one query's verdict can't license a *global* penalty on the chunk. `S`/`R` is a **global, query-independent** staleness term; query-relevance is already a separate axis (the base similarity score, computed per query). Folding `(query, chunk)` feedback into the global `S` is a category error — it would punish a chunk across *all* future queries for one query's judgment. So feedback is genuinely a different system (**query-conditioned relevance feedback** — learning-to-rank territory, keyed on `(query, chunk)`, not per-chunk), not a knob on temporal decay. `S` stays constant; the seam stays open. (See Part 4 — reinforcement is **out of scope for #33**, captured separately as [query-conditioned-relevance-feedback](query-conditioned-relevance-feedback.md).)

3. **Soft down-rank — `R` multiplies relevance.** In `rerank()`: `finalScore = baseScore × R + confidence + userBoosts`, replacing the broken relative-recency term. A decayed chunk *sinks smoothly* but is **never removed**, and resurfaces if nothing fresher matches. Multiplicative (not an additive penalty) so decay can actually dominate. **Specs never decay** (`R = 1`, matching `compact`'s spec exemption).

4. **Deletion → storage backstop only.** `compact` no longer deletes for relevance — it prunes only chunks whose `R` has fallen below a floor (`decay_prune_below`), i.e. already unreachable in ranking, so deletion is pure storage hygiene. The workflow-start `compact` call (Step 0.3 `knowledge-check.md`) stays but becomes near-no-op. Specs always exempt.

**No wall-clock in decay.** Time survives only as Part 1's honest *display* date (provenance). The earlier calendar-floor burst-guard is dropped — soft down-rank makes mild over-decay a harmless ranking nudge, not destruction. Pure-progress self-scales: a 3-unit dormant project barely decays its oldest (`R ≈ 0.93`); a 200-unit project buries it (`R ≈ 0`). Both correct.

---

## Part 4 — Stacked PRs (all shipping in this effort)

One coherent mechanism (`R`), used two ways — rank + prune. Decay is pure progress; `S` constant.

**PR1 — Honest timestamp (A).** `indexSingleFile`: derive `timestamp` from `absSource` mtime, not `Date.now()`. `last_indexed` stays wall-clock (separable). Document the header date as *document-date*. Note the one-shot reindex backfill. No schema change.

**PR2 — Progress clock (B).** Pure, unit-testable helper: completed units via `runManifest(['list'])` → `completed_at` ordering → `progressElapsed(workUnit)`. No behaviour change yet.

**PR3 — Soft down-rank (D — the headline).** The `R` decay function + multiplicative down-rank in `rerank()` (`finalScore = baseScore × R + confidence + userBoosts`), replacing the recency term. Specs `R = 1`. The progress map is computed in `query()` and passed into the still-pure `rerank()`. Coordinates with **#28** (same surface).

**PR4 — Compaction-as-backstop (C).** `compact` drops the wall-clock `completed_at + decay_months <= now` test; prunes only chunks with `R < decay_prune_below`. Specs exempt. New config: `decay_base_stability` (`S0`, default `3`), `decay_prune_below` (default `0.05`); keep the `false` disable.

**Out of scope — Reinforcement (was Phase E).** Not a temporal-decay knob at all — it's *query-conditioned relevance feedback* (wrong layer; see Part 3, point 2). Spun out as its own idea: [query-conditioned-relevance-feedback](query-conditioned-relevance-feedback.md). The `S` seam is left open should that work ever produce a global, cross-query usefulness signal.

---

## Scope / files

- `src/knowledge/index.js` — `indexSingleFile` timestamp (PR1), progress-clock helper (PR2), `rerank()` decay (PR3), `compact` prune (PR4).
- `src/knowledge/config.js` — `decay_base_stability`, `decay_prune_below` (PR4).
- **No schema change** (reinforcement excluded) — `store.js` untouched.
- Rebuild the bundle (`npm run build`) and extend `tests/scripts/test-knowledge-*` per PR.
- Cross-refs: **#28** (rerank surface — PR3), **#22** (reindex backfill — PR1).
