---
topic: freshness-dual-write
status: concluded
work_type: greenfield
date: 2026-01-19
---

# Discussion: Freshness Check & Dual Write Implementation

## Context

Tick uses a dual-storage architecture:
- **JSONL** (`tasks.jsonl`) - Source of truth, committed to git
- **SQLite** (`.cache/tick.db`) - Query cache, gitignored

This design gives us git-friendly storage (JSONL) with fast querying (SQLite). But it introduces a synchronization problem: how do we keep them in sync, and what happens when they diverge?

The research phase proposed:
- Freshness checks on read (compare hash/mtime)
- Dual writes on mutations (write to both atomically)
- Full file rewrite for updates

### References

- [Research: exploration.md](../research/exploration.md) (lines 150-173)

## Questions

- [x] Hash vs mtime for freshness detection?
      - What are the trade-offs?
      - Cross-platform considerations?
- [x] How to handle partial write failures?
      - What if JSONL write succeeds but SQLite fails?
      - What if the reverse happens?
- [x] Is full file rewrite acceptable for updates?
      - Performance implications?
      - Data integrity concerns?
- [x] What triggers a cache rebuild?
      - Only freshness mismatch, or other scenarios?
- [x] How do we ensure data integrity on writes?
      - File locking?
      - Atomic operations?

---

## Hash vs mtime for freshness detection?

### Context

On every read operation, we need to check if the SQLite cache is stale. Two approaches: compare file modification time (mtime) or compute a content hash.

### Options Considered

**Option A: mtime comparison**
- Pros: Fast (single stat call), no I/O beyond metadata
- Cons: Can miss changes (same-second edits, clock skew, git operations can preserve mtime)

**Option B: Content hash (MD5/SHA256)**
- Pros: Definitive - if content changed, hash changed
- Cons: Must read entire file to compute, O(n) on file size

**Option C: Hybrid (mtime + size, hash on mismatch)**
- Pros: Fast path for common case, definitive when needed
- Cons: More complex, still vulnerable to mtime issues

### Journey

Initial instinct was mtime for speed, but on reflection the edge cases are problematic for an agent-first tool:
- Git operations can mess with mtime
- Fast agents might edit within the same second
- Cross-platform consistency matters

The read cost argument fell apart when we realized: we're reading the file anyway on cache miss. Computing a hash on data already in memory is negligible.

### Decision

**Content hash (SHA256)**. Store hash in SQLite metadata table. On read: load JSONL into memory, compute hash, compare. If mismatch, rebuild from data already in memory (no double-read).

Trade-off accepted: Always read full file on every operation. Acceptable for expected file sizes (<1MB, <10ms).

---

## How to handle partial write failures?

### Context

A mutation (create, update, delete) needs to write to both JSONL and SQLite. What if one succeeds and the other fails?

### Options Considered

**Option A: JSONL-first, SQLite is just cache**
- Write JSONL first (with atomic temp+rename)
- Then update SQLite
- If SQLite fails: who cares, it rebuilds on next read anyway
- Pros: Simple, JSONL is already source of truth
- Cons: Next read pays rebuild cost

**Option B: True two-phase commit**
- Begin SQLite transaction
- Write temp JSONL
- Commit SQLite
- Rename JSONL
- Rollback SQLite if rename fails
- Pros: Both always in sync
- Cons: Complex, overkill?

**Option C: SQLite-first with JSONL regeneration**
- Write to SQLite first
- Generate JSONL from SQLite
- Pros: SQLite has better transaction support
- Cons: Inverts the source-of-truth model, JSONL becomes derived

### Journey

Initial concern: what if JSONL succeeds but SQLite fails? Two-phase commit seemed like the "proper" solution.

Key realization: SQLite is a cache, not a peer. It can always be rebuilt from JSONL. This inverts the problem - we don't need to prevent inconsistency, we need to detect and recover from it. Our freshness check already does this.

Follow-up question raised: "Do we update the hash every time?" - critical detail. If we don't update the stored hash after a successful JSONL write, every subsequent read would see a mismatch and trigger a rebuild.

**Resolution**: The hash update is part of the same SQLite transaction as the data update:
```sql
BEGIN;
INSERT INTO tasks (...) VALUES (...);
UPDATE metadata SET jsonl_hash = 'new_hash';
COMMIT;
```

If this transaction fails, we lose both the data update AND the hash update - which is correct. The next read will detect the mismatch (JSONL has new content, SQLite has old hash) and rebuild, applying the change that was "lost" in SQLite.

### Decision

**JSONL-first, SQLite is expendable cache.**

Mutation flow:
1. Read JSONL, compute hash, check freshness (rebuild if stale)
2. Apply mutation in memory
3. Write new JSONL (atomic temp+rename)
4. Update SQLite in single transaction: apply mutation + store new hash
5. If SQLite fails: log warning, continue - next read self-heals

Trade-off accepted: SQLite failure costs one rebuild on next read. Acceptable given simplicity gained.

---

## Is full file rewrite acceptable for updates?

### Context

The research proposed full file rewrite for updates. Concern raised: what about data integrity? What if writes fail mid-operation? Can we lose our source of truth?

Initial thought was append-only for creates, rewrite for updates. But this introduces complexity around detecting incomplete appends.

### Options Considered

**Option A: Append for creates, rewrite for updates**
- Pros: Fastest possible creates
- Cons: Two strategies, need to detect/handle incomplete appends

**Option B: Always full rewrite (atomic)**
- Pros: One strategy for all writes, simpler mental model
- Cons: Slightly slower creates (negligible at our scale)

**Option C: Append-only log with compaction**
- Pros: Never rewrite, all operations are appends
- Cons: Requires tombstones, versioning, compaction - complexity explosion

**Option D: SQLite as source of truth**
- Pros: ACID transactions, crash recovery built-in
- Cons: Binary file in git, inverts the model, still need JSONL export

### Journey

Concern raised: "What if the file gets corrupted and data is truncated? We can't lose our source of truth."

This triggered research into how other tools handle this:

**Findings from `eriner/jsonl` Go package:**
- JSONL is inherently power-loss resistant
- Each line is atomic - interrupted writes only corrupt that line
- Previous lines remain intact
- Package designed for "write-error recoverable" applications

**Findings from Taskwarrior:**
- Corruption issues stem from concurrent access without file locking
- Shell prompt integrations running parallel commands caused corruption
- Lesson: file locking is essential

**Key insight**: The atomic rename pattern solves rewrite safety:
1. Write complete new content to temp file
2. fsync (flush to disk)
3. `os.Rename(temp, target)` - atomic on POSIX
4. Original file is either old OR new, never half-written

This means full rewrite is actually *safer* than append, because:
- Append can leave incomplete line at end (detectable but messy)
- Atomic rename guarantees complete file or no change

### Decision

**Always use atomic rewrite for all operations.**

Write strategy:
1. Read current JSONL into memory
2. Apply mutation (create/update/delete)
3. Write complete new content to temp file
4. fsync temp file
5. `os.Rename(temp, tasks.jsonl)` - atomic
6. Update SQLite cache

Performance: ~500 tasks × ~200 bytes = 100KB. Write + fsync + rename is trivially fast.

Simplicity: One code path for all mutations. No special handling for appends vs rewrites.

### References

- [eriner/jsonl package](https://pkg.go.dev/github.com/eriner/jsonl) - power-loss resistant JSONL
- [Taskwarrior corruption issues](https://github.com/GothenburgBitFactory/taskwarrior/issues/2070) - concurrent access problems

---

## What triggers a cache rebuild?

### Context

When should we rebuild SQLite from JSONL?

### Options Considered

**Option A: Only on hash mismatch**
- Simple, covers the main case

**Option B: Hash mismatch + explicit command**
- `tick doctor` or similar for manual rebuild

**Option C: Hash mismatch + corruption detection**
- Auto-rebuild if SQLite queries fail

### Journey

Short discussion - the freshness check already covers the primary case. If hash mismatches, rebuild.

Additional scenarios:
- SQLite file deleted: hash lookup fails → rebuild
- SQLite corrupted: query fails → delete and rebuild
- Explicit `tick doctor`: force rebuild

### Decision

**Rebuild on:**
1. Hash mismatch (primary case)
2. SQLite file missing
3. SQLite query errors (delete and rebuild)
4. Explicit `tick doctor --rebuild` command

The freshness check is the gatekeeper. Everything else is error recovery.

---

## How do we ensure data integrity on writes?

### Context

Follow-up from the rewrite discussion. What mechanisms prevent corruption?

### Options Considered

**Option A: Atomic rename only**
- temp + fsync + rename pattern
- Sufficient for single-process use

**Option B: Atomic rename + file locking**
- Add `flock` to prevent concurrent access
- Handles multi-process scenarios

**Option C: Full database with transactions**
- Overkill, adds complexity we're trying to avoid

### Journey

Taskwarrior's corruption issues came from concurrent access. Even if we don't expect agents to run tick concurrently, defensive programming says we should handle it.

`github.com/gofrs/flock` is simple and battle-tested for file locking in Go.

### Decision

**Atomic rename + file locking.**

Every write operation:
1. Acquire exclusive lock on `.tick/lock` file
2. Read JSONL, compute hash, check freshness
3. Apply mutation
4. Write temp file, fsync, atomic rename
5. Update SQLite
6. Release lock

Every read operation:
1. Acquire shared lock (allows concurrent reads)
2. Read JSONL, compute hash, check freshness
3. Query SQLite
4. Release lock

Libraries:
- `github.com/gofrs/flock` for file locking
- `github.com/natefinch/atomic` for atomic writes (or hand-roll with os.Rename)

---

## Summary

### Key Insights

1. **SQLite is a cache, not a peer** - This realization simplified everything. We don't need two-phase commits or complex sync logic. JSONL leads, SQLite follows, mismatches self-heal.

2. **Atomic rename is the key to safe writes** - The temp + fsync + rename pattern gives us crash-safe writes without complex transaction logic.

3. **File locking prevents concurrent access bugs** - Learned from Taskwarrior's pain. Simple to add, prevents a class of corruption issues.

4. **Always hash, always rewrite** - Simpler than optimizing for edge cases. Performance is fine at expected scale.

### Current State

All questions resolved:
- Hash-based freshness detection
- JSONL-first with expendable SQLite cache
- Atomic rewrite for all mutations
- File locking for concurrent access safety

### Next Steps

- [ ] Proceed to specification phase
- [ ] Define exact file formats (JSONL schema, SQLite schema, metadata table)
- [ ] Define error handling behavior (what messages, what exit codes)
