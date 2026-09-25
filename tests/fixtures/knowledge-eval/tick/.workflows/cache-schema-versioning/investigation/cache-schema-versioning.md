---
topic: cache-schema-versioning
status: concluded
work_type: bugfix
date: 2026-03-01
---

# Investigation: Cache Schema Versioning

## Symptoms

### Problem Description

**Expected behavior:**
CLI commands (`tick ready`, etc.) query the SQLite cache and return results normally.

**Actual behavior:**
All CLI commands that query the cache fail with: `Error: failed to query tasks: SQL logic error: no such column: t.type (1)`

### Manifestation

- SQL logic error on every cache-querying CLI command
- Deterministic failure — not intermittent
- Caused by SQLite cache schema mismatch after recent feature additions introduced new columns (e.g., `type`)
- Pre-existing `cache.db` files lack columns expected by current code

### Reproduction Steps

1. Have a project with a `.tick/cache.db` created before the recent CLI enhancements
2. Run any tick command that queries the cache (e.g., `tick ready`)
3. Observe SQL logic error about missing column

**Reproducibility:** Always (when cache predates schema changes)

### Environment

- **Affected environments:** Any local environment with a stale cache.db
- **Platform:** All (darwin, linux)
- **User conditions:** Existing tick users who upgrade to the new version

### Impact

- **Severity:** Critical — tool is completely unusable until cache is manually deleted
- **Scope:** All existing users who upgrade
- **Business impact:** Breaks the upgrade path; users must know to manually delete `.tick/cache.db`

### References

- Recent commits added new columns to the SQLite schema (e.g., `type` column)
- Cache is designed to be ephemeral — rebuilt from JSONL source of truth

---

## Analysis

### Initial Hypotheses

User hypothesis: The cache.db is ephemeral and auto-rebuilt from JSONL. The fix should introduce a hard-coded schema version number. When the DB structure changes, increment the version. On startup, compare stored version vs expected — if mismatched, delete and rebuild.

### Code Trace

**Entry point:** `store.go:361` — `ensureFresh()` called on every Query/Mutate

**Execution path:**

1. `store.go:363-377` — Lazy init: `OpenCache(path)` → runs `schemaSQL` (`CREATE TABLE IF NOT EXISTS`)
   - **Key problem:** `CREATE TABLE IF NOT EXISTS` is a **no-op** when the table already exists. It does NOT add missing columns to an existing table. The old `tasks` table (without `type` column) passes this check silently.

2. `store.go:379` — `IsFresh(rawJSONL)` → queries `metadata` table for stored hash
   - `cache.go:233` — `SELECT value FROM metadata WHERE key = 'jsonl_hash'`
   - The `metadata` table exists in old schemas, so this succeeds.

3. **Two failure paths depending on whether JSONL has changed:**

   **Path A — JSONL unchanged (hash matches):**
   - `fresh = true`, no rebuild triggered
   - Control returns to the caller's query callback
   - Query references `t.type` → **BOOM: "no such column: t.type"**
   - Error surfaces from the query callback, outside cache management logic

   **Path B — JSONL changed (hash mismatch):**
   - `fresh = false`, `Rebuild()` called
   - `cache.go:173-184` — INSERT references `type` column: `INSERT INTO tasks (id, title, status, priority, description, type, ...)`
   - INSERT fails because old table schema lacks `type` column → **BOOM**
   - Error returns as "failed to rebuild cache" from `store.go:402-403`

**Key files involved:**
- `internal/storage/cache.go` — schema definition (line 13-61), OpenCache (line 69-82), IsFresh (line 229-243), Rebuild (line 94-227)
- `internal/storage/store.go` — ensureFresh (line 361-408), Query (line 254-267), Mutate (line 158-199)
- `internal/cli/list.go` — queries referencing `t.type` (lines 284-287, 307)

### Root Cause

SQLite's `CREATE TABLE IF NOT EXISTS` does not alter existing tables — it only creates tables that don't yet exist. When a new column (`type`) is added to the `tasks` table in `schemaSQL`, existing cache.db files with the old schema silently pass schema initialization but lack the new column. No mechanism exists to detect or handle schema evolution.

**Why this happens:** The cache was designed with a content-freshness model (SHA256 hash of JSONL data) but has no schema-freshness model. The system detects when data is stale but not when the schema itself is stale.

### Contributing Factors

- `CREATE TABLE IF NOT EXISTS` is deceptively silent — it succeeds regardless of column mismatches
- The existing corruption recovery (lines 380-394) catches `IsFresh()` query errors, but the `metadata` table exists in old schemas, so `IsFresh()` succeeds — the error surfaces later during actual queries or rebuilds
- No schema version tracking in the metadata table

### Why It Wasn't Caught

- Tests always start with a fresh temp directory (`t.TempDir()`), so tests never encounter a pre-existing cache with an old schema
- The bug only manifests during **upgrades** — a scenario not covered by unit tests
- `CREATE TABLE IF NOT EXISTS` masking the schema mismatch made this non-obvious

### Blast Radius

**Directly affected:**
- Every CLI command that queries the SQLite cache (all of them)
- Upgrade path for all existing users

**Potentially affected:**
- Any future schema changes will cause the same problem unless versioning is added

---

## Fix Direction

### Proposed Approach

Add a hard-coded schema version constant to the storage package. Store it in the `metadata` table on cache creation/rebuild. On `ensureFresh()` (or `OpenCache()`), check the stored version against the expected version. If mismatched, delete the cache file entirely and recreate from scratch.

**Implementation sketch:**
1. Add `const schemaVersion = 1` in `cache.go`
2. After opening the cache in `ensureFresh()`, query `metadata` for `schema_version`
3. If missing or mismatched → close, delete file, `OpenCache()`, force rebuild
4. On `Rebuild()`, store `schema_version` in metadata alongside the JSONL hash
5. Increment `schemaVersion` whenever `schemaSQL` changes

### Alternatives Considered

**Alternative 1:** Hash the `schemaSQL` string itself and compare
- Pros: Automatic — no manual version bumping needed
- Cons: Whitespace/comment changes trigger unnecessary rebuilds; harder to reason about
- Why not: Version number is simpler, more explicit, and conventional

**Alternative 2:** Use `ALTER TABLE ADD COLUMN` migrations
- Pros: Preserves existing cache data, faster than full rebuild
- Cons: Complex migration framework for an ephemeral cache; the cache is designed to be throwaway
- Why not: Over-engineered for an ephemeral cache that rebuilds in milliseconds

**Alternative 3:** Always delete and rebuild on startup
- Pros: Simplest possible fix
- Cons: Destroys the performance benefit of caching entirely; defeats the purpose of hash-based freshness
- Why not: Wasteful — most startups don't need a rebuild

### Testing Recommendations

- Test that a cache with a wrong/missing schema version triggers delete + rebuild
- Test that matching schema version preserves the cache (no unnecessary rebuild)
- Test that after version-triggered rebuild, queries succeed normally

### Risk Assessment

- **Fix complexity:** Low — small, localized change in cache.go and store.go
- **Regression risk:** Low — only affects the cache lifecycle, and cache is ephemeral by design
- **Recommended approach:** Regular release

---

## Notes

- The `metadata` table is the right place to store the version (already used for `jsonl_hash`)
- The version check should happen early in `ensureFresh()`, before `IsFresh()`, to avoid querying a schema-incompatible cache
- Future schema changes only require incrementing the `schemaVersion` constant
