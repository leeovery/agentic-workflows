# The Engine

The engine is the answer to a specific failure class: asking a language model to maintain state, derive status, or draw ASCII by hand produces output that is *usually* right. The workflow system's rule is that anything fully determined by data is computed in code and consumed by Claude, never re-derived in prose. The engine (`skills/workflow-engine/scripts/`) is where that computation lives.

Three rings:

- **Kernel**: mechanism. Render primitives (the wrap budget `width − prefix` exists in exactly one place, so a gutter-overflow bug can exist in only one place), `manifest-io.cjs` (one read/parse, one atomic-write serialisation, one lock protocol), and `manifest-schema.cjs` (the single vocabulary of legal work types, phases, and statuses).
- **Domain**: the workflow ontology. Transitions, transactions, queries, projections, shared derivations (lifecycle joins, next-phase computation, cache freshness), glyph and `[tag]` composition.
- **Gateway**: the harness every per-skill adapter script runs on, emitting the demarcated `DATA` / `DISPLAY` / `MENU` sections.

And two doors: the **CLI** (`engine.cjs`) for writes, called from skill prose at prescribed points, and the **library** (`lib.cjs`) that adapter scripts `require()` in-process for reads and rendering. The full command catalogue, grammar rules, and per-verb contracts live in [`commands.md`](../skills/workflow-engine/references/commands.md); the library surface in [`library-and-gateway.md`](../skills/workflow-engine/references/library-and-gateway.md). This page is the user-level view.

## The response contract

Every mutation answers with one decision-ready JSON line, with derived state riding along so no follow-up read is needed:

```json
{"ok":true,"work_unit":"venue-ordering","name":"kitchen-routing","op":"add","routing":"research",
 "source":"discovery","lifecycle":"fresh","map_total":2,"summary":"Ticket routing and printer integration options"}
```

Failures are `{"ok": false, "error": "…"}` on stderr with exit 1. Knowledge-base side effects are warn-don't-block by design: the store is a derived index, so its failures land in a `warnings` array and never abort a transaction.

## Transactions

Multi-step state changes are single engine verbs, not sequences of prose-driven commands. `workunit create` is the canonical case, discovery's [durability boundary](discovery.md#the-confirm-trigger-the-durability-boundary) as one call: manifest creation, project-manifest registration, imports copied, seeds moved out of the inbox, the session log installed, knowledge indexing, and a scoped commit. The lifecycle verbs (`complete`, `cancel`, `reactivate`, `pivot`, `absorb`, `promote`) follow the same shape: manifest write, knowledge sync, one commit.

Two properties hold across the family:

- **Validation completes before any mutation.** A `workunit create` with a missing import path fails whole, with nothing created, and reports `missing_imports` so the calling flow can re-prompt against untouched state. An `absorb` refusal leaves both work units byte-identical; a `promote` refusal leaves the epic byte-pristine with no new unit on disk. There is no crash window between a deletion and its commit.
- **Writes run under a lock, atomically.** Every load→mutate→save holds the manifest lock (an `O_EXCL` lock file, with a single-contender stale-lock breaking protocol) and lands via temp-file-plus-rename, so a crash mid-write can never leave a torn manifest.

## Refusals

The engine is never the permissive path. Illegal states are refused loudly, with schema-driven vocabularies rather than hardcoded lists. Captured live:

```
$ engine manifest set venue-ordering.research.kitchen-routing status bogus-status
{"ok":false,"error":"Invalid status \"bogus-status\" for phase \"research\". Must be one of: in-progress, completed, superseded, cancelled"}

$ engine discovery-map remove venue-ordering kitchen-routing
{"ok":false,"error":"\"kitchen-routing\" can't be removed — research is in flight on it; cancel from the epic menu instead"}
```

The second refusal shows the house style: name the blocking condition *and* the recovery path. Transition verbs enforce direction: `topic start` refuses a completed item (resuming is not starting; that's `reopen`), `reopen` refuses anything not completed, cancelled items must go through `reactivate`, and discovery's empty status vocabulary refuses every status write, because map items don't store status at all. Since the same gates run in the engine as in the prose pre-checks, the two can never disagree; the prose renders the friendlier message, the engine guarantees the invariant.

## Byte-stable renders

Dashboards, trees, maps, and menus are rendered by engine projections from typed detail structures, and Claude's contract is emit-verbatim: never redraw, reflow, or trim. The output sections are one-directional, `DATA` is for reasoning and never displayed, `DISPLAY` and `MENU` are displayed and never parsed for decisions. Byte-stability is what makes the displays trustworthy: the same state produces the same bytes every time, wrap arithmetic lives in one kernel function that throws on a misconfigured gutter rather than silently overflowing, and no session can "helpfully" restyle a dashboard. Even interactive gate menus in the [implementation loop](implementation.md#the-task-loop) arrive pre-rendered on engine responses, parameterised from manifest state.

Rendering is not a runtime CLI concern: static chrome lives as literal blocks in skill prose, parameterised chrome is rendered in-process by projections, and the CLI's `render` command group exists only as a development utility for authoring those literals.

## Commits

Engine transactions commit scoped: `git add -- .workflows/{wu}` plus the commit, so workflow state can never sweep unrelated changes along. The `commit` helper gives skill flows the same discipline (`--inbox` and `--workflows` widen the scope for the two cases that need it), and a clean tree is a success (`"committed": null`, note attached), not an error. One detail shows the care level: every engine-made commit also stages `.workflows/.knowledge` when it exists, because transactions dirty the store as a side effect of their knowledge sync, and that dirt belongs with the write that produced it rather than with some later unrelated commit. Commit messages for invariant transitions are engine-owned (`workflow({wu}): mark as cancelled`); messages that depend on *how* something happened (completing a pipeline vs skipping review) ride on `-m` from the caller, because the engine can't derive intent.

## Boot and migrations

`engine boot` is the entry pipeline behind [`/workflow-start`](how-it-fits-together.md): run all pending migrations, then `knowledge check`, then `knowledge compact` when the store is ready, one call.

```json
{"ok":true,"migrations":{"changed":false,"output":"[SKIP] No changes needed"},
 "knowledge":"ready","compacted":true,"kb_committed":"b941380","warnings":[]}
```

Migrations keep every installed project's `.workflows/` in sync with the current system design: numbered idempotent shell scripts, run in order, tracked in `.workflows/.state/migrations` so each runs exactly once per project. A failing migration is a hard `{ok: false}` stop, because migrations must never half-run silently; changed files are summarised to the user and committed with their consent. Shipped migrations are never edited; mistakes are fixed forward with a new numbered migration. On a fresh project, boot's migration pass is what creates `.workflows/` itself: 49 migrations currently reconstruct the full current layout from nothing.

---

*Next: the sub-agents the phases dispatch, in [agents](agents.md).*
