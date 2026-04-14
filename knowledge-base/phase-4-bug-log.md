# Phase 4 Bug Log

Append-only log of bugs, logic errors, and concerns surfaced during review of Phase 4 (knowledge base CLI complete). Each entry: severity, location, description, status, and resolution notes.

Format: `### N. Title — Severity (status)`

Status values: `fixed`, `noted-deferred`, `wontfix`, `verifying`.

---

## First Review Pass (initial self-review)

### 1. OpenAI `dimensions` parameter not sent to API — High (fixed)

**Location:** `src/knowledge/providers/openai.js` `embed()`, `embedBatch()` request bodies.
**Description:** Constructor accepted `dimensions` and `dimensions()` returned it, but the API request body never included `dimensions`. With non-default config (e.g., `dimensions: 256`), OpenAI returned full 1536-d vectors causing schema/store mismatches.
**Resolution:** Added `dimensions: this._dimensions` to all three JSON.stringify call sites (single embed, single batch, chunked batch).
**Commit:** `16cc818`

### 2. `byWorkType` computed but never displayed in status — Medium (fixed)

**Location:** `src/knowledge/index.js` `cmdStatus`.
**Description:** Status command computed work-type breakdown but only rendered work-unit and phase sections. Design doc explicitly required "by work unit, phase, work type."
**Resolution:** Added "By work type:" output section.
**Commit:** `16cc818`

### 3. Compact output bullets used `- ` instead of `•` — Low (fixed)

**Location:** `src/knowledge/index.js` `cmdCompact` (both dry-run and live output paths).
**Description:** Design doc spec format uses `•` bullets; CLAUDE.md display conventions also mandate `•`.
**Resolution:** Changed both paths to use `•`.
**Commit:** `16cc818`

---

## Second Review Pass (adversarial bug hunt)

### 4. `--topic` query filter silently ignored — High (fixed)

**Location:** `src/knowledge/index.js` `cmdQuery` where-clause construction.
**Description:** `options.topic` was parsed but never added to the Orama where clause. Users passing `--topic billing` got results from all topics.
**Resolution:** Added topic filter to where clause with comma-separated multi-value support matching `--phase`/`--work-type` pattern. Added Test 70.
**Commit:** `a65a023`

### 5. Empty source file silently wipes existing indexed chunks — High (fixed)

**Location:** `src/knowledge/index.js` `indexSingleFile`.
**Description:** When `chunks.length === 0`, the function still ran `removeByIdentity` inside the lock without inserting replacements. An accidentally-empty (or post-edit blank) artifact would silently delete prior indexed content for that topic.
**Resolution:** Throws clear error before lock acquisition directing user to `knowledge remove` if intentional. Added Test 71.
**Commit:** `a65a023`

### 6. Compact `completed_at` parsing timezone bug — High (fixed)

**Location:** `src/knowledge/index.js` `cmdCompact` date math.
**Description:** `new Date("YYYY-MM-DD")` parses as UTC midnight, but `new Date()` (used for `now`) is local time. With short decay windows (especially `decay_months=0`), a topic completed today in local time could be marked expired, causing premature data loss for users east of UTC.
**Resolution:** Added `parseLocalDate(str)` helper that constructs Date from local Y/M/D components. Falls back to default Date parsing for ISO timestamps with time component.
**Commit:** `a65a023`

### 7. First-ever bulk index failure dropped from pending queue — High (fixed)

**Location:** `src/knowledge/index.js` `addToPendingQueue`.
**Description:** Function early-returned if `metadata.json` didn't exist. If the FIRST-EVER bulk index attempt hit failures (e.g., network burst on initial setup), failures were not queued for catch-up — silent data loss of failure tracking.
**Resolution:** Now creates a minimal metadata file (with `provider: null`, etc.) so failure tracking works from the very first invocation. Added Test 72.
**Commit:** `a65a023`

### 8. `--work-unit` usage text misleading — Low (fixed)

**Location:** `src/knowledge/index.js` USAGE constant.
**Description:** Usage text said "Filter by work unit" but the implementation only used it as a re-rank proximity boost. Phase 3 Test 31 depends on this boost-not-filter behaviour, so the implementation is correct — only the doc was wrong.
**Resolution:** Updated usage to "Re-rank boost for this work unit (not a filter)".
**Commit:** `a65a023`

---

## Issues Noted but Deferred

### 9. Index/rebuild TOCTOU on embedding dimensions — Critical (noted-deferred)

**Location:** `src/knowledge/index.js` `indexSingleFile` lines ~395-435.
**Description:** Embeddings are computed using `effectiveProvider.dimensions()` BEFORE acquiring the lock. Inside the lock, the store is reloaded but the provider-state check is not re-run. If a concurrent `rebuild` recreates the store with different dimensions between embed and insert, `insertDocument` will fail or corrupt the vector index.
**Why deferred:** Requires concurrent rebuild during indexing — extremely rare in single-developer use. Phase 5+ skill orchestration may serialize these operations.
**Mitigation idea:** Re-validate provider state inside the lock after reload; abort if mismatch.

### 10. Pending queue unbounded growth on persistent failures — Medium (noted-deferred)

**Location:** `src/knowledge/index.js` `processPendingQueue` catch block.
**Description:** Items that fail catch-up retry stay in the queue forever with no max-retry counter. If failure is permanent (renamed work unit, malformed file), each bulk run wastes 3 OpenAI calls per item indefinitely.
**Why deferred:** Acceptable for Phase 4. Need a `retry_count` field on pending entries with eviction after N total attempts.
**Mitigation idea:** Add `attempts` counter to pending entry; evict at 10 with a stderr warning.

### 11. Rebuild has no rollback — Medium (noted-deferred)

**Location:** `src/knowledge/index.js` `cmdRebuild`.
**Description:** Deletes `store.msp` and `metadata.json` BEFORE running bulk index. If bulk index throws (network down, OpenAI outage), system left with no store and no metadata.
**Why deferred:** Destructive by design and documented in confirmation prompt. User can re-run rebuild.
**Mitigation idea:** Move old files to `.bak` suffix; restore on bulk-index failure.

### 12. `getWorkUnitMeta` swallows all errors — Medium (noted-deferred)

**Location:** `src/knowledge/index.js` `getWorkUnitMeta`.
**Description:** Catches all manifest CLI failures and returns null. Hides bugs in MANIFEST_JS path resolution, broken manifest CLI, etc. Compact and status consistency checks silently skip work units.
**Why deferred:** Returning null is the right behaviour for orphans; need to differentiate orphan from CLI-broken.
**Mitigation idea:** Distinguish exit code 1 (key not found) from other errors; surface unexpected errors.

### 13. `MANIFEST_JS` fallback resolves to non-existent path silently — Medium (noted-deferred)

**Location:** `src/knowledge/index.js` MANIFEST_JS constant.
**Description:** If neither candidate path exists, MANIFEST_JS resolves to the fallback (which doesn't exist). `execFileSync` throws ENOENT, caught silently in `discoverArtifacts`, returning empty array. Bulk index becomes a silent no-op.
**Why deferred:** Both candidate paths cover all known deployment shapes. Worth adding a startup assertion.
**Mitigation idea:** Throw at module load if MANIFEST_JS doesn't resolve to an existing file.

### 14. Manifest CLI shelled per spec topic in status — Low (noted-deferred)

**Location:** `src/knowledge/index.js` `cmdStatus` superseded-spec consistency check.
**Description:** N node processes spawned for N spec topics. Status is slow on repos with many specs.
**Why deferred:** Acceptable at typical scale (10-50 topics).
**Mitigation idea:** Cache full manifest for each work unit once per status invocation.

### 15. `--work-unit` filter ambiguity (semantics) — Low (noted-deferred)

**Location:** Phase 3 design — `cmdQuery` `--work-unit` flag.
**Description:** Implementation treats it as a re-rank boost while `--phase`/`--work-type` are hard filters. Inconsistent UX — users may expect filter behaviour.
**Why deferred:** Phase 3 design decision; changing semantics now would break Test 31 and existing assumptions. Updated USAGE to clarify (issue #8).
**Mitigation idea:** Phase 5+: introduce separate `--boost-work-unit` and let `--work-unit` filter; or add `--scope work-unit:foo` syntax.

### 16. Migration 036 calls `report_update` even when 0 work units modified — Low (noted-deferred)

**Location:** `skills/workflow-migrate/scripts/migrations/036-completed-at.sh`.
**Description:** Pre-existing pattern from migration 035. Inflates orchestrator counter, may trigger false "review changes" prompt.
**Why deferred:** Matches existing codebase pattern. Should be fixed as a cross-migration cleanup pass.

---

## Third Review Pass (adversarial deep-dive: locks, stdin, identity, path safety)

### 17. `indexSingleFile` metadata lost-update — clobbers concurrent pending entries — High (fixed)

**Location:** `src/knowledge/index.js` `indexSingleFile` lines ~376 (load) and ~466-468 (write).
**Description:** `metadata` is loaded OUTSIDE the lock and then written INSIDE the lock. Any `addToPendingQueue` or other metadata mutation that happens between the load and the lock-protected write is silently overwritten. Classic read-modify-write race on `pending[]` and `last_indexed`.
**Resolution:** Re-read metadata inside the lock just before writing; preserve `pending[]` from the fresh read and merge updates to other fields.

### 18. `cmdRebuild` has no lock — races concurrent operations — High (fixed)

**Location:** `src/knowledge/index.js` `cmdRebuild`.
**Description:** `fs.unlinkSync(sp)` and `fs.unlinkSync(mp)` execute without acquiring `lockFilePath()`. A concurrent `knowledge index`/`remove`/`compact` could be holding the lock mid-write; rebuild races past the lock and deletes files that the other process is about to `saveStore` into. The other process then resurrects a stale/partial store.
**Resolution:** Acquire the lock around the unlink+initial bulk-index-setup. Release before the per-file loop (since indexSingleFile re-acquires per file).

### 19. `addToPendingQueue` / `removePendingItem` — read-modify-write without lock — High (fixed)

**Location:** `src/knowledge/index.js` pending queue helpers.
**Description:** Both read `metadata.json`, mutate in memory, write back. No lock. Concurrent bulk indexes can lose pending entries. `processPendingQueue` compounds the issue by reading metadata pre-lock and writing via nested `indexSingleFile` that takes the lock.
**Resolution:** Wrap both helpers in `store.withLock`. This also composes correctly with `indexSingleFile`'s lock since it's the same lock file.

### 20. `cmdRebuild` stdin `once('data')` fails on partial chunks — High (fixed)

**Location:** `src/knowledge/index.js` `cmdRebuild`.
**Description:** `once('data', ...)` resolves on the first chunk received. A user typing slowly or a non-line-buffered stdin can deliver `"re"` then `"build\n"` as two events — the first chunk `"re"` fails the comparison, aborting incorrectly. TTY usually line-buffers but this is not guaranteed.
**Resolution:** Accumulate data events until newline or end; trim and compare full line.

### 21. `decay_months` type not validated — silent no-op or silent mass deletion — Medium (fixed)

**Location:** `src/knowledge/index.js` `cmdCompact`.
**Description:** If `decay_months` is a string (`"6"` from hand-edited JSON) → `setMonth(getMonth() - "6")` → NaN → Invalid Date → nothing expires (silent no-op). If negative (`-6`) → `setMonth(getMonth() - (-6))` → cutoff is 6 months in the future → all completed work units expire immediately (silent mass deletion).
**Resolution:** Validate as `false` OR non-negative integer. Error clearly on invalid values.

### 22. Path-traversal via `..` work_unit in `deriveIdentity` — Medium (fixed)

**Location:** `src/knowledge/index.js` `deriveIdentity` and `readWorkType`.
**Description:** The regex captures `[^/]+` which allows `..` or names starting with `.`. A crafted path like `.workflows/../some-escape/research/x.md` could match with `workUnit='..'` — then `readWorkType` constructs `path.resolve(cwd, '.workflows', '..', 'manifest.json')` which escapes into parent directory. Low practical severity for a local tool but a concrete escape hatch.
**Resolution:** Reject `workUnit` equal to `.`, `..`, or starting with `.`.

### 23. `KEYWORD_ONLY_DIMENSIONS = 1536` silent provider lock-in — Medium (noted-deferred)

**Location:** `src/knowledge/index.js` `cmdIndex` / `resolveProviderState` case 4.
**Description:** If user first indexes without provider (keyword-only, schema dimensions=1536), then later configures OpenAI (also 1536 dims), subsequent indexes silently stay keyword-only. Only `cmdStatus` warns the user; `cmdIndex` gives no indication. User must know to run `rebuild`.
**Why deferred:** The status command already surfaces this via the upgrade note. `cmdIndex` printing a hint on every invocation would be noisy. Worth revisiting: print upgrade note once per invocation of cmdIndex single-file mode.

### 24. `withRetry` swallows programming errors like network errors — Low (noted-deferred)

**Location:** `src/knowledge/index.js` `withRetry`.
**Description:** A `TypeError` from a typo is retried 3× with 7s total sleep, then thrown. Masks real bugs in dev.
**Why deferred:** Adds complexity (error type discrimination) for modest value. Programming errors surface reliably through the third throw.

### 25. `indexSingleFile` stack trace lost in pending queue — Low (noted-deferred)

**Location:** `src/knowledge/index.js` `cmdIndexBulk` catch block.
**Description:** `addToPendingQueue(item.file, err.message)` saves only the message, not the stack. Debugging relies on stderr output which users may not capture.
**Why deferred:** Stack traces bloat metadata.json. Stderr is the right place for them.

### 26. `discoverArtifacts` swallows JSON parse / manifest errors silently — Medium (noted-deferred)

**Location:** `src/knowledge/index.js` `discoverArtifacts`.
**Description:** If `manifest list` returns malformed JSON, `cmdIndexBulk` reports "Indexed 0 files" and exits 0 — false success. Same pattern in cmdStatus's unindexed probe.
**Why deferred:** Same class as issue #12 (`getWorkUnitMeta` error swallowing). Should be addressed as part of that cleanup pass — differentiate "topic doesn't exist" from "manifest CLI broken".

### 27. OpenAIProvider mutates `res.data` in place with `.sort()` — Low (noted-deferred)

**Location:** `src/knowledge/providers/openai.js` `embedBatch`.
**Description:** `.sort()` mutates the array. Response is used only locally so no observable effect. Code smell.
**Why deferred:** Cosmetic. No functional impact.

### 28. OpenAIProvider `embed()` assumes non-empty `res.data[0]` — Low (noted-deferred)

**Location:** `src/knowledge/providers/openai.js` line 45.
**Description:** If OpenAI returns `{ data: [] }` for an edge input, throws a non-descriptive `TypeError`.
**Why deferred:** OpenAI returns 400 for empty string inputs, which is caught by the _fetch error path. True empty `data` arrays are not observed.

### 29. Project config cannot unset a system config field — Low (noted-deferred)

**Location:** `src/knowledge/config.js` `loadConfig` merge loop.
**Description:** `Object.assign`-style merge only copies defined values; setting project `model: undefined` cannot unset a system `model: "x"` default.
**Why deferred:** Valid config design decision (explicit unset is not supported). Acceptable.

### 30. `searchHybrid` similarity-threshold may drop strong text-only matches — Low (noted-deferred)

**Location:** `src/knowledge/store.js` `searchHybrid` / Orama semantics.
**Description:** Orama applies `similarity` as a filter on hybrid results; zero vector matches can mask strong BM25 matches.
**Why deferred:** Phase 5+ retrieval-tuning concern. Not a bug per spec.

### 31. `cmdRebuild` stdin listeners leak in flowing mode — Low (noted-deferred)

**Location:** `src/knowledge/index.js` `cmdRebuild`.
**Description:** After `process.stdin.resume()` is called, stdin stays in flowing mode. Irrelevant for the CLI (process exits shortly after), but leaks if ever called as a library.
**Why deferred:** CLI-only entry point.

### 32. `discoverArtifacts` silent empty on bad MANIFEST_JS path — Medium (superseded by #13)

Same as #13 — same root cause, noted here only to confirm this pass rediscovered it.

---

## Items to verify in the next pass

- [ ] Lock semantics: audit again after the lock fixes (17, 18, 19) to ensure no introduced deadlocks
- [ ] Test coverage: concurrent-process tests for rebuild-vs-index race
- [ ] Test coverage: pending queue under concurrent bulk indexes
- [ ] Test coverage: rebuild confirm path (manual only — TTY required)
- [ ] Error swallowing audit for `getWorkUnitMeta`, `discoverArtifacts`, `runManifest`
- [ ] Store schema mismatch on load when .msp dimensions differ from provider
