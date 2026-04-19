---
name: workflow-knowledge
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
---

# Workflow Knowledge

CLI tool for querying the workflow knowledge base — a retrieval-augmented store of all completed workflow artifacts, searchable by semantics or keyword. This file is the API documentation layer. Load it when you need to construct a query or interpret results.

## What the knowledge base is

A local semantic-search index over every completed research, discussion, investigation, and specification artifact in `.workflows/`. Content is stored at full fidelity — chunks are the actual text, not summaries — with provenance metadata attached: which work unit, which phase, which topic, when it was indexed.

**Why it exists**: to surface prior context that would otherwise be lost across work units or forgotten within one. A spec written three months ago, a discussion that rejected an approach, an investigation that ruled out a cause — all remain queryable.

**What is indexed**:

- `research` (low confidence — exploratory, may contain dead ends)
- `discussion` (low-medium — conversational, may contain corrected assumptions)
- `investigation` (medium — diagnostic, tied to specific symptoms)
- `specification` (high — validated decisions, "what we decided to build")

**What is NOT indexed**: planning, implementation, review. These phases describe execution, not knowledge. Searching them would surface task IDs and code fragments, not insight.

---

## Invocation

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs <command> [args]
```

Every skill that calls this must declare `Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)` in its `allowed-tools` frontmatter.

---

## `query` — search the knowledge base

### Single query

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs query "<search term>" [flags]
```

### Batch query

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs query "<term1>" "<term2>" "<termN>" [flags]
```

Multiple positional arguments run separate searches in one invocation, merge the results, deduplicate by chunk ID (highest score wins), then apply `--limit` to the merged set. Efficient — one store load, multiple searches. Encouraged when you want to attack the same topic from different angles.

### Flags

| Flag | Behaviour |
|------|-----------|
| `--work-type <type>` | Filter results to a work type. Comma-separated list accepted (e.g., `--work-type cross-cutting` or `--work-type epic,feature`). Hard filter — non-matching chunks are excluded |
| `--phase <phase>` | Filter to one or more phases. Same comma-separated syntax. Hard filter |
| `--topic <topic>` | Filter to one or more topics. Same comma-separated syntax. Hard filter |
| `--work-unit <wu>` | **Re-ranking hint, NOT a filter.** Boosts chunks from this work unit in post-processing. Cross-work-unit results still appear, just ranked lower. Use it to say "I'm currently working in `auth-flow`, prefer its context" — not to exclude other work |
| `--limit <n>` | Cap result count after merge + re-rank. Default 10 |

### Search modes

Two modes, auto-selected based on project config:

- **Hybrid** (default when an embedding provider is configured): keyword + vector search combined, results re-ranked by work-unit proximity, confidence tier, and recency.
- **Keyword-only** (when no provider is configured): full-text search only. Still useful — you lose semantic expansion but exact-term queries work. The output prepends a note: `[keyword-only mode — configure embedding provider for semantic search]`. This is a supported degraded mode, not a broken state.

### Query construction

Use **natural language**, not topic slugs. A query is a short description of what you're looking for, framed the way the original author would have written about it.

- Good: `"OAuth2 PKCE flow for mobile clients"`
- Good: `"why we ruled out email as a primary identity field"`
- Poor: `"auth-flow"` (topic slug — weak semantic signal)
- Poor: `"auth"` (too broad — matches everything auth-related)

Descriptive, specific, phrased in the language likely to appear in the source material. Multiple queries from different angles are encouraged — one for the decision, one for the constraint, one for the rejected alternative.

### Output format

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

- **Header line**: `[N results]` where N is the merged, deduplicated, re-ranked count after `--limit`.
- **Provenance line** (per chunk): `[phase | work_unit/topic | confidence | YYYY-MM-DD]`. Date is the indexing timestamp, approximating when the knowledge was produced.
- **Content**: the chunk text verbatim. No summarisation, no truncation.
- **Source line**: the path to the source artifact. Use this with the two-step retrieval pattern below.
- **Blank line** between chunks.
- **Empty results**: `[0 results]` — no provenance lines, nothing else. Treat as "no prior context found" — move on.
- **Stub-mode note** (when applicable): prepended as the first line before the header — `[keyword-only mode — configure embedding provider for semantic search]`.

### Confidence tiers — how to weigh results

Confidence is intrinsic to the source phase. It tells you how much weight to give the content, not whether to use it.

| Tier | Meaning |
|------|---------|
| `high` | Specification — a decision that was validated and written down. Trust the *what*, verify the *why* against the source if it matters |
| `medium` | Investigation — diagnostic work tied to specific symptoms. Trust the diagnosis, but check whether the symptom is still current |
| `low-medium` | Discussion — conversational, may contain assumptions that were corrected later in the same file. Read for context, not conclusions |
| `low` | Research — exploratory. May be a dead end, a rejected path, or an unvalidated idea |

**Low confidence is not low value.** A research chunk that rejected an approach prevents the next work unit from re-exploring the same dead end. A discussion chunk showing a corrected assumption explains *why* the spec says what it says. Don't filter out low-confidence results — weigh them.

### Two-step retrieval pattern

1. **Query** returns chunks with provenance. Lightweight — lands in your context window.
2. **Read the source file** (from the `Source:` line) only if a chunk looks load-bearing for what you're doing.

Don't read source files for every result. Most queries produce a couple of chunks that are mildly relevant and one that's directly relevant — read the one, skim the rest from the chunk text alone. This keeps context lean while preserving full-fidelity access on demand.

### What NOT to do

- **Do not dump large result sets speculatively.** `--limit 50` with a vague query produces noise. Prefer a focused query with the default limit.
- **Do not use topic slugs as search terms.** `"auth-flow"` is a weak semantic signal. Describe the thing, don't name it.
- **Do not query during the specification phase.** Spec turns discussion decisions into a golden document. Cross-cutting concerns merge at planning time via an explicit cross-cutting query, not during spec authoring. Querying mid-spec pulls the spec away from its own source material.
- **Do not prepend metadata to the query string.** The CLI already filters by `work_type`, `phase`, `topic`, `work_unit` via flags. `"auth-flow specification UUID identity"` is worse than `"UUID identity"` with `--phase specification`.
- **Do not treat `--work-unit` as a filter.** It re-ranks. If you want to exclude other work units, you probably don't — cross-work-unit context is the point of the knowledge base.

---

## `check` — readiness probe

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs check
```

Exit code is always `0` (unless the filesystem itself is unreadable). Output on stdout:

- `ready` — knowledge base is initialised and the store is loadable
- `not-ready` — missing directory, missing config, missing store, or unloadable store

Skills branch on the stdout string, not the exit code. Used in Step 0 of entry-point skills to detect an uninitialised knowledge base and direct the user to `knowledge setup`.

---

## `index` — write to the store

```bash
# Single artifact (used by phase-completion steps)
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index <path/to/artifact.md>

# Bulk catch-up (no args — finds all unindexed completed artifacts)
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index
```

- **With a file**: re-indexing replaces existing chunks for that file (idempotent). The path must match `.workflows/{work_unit}/{phase}/...` so identity can be derived.
- **Without args**: discovers every completed artifact across all work units and indexes anything missing. Used by setup and manual catch-up.
- Failures are retried (exponential backoff). Files that still fail are pushed to a pending queue and retried on the next `index` call.
- Exits non-zero if the file doesn't exist or the path can't be parsed.

Typically invoked by processing skills at phase completion — not queried by Claude during a phase.

---

## `remove` — remove chunks

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs remove --work-unit <wu> [--phase <p>] [--topic <t>]
```

Removes chunks matching the given filter. Granularity:

- `--work-unit <wu>` alone — removes every chunk for that work unit
- `--work-unit <wu> --phase <p>` — narrows to one phase
- `--work-unit <wu> --phase <p> --topic <t>` — narrows to one topic

Used when a spec is superseded or promoted, when a work unit is cancelled, or when catching up after a manifest change. `--topic` requires `--phase`.

Output: `Removed N chunks for {scope}`. Exits non-zero on usage errors.

---

## `status` — full health report

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs status
```

Human-readable report of the store's state: chunk counts by work unit, phase, and work type; last-indexed timestamp; provider info; pending queue; provider-mismatch warnings; orphan detection; unindexed completed artifacts; manifest-knowledge consistency checks. Not used in skill automation — intended for debugging and user inspection.

---

## `rebuild` and `compact` — maintenance commands

- **`rebuild`** — destructive. Deletes the existing index and re-indexes all completed artifacts. Prompts the user to type `rebuild` literally to confirm. **Human-only** — Claude cannot run it (interactive prompt). Non-deterministic: rebuilt chunks won't match the originals (embedding variance, edited artifacts).
- **`compact [--dry-run]`** — removes chunks from work units whose `completed_at` date exceeds the configured `decay_months` TTL. Specifications are exempt. `--dry-run` previews without deleting.

Skills do not call these directly during normal operation. Users run them manually.

---

## `setup` — interactive wizard

One-shot first-time setup. Handles system config (`~/.config/workflows/config.json`), project init (`.workflows/.knowledge/`), and initial indexing of all completed artifacts in a single guided flow. **Human-only** — prompts throughout via readline. Non-TTY invocations (including Claude or piped input) abort with `knowledge setup requires an interactive terminal`. If `knowledge check` returns `not-ready`, direct the user to run `knowledge setup` rather than trying to fix it programmatically. Safe to re-run: per-step prompts detect existing state and offer skip or reconfigure; the bulk index at the end only processes missing artifacts.

---

## Exit codes

- `0` — success, or `check` reporting either state
- Non-zero — usage error, file not found, unparseable path, lock contention exceeded, or unrecoverable provider mismatch

`query` with zero results exits `0` and prints `[0 results]`. `check` exits `0` for both `ready` and `not-ready`. Both semantics are intentional — skills branch on output, not on the exit code.
