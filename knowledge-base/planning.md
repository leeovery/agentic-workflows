# Plan: Knowledge Base

Specification: [design.md](design.md)

## Phases

### Phase 1: Build Pipeline + Store Fundamentals

**Goal**: Prove esbuild bundling works with Orama and MsgPack, and establish a working store that can create documents, insert them with vectors, search across all modes (fulltext, vector, hybrid), persist to disk via MsgPack, and reload with identical results.

**Acceptance Criteria**:
- [ ] `npm run build` produces a single CJS bundle under 200KB at `skills/workflow-knowledge/scripts/knowledge.cjs`
- [ ] `__dirname` in the bundled output resolves to the script's directory (not the source directory)
- [ ] `.gitignore` updated: `node_modules/`, `.workflows/.knowledge/store.msp`
- [ ] Orama store can be created with the schema from the design doc
- [ ] Documents with all enum fields + vector can be inserted and retrieved
- [ ] Fulltext (BM25), vector, and hybrid search all return ranked results
- [ ] Metadata filtering via `where` clause works on enum fields (phase, work_type, etc.)
- [ ] MsgPack serialize/deserialize round-trip preserves all data (document counts match, search results identical)
- [ ] File locking prevents concurrent write corruption (wx flag, stale detection, timeout)
- [ ] StubProvider returns deterministic vectors from text input (same input = same vector, never null)
- [ ] `metadata.json` tracks provider, model, dimensions, and last-indexed timestamps
- [ ] All store unit tests pass

---

### Phase 2: Chunking Engine

**Goal**: A pure-function markdown chunker driven by per-phase JSON configs that splits workflow artifacts at natural semantic boundaries, testable with real artifact fixtures and zero external dependencies.

**Acceptance Criteria**:
- [ ] Generic engine reads a chunking config and splits markdown into chunks accordingly
- [ ] All 4 phase configs exist (research, discussion, investigation, specification) with validated settings from the design doc
- [ ] Primary split on H2, fallback to H3 for oversized sections
- [ ] Special sections handled: `own-chunk`, `skip`, `merge-up`
- [ ] YAML frontmatter stripped before chunking
- [ ] Empty sections skipped
- [ ] Files below `keep_whole_below` threshold stay whole
- [ ] Code blocks containing markdown headings do not trigger false splits
- [ ] Test fixtures cover all 4 indexed phases with edge cases
- [ ] All chunker unit tests pass

---

### Phase 3: CLI Core

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

---

### Phase 4: CLI Complete

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

---

### Phase 5: Skill Integration

**Goal**: Wire the knowledge base into all workflow skills so that it checks readiness, compacts on entry, indexes on phase completion, and removes on cancellation/supersession.

**Acceptance Criteria**:
- [ ] Step 0 of all entry-point skills runs `knowledge check` (after migrations)
- [ ] Hard stop reference file displayed when knowledge base is not set up
- [ ] Step 0 runs `knowledge compact` after check passes
- [ ] Phase-completion steps in processing skills for indexed phases run `knowledge index <file>`
- [ ] Manage menu cancellation runs `knowledge remove --work-unit`
- [ ] Specification supersession/promotion runs `knowledge remove` for affected topic
- [ ] `allowed-tools` frontmatter updated across all affected skills (~30 files)

---

### Phase 6: Retrieval Integration

**Goal**: Make the knowledge base user-facing through the three-layer integration pattern so Claude queries it autonomously during workflow phases.

**Acceptance Criteria**:
- [ ] Knowledge SKILL.md exists (Layer 1 — API documentation, commands, output format)
- [ ] Per-phase usage reference files exist (Layer 2 — trigger heuristics contextualised per phase)
- [ ] Inline callouts added at pertinent points in processing skills (Layer 3 — nudges)
- [ ] Contextual query at phase start for research, discussion, and investigation
- [ ] Planning entry cross-cutting query replaces existing manual approach
- [ ] Two-step retrieval pattern documented (chunks with provenance -> source file deep dive)

---

### Phase 7: Setup Wizard

**Goal**: An interactive first-time setup experience that handles system config, project init, and initial indexing in one flow.

**Acceptance Criteria**:
- [ ] `knowledge setup` wizard creates system config at `~/.config/workflows/config.json`
- [ ] Wizard creates project knowledge base at `.workflows/.knowledge/`
- [ ] Provider validation: test embed call to verify API key works
- [ ] Initial indexing of all existing completed artifacts
- [ ] Stub mode path when user skips API key
- [ ] Skips already-completed steps (idempotent)

---

### Phase 8: Release Process

**Goal**: Formalize the esbuild build step into the release pipeline so the bundled knowledge.cjs is always up-to-date when tags are created.

**Acceptance Criteria**:
- [ ] Build step produces `knowledge.cjs` from source before tagging
- [ ] Release script or CI workflow includes the build
- [ ] Bundled output is committed and present in tagged releases
- [ ] `node_modules/` remains gitignored (dev dependency only)
