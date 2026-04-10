# Phase 3: CLI Core

**Goal**: A working CLI that can index a single file into the store, query it with formatted output, and report readiness status — the minimum viable end-to-end path.

**Acceptance Criteria**:
- [ ] Config resolution works: system config + project config merge, env var lookup for API keys
- [ ] CLI dispatches commands correctly with proper flag parsing and error messages
- [ ] `manifest resolve` command returns correct file paths for all indexed phases (including research multi-file case)
- [ ] `knowledge index <file>` chunks, embeds (via provider), stores, and persists a single artifact file
- [ ] Re-indexing the same file replaces its previous chunks (identity key: work_unit + phase + topic)
- [ ] Provider mismatch detection refuses indexing when config differs from stored metadata
- [ ] `knowledge query` returns formatted results with provenance (phase, work_unit/topic, confidence, date)
- [ ] Query flags work: `--work-type`, `--phase`, `--work-unit`, `--limit`
- [ ] `similarity_threshold` read from config and passed to Orama on every query
- [ ] Post-processing re-ranking affects result order (work-unit proximity, confidence, recency)
- [ ] Stub mode query output includes `[keyword-only mode — configure embedding provider for semantic search]` note
- [ ] `knowledge check` returns "ready"/"not-ready" on stdout, always exit 0
- [ ] All CLI command tests pass (shell tests)

## Tasks

5 tasks.

1. Config resolution + provider instantiation + CLI entry point — two-level config reading (system + project), merge logic, env var resolution for API keys. Provider resolution from config: `provider: "stub"` → StubProvider, `provider: "openai"` → error until Phase 4, no provider/no API key → keyword-only mode (no embeddings). CLI command dispatch, flag parsing, error messages. Same pattern as manifest.cjs.
   └─ Edge cases: missing system config, missing project config, missing env var, unknown provider name, keyword-only mode fallback, unknown command, missing required flags

2. `manifest resolve` command — new command in manifest.cjs returning file paths for work_unit.phase.topic. Research returns multiple files. Includes test in test-workflow-manifest.sh.
   └─ Edge cases: research multi-file, non-existent work unit, non-existent phase

3. `index <file>` command — single-file indexing end-to-end: derive identity from file path, load config + provider + store, chunk file with phase config, embed chunks, remove existing chunks for identity key, insert new chunks, save store. Provider mismatch detection via metadata.json.
   └─ Edge cases: re-index same file (replace), provider mismatch refusal, file not in .workflows/ path, file for non-indexed phase

4. `query` command + output formatting + re-ranking — embed query text, hybrid search (or fulltext-only in stub mode), metadata filtering via flags, post-processing re-ranking (work-unit proximity, confidence, recency), formatted output with provenance. Similarity threshold from config.
   └─ Edge cases: zero results, stub mode note, work-unit proximity boost, all filters combined

5. `check` command + CLI shell tests — readiness check (directory + config + store exist), always exit 0. Shell test suite for all Phase 3 commands (check, index, query) testing stdout, stderr, exit codes against the built bundle.
   └─ Edge cases: partially initialised (directory exists but no store), corrupted store file
