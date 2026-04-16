# Knowledge Base — Deferred Issues

Cross-phase log of **non-blocking** issues, design debts, and code smells surfaced during review that are intentionally deferred. Blocking bugs are fixed immediately — they do not belong here.

Format: `### N. Title — Severity`

Each entry records: where, what, why it was deferred, and a mitigation idea. Circle back when working on the owning area.

---

## Phase 4 (CLI Complete) — Deferred

### 1. Index/rebuild TOCTOU on embedding dimensions — Critical-rare

**Location:** `src/knowledge/index.js` `indexSingleFile` lines ~400–450.
**Description:** Embeddings are computed using `effectiveProvider.dimensions()` BEFORE acquiring the lock. Inside the lock the store is reloaded but provider-state is not re-validated. If a concurrent `rebuild` recreates the store with different dimensions between embed and insert, `insertDocument` will fail or corrupt the vector index.
**Why deferred:** Requires concurrent rebuild during indexing — extremely rare in single-developer use. Phase 5+ skill orchestration will serialize.
**Mitigation:** Re-validate provider state inside the lock after store reload; abort if schema mismatch.

### 2. Pending queue unbounded growth on persistent failures — Medium

**Location:** `src/knowledge/index.js` `processPendingQueue` catch block.
**Description:** Items that fail catch-up retry stay in the queue forever. No max-retry counter, no eviction. If failure is permanent (renamed work unit, malformed file), each bulk run wastes 3 OpenAI calls per item indefinitely.
**Mitigation:** Add `attempts` counter to pending entry; evict at 10 with stderr warning.

### 3. Rebuild has no rollback — Medium

**Location:** `src/knowledge/index.js` `cmdRebuild`.
**Description:** Deletes `store.msp` and `metadata.json` BEFORE running bulk index. If bulk index throws (network down, OpenAI outage), left with no store, no metadata.
**Mitigation:** Move old files to `.bak` suffix; restore on bulk-index failure.

### 4. `getWorkUnitMeta` / `discoverArtifacts` / `runManifest` swallow all errors — Medium

**Location:** Multiple helpers in `src/knowledge/index.js`.
**Description:** Catch-alls return null/empty on manifest CLI failure. Hides broken MANIFEST_JS path, corrupt manifest JSON, etc. Compact and status consistency checks silently skip work units; bulk index reports "0 files" on broken manifest.
**Mitigation:** Distinguish exit-code-1 (key not found) from other errors; surface unexpected errors to stderr at minimum.

### 5. `MANIFEST_JS` fallback resolves silently to non-existent path — Medium

**Location:** `src/knowledge/index.js` MANIFEST_JS constant (~line 26).
**Description:** If neither candidate path exists, fallback resolves to a path that doesn't exist. `execFileSync` throws ENOENT, caught silently in `discoverArtifacts`, returning empty array. Bulk index becomes a silent no-op.
**Mitigation:** Throw at module load if MANIFEST_JS doesn't resolve to an existing file.

### 6. Status shells manifest CLI per spec topic — Low (perf)

**Location:** `src/knowledge/index.js` `cmdStatus` superseded-spec consistency check.
**Description:** N node processes spawned for N spec topics. Status slow on repos with many specs (~5s for 50 topics).
**Mitigation:** Cache full manifest once per status invocation; read spec statuses from the cached object.

### 7. `--work-unit` filter vs boost semantics — Low (UX)

**Location:** `src/knowledge/index.js` `cmdQuery`.
**Description:** `--work-unit` is a re-rank proximity boost, not a hard filter. Inconsistent with `--phase`/`--work-type`/`--topic` which are filters. Usage text was updated to clarify, but inconsistency remains.
**Mitigation:** Phase 5+: introduce separate `--boost-work-unit` and let `--work-unit` filter; or add `--scope work-unit:foo` syntax.

### 8. Migration `report_update` called unconditionally — Low

**Location:** `skills/workflow-migrate/scripts/migrations/036-completed-at.sh` (and pattern from 035).
**Description:** `report_update` is called even when 0 work units were modified. Inflates orchestrator counter; may trigger false "review changes" prompt.
**Mitigation:** Cross-migration cleanup — have node script exit 2 when nothing modified; bash dispatches `report_update` vs `report_skip` on exit code.

### 9. `withRetry` swallows programming errors like network errors — Low

**Location:** `src/knowledge/index.js` `withRetry`.
**Description:** A `TypeError` from a typo is retried 3× with 7s of sleep before rethrow. Wastes time during development.
**Mitigation:** Discriminate error types — don't retry `TypeError`/`ReferenceError`/`SyntaxError`.

### 10. `indexSingleFile` stack trace lost in pending queue — Low

**Location:** `src/knowledge/index.js` `cmdIndexBulk` catch block.
**Description:** `addToPendingQueue(item.file, err.message)` saves only the message, not the stack. Debugging relies on stderr which users may not capture.
**Mitigation:** Accept and write a bounded stack snippet; or always `console.error(err.stack)` before queueing.

### 11. KEYWORD_ONLY_DIMENSIONS = 1536 silent provider lock-in — Medium (UX)

**Location:** `src/knowledge/index.js` `cmdIndex` / case 4 of `resolveProviderState`.
**Description:** User first indexes without provider (keyword-only, schema dims=1536). Later configures OpenAI (also 1536 dims). Subsequent `knowledge index` calls silently stay keyword-only. Only `knowledge status` warns. User must know to run `rebuild`.
**Mitigation:** Print upgrade note on `cmdIndex` when entering case 4 with a provider now configured.

### 12. OpenAIProvider mutates `res.data` in place — Low (style)

**Location:** `src/knowledge/providers/openai.js` `embedBatch`.
**Description:** `.sort()` mutates. Response used only locally so no observable effect.
**Mitigation:** Use `[...res.data].sort(...)`.

### 13. OpenAIProvider `embed()` assumes non-empty `res.data[0]` — Low

**Location:** `src/knowledge/providers/openai.js` ~line 45.
**Description:** If OpenAI returns `{ data: [] }` throws non-descriptive TypeError. Not observed in practice (OpenAI returns 400 for empty inputs).
**Mitigation:** Guard and throw a provider-specific error.

### 14. Project config cannot unset system config field — Low

**Location:** `src/knowledge/config.js` `loadConfig` merge loop.
**Description:** `Object.assign`-style merge only copies defined values; setting project `model: undefined` cannot unset a system `model: "x"` default.
**Mitigation:** Treat explicit `null` as unset sentinel in the merge.

### 15. `searchHybrid` similarity threshold may drop strong text-only matches — Low

**Location:** `src/knowledge/store.js` `searchHybrid`.
**Description:** Orama applies `similarity` as a filter on hybrid results; zero vector matches can mask strong BM25 matches.
**Mitigation:** Phase 5+ retrieval tuning — fall back to text-only if hybrid returns 0.

### 16. `cmdRebuild` stdin left in flowing mode — Low

**Location:** `src/knowledge/index.js` `cmdRebuild`.
**Description:** After `process.stdin.resume()`, stdin stays flowing. Irrelevant for CLI but leaks if called as library.
**Mitigation:** `process.stdin.pause()` after reading the line.

### 17. Bulk discovery misses work units not in project manifest — Medium

**Location:** `src/knowledge/index.js` `discoverArtifacts` → `manifest list`.
**Description:** `manifest list` reads from the project manifest, not the filesystem. Work units created before the project manifest system (legacy) are invisible to bulk index and status unindexed-artifact detection. Real-data testing on Tick showed 9 work units on disk but only 1 registered in project manifest → only 2 files indexed.
**Mitigation:** Fall back to filesystem scan (like `manifest list` already does when project manifest has no `work_units` key) or add a "register all" migration.

---

## Phase 5 (Skill Integration) — Deferred

### 18. Knowledge removal has no automatic retry on failure — Medium

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
