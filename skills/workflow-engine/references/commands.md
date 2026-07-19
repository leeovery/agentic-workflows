# Engine Commands

*Reference for **[workflow-engine](../SKILL.md)***

---

The CLI door: `node .claude/skills/workflow-engine/scripts/engine.cjs <command> [args]`. Skill prose prescribes these calls at exact points; this catalogue exists for understanding a command's full contract.

**Response contract (every mutation/transaction):** one decision-ready JSON line on stdout — `{"ok": true, …}` with derived state riding so no follow-up read is needed. Failures: `{"ok": false, "error": "…"}` on stderr, exit 1. Knowledge-base side effects are warn-don't-block — failures land in `warnings`, never abort. Commands that commit report `committed` (short sha, or `null` plus a note on a clean tree); commands documented as commit-free rely on the calling flow's commit cadence. Every engine-made commit also stages `.workflows/.knowledge` when it exists.

## Grammar

Every command follows six rules — new commands must too:

1. **Identity is positional, in containment order**: `{work-unit}`, then `{topic}`, then `{item}`.
2. **Required values with closed vocabularies are positional enums** (`discussion-map set … {state}`, `cache stamp {wu} research-analysis|gap-analysis`, `workunit create {wu} {work-type}`).
3. **Payloads are always named flags, even when required** (`-m {message}`, `--findings-file {path}`).
4. **Optional modifiers and alternate addressing are flags** (`--skipped`, `--parent`, `--external {id}`).
5. **Mappings are `key=value` pairs** (`discovery-map sequence {wu} {topic}={order} …`).
6. **A reserved word sharing a slot with user-named values must be a flag** — why `commit --inbox`/`--workflows` are flags beside positional `commit {work-unit}`.

Documented exception to rule 2: `discovery-map add` takes its required closed vocabulary as a flag (`--routing <research|discussion>`), while `reroute` takes the same vocabulary positionally.

## Commands

**`boot`** — the entry pipeline: runs `workflow-migrate/scripts/migrate.sh` (resolved relative to the engine, cwd = project root), then `knowledge check`, then `knowledge compact` when ready — one call in place of the sequential Step 0 commands. Response: `{"ok": true, "migrations": {"changed": false, "output": "<trimmed report>"}, "knowledge": "ready"|"not-ready", "compacted": false, "kb_committed": null, "warnings": []}`. `migrations.changed` mirrors migrate.sh's own files-updated signal; `output` is the report with the prose stop-gate lines stripped (update counts kept). A failing migrate.sh is a hard error (`{ok:false}` on stderr, exit 1) — migrations must never half-run silently. A failing `check` reports `not-ready`, and boot never initialises anything itself: a not-ready response additionally carries `"system_config": {"status": "valid"|"absent"|"invalid", "provider": <name|null>, "model": <name|null>}` — read from `~/.config/workflows/config.json` only, never the credentials file, so no secret can enter the response — which the calling skill's knowledge gate branches on to drive `knowledge setup` conversationally. A failing `compact` lands in `warnings`, never blocks. When the store is ready, knowledge-store dirt boot finds is committed scoped to `.workflows/.knowledge` (`chore(knowledge): initialise store` for untracked store files — the first boot after a `knowledge setup` run; `chore(knowledge): compact store` otherwise; sha in `kb_committed`, commit failure a warning). The conversational pieces (migration summary, review gate, the knowledge gate) stay in the calling skill.

```bash
engine boot
```

**`manifest`** — the field surface: read and write work-unit manifest fields by dot-path. Thin dispatch in `engine.cjs`, logic in `domain/fields.cjs`, schema validation and locking from the kernel modules.

**Dot-path addressing.** Every command takes `command <dotpath> [field] [value]`. The path joins work unit, phase, and topic with dots; segment count determines the access level:

| Segments | Level | Path | Field | Resolves to |
|----------|-------|------|-------|-------------|
| 1 | Work unit | `my-epic` | `work_type` | `work_type` |
| 2 | Phase | `my-epic.planning` | `format` | `phases.planning.format` |
| 3 | Topic | `my-epic.discussion.auth-flow` | `status` | `phases.discussion.items.auth-flow.status` |

Topic-level access routes through items (`phases.{phase}.items.{topic}.{field}`); the field argument may itself be a dot-path (`sources.auth-api.status`). The wildcard topic `*` collects from every item in a phase (`get`/`exists` only; `get` returns a JSON array of `{topic, value}` objects). The reserved prefix `project` routes to the project manifest (`.workflows/manifest.json`) with the field embedded in the dot-path — `get project.defaults.plan_format`, `set project.defaults.plan_format {format}` — which is why `project` is a reserved work-unit name (dots and phase names are also barred, enforced at `workunit create`).

**Output contract, deliberately split.** Reads print bare stdout — they are prose substitution surfaces: scalars raw (no quotes), subtrees as two-space-indented JSON, `exists` printing `true`/`false` (always exit 0), `key-of` the bare key, `list` a JSON array of manifests, missing `get` paths empty stdout exit 0. Read errors keep `Error: …` on stderr with exit 1 (real error) or exit 2 (expected miss — `key-of`/`resolve` on a missing work unit, or a `key-of` value not found; `get` misses are the empty-stdout exit 0 above, never exit 2). Mutations answer with the engine's one-line JSON response and fail as `{"ok": false, "error": …}` stderr exit 1 like every other verb.

```bash
engine manifest get    <dotpath> [<field.path>]          # scalar raw / subtree JSON; missing → empty, exit 0
engine manifest set    <dotpath> <field> <value> [<field>=<value> …]
engine manifest push   <dotpath> <field> <value>         # append, creating the array
engine manifest pull   <dotpath> <field> <value>         # remove first deep-equal match; no-op safe
engine manifest delete <dotpath> <field.path>            # errors when the path is absent
engine manifest exists <dotpath> [<field.path>]          # true/false, always exit 0
engine manifest list   [--status <s>] [--work-type <t>]  # JSON array of manifests
engine manifest key-of <dotpath> <field.path> <value>    # reverse lookup (e.g. task_map external → internal)
engine manifest resolve <work-unit>.<phase>[.<topic>]    # artifact paths for KB-indexed phases
```

`set` batches: additional `<field>=<value>` pairs after the positional pair land under one lock in one write, answered by one response listing every field written (`{"ok": true, "path": …, "set": {…}}`); pairs split on the **first** `=` only, so values may contain `=`. Values parse as JSON first (arrays, objects, numbers, booleans), falling back to string; a bare `~` is null, the same sentinel `task complete --next-task` takes — shell-quote anything zsh would eat (`'[]'`, `'{}'`, `'~'`). Validation is schema-driven (`kernel/manifest-schema.cjs`): `work_type`, work-unit `status`, per-phase item statuses (discovery's empty vocabulary refuses every status write — map items carry no status), and `*_gate_mode` fields; a refused value fails a whole batch with nothing written. Mutation responses: `set` echoes the fields written; `push` carries `pushed` and the new `length`; `pull` carries `removed` (`false` on any no-op) and `length`; `delete` carries `deleted: true`.


**`workunit`** — work-unit lifecycle. `create` is the work-type commit — discovery's durability boundary as one transaction. It creates the manifest (identity fields, `status: in-progress`, empty phases, project-manifest registration; an existing manifest is reused as-is, `created: false`), copies each `--import` into `imports/`, moves each `--seed` — a live inbox path, its folder deriving the `inbox:{idea|bug|quickfix}` source tag — into `seeds/`, installs the `--session-log-file` content verbatim as `discovery/sessions/session-001.md` (the content is model-authored — the engine never writes prose; a creation outside discovery passes `--no-session-log` instead — log-less must be explicit — landing no log and, for an epic, no `active_session` marker), sets `phases.discovery.active_session = "001"` for an epic, and commits scoped to the work unit plus `.workflows/.inbox` when seeds moved out of it (`discovery({wu}): create work unit ({work_type})` — engine-owned message). Landing filenames are normalised (lowercase; whitespace/punctuation runs → `-`; repeats collapsed; `.md` forced; imports normalising to dotfiles are skipped and reported in `skipped_imports`, seeds fall back to `seed.md`) and collisions are suffixed `-2`, `-3` against both the destination directory and the batch; every landing gets an `imports[]`/`seeds[]` manifest entry with a fresh ISO-8601 UTC timestamp and a knowledge-base index (warn-don't-block). Validation completes before any mutation — a missing import fails the whole call with `{"ok": false, "error": …, "missing_imports": […]}` so the calling flow can re-prompt and re-run against untouched state. Response: `{"ok": true, "work_unit": …, "work_type": …, "created": bool, "imports": [{"path": …}…], "seeds": [{"path": …, "source": …}…], "skipped_imports": […], "session_log": …, "committed": "<short-sha>", "warnings": []}`.

`complete`, `cancel`, and `reactivate` are the lifecycle transactions, each one transaction: manifest write, knowledge-base sync (warn-don't-block), scoped commit (`.workflows/{wu}`). `complete` sets `status: completed` and stamps `completed_at` (today, UTC — same form as `created`); its commit message rides on `-m` because it varies by caller (manual completion vs pipeline-terminal vs review-skipped — the engine can't derive how completion happened). No knowledge-base action — completed units retain their chunks. `cancel` sets `status: cancelled` and removes the unit's chunks (`knowledge remove --work-unit`); commit message engine-owned: `workflow({wu}): mark as cancelled`. `reactivate` restores `status: in-progress` from completed **or** cancelled, clears a stale `completed_at`, and — only from cancelled, whose removal emptied the index — re-indexes what cancellation removed (every completed artifact in an indexed phase, shape-valid `imports/` and `seeds/` entries, on-disk analysis caches, and — epics — the on-disk `discovery/sessions/session-*.md` logs); commit message engine-owned: `workflow({wu}): reactivate work unit`. Illegal transitions refuse loudly: complete/cancel refuse an already-completed/cancelled unit respectively and route the opposite closed state through reactivate; reactivate refuses an in-progress unit. Statuses are validated against the shared schema's work-unit vocabulary — the engine is never the permissive path. Responses: `{"ok": true, "work_unit": …, "status": …, "committed": "<short-sha>", "warnings": []}` plus `completed_at` (complete) or `previous_status` (reactivate); `committed: null` plus a note when nothing was staged.

`pivot` converts an in-progress feature to an epic as one transaction: flips `work_type: epic` in the work-unit manifest **and** the project manifest's registration (upserted when a legacy unit predates registration), registers the feature's single topic (topic name = work unit name) on the discovery map with backfill semantics (`routing` = `research` when the research phase exists, else `discussion`; summary/description left for the next epic entry's summary-backfill), re-indexes the whole unit via the same walk reactivate uses — chunk metadata carries `work_type`, which is why pivot re-indexes — and commits both manifests (`workflow({wu}): pivot to epic`, engine-owned). Refuses a non-feature, a unit that isn't in-progress, and a topic already on (or dismissed from) the map — all before anything is touched. Response: `{"ok": true, "work_unit": …, "work_type": "epic", "routing": …, "committed": "<short-sha>", "warnings": []}`.

`absorb` merges a feature into an in-progress epic as a new topic, then deletes the feature — one transaction owning the mechanical tail; the judgment (choosing the feature, the epic, and the topic name with the user) stays in the calling prose, and the verb takes the decided inputs. Validation completes before any mutation — feature exists and is a feature with a discussion (item **and** file) and no specification-or-beyond phases; epic exists, is an epic, is in-progress; the topic name is dot/slash-free and free in the epic (map item, dismissed list, discussion item, discussion file) — so a refusal leaves both work units byte-identical: no crash window between the feature's deletion and the commit. It moves the discussion to `discussion/{topic}.md`, research files (topic collisions suffix `-{feature}`, then numbered), and imports/seeds (filename collisions suffix `-2`, `-3` — create's dedupe — with manifest entries carrying their **original** timestamps and seed provenance); mirrors each phase item's status onto the epic; registers the map item with backfill semantics (`routing` = `research` when the feature did research); removes the feature's knowledge-base chunks and indexes the moved artifacts at their epic identities (completed phase artifacts; imports and seeds always — warn-don't-block); deletes the feature directory and its project-manifest registration; and lands ONE commit staging `.workflows/{feature}`, `.workflows/{epic}`, and `.workflows/manifest.json` (`workflow({feature}): absorb into {epic}`, engine-owned). The feature's `discovery/sessions/` logs are not moved — they are deleted with the feature directory; git history is provenance. Response: `{"ok": true, "feature": …, "epic": …, "topic": …, "discussion": {"path": …, "status": …}, "research": […], "imports": […], "seeds": […], "routing": …, "committed": "<short-sha>", "warnings": []}`.

`promote` moves a completed epic specification assessed as cross-cutting to its own cross-cutting work unit — one transaction owning the mechanical tail; the judgment (the assessment, the cc unit's name, the one-line description, user confirmation) stays in the calling prose, and the verb takes the decided inputs. Validation completes before any mutation — the source is an in-progress epic whose topic carries a `completed` specification item with `specification.md` on disk; the `--to` name passes the work-unit name rules (create's own) and is free (no `.workflows/{to}` directory, no project-manifest registration); spec source names that would break path addressing refuse as tampered — so a refusal leaves the epic byte-pristine and no cc unit exists. It moves the spec directory to `specification/{to}/` (topic = work unit name for a cross-cutting unit), moves each spec source whose discussion file exists on disk into the cc unit's `discussion/` (registered `completed` — sources of a completed spec were incorporated; the epic's own discussion items stay, git history is provenance), creates the cc manifest log-less and already completed (`status`/`completed_at` — the cc pipeline is terminal after spec — plus `source_work_unit`/`source_topic` origin provenance and the spec item's `date`, all stamped today UTC), registers it in the project manifest, sets the epic's spec item to `status: promoted` + `promoted_to: {to}`, syncs the knowledge base (moved artifacts indexed at their cc identities, the epic's old chunks removed — warn-don't-block), and lands ONE commit staging `.workflows/{wu}`, `.workflows/{to}`, and `.workflows/manifest.json` (`spec({wu}): promote {topic} to cross-cutting work unit`, engine-owned). Response: `{"ok": true, "work_unit": …, "topic": …, "cc_work_unit": …, "cc_status": "completed", "discussions": [{"name": …, "path": …}…], "specification": {"path": …}, "status": "promoted", "promoted_to": …, "committed": "<short-sha>", "warnings": []}`.

```bash
engine workunit create <work-unit> <work-type> --description <text> (--session-log-file <path> | --no-session-log) [--import <path> …] [--seed <path> …]
engine workunit complete <work-unit> -m "<message>"
engine workunit cancel <work-unit>
engine workunit reactivate <work-unit>
engine workunit pivot <work-unit>
engine workunit absorb <feature> --into <epic> --topic <name>
engine workunit promote <work-unit> <topic> --to <cc-work-unit> --description <text>
```

**`discussion-map`** — Discussion Map subtopic writes. `add` and `set` each load the work unit's manifest, apply the transition, save atomically, and print one decision-ready JSON line: `{"ok": true, "subtopic": "…", "status": "…", "all_decided": false, "unresolved_count": N}` — no follow-up read needed, and no git commit (the calling session's commit cadence picks the manifest change up).

```bash
engine discussion-map add <work-unit> <topic> <subtopic> [--parent <subtopic>]   # new subtopic, starts pending
engine discussion-map set <work-unit> <topic> <subtopic> <state>                 # pending|exploring|converging|decided|deferred
```

Subtopic names are kebab-case slugs; `--parent` nests under an existing top-level subtopic (two levels max).

**`discovery-map`** — the Discovery Map's writes. `sequence` records the suggested execution order as one transaction: validates every topic exists under `phases.discovery.items` and every order is a positive integer, sets each topic's `order`, and commits scoped to the work unit (`discovery({wu}): sequence topic map`); response `{"ok": true, "ordered": {"{topic}": N, …}, "committed": "<short-sha>"}` (`committed: null` plus a note when nothing was staged). Choosing the order is the caller's judgment — the command only records it.

The per-item map operations write the manifest with no git commit (the calling session's commit cadence picks the change up) and enforce the map's lifecycle gates in the engine, deriving each item's lifecycle with the same join the epic detail builder uses. `add` creates a map item as `{routing, source, summary[, description]}` — never a `status` field (map-item lifecycle is computed at render time, not stored); `--source` defaults to `discovery`, the name follows rename's dot/slash-free rule, an active duplicate is refused, and a dismissed name is refused unless `--force-dismissed` carries the user's confirmed re-add decision (the entry is then pulled off the dismissed list); the response carries `map_total` so the calling flow needs no follow-up read. `--backfill` (mutually exclusive with `--summary`/`--description`) lands the item without either field — keys absent, not `""` — so the next epic entry's summary-backfill drafts them from the topic's artifacts; for topics arriving with work already done (absorb, pivot). `edit` sets `summary` and/or `description` — at least one flag, any lifecycle. `remove` hard-deletes a **fresh** item and pushes its name onto `phases.discovery.dismissed`. `rename` moves a **fresh** item to a new key preserving every field and its map position; the new name must not collide with an active item (a dismissed-list match is allowed — the entry is left alone) and must be dot/slash-free. `reroute` sets a **fresh** item's `routing`. `handle` sets `handled: true` (any lifecycle except handled/cancelled); `reactivate` clears the marker (handled only). Gate refusals name the blocking lifecycle and the recovery path (e.g. `"X" can't be removed — research is in flight on it; cancel from the epic menu instead`). Responses: `{"ok": true, "work_unit": …, "name": …, "op": …, "lifecycle": …}` plus op-specific fields — add and edit echo the values written (add also `undismissed` when forced past a dismissed match), remove carries `dismissed: true`, rename carries `renamed_from`/`preserved_fields`/`matches_dismissed`, reroute `routing`, handle/reactivate `handled`.

```bash
engine discovery-map sequence <work-unit> <topic>=<order> [<topic>=<order> …]   # suggested execution order, scoped commit
engine discovery-map add <work-unit> <name> --routing <research|discussion> (--summary <text> [--description <text>] | --backfill) [--source <tag>] [--force-dismissed]
engine discovery-map edit <work-unit> <name> [--summary <text>] [--description <text>]
engine discovery-map remove <work-unit> <name>       # fresh only; name lands on the dismissed list
engine discovery-map rename <work-unit> <old> <new>  # fresh only; every field preserved
engine discovery-map reroute <work-unit> <name> <research|discussion>   # fresh only
engine discovery-map handle <work-unit> <name>       # any lifecycle except handled/cancelled
engine discovery-map reactivate <work-unit> <name>   # handled only
```

**`discovery-session`** — epic discovery-session finalisation. `close` ends the session the `phases.discovery.active_session` marker names, as one transaction: delete the marker (resume detection on the next entry sees a closed session), index the marker's session log into the knowledge base (warn-don't-block), and commit scoped to the work unit with the caller's message — one call covers whatever the session left dirty (map writes, the log's Topics Identified and Conclusion, harvest briefs). The message rides on `-m` because it varies by caller (topics synthesised vs edits-only finalisation). The log's content is model-authored **before** the call — the engine never writes prose. Refuses loudly, manifest untouched, when no marker is set (the marker is set at the log's first write and always pairs with an existing log, so a browse-only session has nothing to close) or when the marker names a session with no log on disk. Response: `{"ok": true, "work_unit": …, "session": "NNN", "session_log": …, "committed": "<short-sha>", "warnings": []}` (`committed: null` plus a note when nothing was staged).

```bash
engine discovery-session close <work-unit> -m "<message>"
```

**`topic`** — phase-item transitions. `start`, `complete`, and `supersede` are lifecycle bookkeeping with no git commit — the calling flow's commit cadence picks the manifest change up. `start` creates the phase item with `status: in-progress` when absent (init-phase semantics: `phases.{phase}.items.{topic}`, status only) or sets an existing item back to `in-progress`; a completed item errors — resuming is not starting — and a cancelled item must go through `reactivate`. Response: `{"ok": true, "phase": "…", "topic": "…", "status": "in-progress", "created": bool}`. `complete` sets `status: completed` on an existing item and, when the phase is research/discussion/investigation/specification, indexes the phase artifact into the knowledge base. Response: `{"ok": true, "phase": "…", "topic": "…", "status": "completed", "warnings": []}`. `supersede` sets `status: superseded` and `superseded_by: {topic}` (always the absorbing **topic** name) and removes the item's chunks from the knowledge base — legal only in phases whose shared-schema status vocabulary contains `superseded` (schema-driven, no hardcoded list). The `--by` topic must already exist in the same phase; a proposed item is refused (no artifact — reconcile deletes it instead), an already-superseded item is refused, and a cancelled item must go through `reactivate`. No commit — supersession is batch-oriented; the calling flow supersedes the set, then commits once. Response: `{"ok": true, "phase": "…", "topic": "…", "status": "superseded", "superseded_by": "…", "warnings": []}`.

`cancel` and `reactivate` are the epic transactions, each one transaction: manifest write (stash/restore `previous_status`, cancel also drops the topic's discovery-map `order`), knowledge-base sync (remove on cancel; re-index on reactivate when the restored status is `completed` in an indexed phase), and a commit scoped to `.workflows/{wu}` (`workflow({wu}): cancel {topic} ({phase})` / `… reactivate …`). Response: `{"ok": true, "topic": "…", "phase": "…", "status": "…", "committed": "<short-sha>", "warnings": []}` (`committed: null` plus a note when nothing was staged).

Across all five, the knowledge base is a derived index — its failures land in `warnings`, never block.

```bash
engine topic start <work-unit> <phase> <topic>
engine topic complete <work-unit> <phase> <topic>
engine topic supersede <work-unit> <phase> <topic> --by <topic>
engine topic cancel <work-unit> <phase> <topic>
engine topic reactivate <work-unit> <phase> <topic>
```

**`task`** — implementation-task bookkeeping: format-blind, manifest-side only. The engine never reads or writes a task backend and knows no plan-format names — the session does the plan surgery, these commands record it against `phases.implementation.items.{topic}`. Each command is load → apply → save plus one decision-ready JSON line; no git commit (the session's per-task commit cadence picks the manifest change up).

```bash
engine task init <work-unit> <topic>                       # create-or-resume the implementation item
engine task start <work-unit> <topic> <internal-id>        # reset fix_attempts, drop the task's fix-tracking cache file
engine task fix-attempt <work-unit> <topic> <internal-id> --findings-file <path>
engine task complete <work-unit> <topic> (<internal-id> | --external <id>) [--skipped] [--next-task <id|~>] [--phase <N>] [--phase-complete]
engine task analysis-cycle <work-unit> <topic>             # increment both analysis counters
```

`init` creates the item with `status: in-progress`, gated gate modes, zeroed counters, empty `linters`/`project_skills`, `current_phase: 1`, `current_task: null` — or, when it already exists, performs a session-only reset (three gate modes → `gated`, `fix_attempts`/`analysis_cycle_session` → 0; `analysis_cycle_total`, arrays, and progress fields untouched). Response: `{"ok": true, "mode": "created"|"resumed", "gates": {…}, "counters": {…}}`. `fix-attempt` increments `fix_attempts` and appends the findings file's content verbatim under a `## Attempt {N}` section in `.workflows/.cache/{wu}/implementation/{topic}/fix-tracking-{internal-id}.md`; response carries `attempts`, `threshold_reached` (≥ 3), and `fix_gate_mode`. `complete` pushes the internal id to `completed_tasks` (skips included — the plan carries the skip distinction), resolves `--external` by mirroring manifest `key-of` over `{wu}.planning.{topic}.task_map`, sets `current_phase`/`current_task` (`~` = null) when flagged, and pushes to `completed_phases` on `--phase-complete` (`--phase`, or the phase embedded in the internal id). `analysis-cycle` responds with `cycle_total`, `cycle_session`, `over_session_limit` (> 3), and `analysis_gate_mode`.

**`inbox`** — archive / restore / delete one or more inbox items as a single transaction. Paths are validated strictly against the inbox layout (`.workflows/.inbox/{ideas|bugs|quickfixes}/…`, archived items under `.inbox/.archived/…`) before anything moves; one commit covers the whole set (`workflow(inbox): archive {slug}` for one item, `… archive {N} items` for several — same forms for restore/delete). Response: `{"ok": true, "archived": [paths…], "committed": "<short-sha>"}` (key matches the verb: `archived` / `restored` / `deleted`).

```bash
engine inbox archive <path> [<path> …]   # live → .archived/{folder}/
engine inbox restore <path> [<path> …]   # .archived/{folder}/ → live
engine inbox delete <path> [<path> …]    # git rm archived items
```

**`cache`** — analysis-cache stamping: record that an analysis ran over the current completed inputs. Collects and checksums the input files exactly as the read side (`computeAnalysisCacheStatus` in domain/discovery-utils) does — a fresh stamp is `valid` by construction. Writes `checksum`, `generated` (current ISO timestamp), and the input file names to the kind's manifest home: `phases.research.analysis_cache` (`files`) for `research-analysis`, `phases.discovery.gap_analysis_cache` (`input_files`) for `gap-analysis` — then indexes the kind's `.state/` cache file (`research-analysis.md` / `discovery-gap-analysis.md`) into the knowledge base (warn-don't-block). Errors when no qualifying inputs exist — the analyses' preconditions skip the stamp in that case. Response: `{"ok": true, "kind": "…", "checksum": "…", "files": N, "warnings": []}`. No git commit — the calling flow's commit cadence picks the manifest change up.

```bash
engine cache stamp <work-unit> (research-analysis|gap-analysis)
```

**`commit`** — the scoped commit helper: `git add -- .workflows/{wu}` (`.workflows/.inbox` with `--inbox`, or the whole `.workflows` tree with `--workflows` — migrations touch many work units plus `.workflows/.state`) plus commit. Every engine-made commit — this helper and every transaction — also stages `.workflows/.knowledge` when it exists (exists-guarded, `domain/commit.cjs`): transactions dirty the store as a side effect of their knowledge sync, and that dirt belongs with the write that produced it. A clean tree is fine: `{"ok": true, "committed": null, "note": "nothing to commit"}`, exit 0.

```bash
engine commit <work-unit> -m "<message>"
engine commit --inbox -m "<message>"
engine commit --workflows -m "<message>"
```

**Rendering is not a runtime CLI concern.** Static chrome (signposts, boxes, gate rules) lives as literal blocks in skill prose; parameterised chrome is rendered in-process by projections. No skill flow calls a render command at runtime — the `render` command group in `engine.cjs` is a development/debugging utility only (e.g. generating a correct literal while authoring prose).
