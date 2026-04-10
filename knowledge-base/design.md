# Knowledge Base Design

Tracking document for the project-wide knowledge base feature. Captures design decisions, open questions, and architectural direction from initial discussions. Intended as the foundation for planning and implementation.

**Status**: Design complete. All review findings resolved. Technical feasibility verified. Ready for implementation planning.

## Implementation Phases (Suggested)

The feature is split into phases that build on each other. Each phase has a clear deliverable and can be reviewed before moving on. This phasing is a suggestion from the design discussion — if during planning a different breakdown makes more sense, that's fine. The key constraint is the dependency chain: Phase 2 depends on Phase 1, Phase 3 depends on Phase 2, Phase 4 depends on Phase 1 but is independent of Phases 2-3, Phase 5 is last.

**Phase 1: Foundation** — the knowledge CLI core, testable in isolation with no skill changes.
- esbuild bundling setup (validate first — highest implementation risk)
- Orama store + MsgPack persistence + file locking
- Generic markdown chunking engine + per-phase JSON configs
- Embedding provider interface + OpenAI driver + stub driver
- All CLI commands: `index`, `rebuild`, `remove`, `query`, `compact`, `check`, `status` (not `setup` — the interactive wizard is Phase 4)
- During Phase 1-3 development, the knowledge base is initialised manually (create directories, write config files, run `knowledge index`). No interactive wizard needed for dev/testing
- `completed_at` manifest schema migration (with file mtime backfill)
- `manifest resolve` command (new — returns file paths for work_unit + phase + topic)
- Testing: chunking unit tests, store unit tests, CLI command tests, mock provider

**Phase 2: Skill Integration** — wiring the knowledge base into the existing workflow skills.
- `knowledge check` in Step 0 of all entry-point skills (after migrations, before compaction)
- `knowledge compact` in Step 0 (after check passes)
- `knowledge index <file>` at phase completion in all indexed-phase processing skills
- `knowledge remove` on work unit cancellation (manage menu skill)
- `knowledge remove` on spec supersession/promotion (specification process skill)
- `allowed-tools` frontmatter changes across all skills (~30 files)
- Hard stop reference file for when knowledge base is not set up

**Phase 3: Retrieval Integration** — making the knowledge base user-facing.
- Knowledge SKILL.md (layer 1 — API documentation)
- Per-phase usage reference files (layer 2 — trigger heuristics contextualised per phase)
- Inline callouts at pertinent points in processing skills (layer 3 — nudges)
- Contextual query at phase start (research, discussion, investigation)
- Planning entry cross-cutting query replacement
- Two-step retrieval pattern documentation

**Phase 4: Setup Wizard** (independent of Phases 2-3, but requires Phase 1 CLI commands)
- `knowledge setup` interactive wizard
- System config creation (`~/.config/workflows/config.json`)
- Project init + initial indexing
- Stub mode path (skip API key)

**Phase 5: Release Process & Build Pipeline** (final phase — done after Phases 1-4 are complete)
- Local builds (esbuild run manually) are sufficient for development and testing throughout Phases 1-4.
- This phase formalises the build into the release process for shipping to users.
- The project currently has no build step. The release workflow (`release.yml`) goes: local release script → annotated tag → push → GitHub Actions runs tests → creates GitHub release.
- The knowledge CLI requires esbuild bundling (`src/knowledge/` + Orama + MsgPack → `skills/workflow-knowledge/scripts/knowledge.cjs`). The bundled output must be committed before tagging, since AGNTC installs from tags with no build step at install time.
- Introduce `package.json` at project root with dev dependencies: `@orama/orama`, `@msgpack/msgpack`, `esbuild`. `node_modules/` gitignored.
- Add a build script that runs esbuild and outputs to the skill directory.
- Decide where the build runs: in GitHub Actions (build → commit → tag) or locally via the release script. Either works.
- GitHub releases may no longer be needed (AGNTC uses tags, not releases). Consider simplifying.
- Also enables future minification of `manifest.cjs` and other scripts.

---

## Problem Statement

Workflow artifacts (research, discussions, specifications, plans, investigations, reviews) are isolated. Each phase operates in a silo — a discussion has no awareness of what was decided in other discussions, and work units have no visibility into artifacts from other work units.

This creates two concrete problems:

1. **Intra-work-unit isolation (immediate)**: Within an epic, discussion topics often build on each other. Discussion #3 has no visibility into decisions made in discussions #1 and #2. The user must manually remind Claude to check other discussions.

2. **Cross-work-unit isolation (long-term)**: Over months/years of using workflows on a project, hundreds of artifacts accumulate containing valuable context — decisions, rationale, rejected approaches, constraints discovered, dependencies identified. None of this is accessible to new work units without the user manually surfacing it.

### Why This Matters

The workflows are intended as a project-lifetime companion, not just a project-starter tool. The knowledge accumulated through research, discussion, investigation, and specification is the institutional memory of the project. Without a way to surface it, the same ground gets re-explored, the same dead ends get revisited, and decisions get made without the context that informed earlier related decisions.

### Why Summarization Won't Work

A core design constraint: **details matter**. The difference between "user identity is UUID-based" and "user identity is email-based" can easily be lost in summarization, but that detail is critical context for downstream decisions. Any solution must preserve full fidelity of the source material. No lossy compression anywhere in the pipeline.

This rules out:
- Living summary documents maintained by Claude
- Digest files that compress discussions into bullet points
- Any approach where the queryable content is a reduction of the source

---

## Alternatives Considered

Before settling on RAG, five approaches were evaluated:

**A. Search permission only** — just tell Claude it can search other discussions/research. No infrastructure. Relies on Claude recognising when to look. Rejected: Claude doesn't know what it doesn't know — it can only search when something *feels* relevant, which is the exact problem.

**B. Decision index** — when Discussion Map items move to `decided`, write a one-liner to a shared index file. Rejected: only captures explicit decisions, misses constraints, context, and rationale. Also requires a "write to index" step that could drift.

**C. Per-discussion summary** — generate a structured summary on completion (decisions, constraints, open questions). Rejected: summaries are lossy. "The difference between using a UUID and an email address for identity tracking could easily be lost in a summarisation. But that's really important information." Details matter — any summarisation reduces accuracy.

**D. Knowledge catalogue** — structured knowledge base with categories (decisions, constraints, assumptions, dependencies, terminology). Both research and discussion write to it. Rejected: heaviest to build and maintain, risk of staleness, overhead per discussion.

**E. Hybrid — lightweight index + search permission** — load Discussion Maps from completed discussions as the passive layer, give Claude permission to deep-dive into files. Initially the leading option but evolved into the full RAG approach when the user identified that: (a) cross-work-unit context matters as much as intra-work-unit, (b) the vocabulary gap problem (related concepts, different words) needs semantic search, and (c) summarisation/indexing won't work because details matter.

The RAG approach emerged as the only design that satisfies all three constraints: no information loss, semantic search across vocabulary gaps, and scalable to project-lifetime use.

---

## Solution: Retrieval-Augmented Knowledge Base

A RAG (Retrieval-Augmented Generation) system that stores all workflow artifacts at full fidelity, chunks them at semantically meaningful boundaries, embeds them for semantic search, and retrieves specific relevant chunks verbatim when needed.

### Why RAG Fits

The problem is: "can't load everything into context, can't summarize without losing detail." RAG solves exactly this — store everything, retrieve only what's relevant, present it word-for-word with provenance. No summarization anywhere in the pipeline.

Semantic search via embeddings also solves the vocabulary gap problem: a discussion about "rate limiting" can surface a prior discussion about "token refresh intervals" even though the words don't overlap. Keyword search alone can't do this.

---

## Architecture

### Storage

```
.workflows/.knowledge/
├── store.msp           # Orama index serialized as MsgPack binary (gitignored)
├── config.json         # embedding provider, chunking settings
└── metadata.json       # index state, last-indexed timestamps
```

**Vector store**: [Orama](https://github.com/oramasearch/orama) (`@orama/orama`) — a pure JavaScript full-text, vector, and hybrid search engine.

**Why Orama**:
- **Zero native dependencies** — pure JS, `npm install` just works on every platform. No node-gyp, no prebuilds, no compilation. Critical for a tool installed via `npx agntc add`
- **Built-in hybrid search** — BM25 keyword + vector similarity in a single query with configurable weights. Keyword search handles exact lookups ("UUID", "auth-flow"). Vector search handles semantic similarity ("rate limiting" finds "token refresh intervals"). One query, both capabilities
- **Metadata filtering across all search modes** — `where` clause works with fulltext, vector, and hybrid. Filter by phase, work_unit, work_type, confidence in the same query. The `enum` type is purpose-built for categorical metadata
- **Built-in faceting and grouping** — aggregate counts by phase, work_type, etc. alongside search results
- **Full TypeScript** — schema definitions produce inferred types for documents, search params, and filters
- **Plugin hooks** — `beforeInsert`, `afterSearch`, etc. for custom scoring (e.g., recency boost, work-unit proximity)
- **Built-in persistence** — `save()`/`load()` serializes the full index to a JS object. Written to disk via MsgPack (`@msgpack/msgpack`, zero-dependency pure JS) for compact, fast storage

**Alternatives evaluated**:
- **SQLite + sqlite-vec**: Familiar, disk-based (no full index load per invocation). Rejected: native C module requires node-gyp/prebuilds — install reliability concern for a tool distributed via `npx agntc add`. Would need to wire up hybrid search manually (combine FTS5 + sqlite-vec). Remains a viable future migration if Orama's memory-resident architecture becomes limiting at scale.
- **LanceDB**: Purpose-built file-based vector DB, Rust core, Node SDK. Rejected: native Rust bindings, same prebuilt concern as SQLite. Newer, less battle-tested. Clean API but the native dependency was the dealbreaker.
- Both alternatives would solve the per-invocation loading problem (disk-based query, no full index load). If compaction proves insufficient for scale management, migrating from Orama to SQLite is a known upgrade path — the driver pattern insulates the embedding provider but not the storage engine. A storage abstraction layer is not currently justified but could be added if needed.

**What we skip**: Orama's embeddings plugins (`plugin-embeddings` uses TensorFlow.js at ~100MB+, `plugin-secure-proxy` requires an Orama Cloud account). We generate embeddings ourselves via our driver pattern and pass pre-computed vectors on insert and search. Orama stores and queries — it doesn't need to know about our embedding provider.

**Orama schema**:
```js
const schema = {
  id: 'string',
  content: 'string',              // full text of the chunk — verbatim from artifact
  work_unit: 'enum',              // which work unit this came from
  work_type: 'enum',              // epic, feature, bugfix, quick-fix, cross-cutting
  phase: 'enum',                  // research, discussion, investigation, specification
  topic: 'enum',                  // topic within the work unit
  confidence: 'enum',             // low, low-medium, medium, high (derived from phase)
  // no superseded flag — superseded spec chunks are removed, not marked
  source_file: 'string',          // path to the source artifact
  timestamp: 'number',            // when the chunk was indexed (epoch ms)
  embedding: 'vector[N]',          // N = configured dimensions (default 1536 for OpenAI text-embedding-3-small)
}
```

**Example insert**:
```js
insert(db, {
  id: 'auth-flow-specification-auth-flow-001',
  content: 'User identity uses UUID v7. Email is a profile attribute, not an identifier.',
  work_unit: 'auth-flow',
  work_type: 'feature',
  phase: 'specification',
  topic: 'auth-flow',
  confidence: 'high',
  source_file: '.workflows/auth-flow/specification/auth-flow/specification.md',
  timestamp: Date.now(),
  embedding: [0.1, 0.2, ...],  // from OpenAI text-embedding-3-small
})
```

**Example hybrid search with filtering**:
```js
search(db, {
  mode: 'hybrid',
  term: 'user identity format',
  vector: { value: queryEmbedding, property: 'embedding' },
  where: {
    phase: { in: ['specification', 'discussion'] },
  },
  hybridWeights: { text: 0.4, vector: 0.6 },  // NOTE: verify exact API shape against targeted Orama version at implementation time
  limit: 10,
})
```

**Real-world project scale** (measured across 5 projects):

| Project | Stage | Indexable files | Est. chunks | Est. MsgPack store |
|---------|-------|----------------|-------------|-------------------|
| magic-pad | Early (research + discussion) | ~8 | ~40 | ~1-2 MB |
| folio | Early (research + discussion) | ~6 | ~30 | ~1 MB |
| agntc | Mature (completed epic + 4 features) | ~60 | ~300 | ~10 MB |
| portal | Active (10 work units) | ~80 | ~400 | ~15 MB |
| tick | Mature (completed epic + 9 features) | ~200 | ~1,000 | ~35 MB |

**Serialization benchmarks** (verified empirically at 1K/5K/8K chunks with 1536-dim vectors):

| Approach | 1K store | 8K store | 8K serialize | 8K deserialize |
|----------|---------|---------|-------------|---------------|
| JSON only | ~63 MB | ~502 MB | 2,935 ms | 2,013 ms |
| JSON + gzip | ~27 MB | ~219 MB | 19,028 ms | 2,983 ms |
| MsgPack only | ~30 MB | ~240 MB | 1,010 ms | 1,085 ms |
| MsgPack + gzip | ~19 MB | ~154 MB | 10,829 ms | 2,079 ms |

**MsgPack without gzip is the clear winner**: 3x faster serialize, 2x faster deserialize than JSON. Comparable size to JSON+gzip while being 19x faster to serialize. Both `@orama/orama` and `@msgpack/msgpack` are zero-dependency pure JS — the two libraries bundle to **90KB minified** (verified). With application code, the total `knowledge.cjs` is estimated at ~110-120KB minified.

**Performance at realistic scale** (with memory decay/compaction — see below):
- Active working set: 500-2,000 chunks (specs forever + recent research/discussion)
- Store size: ~15-60 MB (MsgPack)
- Deserialize: ~150-500ms per CLI invocation
- Vector search: brute-force linear scan, ~5-20ms per query
- Full-text search: sub-millisecond to low single-digit ms
- Memory: ~30-120 MB resident during operation

**Limitations accepted**:
- No partial document updates — `upsert` requires the full document including vector. Manageable with our document sizes
- Memory-resident — entire index loads into RAM per CLI invocation. Manageable at compacted scale (~500-2K chunks). Per-invocation load is ~150-500ms — acceptable in the context of Claude sessions where responses take 5-30s
- Cosine similarity only (hardcoded) — standard metric for our embedding models
- One vector property per search query — we only have one vector field

**Why not 8K+ chunks**: The 8K chunk scenario (240MB store, 1s+ deserialize) was a theoretical projection for a project running years without cleanup. Memory decay/compaction (see below) keeps the active index in the 500-2K range even for long-running projects. The 8K problem never materialises.

The knowledge base is a **derived index** — its source of truth is the markdown artifacts. However, it is **not safely reproducible**: re-embedding the same chunks produces slightly different vectors due to floating-point variance in embedding APIs, and edited artifacts produce different content than what was originally indexed. Chunking itself is deterministic (rule-based). The index should be treated as an important file, not a disposable cache.

### Embedding Provider

Uses a driver/strategy pattern. The knowledge system calls a generic `KnowledgeProvider` interface; the concrete implementation is resolved from config at runtime.

```
KnowledgeProvider (interface)
├── embed(text) -> vector
├── embedBatch(texts[]) -> vectors[]
└── dimensions() -> number

OpenAIProvider implements KnowledgeProvider
VoyageProvider implements KnowledgeProvider
// future providers just implement the interface
```

**Default provider**: OpenAI `text-embedding-3-small` (1536 dimensions). The content being indexed is natural language prose (decisions, rationale, constraints, discussion exchanges) — not code. OpenAI's small model handles general language well and the cost is negligible (~$0.02/1M tokens). Higher-quality models (OpenAI `text-embedding-3-large`, Voyage `voyage-code-3`) are available as alternatives but unlikely to be necessary for this domain.

**Other evaluated options**:

| Provider | Model | Dimensions | Cost | Notes |
|----------|-------|-----------|------|-------|
| OpenAI | text-embedding-3-small | 1536 (reducible) | ~$0.02/1M tokens | Default. Battle-tested, cheap, good general-purpose quality |
| OpenAI | text-embedding-3-large | 3072 (reducible) | ~$0.13/1M tokens | Higher quality, still cheap. Overkill for this use case |
| Voyage | voyage-3-large | 1024 | ~$0.18/1M tokens | Strong retrieval quality. Anthropic-owned |
| Voyage | voyage-code-3 | 1024 | ~$0.18/1M tokens | Tuned for code/technical docs. Better fit if content were code-heavy |

Adding a new provider is just implementing the `KnowledgeProvider` interface — no changes to chunking, storage, retrieval, or skill integration. Switching providers on an existing project requires a full rebuild (embeddings aren't compatible across providers/models).

**Batch embedding**: OpenAI's `/v1/embeddings` endpoint natively accepts an array of strings as input (up to 2048 inputs per request). The `embedBatch(texts[])` interface maps directly to this — one API call for multiple texts. Used during bulk indexing (`knowledge index` no args — which `knowledge setup` delegates to) and batch queries (`knowledge query "term1" "term2"`).

### Configuration Hierarchy

Two-level config: system defaults shared across projects, with per-project overrides.

**System-level** (`~/.config/workflows/config.json`):
```json
{
  "knowledge": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimensions": 1536,
    "api_key_env": "OPENAI_API_KEY"
  }
}
```

**Project-level** (`.workflows/.knowledge/config.json`):
```json
{
  "knowledge": {
    "provider": "openai",
    "model": "text-embedding-3-large",
    "dimensions": 3072
  }
}
```

**Resolution**: Project config inherits from system config and overrides what it specifies. API keys are always referenced by env var name (`api_key_env`), never stored directly — keeps secrets out of config files. The user sets the env var in their shell profile.

**Typical usage**: System config holds the API key reference and default provider. Most projects inherit everything. A project that needs a different model or provider overrides just that field.

**Complete config schema** (all valid fields):
```json
{
  "knowledge": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimensions": 1536,
    "api_key_env": "OPENAI_API_KEY",
    "similarity_threshold": 0.8,
    "decay_months": 6
  }
}
```
System config typically has all fields. Project config only overrides what differs (e.g., just `decay_months`).

### Knowledge Base is Required Infrastructure

The knowledge base is **required** — skills cannot proceed without it. But it is **user-initiated**, not automatically provisioned. This is a deliberate boundary: the knowledge base requires system-level configuration (API keys in `~/.config/workflows/`) that is outside the workflow system's remit to create automatically.

**Setup flow:**

1. **Entry-point skills check** — Step 0 runs `knowledge check` (lightweight, just checks if the store exists). If not initialised, a reference file displays a clear message explaining the knowledge base, why it's needed, and the exact command to run. Hard stop — same conventions as any terminal condition.
2. **User runs `knowledge setup`** outside Claude — interactive wizard that handles everything:
   - System config (`~/.config/workflows/config.json`): provider, model, API key env var, validation
   - Project init (`.workflows/.knowledge/`): directory, config, empty store
   - Initial indexing of all existing completed artifacts
   - Stub mode (keyword-only) if user skips the API key step
3. **User re-runs their workflow** — check passes, skill proceeds normally.

`knowledge setup` is the single entry point for all first-time setup. Interactive throughout — Claude cannot run it. Handles both system-level and project-level initialisation in one flow. If system config already exists, skips to project init. If everything exists, no-op.

**Existing users upgrading to this version will hit a hard stop** on their next workflow invocation until they run `knowledge setup`. This is a deliberate choice — the knowledge base is required infrastructure and there is no migration path that can auto-provision API keys. The hard stop is clear, the setup is a one-time cost, and the alternative (optional feature with conditional logic everywhere) was evaluated and rejected for complexity reasons.

**Quality scales with provider configuration:**

| Mode | Trigger | Search Capability | Limitations |
|------|---------|------------------|-------------|
| **Stub (keyword-only)** | No embedding API key configured | BM25 full-text search only | No semantic search. "Rate limiting" won't find "token refresh intervals". Misses connections where vocabulary differs. **Heavily documented as limited** |
| **Full (hybrid)** | OpenAI API key (or other provider) configured | BM25 + vector similarity | The designed experience. Semantic + keyword search |

**Upgrading from stub to full**: User runs `knowledge setup` again (or configures API key manually in system config), then runs `knowledge rebuild`. Existing keyword index is replaced with full hybrid index.

**Skills never check mode** — they always call `knowledge query`. The CLI handles whether it runs keyword-only or hybrid based on config. The knowledge skill describes one unified capability.

---

## Indexing

### When Indexing Happens

**Primary trigger**: Phase completion. When a discussion completes, a spec is finalised, an investigation concludes — the artifact gets chunked and indexed automatically.

**Not mid-phase**: In-progress artifacts are not indexed. The knowledge base reflects completed, committed work.

### Indexed Phases

Only **knowledge artifacts** are indexed — phases whose value persists beyond the work unit and informs future work. **Execution artifacts** (planning, implementation, review) are not indexed — their value is consumed during execution and then lives in the code + git history.

| Phase | Indexed | Rationale |
|-------|---------|-----------|
| Research | Yes | Explored approaches, rejected paths, evidence — prevents re-exploring dead ends |
| Discussion | Yes | Decisions with rationale, constraints discovered, reasoning journey |
| Investigation | Yes | Root cause analysis, diagnostic knowledge, blast radius |
| Scoping | **No** | Scoping produces a specification and a plan, not a separate scoping artifact. The spec it creates is indexed under the specification phase |
| Specification | Yes | The "golden" artifact — what we decided to build and why |
| Planning | **No** | Execution decomposition of the spec. Once implemented, the code is the truth |
| Implementation | **No** | The code IS the implementation. Git history serves this role |
| Review | **No** | Findings either got fixed (now in code) or logged to inbox (become their own work unit) |

This reduces index size significantly. For a mature project like tick (574 total files, 3.8MB), only ~30-40% of files need indexing — the knowledge-bearing early phases.

### Phase-Aware Chunking

Artifacts are chunked at natural semantic boundaries defined by each phase's structure, not arbitrary token windows. **Fully rule-based** — split on markdown headings at phase-appropriate levels. No LLM-assisted boundary detection. This keeps chunking deterministic, fast (no API calls), and reproducible.

Validated against real-world artifacts across 5 projects (tick: 574 files/3.8MB, portal: 277 files/2.0MB, agntc: 187 files/1.5MB, magic-pad: ~15 files/274KB, folio: ~6 files/90KB).

| Phase | Strategy | Real-World Chunk Sizes | Notes |
|-------|---------|----------------------|-------|
| Research | Split on H2 sections | 50-200 lines | Sections are thematic units (findings, evidence, recommendations). Large research files (500-1300 lines) split into 5-15 chunks |
| Discussion | Split on H2 subtopics. Discussion Map as its own chunk | 20-80 lines per subtopic | Each `## {Subtopic}` contains Context → Options → Journey → Decision. Summary section is a separate chunk. 6-9 subtopics per discussion typical |
| Investigation | Split on H2 major sections (Symptoms, Analysis, Fix Direction) | 30-60 lines per section | Three clear sections with well-defined subsections. ~150 lines total typical |
| Specification | Split on H2 sections | 50-150 lines per section | Sections organised by subject matter (requirements, constraints, edge cases, dependencies). 75-810 lines total |

**Chunking is configuration-driven, not hardcoded.** Each indexed phase has a JSON config file:

```
skills/workflow-knowledge/
├── chunking/
│   ├── research.json
│   ├── discussion.json
│   ├── investigation.json
│   └── specification.json
```

Example (`discussion.json`):
```json
{
  "phase": "discussion",
  "confidence": "low-medium",
  "strategy": "split-on-heading",
  "primary_level": 2,
  "fallback_level": 3,
  "max_lines": 200,
  "keep_whole_below": 50,
  "special_sections": {
    "Discussion Map": "own-chunk",
    "Summary": "own-chunk"
  },
  "strip_frontmatter": true,
  "skip_empty_sections": true
}
```

`special_sections` values:
- `"own-chunk"` — always split into its own chunk regardless of heading level
- `"skip"` — exclude from indexing entirely
- `"merge-up"` — merge into the preceding section's chunk

`keep_whole_below` and `max_lines` are measured in lines.

The knowledge script contains a **generic markdown chunking engine** that reads these configs and applies the rules. The algorithm is the same for every phase — only the parameters change:

1. Strip frontmatter if configured
2. Parse markdown into sections by heading level
3. Apply phase-specific primary split level (from config)
4. Handle special sections (own-chunk, skip, etc.)
5. If a section exceeds `max_lines`, split on `fallback_level`
6. Skip empty sections if configured
7. Files below `keep_whole_below` stay whole

Adjusting chunk boundaries or adding a new indexed phase means editing a JSON file, not the script. If a phase's artifact structure evolves, update the config.

### Build & Distribution

**Source structure** — source files live at the project root, outside the skill directory. AGNTC copies entire skill directories recursively with no file filtering, so source/build files must not be inside `skills/`.

```
# Project root (NOT copied by AGNTC)
package.json                    # dev deps: @orama/orama, @msgpack/msgpack, esbuild
node_modules/                   # gitignored
src/
└── knowledge/                  # source files for the knowledge CLI
    ├── index.js
    ├── store.js
    ├── chunker.js
    └── embeddings.js
build/
└── knowledge.build.js          # esbuild config

# Skill directory (COPIED by AGNTC)
skills/workflow-knowledge/
├── SKILL.md
├── chunking/
│   ├── research.json
│   └── ...
└── scripts/
    └── knowledge.cjs           # bundled output (~110-120KB minified), committed
```

**Build process**: esbuild bundles `src/knowledge/` + `@orama/orama` + `@msgpack/msgpack` into a single self-contained `knowledge.cjs`. Both dependencies are zero-dep pure JS — the bundle is ~90KB for libraries + ~20-30KB for application code.

**Language**: Plain JS (not TypeScript). Matches the manifest CLI convention.

**Node.js version**: Minimum Node 18 (required by Orama). Node 20+ recommended — Node 18's built-in `fetch` is experimental and emits `ExperimentalWarning` to stderr (cosmetic, not functional). All HTTP calls to the OpenAI embedding API use Node's built-in `fetch` (simple POST + JSON, no streaming). OpenAI's own SDK made the same choice (moved from `node-fetch` to native `fetch`).

**The bundled `knowledge.cjs` is committed** to the repo. AGNTC installs from git tags — there's no build step at install time. The build must happen before committing/tagging.

**Release workflow change required**: The current release process (local tag → GitHub workflow → release) has no build step. The bundle must be built in CI before tagging, or the release script must build locally before tagging. The release process redesign is out of scope for this design — to be addressed as a prerequisite or parallel workstream.

**What the user gets**: SKILL.md, chunking configs, and the single bundled `knowledge.cjs`. No source files, no node_modules, no build tooling.

**Runtime config file discovery**: The bundled `knowledge.cjs` finds chunking configs at runtime via `path.join(__dirname, '..', 'chunking')`. In CJS bundles produced by esbuild, `__dirname` correctly resolves to the output file's directory (not the source file's). Since both the script and the configs are in the same skill directory hierarchy, and AGNTC copies the entire directory, the relative path is stable across installations. Verified: esbuild preserves `__dirname` as-is in `--platform=node --format=cjs` output.

### Testing Strategy

**Unit tests — chunking engine**: Given markdown string + chunking config, verify expected chunks. Pure function, no external deps. Fixtures from real artifacts (5 surveyed projects). Cover edge cases: no H2s (fallback), empty sections (skipped), frontmatter (stripped), oversized sections (split on fallback level).

**Unit tests — store**: Create, insert, search, remove, save/load round-trip. Uses Orama directly, no embedding API. Verifies MsgPack persistence fidelity.

**Mock embedding provider**: `StubProvider` implementing `KnowledgeProvider` — returns deterministic fake vectors (hash input text to produce consistent vector). Used in all tests except explicit integration tests. No API calls in the test suite.

**Integration test**: One test hitting real OpenAI API. Indexes a small fixture, queries, verifies results. Skipped in CI unless API key env var is present. Developer confidence, not CI gating.

**CLI command tests**: Test each command's stdout, stderr, exit codes. Shell out to the built `knowledge.cjs`. Covers: `check` (ready/not-ready), `index` (with and without args), `remove`, `query`, `compact`, `status`.

**Test location**: `tests/scripts/test-knowledge-*.cjs` (node) and `tests/scripts/test-knowledge-*.sh` (bash for CLI). Matches existing conventions.

**Artifact discovery delegates to the manifest CLI** — the knowledge script calls the manifest to find completed artifacts for indexed phases. The manifest knows what exists, what's completed, and where files live on disk.

**Discovery algorithm for `knowledge index` (no args)**:
1. Get all work units and their completed items across indexed phases via the manifest CLI
2. For each completed item, resolve the file path via a new manifest command: `manifest.cjs resolve {work_unit}.{phase}.{topic}` → returns the artifact's file path (e.g., `.workflows/{wu}/discussion/{topic}.md`)
3. Check which items are already indexed — query the store for chunks matching each `work_unit` + `phase` + `topic` combination
4. Index the missing ones, using the retry/pending-queue mechanism for failures

The `resolve` command is a new addition to the manifest CLI. The manifest already encodes all directory conventions internally — this exposes them as resolved paths. Keeps path knowledge in one place rather than duplicating conventions across scripts.

**Note on research files**: Research in epics can have multiple files with non-predictable names (`exploration.md`, `networking.md`, etc.). The `resolve` command for research should return all files in the research directory for that work unit, not a single path. The manifest's `phases.research.items` tracks individual research topics — resolve returns the path for each.

### No Metadata Prefix in Content

Chunk content is stored and embedded as-is — no metadata prefix prepended. Metadata (phase, work_unit, topic, confidence) lives in the structured enum fields where it belongs and is used for filtering via Orama's `where` clause.

An earlier design considered prepending `[phase | work_unit | topic]` to improve embedding quality, but this pollutes BM25 keyword search: searching for "discussion" would match every discussion chunk's prefix, inflating scores. The enum fields handle filtering cleanly. If embedding quality suffers without the prefix, this can be revisited.

### Chunk Identity & Metadata

**Identity key**: `work_unit` + `phase` + `topic` — semantic, survives file reorganisation. When `knowledge index <file>` runs, it derives these from the file path / manifest, removes all existing chunks matching that combination, then inserts fresh chunks.

**Chunk ID format**: `{work_unit}-{phase}-{topic}-{seq}` (e.g., `auth-flow-discussion-auth-flow-003`). Deterministic, readable. Not used as the replacement key — the enum field combination is.

Every chunk carries:

| Field | Description |
|-------|-------------|
| `id` | `{work_unit}-{phase}-{topic}-{seq}` — deterministic, readable |
| `work_unit` | Which work unit this came from |
| `work_type` | epic, feature, bugfix, quick-fix, cross-cutting |
| `phase` | research, discussion, investigation, specification |
| `topic` | Topic within the work unit |
| `confidence` | Derived from phase (see Confidence Tiers below) |
| `timestamp` | When the chunk was indexed |
| `source_file` | Path to the source artifact — convenience metadata for two-step retrieval, not an identity field. May go stale if files are reorganised; a known edge case to address when it happens |

### Confidence Tiers

Confidence is intrinsic to the source phase — it's metadata, not a filter. All confidence levels are retrieved; Claude sees the tier and judges accordingly.

| Phase | Confidence | Rationale |
|-------|-----------|-----------|
| Research | Low | Exploratory. May contain dead ends, rejected paths, unvalidated ideas |
| Discussion | Low-Medium | Conversational. May contain assumptions corrected later in the same discussion |
| Investigation | Medium | Diagnostic. Tied to specific symptoms that may have changed |
| Specification | High | Validated, refined, intentional. The "what we decided to build" |

Low-confidence artifacts are not low-value. Research that explored and rejected an approach prevents the next work unit from re-exploring the same dead end. A discussion where an assumption was corrected shows *why* the spec says what it says. Confidence tells Claude how much weight to give the information, not whether to show it.

### Staleness & Supersession

**Same-file edits** (spec revised within a work unit): Re-indexing the file replaces its chunks. Old content is removed, new content takes its place. This is implicit and automatic.

**Supersession and promotion** are spec-only concepts in the workflow system. No other indexed phase has these statuses.

- **`superseded`**: The spec is replaced by another spec (e.g., unified into a combined spec). Chunks are **removed** from the index. The content is either redundant (carried forward) or wrong (changed) — either way, surfacing it is noise at best, misleading at worst.

- **`promoted`**: The spec is moved into a new cross-cutting work unit. This is a **relocation, not a removal**. Chunks are removed from the original work unit's index entry. The new cross-cutting spec gets indexed naturally when it completes — with `work_type: cross-cutting` in its metadata. The content survives, just under a different work unit.

**Promotion timing gap**: Between removing the original spec's chunks and the new cross-cutting spec completing, there's a window where the spec content is absent from the knowledge base. This is accepted — the content is being actively worked on in the new work unit, and the old location is no longer authoritative.

Research, discussion, and investigation chunks from the same work unit are **kept** even if a spec is superseded. These phases contain reasoning, rejected approaches, and contextual knowledge that remains valuable regardless of spec status. The discussion explains *why* a decision was made; the spec just states the outcome.

---

## Retrieval

### Integration Points

**No broad phase-entry dumps.** The design initially included automatic multi-query context dumps at the start of each early phase. This was removed after discussion: upfront dumps risk anchoring Claude's thinking before the conversation develops, the topic name alone is a weak search signal, and 500-1500 lines of potentially irrelevant context is counterproductive. Instead, context surfaces primarily through autonomous querying as topics emerge — at which point we have much better signal for what to search for.

**One exception: a single contextual query at phase start.** At the beginning of each phase (research, discussion, investigation), Claude constructs a natural language query from the available context — topic description, bootstrap answers, handoff context, problem statement — and searches the knowledge base. Not the topic slug ("auth-flow") but a descriptive summary ("user authentication flow using OAuth2 with PKCE for mobile and web clients"). The richer the query, the better the semantic matching. Returns a small, focused result set. Zero cost if nothing comes back. High value when it catches prior work that would otherwise surface as a correction minutes into the conversation.

**Autonomous querying throughout every phase** is the primary retrieval model. The knowledge skill empowers Claude to query proactively. The skill file teaches specific trigger heuristics — situations where querying is most valuable:

1. **At topic boundaries** — when the conversation is at the edge of the current topic, bordering on adjacent territory that may have been explored elsewhere
2. **Upstream/downstream dependencies** — when something being discussed might be affected by or affect other parts of the system. "This auth decision probably has implications for billing — have we discussed billing auth?"
3. **Unfamiliar territory** — when Claude isn't sure whether a topic has been explored before in this project
4. **User prompts** — when the user asks "have we discussed this?" or "check if there's prior context"

These heuristics are tunable over time based on how well Claude performs. The knowledge skill is the right place to refine them.

**Specification explicitly excluded from automatic retrieval.** The spec phase turns discussion decisions into a golden document — that's its job. Cross-cutting concerns are NOT woven into individual specs (that would be disorganised — the cross-cutting spec already exists for that purpose). Cross-cutting specs merge with feature specs at planning time, not spec time. This is the existing design and the knowledge base doesn't change it.

**One explicit integration point remains**: **Planning entry cross-cutting query.** This replaces the existing manual approach in `workflow-planning-entry/references/cross-cutting-context.md` (currently reads every cross-cutting spec and manually assesses relevance) with a targeted semantic query filtered to `work_type: cross-cutting`. This is a deterministic step replacing existing functionality, not a speculative dump.

### Retrieval Weighting

When retrieving, results should be weighted by:

1. **Semantic relevance** — the core embedding similarity score (native to Orama)
2. **Work unit proximity** — sibling discussions within the same work unit weighted higher (implementation: post-processing re-ranking using `--work-unit` flag)
3. **Confidence tier** — higher confidence results surface first when relevance scores are similar (implementation: post-processing re-ranking)
4. **Recency** — more recent chunks weighted slightly higher (implementation: post-processing using `timestamp` field)
5. **Supersession** — superseded spec chunks are removed entirely, so this is handled by absence rather than weighting

**Implementation note**: Orama natively handles #1 (similarity scoring) and hybrid weights (text vs vector balance). Factors #2-#4 require **application-level post-processing** of the result set. Plan for post-processing re-ranking from the start (~15 lines of code on a result set of limit 10). Orama's `afterSearch` plugin hook may or may not expose what's needed in a mutable form — don't depend on it. The re-ranking is simple: get results from Orama, adjust scores based on work-unit match / confidence / recency, re-sort, return.

### Retrieved Context Format

**Output format**: Plain text (not JSON — Claude reads and incorporates, doesn't parse programmatically).

```
[3 results]

[specification | auth-flow/auth-flow | high | 2026-03-15]
User identity uses UUID v7. Email is a profile attribute, not an identifier.
Source: .workflows/auth-flow/specification/auth-flow/specification.md

[discussion | payments-overhaul/data-model | low-medium | 2026-03-10]
Debated UUID vs email for identity. UUID won because email changes are common.
Source: .workflows/payments-overhaul/discussion/data-model.md

[research | payments-overhaul/exploration | low | 2026-02-28]
Explored identity approaches. Email-based ruled out due to GDPR right-to-erasure.
Source: .workflows/payments-overhaul/research/exploration.md
```

- Result count header
- Each chunk: provenance line `[phase | work_unit/topic | confidence | date]`, content verbatim, source file path
- For features (work_unit = topic), the provenance shows e.g., `auth-flow/auth-flow`. Slightly redundant but consistent with epics where they differ
- Date is the chunk's indexing timestamp (from the `timestamp` field), formatted as YYYY-MM-DD. This approximates when the knowledge was produced (indexed at phase completion)
- Blank line between chunks
- Empty results: `[0 results]`
- Batch mode (`knowledge query "term1" "term2"`): results from all queries merged, deduplicated, sorted by relevance
- Stub mode note (when applicable): `[keyword-only mode — configure embedding provider for semantic search]` at the top

No summarization. The actual text from the actual artifact, with metadata that helps Claude judge its weight.

---

## Management CLI

Modelled loosely on Laravel's migration commands — setup, index, rebuild, remove, query, compact, status.

### Commands

```
knowledge setup                                         # interactive first-time setup (human only)
knowledge index [<source_file>]                         # no args = index all missing; with file = index one
knowledge rebuild                                       # destructive reindex (human only, interactive prompts)
knowledge remove --work-unit <wu> [--phase <p>] [--topic <t>]  # remove chunks (for supersession)
knowledge query "<search>" [--work-type ...] [--phase ...] [--work-unit <wu>] [--limit N]  # search
knowledge compact [--dry-run]                           # remove expired chunks per decay rules
knowledge check                                         # quick readiness check (exit 0 + "ready" or "not-ready")
knowledge status                                        # full health report
```

**`knowledge setup`**
- **Interactive wizard** — handles all first-time setup in one flow:
  1. System config (`~/.config/workflows/config.json`): provider, model, API key env var, test embed call to validate
  2. Project init (`.workflows/.knowledge/`): directory, config, empty store
  3. Initial indexing of all existing completed artifacts via `knowledge index` (no args)
- Skips steps that are already done (system config exists → skip to project init; project exists → skip to indexing)
- **Human-only** — interactive prompts throughout. Claude cannot run it
- Stub mode available if user skips the API key step

**No migration.** Entry-point skills check `knowledge check` in Step 0. If not initialised, a reference file displays a message and instructs the user to run `knowledge setup`. Hard stop.

**During normal workflow use**: `knowledge index <file>` runs at phase completion in the processing skill (single file, incremental). The no-args form is for `knowledge setup` and manual catch-up.

**`knowledge index [<source_file>]`**
- **With file argument**: Index one specific artifact. Used by phase-completion steps in processing skills. Idempotent — re-indexing replaces existing chunks for that file
- **Without arguments**: Find all completed artifacts that aren't in the store and index them. Handles first-run population, catch-up after failures, and manual "make sure everything is indexed." Uses the retry/pending-queue mechanism for failures
- Acquires exclusive file lock during write

**`knowledge rebuild`**
- Destructive reindex from current artifacts
- Drops existing index, re-chunks and re-embeds everything
- **Human-only** — uses a type-the-action-word confirmation prompt (the user must type `rebuild` literally to proceed, same pattern as Terraform destroy or GitHub repo deletion). Forces engagement with what's being done rather than clicking through yes/no. Claude can't handle interactive terminals, which is the natural protection
- Non-deterministic: rebuilt index won't match the original (embedding variance, edited artifacts). Use only when necessary (provider change, corruption, major schema change)
- Analogous to `migrate:fresh`

**`knowledge remove --work-unit <wu> [--phase <p>] [--topic <t>]`**
- Remove chunks matching the given work unit, optional phase, and optional topic
- Used for spec supersession/promotion — remove a specific topic's spec chunks when status changes to `superseded` or `promoted`
- Without `--topic`, removes all chunks for the work unit + phase combination
- Without `--phase`, removes all chunks for the work unit
- Granularity matters: in an epic with 5 spec topics, superseding one topic must not remove the other 4

**`knowledge query "<search>" [--work-type <type,...>] [--phase <phase,...>] [--work-unit <wu>] [--limit N]`**
- Hybrid search (keyword + vector) by default
- `--work-type` and `--phase` map to Orama's `where` clause for metadata filtering
- `--work-unit` enables proximity re-ranking: results from the specified work unit are boosted in post-processing. This is for context — "I'm currently working in auth-flow, boost results from auth-flow." It's a re-ranking hint, not a filter (cross-work-unit results still appear, just ranked lower)
- Returns formatted chunks with provenance metadata (phase, work_unit/topic, confidence, date)
- Supports batch queries: `knowledge query "term1" "term2" --limit 5` (one load, multiple searches, results merged and deduplicated by chunk ID, highest score kept)
- Used autonomously by Claude during phases and explicitly at planning entry for cross-cutting

**`knowledge compact [--dry-run]`**
- Remove chunks that have exceeded their decay TTL (see Memory Decay & Compaction)
- Checks each chunk's work unit completion date + phase against decay rules
- Specs are exempt — never compacted
- `--dry-run` shows what would be removed without removing it
- Also available manually

**`knowledge check`**
- Quick readiness check for use in skill Step 0
- Validates: `.workflows/.knowledge/` directory exists, `config.json` exists, `store.msp` exists and is loadable (not corrupted). All three must pass for `ready`
- Exit code `0` always (unless genuine error like unreadable filesystem)
- stdout: `ready` (set up and usable) or `not-ready` (needs `knowledge setup`)
- Skills branch on the stdout value, not the exit code — avoids false errors in Claude Code

**`knowledge status`**
- Full health report — not used in skill automation, intended for user/debugging
- What's indexed: chunk count by work unit, phase, work type
- Last indexed timestamps
- Index health: store size, provider info, config summary
- Pending items from catch-up queue
- Stub/full mode indicator
- Provider mismatch warnings (if config changed but index wasn't rebuilt)

### Integration with Workflow Skills

Same pattern as the manifest CLI. A `workflow-knowledge` skill directory with `scripts/knowledge.cjs` as the CLI tool:

```
skills/workflow-knowledge/
├── SKILL.md              # describes the knowledge tool's usage and API
├── chunking/             # per-phase chunking configs (JSON)
│   ├── research.json
│   ├── discussion.json
│   ├── investigation.json
│   └── specification.json
└── scripts/
    └── knowledge.cjs     # bundled CLI tool (~110-120KB minified)
```

The skill file describes how to use the knowledge tool. Processing skills reference the CLI directly in their instructions — e.g., "run `node .claude/skills/workflow-knowledge/scripts/knowledge.cjs query ...`". This is identical to how skills reference the manifest CLI today.

**Indexing**: Phase-completion steps in processing skills for indexed phases (research, discussion, investigation, specification) trigger `knowledge.cjs index <file>` automatically. Transparent to the user. Skills that complete multiple indexed phases in one invocation (e.g., scoping produces a specification — the spec is the indexed artifact) make one `knowledge index` call per indexed artifact. Each is independent — a failure on one doesn't block the other.

**Retrieval is fully autonomous.** No automatic phase-entry dumps. Claude queries the knowledge base on its own initiative throughout any phase, guided by trigger heuristics defined in the knowledge skill:

- **At topic boundaries** — conversation edges toward adjacent territory
- **Upstream/downstream dependencies** — current topic may affect or be affected by other parts of the system
- **Unfamiliar territory** — not sure whether a topic has been explored before
- **User prompts** — user asks to check for prior context

**Three-layer integration pattern:**

**Layer 1 — Knowledge skill (`workflow-knowledge/SKILL.md`)**: API documentation. What commands exist, flags, output format, how indexing and querying work. The "what it does and how to call it" layer. Loaded by reference from layer 2.

**Layer 2 — Usage reference per processing skill** (local to each phase or shared): Loaded early in the processing skill (alongside case conventions). Describes when and why to query during this specific phase — the trigger heuristics contextualised for that phase's work. References and loads the knowledge skill (layer 1) for API details. May be shared across phases if guidance is generic enough, or local per phase if each needs different emphasis.

**Layer 3 — Inline callouts at pertinent points in processing skills**: Reminders within the step flow at moments where the knowledge base is most valuable. "You've hit a complex subtopic — consider checking the knowledge base." Same pattern as existing callouts for review agents and commit reminders. Not a full reference load, just a nudge back to the capability.

This matches existing skill patterns — processing skills already load case conventions as references and already have inline callouts for other capabilities. The knowledge base slots into the same structure. The trigger heuristics are tunable over time by editing the layer 2 reference files.

**One explicit integration point**: Planning entry cross-cutting query — a deterministic step replacing existing functionality, not a speculative search.

**`allowed-tools` frontmatter changes**: Every skill that calls `knowledge.cjs` needs `Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)` added. This includes:
- All processing skills for all phases (autonomous querying)
- All entry-point skills (for `knowledge check` in Step 0)
- The manage work unit skill (for `knowledge remove` on cancellation)

This is a broad but mechanical change — one line per skill file. Same pattern as the manifest CLI's `allowed-tools` entries.

**Two-step retrieval pattern**: Knowledge base returns chunks with provenance (lightweight, lands in context). If a chunk looks relevant, Claude reads the actual source file (`source_file` in the chunk metadata) for full detail. Surface-level awareness → deep dive on demand. This keeps context lean while allowing full-fidelity access when needed.

**Query construction**: Queries are natural language — the topic or subtopic being discussed, derived from whatever Claude is currently exploring. Multiple queries are expected and encouraged — different angles surface different context.

---

## Rebuild Risk

The knowledge base is derived from markdown artifacts but is **not safely reproducible**:

1. **Embedding variance**: Even with deterministic (rule-based) chunking, re-embedding produces slightly different vectors across runs due to floating-point variance
2. **Edited artifacts**: If a discussion was edited after initial indexing, rebuilding produces chunks from the edited version — the original indexed content is lost

The index should be treated as an important, non-disposable artifact. `knowledge rebuild` is a destructive operation analogous to `migrate:fresh` — available but not routine.

Day-to-day operation is incremental: phase completion triggers indexing of new/changed artifacts. The index grows naturally over the project lifecycle.

---

## Error Handling

### Indexing Failures (Phase Completion)

When `knowledge index` fails during phase completion (embedding API unreachable, rate limit, network error):

1. **Retry** — up to 3 attempts with backoff
2. **If retries exhausted** — clear error message explaining what happened and what the user needs to do (e.g., "Embedding API unreachable. The discussion was saved but not indexed. Run `knowledge index <file>` to retry.")
3. **Log to pending queue** — record the failed file in `.workflows/.knowledge/metadata.json` under a `pending` list
4. **Catch-up on next index** — the next time `knowledge index` runs successfully (for any file), it also processes any files in the pending queue. The system self-heals without user intervention in most cases

The phase itself is not blocked — the artifact is saved. But the failure is made visible, not silently swallowed.

### Query Failures (Contextual or On-Demand)

When `knowledge query` fails during a phase workflow:

1. **Retry** — up to 3 attempts with backoff
2. **If retries exhausted** — **pause the workflow**. Don't silently proceed without context. The knowledge base adds significant value and skipping it could lead to decisions that contradict prior work
3. **Present the error** — clear message explaining the failure and options: fix the issue (API key expired, network down) or explicitly choose to proceed without knowledge context
4. **If the user chooses to proceed** — continue the phase without prior context, with a note that knowledge retrieval was skipped

The value of the knowledge base is too high to silently skip.

### Catch-Up Mechanism

The pending queue in `metadata.json` tracks files that failed to index:

```json
{
  "pending": [
    { "file": ".workflows/auth-flow/discussion/auth-flow.md", "failed_at": "2026-04-05T10:30:00Z", "error": "API timeout" }
  ]
}
```

Processed automatically on next successful `knowledge index` call:
- `knowledge index <file>` — after indexing the specified file, processes up to 5 pending items. Each pending item gets its own fresh 3-retry budget (independent of how many times it failed previously). Gradual catch-up through normal workflow use, avoids bursty API calls after long outages. Items that fail again stay in the queue for the next cycle.
- `knowledge index` (no args) — processes the entire pending queue alongside missing files.
- `knowledge status` — reports pending items but does NOT process them. Status is read-only.

---

## Work Unit Lifecycle

**Completed work units**: Spec chunks kept permanently. Research/discussion/investigation chunks subject to memory decay — removed after configurable TTL from work unit completion date (see Memory Decay & Compaction below).

**Cancelled work units**: Removed from the knowledge base automatically as part of the cancellation action. The manage menu skill runs `knowledge remove --work-unit {work_unit}` inline — no prompt, cancelling means you're done with it. If removal fails (store locked, etc.), surface a clear error and instruct the user to run `knowledge remove --work-unit {work_unit}` manually. The cancellation itself still completes — the knowledge base cleanup is a secondary concern. The pending queue is scoped to indexing failures only (file-based retry), not removal operations (which target work_unit+phase+topic identities and have their own file lock with built-in retry via the lock timeout mechanism).

---

## Memory Decay & Compaction

The knowledge base should not grow without bound. Older knowledge naturally becomes less valuable as decisions move from workflow artifacts into the codebase itself. A feature discussed 18 months ago — its decisions are in the spec, its implementation is in the code, its architecture is visible in the project. The exploratory discussion that led to those decisions is noise, not signal.

This mirrors how human memory works: details decay, leaving behind the important outcomes. The codebase is the long-term memory. The knowledge base is working memory — recent, relevant, actively useful.

### Decay Model

Single TTL applied uniformly to all non-spec phases. Specs never expire.

| Phase | Decay | Rationale |
|-------|-------|-----------|
| Specification | **Never** | The golden artifact. Compact, authoritative. Captures WHAT was decided and WHY. Stays forever |
| Research | After TTL | Exploratory. Once decisions are made and implemented, the exploration journey loses relevance |
| Discussion | After TTL | Reasoning journey. Over time, the spec captures the outcome and the code demonstrates the implementation |
| Investigation | After TTL | Diagnostic. Once the bug is fixed and in the codebase, the diagnostic journey is historical |

**TTL is measured from the work unit's `completed_at` date** — not the chunk's indexing date. If a work unit completes in January and the TTL is 6 months, its non-spec chunks expire in July regardless of when they were indexed.

**Prerequisite: manifest schema change.** The manifest currently stores `status: completed` but no timestamp. A new `completed_at` field (ISO date) must be added via migration. The manage menu's "done" action and any skill that sets `status: completed` must also set `completed_at`. For work units already completed before this migration, backfill by:
1. Finding all work units with `status: completed` and no `completed_at`
2. For each, finding the latest-modified artifact file across all phases in that work unit
3. Using that file's mtime as the `completed_at` value

This is an approximation — the mtime may be days off the actual completion — but for a 6-month TTL the precision is irrelevant. Going forward, `completed_at` is set explicitly by the skill at completion time.

**Default TTL: 6 months.** Short enough to keep the index lean, long enough that recent work is fully available. By 6 months post-completion, the code is the primary context for that feature. Configurable at system and project level.

### Compaction Rules

**In-progress work units**: All chunks kept regardless of age. No completion date means nothing can expire.

**Completed work units**: Spec chunks kept forever. Research/discussion/investigation chunks removed when `work_unit_completion_date + decay_months <= now` (inclusive — chunks expire on their expiry date, not the day after).

**Cancelled work units**: Automatically removed from the index as part of the cancellation action (see Work Unit Lifecycle above).

### Removal Is Index-Only

Compaction removes chunks from the Orama index — **not** from the filesystem. The source markdown files are untouched. If old context is needed again, `knowledge index <file>` re-indexes it. The artifacts remain the source of truth; the index is a curated window into them.

### Compaction Trigger

Runs automatically as part of Step 0 on every entry-point skill invocation. The Step 0 sequence is:

1. **Migrations** (bring system to consistent state)
2. **Knowledge check** (hard stop if not set up)
3. **Compaction** (trim expired chunks)

This order matters — migrations may change file structures or manifest schema that the knowledge system depends on. Compaction must run after migrations and after confirming the knowledge base is ready.

Cost is negligible — iterating 500-2K chunks to check timestamps is milliseconds. No API calls needed (pure deletion).

Also available manually:
- `knowledge compact` — run compaction now, log what was removed
- `knowledge compact --dry-run` — show what would be removed without removing

### Output

When compaction removes chunks, a brief summary is logged:
```
Compacted: removed 45 chunks from 3 work units (completed > 6 months ago)
  • auth-flow: 18 chunks (research, discussion)
  • data-model: 15 chunks (research, discussion)  
  • billing-bug: 12 chunks (investigation)
```

Visible but not intrusive. Skipped silently when nothing expires.

### What This Means for Scale

Active working set at any point in time:
- All specs ever written (compact — 50-150 lines each, 3-5 chunks per spec)
- Everything from in-progress work units (all phases)
- Recent research/discussion/investigation from completed work units (last 6 months)

| Scenario | Without compaction | With compaction |
|----------|-------------------|----------------|
| 1 year active project | ~2K-4K chunks, ~60-120 MB | ~800-1,500 chunks, ~25-45 MB |
| 2+ years active project | ~5K-10K+ chunks, ~150-300+ MB | ~500-2,000 chunks, ~15-60 MB |

The 8K chunk / 240MB problem never materialises. The index stays in a comfortable range for Orama's memory-resident architecture.

### Configuration

```json
{
  "knowledge": {
    "decay_months": 6
  }
}
```

Configurable at both system (`~/.config/workflows/config.json`) and project level (`.workflows/.knowledge/config.json`). Specs are exempt regardless of this setting. Set to `false` to disable compaction (keep everything). `0` means zero-month TTL (expire non-spec chunks immediately on next compact — valid but aggressive). There is no per-phase TTL — single value, simple model.

---

## Intra-Work-Unit Context (Epic Discussions)

The knowledge base subsumes this problem. When discussion #3 starts in an epic, discussions #1 and #2 are already indexed. As the conversation develops and touches on topics covered by earlier discussions, autonomous queries surface relevant context from sibling discussions naturally.

Retrieval weighting biases toward the same work unit, so sibling discussions surface prominently without excluding cross-work-unit context.

In stub mode (keyword-only), intra-work-unit retrieval still works for exact topic names and keywords. Full semantic cross-referencing requires the embedding provider to be configured.

---

## Open Questions

### Chunking Implementation — RESOLVED

Fully rule-based. Split on markdown headings at phase-appropriate levels (H2 primary, H3 fallback for oversized sections). Deterministic, fast, no API calls. Validated against real artifacts across 5 projects.

### Technology Selection — RESOLVED

Orama (`@orama/orama`). Pure JS, zero native deps, built-in hybrid search, metadata filtering, faceting, full TypeScript. Skip their embedding plugins — use our own driver pattern for embeddings.

### Embedding Provider Default — RESOLVED

OpenAI `text-embedding-3-small` as default. Content is natural language prose, not code. Cost is negligible. Higher-quality models available as driver swaps if needed.

### Query Depth at Phase Entry — RESOLVED

Not a special concern. The query is a standard search — Orama returns results ranked by relevance with a similarity threshold (default 0.8). Whatever meets the threshold comes back. Set a sensible `limit` (e.g., 10) and let relevance do the work.

### Discussion Map Item Granularity — RESOLVED

Chunk at the H2 subtopic level (`## {Subtopic}`), which contains the full Context → Options → Journey → Decision for that subtopic. The Discussion Map section itself becomes its own chunk (serves as a keyword-rich index). Real-world subtopics are 20-80 lines — right-sized for embedding.

### Supersession Detection — RESOLVED

Supersession is spec-only (the only indexed phase with `superseded`/`promoted` statuses in the manifest). When a spec's manifest status changes to either, its chunks are removed from the index. Same-file edits are handled by implicit replacement on re-index. Research/discussion/investigation chunks are never superseded — their reasoning value persists.

### Skill Integration Pattern — RESOLVED

Same pattern as manifest CLI. A `workflow-knowledge` skill with `scripts/knowledge.cjs`. Processing skills reference the CLI directly in their instructions. Skill file describes usage. Published with the skills package.

### Cross-Cutting Work Units — RESOLVED

No artificial weighting. Cross-cutting specs are already `confidence: high` and their content is inherently broad — a naming convention spec will semantically match many queries naturally. The knowledge base inherently improves cross-cutting visibility just by existing: a cross-cutting spec about "all API endpoints must use UUID v7" surfaces automatically when discussing a new feature's data model, without anyone needing to explicitly reference it. The `work_type: cross-cutting` enum is available for filtering if someone specifically wants project-level decisions.

---

## Review Findings

Issues identified during multi-perspective review (technical architecture, UX/workflow integration, data integrity/edge cases). Ordered by severity.

### Critical (must resolve before implementation)

**1. Dependency distribution** — RESOLVED
Both `@orama/orama` and `@msgpack/msgpack` are zero-dependency pure JS. Bundled with esbuild into a single `.cjs` file (~90KB minified for both libraries, verified). Estimated total `knowledge.cjs` with application code: ~110-120KB minified. HTTP for embeddings uses Node's built-in `fetch` (Node 18+). User sees a single self-contained `.cjs` file — same distribution model as `manifest.cjs` (27KB). The release workflow needs a build step (esbuild) to produce the bundled file — the current release process has no build step, so this is a broader change worth addressing separately (applies to minifying all scripts, not just knowledge).

**2. Concurrent access / lost writes** — RESOLVED
Exclusive file lock (`.workflows/.knowledge/.lock`) for write operations (`index`, `remove`, `compact`, `rebuild`). Read operations (`query`, `status`) proceed without lock — stale reads are acceptable. Lock timeout: 30 seconds, fail with clear message if not acquired. Matches manifest CLI pattern.

**3. Git storage strategy** — RESOLVED
Store file is gitignored. It's 15-60MB of binary data — doesn't belong in git. Rebuild-on-clone is available but understood as lossy (embedding variance). The store is a local artifact per developer environment.

**4. MessagePack round-trip fidelity** — RESOLVED
Verified empirically. Orama's `save()` produces a JS object that MsgPack serializes and deserializes faithfully. Round-trip fidelity confirmed at 1K/5K/8K chunks — document counts match and search results are identical after deserialization. Both `@orama/orama` and `@msgpack/msgpack` are zero-dependency pure JS.

**5. Init / resumability** — RESOLVED
`knowledge setup` runs `knowledge index` (no args) as its final step. If interrupted mid-index, the pending queue tracks failures. Running `knowledge index` (no args) manually or via the next phase completion picks up where it left off. No migration involved.

### Significant (should resolve in design)

**6. Per-invocation index loading** — RESOLVED (accepted)
At compacted scale (~500-2K chunks), deserialize is ~150-500ms per invocation. A typical phase has 7-12 invocations = ~1-6 seconds total overhead across a 30-60 minute session (most invocations toward the lower end of the range). Acceptable in Claude Code sessions where responses take 5-30s. Batch query support (`knowledge query "term1" "term2"`) reduces phase-entry loads. **Future optimisation**: if load times become a problem at larger scale, a background daemon keeping the index in memory is a viable pivot — not needed now.

**7. Stub mode schema compatibility** — RESOLVED
Verified empirically. Orama accepts documents without the vector field when schema defines `vector[1536]`. Fulltext search works perfectly on vectorless docs. Hybrid search degrades gracefully — vectorless docs get text-only scores. Single schema for both modes, no migration needed on upgrade. One pitfall: never pass `null` for the vector field (crashes) — omit the field or pass `undefined`.

**8. Context bloat from phase-entry queries** — RESOLVED
Eliminated the problem by dropping automatic phase-entry dumps entirely. Retrieval is fully autonomous — Claude queries when topics emerge, not upfront. Avoids anchoring, avoids irrelevant context, and provides much better search signal (actual topics vs topic name alone). Planning entry cross-cutting query is the only deterministic integration point (replacing existing functionality).

**9. Chunking edge cases** — RESOLVED
Fallback chain: no H2s → try H3, no H3s → whole file (with size warning in status). Strip YAML frontmatter before chunking (metadata noise — useful fields already captured structurally). Skip empty sections. Include heading text in each chunk (semantic anchor). All defaults in chunking config, overridable per phase.

**10. Provider mismatch detection** — RESOLVED
Store `provider` + `model` + `dimensions` in `metadata.json` at store creation. Every `knowledge index` and `knowledge query` call compares current config against stored values. Mismatch → refuse with: "Provider/model changed. Run `knowledge rebuild` to reindex." The check is symmetric because `query` embeds the search term before hybrid search — a mismatch would either crash Orama on dimension differences or produce garbage results on same-dim/different-provider. `knowledge status` is the only read operation unaffected (it never embeds).

**11. Index-artifact drift detection** — RESOLVED
`knowledge status` cross-references index against filesystem. Reports orphaned chunks (source file missing) and unindexed completed artifacts (found via manifest, not in store). No automatic correction — just reporting. User runs `knowledge remove` for orphans or `knowledge index` for missing files.

**12. Manifest-knowledge consistency** — RESOLVED
`knowledge status` cross-references manifest state. Reports: superseded specs still indexed, promoted specs not relocated, cancelled work units still present. Reporting only — the processing skills handle the operations, status catches failures.

**13. Stub-to-full upgrade detection** — RESOLVED
`knowledge status` reports when config has an API key but store is stub mode: "Keyword-only mode but embedding provider configured. Run `knowledge rebuild` for full hybrid search." Also surfaces as a one-line note on `knowledge query` output — seen naturally during workflows, not just on manual status checks.

### Design Clarifications

**14. Performance estimates inconsistent** — RESOLVED
Reconciled. Performance section now shows verified empirical data: 1K chunks ≈ 30MB, 8K chunks ≈ 240MB (MsgPack). With compaction keeping the active index at 500-2K chunks, realistic store size is 15-60MB.

**15. Similarity threshold configurability** — RESOLVED
Configurable via `similarity_threshold` in project config (default 0.8, Orama's default). CLI reads it and passes to Orama's `similarity` parameter on every query. Tunable based on real-world results without code changes.

**16. Autonomous query guardrails** — RESOLVED
Knowledge skill defines trigger heuristics: topic boundaries, upstream/downstream dependencies, unfamiliar territory, user prompts. No hard guardrails — heuristics guide Claude, tuned over time. Under-querying is the bigger risk, addressed by encouraging proactive checking.

**17. Enum cardinality at scale** — RESOLVED (deferred)
Compaction keeps cardinality bounded — only recent + in-progress work units in the active index. Hundreds of unique enum values unlikely to cause issues but not verified. Monitor via `knowledge status` query times. Address if it surfaces as a problem.

**18. System config creation flow** — RESOLVED
`knowledge setup` is an interactive wizard that creates system config, project knowledge base, and runs initial indexing in one flow. Human-only (interactive prompts). Entry-point skills detect missing setup via `knowledge check` and hard stop with instructions to run setup. No migration — user-initiated, respects the boundary of not auto-editing files in the user's home directory.

**19. Cancelled work unit UX** — RESOLVED
No prompt — cancellation automatically removes chunks inline via `knowledge remove`. Part of the cancellation action, not a separate decision. Failures handled by pending queue catch-up. Background daemon noted as a future consideration if synchronous operations create friction at scale.

---

## Future Considerations

Ideas discussed during design that were deferred — not rejected, just not needed yet. Documented here so they aren't re-explored from scratch.

**Background daemon**: A persistent process that keeps the Orama index in memory, eliminating the ~150-500ms per-invocation load cost. Would also enable async indexing (no latency at phase completion), background catch-up processing, and immediate removal on cancellation. Significant architectural addition (process lifecycle, IPC, crash recovery). Not justified at current scale — the synchronous CLI approach works. Revisit if per-invocation load becomes a real friction point.

**Dimension reduction**: OpenAI's `text-embedding-3-small` supports outputting 256 or 512 dimensions instead of 1536. At 256 dims, vector data is ~6x smaller. Quality: 512 dims retains most retrieval quality for general language; 256 starts degrading. Not needed because compaction keeps the index small enough for 1536 dims. Revisit if compaction proves insufficient or if a project's index regularly exceeds 2K chunks despite compaction.

**Storage abstraction layer**: The driver pattern insulates the embedding provider but not the storage engine (Orama). If Orama's memory-resident architecture becomes limiting, migrating to SQLite+sqlite-vec (disk-based, no full index load) is a viable path. A storage abstraction layer would make this migration easier but adds complexity we don't need now. The knowledge CLI's interface (the commands and their behavior) wouldn't change — only the internal storage engine.

**`source_file` path update command**: When file reorganisation migrations move artifact files, the `source_file` field on indexed chunks becomes stale. A `knowledge update-source` command could update paths without re-embedding. Discussed but deferred — file reorganisation is rare, and `knowledge index` (no args) naturally re-indexes from current locations. The cost is embedding API calls for all re-indexed files, but this is a one-time event.

**Custom MsgPack ExtensionCodec for vectors**: MsgPack encodes each float as an individual msgpack number (9 bytes for float64). A custom codec that encodes vector arrays as raw Float32Array binary blobs (4 bytes per float) would roughly halve the store size. Not needed at compacted scale (15-60MB is manageable) but noted as an optimisation path.

---

## Technical Verification Summary

Key technical claims verified empirically during design:

| Claim | Verification | Result |
|-------|-------------|--------|
| Orama + MsgPack round-trip fidelity | Tested at 1K/5K/8K chunks | Works. Orama's `save()` produces a plain JS object (internally calls `toJSON()` on each component, converting Float32Arrays to plain arrays). MsgPack serializes/deserializes this faithfully. `load()` reconstructs typed arrays from plain arrays. Document counts and search results identical after round-trip |
| esbuild bundling of Orama + MsgPack | Built with `--bundle --platform=node --format=cjs --minify` | Works. 90KB minified. Both are pure JS with no dynamic imports |
| Orama accepts docs without vector field | Tested insert without embedding, fulltext search, hybrid search | Works. Fulltext unaffected. Hybrid degrades gracefully (text-only scores). Never pass `null` (crashes) — omit or pass `undefined` |
| Orama enum at high cardinality | Investigated internal implementation | Uses Map (sparse hash), no cardinality limit. 200+ unique values is trivial |
| Node built-in fetch for OpenAI | Verified against OpenAI's own SDK approach | Works. Simple POST + JSON. Node 18 emits ExperimentalWarning (cosmetic). Node 20+ stable |
| OpenAI batch embedding API | Verified endpoint accepts array input | Supports up to 2048 inputs per request. Maps directly to `embedBatch()` interface |
| `__dirname` in esbuild CJS output | Verified esbuild documentation | Preserved as-is, resolves to output file directory. Config files found via relative path |
| File locking via `wx` flag | Same pattern as manifest CLI (lines 80-114 of manifest.cjs) | Proven in production. Atomic on local filesystems (HFS+, APFS, ext4) |

---

## Design Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| RAG over summarization | Details matter. Summaries lose critical specifics. Retrieve verbatim, not compressed | 2026-04-04 |
| Phase-aware chunking over token windows | Workflow artifacts have natural semantic structure. Use it | 2026-04-04 |
| Confidence as metadata, not filter | Low-confidence artifacts (research, discussion) carry high-value context (rationale, rejected approaches) | 2026-04-04 |
| No separate intra-work-unit solution | Knowledge base subsumes this. Retrieval weighting handles same-work-unit bias | 2026-04-05 |
| Index is non-disposable | Embedding variance means rebuild produces slightly different vectors. Chunking is deterministic (rule-based). Treat index as important artifact | 2026-04-05 |
| Embedding provider is configurable | Provider-agnostic core. Switch requires full rebuild | 2026-04-05 |
| Modelled on Laravel migration commands | setup / index / rebuild / remove / query / compact / status. Rebuild is destructive, index is incremental | 2026-04-06 |
| Driver/strategy pattern for providers | Workflow system calls generic interface. Provider resolved from config. Adding providers = implementing interface, no other changes | 2026-04-05 |
| OpenAI text-embedding-3-small as default | Content is natural language prose, not code. Cheap, battle-tested, sufficient quality. Higher-quality models available as driver swaps | 2026-04-05 |
| Two-level config hierarchy | System config at `~/.config/workflows/config.json` for API keys and defaults. Project config at `.workflows/.knowledge/config.json` for overrides. Keys via env var reference, never stored directly | 2026-04-05 |
| Orama as vector store | Pure JS, zero native deps, built-in hybrid search (BM25 + vector), metadata filtering via `where` + `enum` types, faceting, full TypeScript. Skip their embedding plugins — generate embeddings via our own driver pattern | 2026-04-05 |
| MsgPack for persistence | Orama's `save()`/`load()` + `@msgpack/msgpack`. 3x faster serialize, 2x faster deserialize vs JSON. Both zero-dep pure JS, bundle to 90KB combined. Verified empirically | 2026-04-05 |
| Enum types for all categorical metadata | phase, work_type, work_unit, topic, confidence all as `enum` — enables exact-match filtering across all search modes | 2026-04-05 |
| Only index knowledge phases | Research, discussion, investigation, specification. Scoping removed (produces a spec, not its own artifact). Skip planning, implementation, review — execution artifacts whose value lives in code + git history post-completion | 2026-04-07 |
| Rule-based chunking only | Split on markdown headings at phase-appropriate levels. Deterministic, fast, no API calls. Validated against real artifacts across 5 projects (574 files largest) | 2026-04-05 |
| No metadata prefix in content | Dropped — pollutes BM25 keyword search. Metadata lives in structured enum fields for filtering. Content embedded as-is | 2026-04-06 |
| H2 as primary split level, ~200 line threshold | H2 boundaries are consistent and semantically meaningful across all indexed phases. Sections above ~200 lines fall back to H3 splitting | 2026-04-05 |
| Superseded specs removed, promoted specs relocated | `superseded`: chunks removed (redundant or wrong). `promoted`: chunks removed from original, re-indexed under new cross-cutting work unit. Both spec-only. Research/discussion/investigation chunks always persist | 2026-04-05 |
| Skill integration mirrors manifest CLI pattern | `workflow-knowledge` skill with `scripts/knowledge.cjs`. Processing skills reference CLI directly. Published with skills package | 2026-04-05 |
| No special cross-cutting weighting | Cross-cutting specs surface naturally via autonomous queries (broad content matches many searches). Planning entry replaces manual manifest-based discovery with targeted semantic query. No spec-level integration needed | 2026-04-06 |
| Interactive prompts for destructive ops | `rebuild` uses interactive terminal prompts. Claude can't handle interactive terminals — natural protection | 2026-04-06 |
| Indexing failures: retry + pending queue + catch-up | 3 retries with backoff. Failed files logged to pending queue. Next successful index run processes pending items. System self-heals | 2026-04-05 |
| Query failures: pause, don't skip | Knowledge base value is too high to silently skip. Pause workflow, present error, let user fix or explicitly choose to proceed without context | 2026-04-05 |
| Completed work units: specs forever, rest decays | Specs kept permanently (golden artifact). Research/discussion/investigation subject to compaction TTL. The codebase becomes the long-term memory | 2026-04-07 |
| Cancelled work units: auto-remove, no prompt | Cancellation removes chunks inline as part of the action. Failures go to pending queue. No prompt — cancelling means done | 2026-04-06 |
| Primarily autonomous retrieval + one contextual query at phase start | No broad dumps. Single query constructed from available context (description, bootstrap answers, handoff context) at phase start. Autonomous querying throughout for everything else. Planning cross-cutting query is a separate deterministic step | 2026-04-07 |
| Three-layer knowledge integration | Layer 1: knowledge skill (API docs). Layer 2: per-phase usage reference loaded early (trigger heuristics contextualised). Layer 3: inline callouts at pertinent points in processing skills. Matches existing patterns (case conventions, review agent callouts) | 2026-04-07 |
| Two-step retrieval depth | Chunks with provenance surface in context (lightweight). Claude reads source file for full detail when relevant. Surface → deep dive on demand | 2026-04-05 |
| Knowledge base is required, not optional | Always present, always queryable. No conditional logic in skills. Eliminates complexity of "is it available?" checks throughout the system | 2026-04-05 |
| Stub mode (keyword-only) when no API key | BM25 search works without embeddings. Quality scales with provider config. Stub → full via `rebuild` when API key is added. Heavily documented limitations | 2026-04-05 |
| User-initiated setup, not migration | `knowledge setup` interactive wizard handles system config + project init + indexing. No migration — skills detect missing setup and hard stop with instructions. Respects boundary of not auto-editing user home directory | 2026-04-06 |
| File locking for concurrent access | Exclusive lock for writes, no lock for reads. 30s timeout. Matches manifest CLI pattern | 2026-04-06 |
| Config-driven chunking | Per-phase JSON configs define chunking rules (split level, thresholds, special sections). Generic engine in the script applies them. Adjustments = edit JSON, not code | 2026-04-06 |
| Manifest delegates discovery, knowledge owns chunking | Knowledge script calls manifest CLI for "what's completed." New `manifest resolve` command returns file paths. Manifest is source of truth for workflow state. Knowledge handles chunking, embedding, storage, retrieval | 2026-04-06 |
| Source outside skill dir, bundle committed | AGNTC copies entire skill dirs — source must not be inside `skills/`. Source at project root `src/knowledge/`, esbuild bundles to `skills/workflow-knowledge/scripts/knowledge.cjs`, committed to repo. Release workflow change needed (out of scope) | 2026-04-06 |
| Accept per-invocation load cost | ~150-500ms at compacted scale. Batch queries reduce phase-entry loads. Background daemon is a future pivot if needed, not a current requirement | 2026-04-06 |
| Chunk identity = work_unit + phase + topic | Semantic key, survives file moves. Replacement removes all chunks matching the combination then inserts fresh. ID format: `{work_unit}-{phase}-{topic}-{seq}`. source_file is convenience metadata, not identity | 2026-04-06 |
| Single schema for stub and full mode | Verified: Orama accepts docs without vectors when schema defines vector field. Fulltext works on vectorless docs. Hybrid degrades gracefully. No schema migration on upgrade. Never pass null for vectors | 2026-04-06 |
| Inbox items not indexed | Pre-pipeline scratchpad. Content enters the index when items become work units and progress through phases | 2026-04-05 |
| Memory decay / compaction | Single 6-month default TTL from work unit `completed_at` date. Specs never expire. All non-spec phases decay uniformly. Removal is index-only (source files untouched). Keeps active index at 500-2K chunks. Requires manifest schema change: `completed_at` field + migration to backfill via file mtime | 2026-04-07 |
| Store is gitignored | Binary store file (15-60MB) does not belong in git. Gitignored. Rebuild-on-clone available but understood as lossy | 2026-04-05 |
| `knowledge check` command (not status --check) | Dedicated command for skill Step 0. Returns "ready"/"not-ready" on stdout with exit code 0 always — never exit 1, which produces errors in Claude Code. Skills branch on stdout value | 2026-04-07 |
| Existing users hard stop on upgrade is deliberate | No grace period, no auto-provisioning. Knowledge base is required infrastructure. Users must run `knowledge setup` before continuing. Stub mode (no API key) available for minimal friction | 2026-04-07 |
| Post-processing for re-ranking, not afterSearch hooks | Orama's afterSearch plugin API may not expose mutable result sets. Plan for ~15 lines of application-level post-processing on the small result set (limit 10). Simple: adjust scores for work-unit proximity / confidence / recency, re-sort | 2026-04-07 |
| Contextual query over topic slug | Phase-start query uses a natural language summary of available context, not the topic slug. "auth-flow" as a search term is useless. "user authentication flow using OAuth2 with PKCE" has semantic richness for embedding similarity | 2026-04-07 |
| `completed_at` backfill via file mtime | Find latest-modified artifact file across all phases in the work unit. Close enough for 6-month TTL. No fragile git log parsing. Going forward, `completed_at` set explicitly by skills at completion time | 2026-04-07 |
