---
topic: cache-schema-versioning
status: concluded
type: feature
work_type: bugfix
date: 2026-03-01
review_cycle: 2
finding_gate_mode: gated
sources:
  - name: cache-schema-versioning
    status: incorporated
---

# Specification: Cache Schema Versioning

## Specification

### Bug: Missing Schema Evolution in SQLite Cache

**Problem:** When the SQLite cache schema changes (e.g., new columns added to the `tasks` table), existing `cache.db` files become incompatible. `CREATE TABLE IF NOT EXISTS` silently succeeds on old schemas without adding missing columns, causing all cache-querying CLI commands to fail with errors like `no such column: t.type`.

**Root Cause:** The cache has a content-freshness model (SHA256 hash comparison) but no schema-freshness model. There is no mechanism to detect when the schema definition in code has diverged from the on-disk cache schema.

**Impact:** Critical — completely breaks the upgrade path for all existing users. Every CLI command fails until the user manually deletes `.tick/cache.db`.

### Fix: Schema Version Constant

Add a hard-coded schema version constant. Store it in the existing `metadata` table. Check it early in `ensureFresh()`, before any queries. If mismatched or missing, delete the cache file and rebuild from JSONL.

**Implementation:**

1. Add `const schemaVersion = 1` in `cache.go`
2. Early in `ensureFresh()`, query `metadata` for key `schema_version`
3. If missing or value differs from `schemaVersion` → close DB, delete cache file, reopen, force rebuild
4. In `Rebuild()`, store `schema_version` in the `metadata` table alongside `jsonl_hash`
5. Increment `schemaVersion` whenever `schemaSQL` changes in future

**Key design decisions:**
- Version check happens **before** `IsFresh()` to avoid querying a schema-incompatible cache
- Simple integer version, not a schema hash — explicit, conventional, no false triggers from whitespace changes
- No `ALTER TABLE` migrations — the cache is ephemeral by design, full rebuild is correct
- On a new cache the missing version triggers the same delete+rebuild path; the extra cycle is acceptable since cache creation is infrequent

**Files affected:**
- `internal/storage/cache.go` — add version constant, store version in metadata on rebuild, add version check function
- `internal/storage/store.go` — add version check early in `ensureFresh()`, trigger delete+rebuild on mismatch

**Testing requirements:**
- Cache with wrong schema version triggers delete + rebuild
- Cache with missing schema version (pre-versioning cache.db) triggers delete + rebuild
- Cache with matching schema version is preserved (no unnecessary rebuild)
- After version-triggered rebuild, queries succeed normally

### Dependencies

No prerequisites. This fix modifies existing cache lifecycle code (`internal/storage/cache.go`, `internal/storage/store.go`) with no dependencies on other systems or features. Implementation can begin immediately.

---

## Working Notes

Source: .workflows/investigation/cache-schema-versioning/investigation.md
