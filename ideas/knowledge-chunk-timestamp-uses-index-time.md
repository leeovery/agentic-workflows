# Knowledge Chunk Timestamp Uses Index Time, Not Document Date

## The Bug

Every chunk indexed into the knowledge base is stamped with `Date.now()` at index time, not with the source document's actual date. The `query` command then renders that timestamp in each result's header — `[phase | work-unit/topic | confidence | DATE]` — where it reads as the *provenance* of the decision/finding. It isn't. It's "when the store was last (re)built for that chunk."

When indexing happens incrementally as documents are authored, the two coincide and nobody notices. They diverge — badly — the moment a corpus is **bulk-indexed**: a fresh install of the knowledge base into an existing project, a full reindex, or a migration. Every legacy document, regardless of true age, gets stamped with today's date.

## How It Surfaced

A configless-install research session in the `agntc` project queried the KB for prior context. Ten chunks came back spanning multiple v1 work units and phases — all stamped `2026-06-04`. The orchestrator cited that as the decision date. The user immediately flagged it: *"there's no way that's true, I haven't worked on this project for months."*

Ground truth: the v1 docs were last committed `2026-03-21` (a migration commit; original authoring earlier still). The `2026-06-04` stamp was simply the day the user had freshly installed and indexed the KB into that project. The store's `metadata.last_indexed` matched it exactly: `2026-06-04T11:11:35.083Z`.

## Why This Matters

The date in a query result is load-bearing context, and right now it lies:

- **Every phase that surfaces KB context and cites a date misreports it.** Research, discussion, investigation all do this. The orchestrator above stated a false decision date and only caught it because the user had personal memory to contradict it.
- **Recency / staleness judgments are silently broken.** "Is this decision still current?" / "what's the most recent thinking on X?" can't be answered when every chunk looks like it was decided today.
- **It re-stamps on every reindex.** The real authoring date isn't just hidden — after a reindex it's *unrecoverable from the store*, because `Date.now()` overwrites it each time.

## Root Cause

`src/knowledge/index.js`, in `indexSingleFile` (chunk-document build, ~line 578):

```js
const now = Date.now();
// ...
const doc = {
  // ...
  source_file: sourceFile,
  timestamp: now,        // ← every chunk for every doc gets "right now"
};
```

`timestamp` flows into the stored chunk (`store.js` schema line 51, read back line 248) and is formatted into the query header by the timestamp formatter in the query renderer.

## The Fix

The chunk already knows its source document, and that document's path is already resolved in the same function as `absSource` (`path.resolve(sourceFile)`, ~line 504). `fs` is already imported (used elsewhere, e.g. line 1559). So derive the timestamp from the document instead of the clock:

```js
// minimal — mtime of the source document
const stat = fs.statSync(absSource);
const now = stat.mtimeMs;
```

### Options & trade-offs (worth a quick decision)

- **mtime** (recommended baseline) — zero dependencies, instant, in scope right now. Caveat: a migration/reformat that rewrites the file bumps mtime, so it tracks "last meaningful edit" rather than original authoring (the v1 docs would date to `2026-03-21`, the migration, not their true origin). Still vastly better than "today," and correct for recency judgments in the common case.
- **git first-commit date** (`git log --diff-filter=A --follow --format=%aI -- <file> | tail -1`) — most accurate authoring date, but adds a git dependency, is slow per-file, and is distorted by squashes/migrated history.
- **frontmatter date** — some workflow docs carry an explicit date (e.g. discovery session logs have a `Date:` line). Most accurate when present. Best as a fallback chain: **frontmatter date → mtime → `Date.now()`**.

Recommended: start with mtime as the default source; optionally layer a frontmatter-date parse in front of it for the doc types that carry one. Keep `Date.now()` only as the final fallback when no document date is obtainable.

### Backfill

Existing stores already carry wrong timestamps and won't self-correct until rechunked. A one-shot reindex after the fix lands repairs them (subject to the mtime caveat above). Worth a note in whatever ships the fix.

## Scope

- `src/knowledge/index.js` — timestamp derivation in `indexSingleFile`.
- No schema change (`store.js` already stores/returns `timestamp` as a number).
- Optionally: document the header's date semantics so consumers know it's document-date, not index-date.
