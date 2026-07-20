# Knowledge Base

A spec written three months ago, a discussion that rejected an approach, an investigation that ruled out a cause: all of it stays queryable. The knowledge base is a local retrieval index over completed workflow artifacts, stored at full fidelity (chunks are the actual text, never summaries) with provenance attached: work unit, phase, topic, index date. It lives in your repo at `.workflows/.knowledge/` and travels with it.

## What goes in, and what deliberately doesn't

Indexed, each with an intrinsic confidence tier:

| Phase | Confidence | Character |
|---|---|---|
| `specification` | high | Validated decisions: what we decided to build |
| `investigation` | medium | Diagnostic work tied to specific symptoms |
| `discussion` | low-medium | Conversational; may contain assumptions corrected later in the same file |
| `research` | low | Exploratory; may be dead ends and unvalidated ideas |
| `imports` | low | User-shared reference material |
| `seeds` | low | The work unit's origin: promoted inbox items, verbatim |
| `analysis` | low | The research-analysis and gap-analysis caches |
| `discovery` | low | Epic exploration session logs: the running record |

Never indexed: **planning, implementation, review**. Those phases describe execution, not knowledge; searching them would surface task IDs and code fragments, not insight.

Confidence tells you how to weigh a chunk, not whether to use it. The API docs are explicit: **low confidence is not low value**. A research chunk that rejected an approach prevents the next work unit from re-exploring the same dead end; a discussion chunk showing a corrected assumption explains *why* the spec says what it says.

## The recall model

Indexing is automatic and event-driven: `engine topic complete` indexes the finished artifact, imports and seeds index at the work-type commit, epic session logs at session close, analysis caches when they're stamped. Removal is equally automatic: cancelling a work unit removes its chunks, superseding or promoting a spec removes the stale ones, reactivation re-indexes what cancellation removed. Skills never bookkeep the index by hand; it rides the engine's transactions, and its failures are warnings, never blocks.

Querying is a judgment call with stated heuristics. Phases load a shared usage guide whose bias is explicit: under-querying is the bigger risk; err toward querying. Four triggers: topic boundaries (the conversation brushes adjacent territory), upstream/downstream dependencies, unfamiliar ground, and the user asking "have we discussed this?". Queries are natural language, framed the way the original author would have written, never topic slugs:

```bash
knowledge query "why we ruled out email as a primary identity field"
knowledge query "OAuth2 PKCE flow" "token refresh handling" --boost:work-unit auth-flow
```

Hard filters (`--work-unit`, `--work-type`, `--phase`, `--topic`) exclude; `--boost:<field>` re-ranks without excluding, and the guide says to reach for boost first, because filtering by work unit throws away exactly the cross-work-unit context the store exists to keep. Results come back as provenance-tagged chunks (`[discussion | payments-overhaul/data-model | low-medium | 2026-03-10]`), and retrieval is two-step: chunks land in context cheaply, and the source file is read in full only when a chunk is load-bearing.

Just as deliberate is where querying is banned. **Not while authoring a spec** (it would pull the golden document away from its own source material; the one exception is the advisory query at [spec entry's grouping analysis](specification.md#grouping-which-discussions-become-which-specs), which chooses inputs rather than injecting content). **Not during planning** (the spec is the sole source; a gap found while planning is a blocker to flag, not a hole to fill from retrieval). **Barely during implementation** (code is the truth for *what* exists; the store answers only the rare *why*). A failed query pauses the phase for an explicit retry-or-skip decision, and a skip is recorded in the artifact so missing context is auditable.

## Modes and decay

Two search modes, auto-selected from config:

- **Hybrid**, when an embedding provider is configured: keyword plus vector search, re-ranked by boosts plus always-on confidence and recency signals.
- **Keyword-only** (BM25), when none is: a supported degraded mode, not a broken state. Exact-term queries still work; query output opens with a note flagging keyword-only mode.

`knowledge compact` is the storage backstop, run automatically at boot. Decay is **progress-based, not wall-clock**: a work unit's non-spec chunks are pruned only once enough later work has completed (weighted by work type) that they've become effectively unreachable in ranking. Specifications never decay. The threshold is configurable, and `false` disables pruning entirely.

## Setup

`engine boot` runs `knowledge check` on every `/workflow-start`. A `not-ready` store is a gate, not a crash: the boot response carries a `system_config` report (valid, absent, or invalid, plus the active provider and model, never key material) and the session walks the user through initialisation conversationally using `knowledge setup`'s non-interactive forms:

```bash
knowledge setup --from-system      # reuse existing system config
knowledge setup --keyword-only     # BM25-only project store, no provider
knowledge setup --provider openai --model {m}
knowledge setup --provider openai-compatible --base-url {u} --model {m} --dimensions {d}
```

The `openai-compatible` form covers local and self-hosted endpoints (LM Studio, Ollama, vLLM, LiteLLM). Provider configs are validated with a test embed before anything lands on disk.

API keys get unusual care: there is deliberately **no `--key` flag**, and any invocation carrying one is refused, because argv lands in shell history and process listings. Keys resolve from `$OPENAI_API_KEY` or from `~/.config/workflows/credentials.json` (mode 0600), written only by the masked-prompt `--key-only` terminal detour or the interactive wizard, both TTY-required and human-only. Setup output names the active provider and model, never key material, so no secret can transit the chat.

Config layers: `~/.config/workflows/config.json` holds system defaults shared across projects; `.workflows/.knowledge/` holds the per-project store, metadata, and config. `knowledge status` prints a full health report (chunk counts, pending retry queue, provider mismatches, orphans, unindexed artifacts); `knowledge rebuild` is the destructive human-only reset.

---

*Next: the deterministic layer everything above stands on, the [engine](engine.md).*
