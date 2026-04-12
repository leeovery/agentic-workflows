# Codebase Intelligence — Code Wiki, AST Graph & Freshness Engine

## The Idea

A multi-layered system that builds and maintains a living understanding of the host codebase. Combines an LLM-authored wiki (prose understanding), an AST-derived code graph (structural facts), git intelligence (change patterns), and a freshness engine (CI hooks + scheduled refresh) to provide rich codebase context throughout all workflow phases.

Solves the knowledge base cold-start problem: when workflows are adopted on an existing codebase, the KB is empty while the codebase is full of architectural decisions, domain concepts, conventions, and history. This system bootstraps that understanding and keeps it current.

## Why This Matters

The knowledge base (Orama, RAG, semantic search) is designed to accumulate institutional memory going forward — decisions, rationale, rejected approaches, specifications. But the majority use case is adoption on existing mature projects, not greenfield. On day one:

- **Architectural decisions** are baked into structure, module boundaries, dependency patterns — but the KB knows nothing about them
- **Domain concepts** are encoded in naming, abstractions, entity relationships — invisible to the workflow system
- **Conventions** are visible in patterns, testing approach, error handling style — but each session rediscovers them
- **Technical debt** is signalled by TODOs, workarounds, complexity hotspots — unknown to planning
- **History** lives in git log, blame, PR descriptions — disconnected from workflow context

Without codebase intelligence, the first epic/feature starts with zero context despite the project having years of embedded knowledge. Each workflow session spends significant time re-orienting to the codebase before doing actual work.

## Prior Art: Graphify

Discussed on April 6, 2026 (session `fd525e02-e07a-4f0d-af7a-7ac3dafb4e28` in the agentic-workflows project). Graphify (`github.com/safishamsi/graphify`, PyPI: `graphifyy`) is a Python-based tool that transforms codebases into queryable knowledge graphs.

Key technical details:
- Seven-stage pipeline: detect → extract → build_graph → cluster → analyze → report → export
- Two-pass extraction: tree-sitter for AST parsing (13 languages), second pass for non-code content
- Graph built with NetworkX, Leiden community detection for clustering
- Query via graph traversal (BFS/DFS from seed nodes), not vector/embedding search
- Claims 71.5x fewer tokens per query vs reading raw files (52-file mixed corpus)
- Python dependencies: tree-sitter, graspologic, networkx

Conclusion from that session: Graphify and the workflow knowledge base solve fundamentally different problems. Graphify indexes code structure (AST entities + relationships). The KB retrieves verbatim prose (decisions, rationale) via semantic search. They're complementary — Graphify could index the codebase itself while the KB indexes workflow artifacts about that codebase.

The distribution constraint matters: Graphify is Python + tree-sitter (native deps), and agentic-workflows distributes via `npx agntc add` with a zero-native-dependency requirement. Can't bundle Graphify directly, but the concept can be rebuilt using tree-sitter WASM.

## Layer 1: Code Wiki (LLM-Authored, Karpathy-Inspired)

Inspired by Karpathy's LLM Wiki concept (also discussed April 6). Not a one-shot analysis — a living, LLM-maintained knowledge document that grows richer with every workflow session.

### What the Wiki Contains

The documentation a senior dev would write for onboarding — except Claude writes it, keeps it current, and queries it for its own context.

**Module pages** — one per significant module/service. Contains: purpose, key abstractions (with semantic anchors like `AuthService.validateCredentials()`), dependencies, dependents, conventions specific to this module. Example content:

```
# AuthService

Purpose: Handles credential validation, token issuance, session management.

Key abstractions:
  - AuthService.validateCredentials() — entry point for all login flows
  - TokenService.issueToken() / .refreshToken() — JWT lifecycle
  - SessionStore — Redis-backed, TTL 24h

Dependencies:
  - UserRepository (reads user + hashed password)
  - PasswordService (bcrypt verify)
  - EventBus (emits auth.login.success / auth.login.failed)

Dependents:
  - AuthMiddleware (every protected route)
  - LoginController, OAuthController

Conventions:
  - All auth errors throw AuthError subtypes (never raw Error)
  - Token payload: { sub: userId, role, iat, exp }
```

**Flow pages** — key user journeys traced through the code. Contains: numbered step-by-step trace with file references, error paths, and notes about non-obvious behavior. Example content:

```
# Login Flow

1. POST /api/auth/login → LoginController.login()
2. → AuthService.validateCredentials(email, password)
3.   → UserRepository.findByEmail(email)
4.   → PasswordService.verify(password, user.passwordHash)
5.   → TokenService.issueToken(user)
6.   → SessionStore.create(token, user.id)
7.   → EventBus.emit('auth.login.success', { userId })
8. ← { token, refreshToken, expiresIn }

Error paths:
  - Step 3 returns null → AuthError.USER_NOT_FOUND (mapped to 401, not 404)
  - Step 4 fails → AuthError.INVALID_CREDENTIALS
  - Step 6 fails → retried 2x then AuthError.SESSION_ERROR (500)
```

**Convention pages** — patterns, testing approach, error handling, naming conventions observed across the codebase.

**Architecture index** — high-level map: API layer, service layer, data layer, events, auth, testing approach. The map of maps.

### How the Wiki Grows

1. **Bootstrap**: Initial analysis pass reads entry points, config, top-level modules, test structure. Produces rough wiki pages. This is the cold-start solution — better than nothing, not perfect.

2. **Passive enrichment**: During every workflow session, Claude reads code to do its actual work (investigating bugs, implementing features). As it discovers things — non-obvious error handling patterns, complex flows, undocumented conventions — it contributes back to the wiki.

3. **Active refresh**: When Claude opens a wiki page and notices the code has diverged (function renamed, file moved, pattern changed), it updates the wiki in-place. Staleness self-heals through use.

4. **Change-triggered**: Git diff since last analysis timestamp flags wiki pages whose source files changed, marks them as stale, re-verifies on next access.

### Storage

Wiki pages stored as markdown in `.workflows/.knowledge/wiki/`. Indexed into the KB for semantic search (they're prose artifacts, the KB already knows how to handle them). Also directly readable — Claude can load a specific module page when it needs targeted context.

## Layer 2: AST Code Graph (Structural Facts)

The wiki relies on Claude reading code and producing understanding. This works but has specific weaknesses:

- Claude samples — reads 5 callers of a function, misses 25. The AST catches all call sites exhaustively.
- Claude can hallucinate relationships ("I think X depends on Y"). The AST is ground truth — parsed, not inferred.
- Bootstrap is token-expensive on large codebases. AST parsing is milliseconds per file.
- Refreshing stale wiki pages means re-reading files with Claude. Re-parsing a changed file via AST is instant.
- "What calls X?" requires grep + interpretation. Graph traversal is instant and complete.

The relationship between layers: **AST = skeleton, Wiki = meaning**. The graph provides structural facts (entities, relationships, call sites, import chains, type signatures). The wiki provides interpreted understanding (purpose, conventions, design intent, domain concepts). Neither alone is sufficient — AST can't explain why, Claude can't guarantee completeness.

### How the Graph Feeds the Wiki

During bootstrap:
1. AST parses every source file → entity + relationship graph
2. Graph analysis identifies modules, boundaries, high-fanout nodes (key abstractions), clusters (related code)
3. Claude receives graph summary for each module cluster → writes wiki pages grounded in structural fact
4. Result: wiki pages that are exhaustive (nothing missed) and interpreted (meaning explained)

During ongoing use:
1. File changes → re-parse → graph diff
2. Graph diff tells exactly what changed: "new dependency from PaymentService → AuthService" or "RateLimitMiddleware added to middleware chain"
3. Flag affected wiki pages as stale with specific change context
4. Next session, Claude refreshes the stale page using the graph diff rather than re-reading the whole file

The graph makes wiki maintenance surgical instead of wholesale.

### Distribution Feasibility

Zero-native-dep constraint is solvable via tree-sitter WASM:

- `web-tree-sitter` has official WASM builds — runs in Node without native compilation
- Language grammars are WASM files (~200KB-1MB each)
- Not bundled into `knowledge.cjs` — stored as sibling files, loaded at runtime
- Common grammars (JS/TS, Python, Go, Rust, Java, PHP, Ruby) ≈ 5-8MB total
- Alternative: download grammars on-demand and cache them

Graph itself is plain JSON (entities + edges). No NetworkX needed. Stored as `.workflows/.knowledge/graph.json`, queried with JS traversal functions bundled into `knowledge.cjs`.

## Layer 3: Git Intelligence (Change Patterns)

Git history analysis — cheap to compute (git log parsing), no dependencies, high signal:

- **Hotspots**: Files that change most frequently (active development or instability)
- **Co-change coupling**: Files that always change together (hidden dependencies the AST might not capture — e.g., a config file and the module that reads it)
- **Stability**: Modules that haven't changed in months/years (stable foundations or dead code)
- **Recent activity**: What's being actively worked on across the team
- **Churn**: Files with high add+delete ratios (might indicate thrashing / unclear design)

## Layer 4: Test Map

Which tests cover which code. Three sources, cheapest to richest:

- **AST-derived**: Test files import source files → basic mapping. Free if the graph exists.
- **Convention-derived**: `auth.test.ts` tests `auth.ts`, `tests/services/` mirrors `src/services/`. Heuristic, usually accurate.
- **Coverage-derived**: Actual line-level coverage data from test runs. Precise but requires running tests with coverage.

## Layer 5: Dependency / Package Layer

What third-party dependencies are used, where, and why. Which services use `bcrypt`, what version, when last updated. Useful for: checking if a similar dep already exists before adding one, understanding impact of upgrades, tracing security advisories to affected modules.

## Layer 6: Schema / Data Model Layer

For projects with databases: current schema (from migration files or ORM models), entity relationships, migration history, model-to-service mapping. Useful for: discussion grounded in actual data model, planning that includes migration tasks, investigation that understands data flow.

## Layer 7: API Surface Tracking

Public interfaces — HTTP endpoints, GraphQL schema, exported functions. What endpoints exist, their methods, params, auth requirements. Breaking change detection: "this PR removes a public method that has 12 call sites."

## Code Citations — Semantic Anchors with Verified References

A key capability across all layers: citing actual code during workflow phases.

### Why Not Line Numbers

Code changes constantly, line numbers drift. Storing `auth.ts:120` and trusting it next week is unreliable.

### Semantic Anchors

The wiki stores semantic references: `AuthService.validateCredentials()` in `src/services/auth.ts`. These are stable across most edits — functions get modified far more often than renamed.

### Two-Step Verified Citation

When a workflow needs to cite code:
1. **Wiki lookup**: "AuthService.validateCredentials is in src/services/auth.ts" (fast, cached)
2. **Verify**: Grep for the function to get current line number (real-time, always accurate)
3. **Present**: `AuthService.validateCredentials() at src/services/auth.ts:127` (verified, current)

If step 2 fails (function moved/renamed), Claude flags it and updates the wiki. The stale reference becomes a self-healing trigger.

### Logic Flow Tracing with Citations

Not just locations — traced logic flow with code evidence. Example from a bugfix investigation:

```
Investigation trace:

1. LoginController.login() receives credentials
   → src/controllers/auth.ts:45-52

2. Calls AuthService.validateCredentials(email, password)
   → src/services/auth.ts:127-148
   Note: fetches user BEFORE checking if account is locked (line 131)

3. PasswordService.verify() compares hashes
   → src/services/password.ts:67-78
   Note: uses user.passwordHash — but after password reset,
   the hash is updated at :82 while the cached user object
   at step 2 still holds the OLD hash (stale read)

4. ROOT CAUSE: AuthService caches user at line 131,
   PasswordService.reset() updates DB at password.ts:82,
   but the cached object isn't refreshed.
```

Once Claude traces a flow during investigation, that trace becomes a wiki flow page. Next time anyone works on the auth system, the flow is already documented. Investigation work compounds — it's institutional knowledge, not throwaway debugging.

## How Workflows Use Code Knowledge (Per-Phase)

### Research / Discussion

Currently: Claude starts with whatever the user tells it. No codebase context.

With code knowledge: Before the discussion starts, contextual queries pull in the architecture overview, relevant module pages, existing flow pages, convention pages. The discussion is grounded in the actual codebase from sentence one. User says "I want rate limiting" and Claude responds knowing where the middleware chain lives, what patterns exist, what the request lifecycle looks like.

### Investigation (Bugfix)

Currently: User describes symptoms, Claude explores the codebase trying to find the relevant code path. Lots of reading, grepping, orienting.

With code knowledge: Claude queries the wiki for relevant flow pages and module pages. Login flow page shows the exact call chain. Investigation becomes targeted instead of exploratory — goes straight to the interaction point between flows, reads current code at those locations, identifies root cause.

### Specification

Currently: Specs describe what to build in abstract terms. The implementer has to re-discover where things live.

With code knowledge: Specs reference actual architecture — specific files to create/modify, patterns to follow, interfaces to extend, existing services to reuse. The spec becomes a bridge between intent and implementation.

### Planning

Currently: Task decomposition is somewhat abstract — "implement the service", "add tests".

With code knowledge: Each task has exact file paths, line references, patterns to follow, dependencies identified. The implementer doesn't need to explore — they have a map. Tasks reference: which file to create/modify, what pattern to follow (with wiki page link), what tests exist (from test map), what dependencies to use.

### Implementation

The implementer gets structural context loaded automatically: which files to create/modify (from plan, grounded in wiki), what patterns to follow (convention pages), what interfaces to implement (module pages), what the surrounding code looks like (flow pages). When something unexpected is encountered, the wiki provides explanation or gets updated.

## Freshness Engine

The piece that makes everything self-maintaining instead of decaying.

### Cheap Tier: Graph + Git Update (Every Commit)

Post-commit or post-merge hook. Runs in seconds, no LLM calls:

1. `git diff --name-only HEAD~1` → list of changed files
2. For each changed source file: re-parse with tree-sitter → updated entities + relationships → diff against previous graph
3. Update `graph.json`
4. Flag affected wiki pages as stale in `metadata.json` with specific change context ("AuthService: new method added, dependency on CacheService added")
5. If test files changed: update test map
6. Update git velocity stats

### Expensive Tier: Wiki Refresh (Lazy or Scheduled)

Wiki pages flagged as stale get refreshed by Claude. Two modes:

**Lazy (default)**: Next workflow session that touches a stale page triggers a refresh. Claude gets the graph diff as context rather than re-reading the whole file. Happens naturally as part of workflow sessions — no extra cost if the page isn't needed.

**Scheduled**: A remote trigger (the `/schedule` skill already exists) runs periodically — e.g., weekly. Refreshes all stale wiki pages in batch. Useful for teams wanting the wiki always current.

### PR Analysis Hook (Team Context)

CI hook on PR merge:
1. Analyze the full PR diff
2. Update graph
3. Generate a PR knowledge summary: modules affected, structural changes, intent from PR description
4. Store as lightweight knowledge artifact
5. Flag wiki pages for refresh

Captures the intent behind changes (from PR descriptions) alongside structural facts (from the diff). PR descriptions capture the "why" that's otherwise lost — nobody reads old PRs, but this archives the intent into the knowledge system.

## The Compound Effect

Each workflow session doesn't just produce its own artifacts — it enriches the shared understanding:

| Session Activity | Wiki Contribution |
|---|---|
| Bugfix investigation | New flow page tracing the call chain |
| Feature discussion | Updated module page with new dependencies |
| Implementation | Updated conventions from patterns discovered |
| Code review | Corrected stale wiki entries |

After months of active use, the wiki is a comprehensive, verified, evolving map of the codebase that no single developer could maintain manually. All queryable via semantic search (KB) and structural traversal (graph).

## Full Stack Diagram

```
┌─────────────────────────────────────────────┐
│              Workflow Phases                  │
│  (research, discussion, spec, plan, impl)    │
│                                              │
│  Query any layer for context during work     │
│  Contribute back to wiki during work         │
├─────────────────────────────────────────────┤
│           Knowledge Base (Orama)             │
│  Semantic search across all indexed content  │
│  Wiki pages + workflow artifacts + PR intents│
├──────────────┬──────────────┬───────────────┤
│  Code Wiki   │  AST Graph   │  Git Intel    │
│  (prose)     │  (structure) │  (velocity)   │
│              │              │               │
│  Module pgs  │  Entities    │  Hotspots     │
│  Flow pages  │  Relations   │  Co-change    │
│  Conventions │  Call chains │  Stability    │
│  Architecture│  Import map  │  Churn        │
├──────────────┼──────────────┼───────────────┤
│  Test Map    │  Dep Layer   │  Schema Layer │
│              │              │               │
│  Coverage    │  Packages    │  Models       │
│  Test↔Code   │  Where used  │  Migrations   │
│  Gaps        │  Versions    │  Relations    │
├─────────────────────────────────────────────┤
│              Freshness Engine                │
│                                              │
│  Git hook: graph + velocity + test map       │
│  Lazy refresh: wiki pages on access          │
│  Scheduled: batch wiki refresh               │
│  PR hook: intent capture + structural diff   │
└─────────────────────────────────────────────┘
```

## Suggested Implementation Phasing

Ordered by value and dependency:

1. **Wiki + bootstrap analysis** — immediate cold-start value, no new deps, fits into existing KB architecture
2. **Git intelligence** — cheap to compute, high signal, no new deps
3. **AST graph via tree-sitter WASM** — significant build work but unlocks structural queries and verified citations
4. **Graph-enhanced wiki** — connect wiki and graph, graph grounds the wiki in structural fact
5. **CI hooks (cheap tier)** — freshness engine for graph + staleness flags
6. **Test map** — AST-derived initially, coverage-derived later
7. **Scheduled wiki refresh** — batch updates via remote triggers
8. **PR analysis hook** — intent capture from merged PRs
9. **Dependency / schema / API surface layers** — project-type-specific, lower priority

Items 1-2 could be part of the KB implementation or immediately after. Item 3 is the big capability jump. Items 4-9 layer incrementally.

## Standalone Product Architecture

This system has scope beyond the workflow system. The code wiki, AST graph, freshness engine, and verified citations serve any AI-assisted development tool — not just agentic-workflows. Plain Claude Code, Cursor, Copilot, or any agent that reads code benefits from a maintained understanding layer.

### Product Boundary: MCP Protocol

The codebase intelligence product runs as an MCP server. Any AI tool connects and queries. The MCP protocol IS the product boundary — stable interface, loose coupling, independent versioning.

**MCP tools exposed:**
- `query` — semantic search across all indexed content
- `index` — add content (with metadata, source type, chunking strategy)
- `remove` — remove content by source/metadata
- `graph_traverse` — structural queries on AST graph
- `wiki_page` — read/update a specific wiki page
- `git_intel` — hotspots, coupling, stability for a path
- `status` — health report
- `compact` — decay/cleanup

**CLI** wraps the same operations for human use: `codeintel query "auth"`, `codeintel wiki auth-service`, `codeintel graph --from AuthService`.

**Artifacts** are readable on disk: wiki pages as markdown, graph as JSON. Everything inspectable without going through the search layer.

### Exposure Summary

Three interfaces, same underlying system:

| Interface | Audience | Use Case |
|---|---|---|
| MCP server | AI tools (Claude Code, Cursor, workflows) | Tool-to-tool queries, structured results |
| CLI | Humans, scripts, CI hooks | Manual queries, automation, freshness engine |
| Readable artifacts | Humans, any tool | Direct file reads, browsing, debugging |

### Relationship to Knowledge Base Design

The knowledge base design (Orama, RAG, semantic search) for agentic-workflows was the genesis of this idea. The KB design is really two things fused together:

**1. Search/storage infrastructure** (generic): Orama, embeddings, chunking engine, MsgPack persistence, CLI commands, provider driver pattern, error handling, file locking.

**2. Workflow artifact pipeline** (workflow-specific): Phase-aware chunking configs, confidence tiers mapped to phases, decay rules based on work unit completion, metadata filtering by work_unit/phase/topic/work_type, manifest CLI integration, Step 0 hooks.

Under the standalone product model, these separate cleanly:

**Transfers to codeintel core (70-80% of KB design):**
- Orama as storage engine
- MsgPack serialization
- Embedding provider driver pattern (OpenAI, Stub, future)
- Chunking engine (generalized — "source-aware" instead of "phase-aware")
- CLI command structure (query, index, remove, compact, check, status, rebuild)
- Two-step retrieval pattern
- Error handling and resilience (retry, pending queue, file locking)
- Provider mismatch detection
- Testing strategy
- Build approach (esbuild bundle)

**Stays in workflow system as adapter (20-30% of KB design):**
- Phase-specific chunking JSON configs (passed to codeintel via MCP tool params)
- Confidence tiers mapped to workflow phases
- Decay rules based on work unit completion dates
- Workflow metadata fields (work_unit, phase, topic, work_type)
- Step 0 codeintel availability check
- Phase-completion indexing calls via MCP
- Cancellation/supersession/promotion removal logic

**New work for codeintel (not in KB design):**
- Code wiki system (bootstrap, enrichment, refresh)
- AST graph (tree-sitter WASM, entity extraction, traversal)
- Git intelligence (log analysis, velocity metrics)
- Test map, dependency layer, schema layer, API surface
- Freshness engine (git hooks, staleness, scheduled refresh)
- MCP server interface
- Content source plugin architecture

At time of writing, 5 of 8 KB implementation phases are complete. The core infrastructure (Orama store, chunking engine, embedding providers, CLI commands) is built and proven. This work transfers directly to codeintel — it IS the codeintel core. The skill integration work (phase 5) refactors into the workflow adapter.

### Dependency Impact: Workflows Consuming Codeintel

**Chosen approach: MCP with optional detection (Option C).**

Codeintel runs as an MCP server. Workflows check for codeintel MCP tool availability at Step 0 (alongside migrations). If present, use it. If absent, workflows function as they do today — no KB, no code intelligence. Users get value from workflows immediately, then unlock a richer experience by adding codeintel.

**Why this approach over alternatives:**

*Required dependency (rejected):* Raises install barrier. Every workflow user would need codeintel set up (embedding provider, API key) before any workflow works. Currently workflows work immediately after `agntc add`.

*Bundled core with optional full (rejected):* Bundling a minimal codeintel inside workflows creates version sync headaches and partial functionality confusion.

*MCP with optional detection (chosen):* Zero barrier for workflows. Clean decoupling. Independent versioning. `agntc add` could auto-configure the MCP server if codeintel is detected. No bundled code from codeintel in workflows — just MCP tool calls.

**Impact on workflow skills:**

- Step 0: Currently runs `knowledge check`. Changes to: check for codeintel MCP tools → if available, run `compact` and set a flag. If absent, skip (workflows work without it).
- Phase completion: Currently calls `knowledge index <file>`. Changes to: if codeintel available, call `index` MCP tool with workflow metadata. If absent, skip.
- Retrieval: Currently calls `knowledge query`. Changes to: if codeintel available, call `query` MCP tool. If absent, no contextual retrieval (as before KB).
- Cancellation: Currently calls `knowledge remove`. Changes to: if codeintel available, call `remove` MCP tool. If absent, skip.
- `allowed-tools`: MCP tool permissions replace direct script execution permissions.

**Migration for existing KB users:**

When workflows upgrade to the codeintel-based version, a migration script detects the old `.workflows/.knowledge/` store. Options: migrate data to codeintel's store automatically, prompt user to run `codeintel import`, or re-index from source artifacts (safe since artifacts are the source of truth).

### Dependency Landscape Change

Orama was chosen for zero-native-dep distribution via `npx agntc add`. As a standalone product, the distribution model changes.

**What relaxes:** Users explicitly install the product (not a silent sub-dependency). Can have its own install step, prebuilt binaries, postinstall scripts. An MCP server that stays running amortises load-once costs — Orama's memory-resident model becomes an advantage.

**What still matters:** "Just works" on any dev machine is critical for adoption. Native deps requiring build tools (node-gyp, python, compilers) are still friction. Cross-platform coverage (macOS, Linux, Windows, ARM, x86) required.

**Storage engine assessment:**

| Option | Pros | Cons |
|---|---|---|
| **Orama (keep)** | Proven (5 phases built), zero deps, 90KB, hybrid search. MCP server model (load once, serve many) plays to its strengths. | Memory-resident (entire index loads), no graph support, one vector field per query |
| **better-sqlite3 + sqlite-vec** | Disk-based, SQL queries, mature ecosystem, prebuilt binaries. Could store graph + search in one DB. | ~8MB binary, prebuilt binaries don't cover every platform, native dep |
| **sql.js (SQLite WASM)** | Zero native deps like Orama, disk-friendly, SQL | Slower than native SQLite, no sqlite-vec |

**Recommendation:** Keep Orama as starting point. It's proven in existing KB work, the MCP server model plays to its strengths, and switching search engines is a migration cost with no immediate payoff. The graph is a separate data structure anyway (JSON + JS traversal) — doesn't need to live in the search index. Design the API so the storage backend is swappable (the existing provider/driver pattern already does this). If scale becomes a problem later (index too large for memory, deserialize too slow), native SQLite migration becomes justified.

**Tree-sitter WASM** is the only significant new dependency:
- `web-tree-sitter`: ~2MB WASM binary, runs in Node, no native compilation
- Language grammars: ~200KB-1MB each as WASM files
- Ship common grammars (JS/TS, Python, Go, Rust, Java, PHP, Ruby ≈ 5-8MB) or download on-demand and cache
- Zero native deps via WASM — aligns with "just works" constraint

### Architecture Diagram (Standalone Product + Workflow Consumer)

```
┌──────────────────────────────────────────────────────┐
│                   Consumers                           │
│                                                       │
│  Claude Code    Cursor    Workflows    Any AI Tool    │
│      │            │          │              │         │
│      └────────────┴──────┬───┴──────────────┘         │
│                     MCP / CLI                         │
├──────────────────────────────────────────────────────┤
│          Codebase Intelligence (the product)           │
│                                                       │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌─────────┐ │
│  │Code Wiki│ │AST Graph │ │Git Intel  │ │Test Map │ │
│  └────┬────┘ └─────┬────┘ └─────┬─────┘ └────┬────┘ │
│       └────────────┼───────────┼──────────────┘      │
│                    ▼           ▼                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │          Search / Storage Core                   │ │
│  │   Orama + Embeddings + Chunking + Persistence    │ │
│  └─────────────────────────────────────────────────┘ │
│                    ▲                                  │
│              Content Sources (plugins)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Workflow  │ │   PR     │ │  Schema  │ │  Deps  │ │
│  │ Adapter   │ │ Intents  │ │  Layer   │ │ Layer  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
└──────────────────────────────────────────────────────┘

Workflow Adapter lives in agentic-workflows repo.
Calls codeintel MCP tools with workflow-specific metadata.
Handles phase-aware chunking, confidence tiers, decay rules.
```
