# Phase 4: CLI Complete

**Goal**: Full CLI with all remaining commands, bulk operations, real embedding provider, and operational features (retry, compaction, status reporting).

**Acceptance Criteria**:
- [ ] OpenAI provider successfully embeds text via `/v1/embeddings` (single + batch)
- [ ] `completed_at` manifest migration backfills existing completed work units via file mtime
- [ ] `knowledge index` (no args) discovers and indexes all missing completed artifacts via manifest
- [ ] `knowledge remove` works at all granularity levels (work-unit / phase / topic)
- [ ] `knowledge compact` removes expired non-spec chunks based on decay TTL from `completed_at`
- [ ] Compaction never removes spec chunks or in-progress work unit chunks
- [ ] `--dry-run` on compact shows what would be removed without removing
- [ ] Retry mechanism: 3 attempts with backoff on both indexing and query failures
- [ ] Failed files logged to pending queue in metadata.json
- [ ] Catch-up: next successful index processes up to 5 pending items
- [ ] `knowledge status` reports: chunk counts, timestamps, store size, provider info, pending items, orphans, unindexed artifacts, mismatch warnings
- [ ] `knowledge rebuild` performs destructive reindex with interactive confirmation
- [ ] Batch queries: multiple terms merged, deduplicated by chunk ID
- [ ] All tests pass (unit + shell + opt-in integration test with real API)

## Tasks

6 tasks.

1. OpenAI embedding provider — implement KnowledgeProvider via Node fetch to /v1/embeddings endpoint. Single + batch embedding. Error handling for network, rate limits, invalid key. Opt-in integration test gated by env var.
   └─ Edge cases: rate limit retry, invalid API key error message, batch size limits (2048 per request)

2. `completed_at` manifest migration — new migration script adding completed_at field to work unit manifests. Backfill existing completed work units using latest artifact file mtime. Migration test following existing conventions.
   └─ Edge cases: completed work unit with no artifact files, already-has-completed_at (idempotent), work units in non-completed states skipped

3. `remove` command — remove chunks at three granularity levels: work-unit only (all chunks), work-unit + phase, work-unit + phase + topic. Uses store removal operations with appropriate where-clause scoping.
   └─ Edge cases: remove when no chunks match (no-op), granularity in epics (remove one topic's spec without affecting others)

4. Bulk index + retry/pending queue — `index` no-args mode: discover all completed artifacts via manifest, diff against store, index missing ones. Retry mechanism (3 attempts with backoff) wrapping both single-file and bulk indexing. Failed files logged to pending queue in metadata.json. Catch-up: next successful index processes up to 5 pending items.
   └─ Edge cases: partial failure during bulk index, pending queue items that fail again, catch-up budget (5 items max per invocation)

5. `compact` command — remove expired non-spec chunks based on decay TTL from work unit completed_at date. Specs never compacted. In-progress work units untouched. --dry-run mode. Summary output of what was removed.
   └─ Edge cases: decay_months set to 0 (immediate), decay_months set to false (disabled), no expired chunks (silent skip)

6. `status` + `rebuild` + batch queries + Phase 4 CLI tests — status: full health report (chunk counts, timestamps, store size, provider info, pending, orphans, unindexed, mismatch warnings). rebuild: destructive reindex with interactive confirmation (human-only). Batch queries: multiple terms merged and deduplicated by chunk ID. Comprehensive CLI shell tests for all Phase 4 commands.
   └─ Edge cases: status with empty store, rebuild interrupted mid-process, batch query deduplication when same chunk matches multiple terms
