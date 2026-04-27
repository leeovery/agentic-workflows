# Knowledge Base — Deferred Issues

Cross-phase log of **non-blocking** issues, design debts, and code smells surfaced during review that are intentionally deferred. Blocking bugs are fixed immediately — they do not belong here.

Format: `### N. Title — Severity`

Each entry records: where, what, why it was deferred, and a mitigation idea. Circle back when working on the owning area.

Items below marked **RESOLVED** were addressed during the pre-merge cleanup pass on `feat/knowledge-base-phase-8` (commits after 2026-04-20). Each entry still records the original problem for provenance.

---

## Phase 4 (CLI Complete) — Deferred

### 1. Index/rebuild TOCTOU on embedding dimensions — Critical-rare — **RESOLVED**

**Location:** `src/knowledge/index.js` `indexSingleFile` lines ~400–450.
**Description:** Embeddings are computed using `effectiveProvider.dimensions()` BEFORE acquiring the lock. Inside the lock the store is reloaded but provider-state is not re-validated. If a concurrent `rebuild` recreates the store with different dimensions between embed and insert, `insertDocument` will fail or corrupt the vector index.
**Why deferred:** Requires concurrent rebuild during indexing — extremely rare in single-developer use. Phase 5+ skill orchestration will serialize.
**Mitigation:** Re-validate provider state inside the lock after store reload; abort if schema mismatch.

### 2. Pending queue unbounded growth on persistent failures — Medium — **RESOLVED**

**Location:** `src/knowledge/index.js` `processPendingQueue` catch block.
**Description:** Items that fail catch-up retry stay in the queue forever. No max-retry counter, no eviction. If failure is permanent (renamed work unit, malformed file), each bulk run wastes 3 OpenAI calls per item indefinitely.
**Mitigation:** Add `attempts` counter to pending entry; evict at 10 with stderr warning.

### 3. Rebuild has no rollback — Medium — **RESOLVED**

**Location:** `src/knowledge/index.js` `cmdRebuild`.
**Description:** Deletes `store.msp` and `metadata.json` BEFORE running bulk index. If bulk index throws (network down, OpenAI outage), left with no store, no metadata.
**Mitigation:** Move old files to `.bak` suffix; restore on bulk-index failure.

### 4. `getWorkUnitMeta` / `discoverArtifacts` / `runManifest` swallow all errors — Medium — **RESOLVED**

**Location:** Multiple helpers in `src/knowledge/index.js`; convention in `skills/workflow-manifest/scripts/manifest.cjs`.
**Description:** Catch-alls return null/empty on manifest CLI failure. Hides broken MANIFEST_JS path, corrupt manifest JSON, etc. Compact and status consistency checks silently skip work units; bulk index reports "0 files" on broken manifest.
**Mitigation:** Distinguish exit-code-1 (key not found) from other errors; surface unexpected errors to stderr at minimum.
**Resolution:** `manifest.cjs` `die()` now takes an optional exit code — 2 for "expected miss" (not-found paths, missing work units, missing values), 1 for real errors (corrupt JSON, validation failures, bad args). Knowledge-base helpers classify via `err.status === 2` on execFileSync — stable and not reliant on stderr-text regex. 10 die() sites updated; 4 tests updated to assert the new codes; one new test covers the exit-code contract directly.

### 5. `MANIFEST_JS` fallback resolves silently to non-existent path — Medium — **RESOLVED**

**Location:** `src/knowledge/index.js` MANIFEST_JS constant (~line 26).
**Description:** If neither candidate path exists, fallback resolves to a path that doesn't exist. `execFileSync` throws ENOENT, caught silently in `discoverArtifacts`, returning empty array. Bulk index becomes a silent no-op.
**Mitigation:** Throw at module load if MANIFEST_JS doesn't resolve to an existing file.

### 6. Status shells manifest CLI per spec topic — Low (perf) — **RESOLVED**

**Location:** `src/knowledge/index.js` `cmdStatus` superseded-spec consistency check.
**Description:** N node processes spawned for N spec topics. Status slow on repos with many specs (~5s for 50 topics).
**Mitigation:** Cache full manifest once per status invocation; read spec statuses from the cached object.

### 7. `--work-unit` filter vs boost semantics — Low (UX) — **RESOLVED**

**Location:** `src/knowledge/index.js` `cmdQuery`, `cmdRemove`.
**Description:** `--work-unit` was a re-rank proximity boost on `query` but a hard filter on `remove` — same flag name, opposite semantics. Inconsistent with `--phase`/`--work-type`/`--topic` (all filters). Docs alone weren't enough; the flag spelling itself invited misuse.
**Resolution:** Fully orthogonal CLI — every `--<dimension>` flag is a hard filter on every command that accepts it (`--work-unit`, `--work-type`, `--phase`, `--topic`). Re-ranking happens exclusively through `--boost:<field> <value>`, which is repeatable, composable across dimensions, and validated against a fixed set of fields (`work-unit`, `work-type`, `phase`, `topic`, `confidence`). `+0.1` per match, additive. Unknown field or missing value → fail-fast error. Skill templates can now compose multi-dimensional bias (e.g. `--boost:work-unit auth-flow --boost:phase research`) that wasn't expressible before.

### 8. Migration `report_update` called unconditionally — Low — **WITHDRAWN**

**Location:** `skills/workflow-migrate/scripts/migrations/036-completed-at.sh` (and pattern from 035).
**Description:** `report_update` is called even when 0 work units were modified. Inflates orchestrator counter; may trigger false "review changes" prompt.
**Why withdrawn:** Migrations are point-in-time snapshots. Once a migration id is recorded in `.workflows/.state/migrations`, it never re-runs — editing the bash wrapper helps only users who haven't yet run it. The counter is a one-time UX nit during a single migration pass; the fix-vs-snapshot-principle tradeoff isn't worth it.

### 9. `withRetry` swallows programming errors like network errors — Low — **RESOLVED**

**Location:** `src/knowledge/index.js` `withRetry`.
**Description:** A `TypeError` from a typo is retried 3× with 7s of sleep before rethrow. Wastes time during development.
**Mitigation:** Discriminate error types — don't retry `TypeError`/`ReferenceError`/`SyntaxError`.

### 10. `indexSingleFile` stack trace lost in pending queue — Low — **RESOLVED**

**Location:** `src/knowledge/index.js` `cmdIndexBulk` catch block.
**Description:** `addToPendingQueue(item.file, err.message)` saves only the message, not the stack. Debugging relies on stderr which users may not capture.
**Mitigation:** Accept and write a bounded stack snippet; or always `console.error(err.stack)` before queueing.

### 11. KEYWORD_ONLY_DIMENSIONS = 1536 silent provider lock-in — Medium (UX) — **RESOLVED**

**Location:** `src/knowledge/index.js` `cmdIndex` / case 4 of `resolveProviderState`.
**Description:** User first indexes without provider (keyword-only, schema dims=1536). Later configures OpenAI (also 1536 dims). Subsequent `knowledge index` calls silently stay keyword-only. Only `knowledge status` warns. User must know to run `rebuild`.
**Mitigation:** Print upgrade note on `cmdIndex` when entering case 4 with a provider now configured.

### 12. OpenAIProvider mutates `res.data` in place — Low (style) — **RESOLVED**

**Location:** `src/knowledge/providers/openai.js` `embedBatch`.
**Description:** `.sort()` mutates. Response used only locally so no observable effect.
**Mitigation:** Use `[...res.data].sort(...)`.

### 13. OpenAIProvider `embed()` assumes non-empty `res.data[0]` — Low — **RESOLVED**

**Location:** `src/knowledge/providers/openai.js` ~line 45.
**Description:** If OpenAI returns `{ data: [] }` throws non-descriptive TypeError. Not observed in practice (OpenAI returns 400 for empty inputs).
**Mitigation:** Guard and throw a provider-specific error.

### 14. Project config cannot unset system config field — Low — **RESOLVED**

**Location:** `src/knowledge/config.js` `loadConfig` merge loop.
**Description:** `Object.assign`-style merge only copies defined values; setting project `model: undefined` cannot unset a system `model: "x"` default.
**Mitigation:** Treat explicit `null` as unset sentinel in the merge.

### 15. `searchHybrid` similarity threshold may drop strong text-only matches — Low — **WITHDRAWN**

**Location:** `src/knowledge/store.js` `searchHybrid`.
**Description:** Theoretical concern that Orama applies `similarity` as a filter on hybrid results; zero vector matches could mask strong BM25 matches.
**Why withdrawn:** Empirical probing of Orama's hybrid mode shows the concern doesn't manifest. With a flat/poor vector and `similarity: 0.99`, hybrid still returns BM25-driven hits (text matches come through regardless of similarity post-filter). The only way to get zero hybrid hits is when the term itself doesn't match — at which point a text-only fallback also returns zero. A defensive fulltext fallback was briefly added in commit `33303da1` then removed once probing confirmed it was unreachable. Orama's hybrid implementation already does the right thing.

### 16. `cmdRebuild` stdin left in flowing mode — Low — **RESOLVED**

**Location:** `src/knowledge/index.js` `cmdRebuild`.
**Description:** After `process.stdin.resume()`, stdin stays flowing. Irrelevant for CLI but leaks if called as library.
**Mitigation:** `process.stdin.pause()` after reading the line.

### 17. Bulk discovery misses work units not in project manifest — **WITHDRAWN**

**Location:** `src/knowledge/index.js` `discoverArtifacts` → `manifest list`.
**Original claim:** `manifest list` reads from the project manifest, not the filesystem. Legacy work units invisible to bulk index.
**Why withdrawn:** The Tick-project data that motivated this entry (9 dirs on disk, 1 registered) was the result of a one-off project-manifest corruption bug — not a systemic code issue. Migration 031 already populates the registry from the filesystem; once it has run, the registry is authoritative and reading it directly is correct. Work units are created via `manifest init`, which registers them atomically. A work unit that exists on disk but not in the registry is either mid-migration or the registry has been corrupted externally — neither is something `manifest list` should paper over.

---

## Phase 5 (Skill Integration) — Deferred

### 18. Knowledge removal has no automatic retry on failure — Medium — **RESOLVED**

**Location:** `skills/workflow-start/references/manage-work-unit.md` (cancellation), `skills/workflow-specification-process/references/spec-completion.md` (supersession), `skills/workflow-specification-process/references/promote-to-cross-cutting.md` (promotion).
**Description:** When `knowledge remove` fails (store locked, CLI error), the skill displays a warning and tells the user to retry manually. Unlike indexing failures — which have a pending queue for automatic catch-up on the next `index` call — removal failures have no retry mechanism. Stale chunks from cancelled/superseded/promoted work persist in the knowledge base until the user manually runs `knowledge remove`.
**Why deferred:** Removal failures are rare (store lock is the main scenario), and stale chunks cause noise but not corruption. The pending queue design (Phase 4) was scoped to indexing only.
**Mitigation:** Add a pending-removal queue analogous to the pending-index queue. On each `knowledge remove` or `knowledge compact` invocation, process queued removals first.

---

## How to use this file

- Add new entries as you review code across any phase.
- Keep it short — one paragraph per entry, not a design doc.
- When working in an area, scan this file first for owned deferred items.
- Move resolved entries to a `## Resolved` section with the commit SHA, or delete them if the PR closed the item cleanly.
