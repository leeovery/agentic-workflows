# Phase 1: Build Pipeline + Store Fundamentals

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

## Tasks

5 tasks.

1. Project scaffolding + esbuild validation — package.json, directory structure, esbuild config, build a minimal bundle importing Orama + MsgPack, verify it runs and `__dirname` resolves correctly
   └─ Edge cases: esbuild tree-shaking, bundle size exceeding 200KB, `__dirname` in CJS output

2. Embedding provider interface + StubProvider — define KnowledgeProvider interface (embed, embedBatch, dimensions), implement StubProvider with deterministic hash-based vectors
   └─ Edge cases: null vs undefined vector (Orama crashes on null), empty string input, batch with mixed inputs

3. Orama store — creation, insert, remove, fulltext search, filtering — create store with design doc schema, insert documents with all enum fields + vector, remove by identity key (work_unit + phase + topic), BM25 search, `where` clause filtering on enums
   └─ Edge cases: duplicate document IDs, empty store search, filtering on multiple enum fields simultaneously, remove when no documents match

4. Store persistence + file locking + metadata — MsgPack serialize/deserialize via Orama save()/load(), file locking (wx flag, stale detection, timeout), metadata.json for provider/model/dimensions tracking
   └─ Edge cases: corrupted store file, stale lock cleanup, Float32Array round-trip through MsgPack, concurrent write attempts

5. Store integration test — full round-trip: create → insert with StubProvider → save to disk → reload → search all three modes (fulltext, vector, hybrid) → verify identical results
   └─ Edge cases: search after reload matches search before save, metadata.json persists across reload
