# Incoming: Off-Topic Surfacing + Shared Topic-Creation Infra

**Status:** In progress

> ⚠️ **TERMINOLOGY CHANGED MID-STACK (from PR 5).** This doc is throwaway and was **not**
> back-edited, so older sections below still say "Incoming"/"elevate". The shipped names are:
> - **Section** in artefacts: `## Triage` (was `## Incoming`).
> - **Menu verb**: `reroute` — a single option that replaces *both* the old `elevate` and `incoming`.
>   `elevate` is **removed**; rerouting to a new topic is what used to be elevation.
> - **Shared ref**: `triage-landing.md` (was `incoming-landing.md`).
> - **Provenance**: `reroute:{origin}` (was `incoming:{origin}`).
> - The feature/initiative name "Incoming" and the `incoming/` dir/branch names are kept as-is.
> Future PRs (6, 7): use the new names; ignore the older terminology in the prose below.

Design log for the Incoming initiative. Its own stacked-PR effort, independent of the discovery-map
work. This doc is the durable scope reference; decisions are appended as the PR stack progresses.

## Purpose

When an off-topic concern surfaces mid research or discussion, there is today **no clean way to
record it against the topic it actually belongs to**. The only moves are *fission* (elevation §F /
research-split spawn a brand-new sibling) or burying it in the current artefact. There is no way to
route a concern into an **existing** topic on the discovery map, and the spawn paths don't even
check whether a matching topic already exists — so they create duplicates.

**Incoming** lets an off-topic concern land in an `## Incoming` section of a *target* topic's
artefact (existing or new — landing is uniform). The target's own processing skill drains Incoming
into its working map when that topic's phase next runs. Symmetric across research and discussion. A
topic can't conclude with a non-empty Incoming.

Building it surfaced that the "create a topic" sequence is **already duplicated across six call
sites** and is non-atomic (multi-command, with explicit "stop before commit to recover" prose
because a mid-sequence failure half-builds a topic). The feature therefore ships on top of extracted,
hardened shared infra: an atomic `create-discovery-topic` CLI command + a `create-discovery-topic.md` shared reference.

**Outcome:** off-topic concerns are never lost and never pollute the wrong artefact; topic creation
is atomic and defined once; existing spawn behaviour is unchanged.

## Locked design (decided with user)

- **Storage:** Incoming lives in the **target's artefact file**, an `## Incoming` section. A `fresh`
  target with no file yet → landing creates a seed artefact stub. Artefact-only; **not** a manifest
  array (hybrid was explicitly rejected).
- **Surfacing is dumb + symmetric:** the landing step writes **only** `## Incoming`. It never injects
  into the target's Discussion Map / research threads. Folding Incoming → working map is the
  *consuming* process's job, identically on both sides.
- **Reopen on decided:** landing on a `completed` (decided) target also flips its phase-item status
  `completed → in-progress`. Lifecycle recomputes to actionable automatically
  (`discovery-utils.cjs` `computeTopicLifecycle` reads live status).
- **Drain = remove:** when the consuming process folds an entry in, it **deletes** that subsection
  from `## Incoming` (clean for KB indexing; git history is the audit trail).
- **Conclusion gate:** a research/discussion topic cannot conclude while `## Incoming` ≠ `(none)`.
- **Provenance:** new source value `incoming:{origin}`. Renders "from {origin}" for free via
  `discovery-utils.cjs` `computeSourceProvenance` (splits `{x}:{y}` → label `y`). Multi-source
  comma-accumulation already handled.
- **Non-epic (feature/bugfix/quick-fix):** stays single-topic, no exceptions. An off-topic concern →
  **ignore**, **surface to inbox** (`workflow-log-idea`), or **pivot to epic** then use the main
  flow. No Incoming section on single-topic artefacts.
- **Coexist with extraction:** keep extraction for already-written drift (research-split moves real
  content out of a file); Incoming is for conversational concerns not yet written up.

## Component 1 — `create-discovery-topic` CLI command (atomic)

`skills/workflow-manifest/scripts/manifest.cjs`. Mirrors `cmdInitPhase`'s lock/atomic pattern: one
`withLock` → `readManifest` → in-memory mutations → single `writeManifestAtomic`.

```
create-discovery-topic <work-unit>.<topic> [--phase research|discussion] --routing <r> --source <src> [--summary s] [--description d]
```

- First positional is a **two-segment** dotted path `wu.topic` (the discovery item it addresses) — a
  deliberate divergence from `init-phase`'s three-segment `wu.phase.topic` (phase is a flag here, not
  a path segment).
- **Epic-only by intent** — the discovery map exists only for epics, so this is the epic topic-spawn
  primitive. Single-topic types create their topic via `init` + a single `init-phase`. The work_type
  gate lives in the callers; the CLI stays a dumb primitive.
- Always creates the **discovery** item with `routing`/`source` (required) + `summary`/`description`
  (optional) on the discovery item.
- `--phase` additionally creates `phases.{phase}.items.{topic} = {status:'in-progress'}` — status
  only (preserves the existing asymmetry: the four fields live on the discovery item).
- `--summary`/`--description` truly omittable (key absent, not `""`).
- **Errors if either target item already exists** (checked before any write) — removes the
  half-built-topic hazard outright.
- `--phase` and `--routing` validated against `research`/`discussion`.

## Component 2 — `create-discovery-topic.md` shared reference

`skills/workflow-shared/references/create-discovery-topic.md` encodes the **common core** only: name-validation
loop, idempotent `pull dismissed`, the `create-discovery-topic` CLI call, no commit (returns dirty to caller).

Stays site-specific: artefact creation/templates, originating-side markers, summary/description
generation, commit messages + staged paths, post-action prompts, trigger/offer gates.

**Behaviour-preservation note:** §F and research-split today pull dismissed *only* on
`matches-dismissed`; the shared reference pulls *unconditionally*. Observably identical — `pull` is a
no-op when the name is absent, and on the `ok` path the name is never in dismissed.

## Component 3 — Incoming (the new behaviour)

**Substrate:** `## Incoming` with a `(none)` placeholder in both templates; `initialize-*` seed it;
new `drain-incoming.md` + `incoming-landing.md` shared references; `incoming:{origin}` provenance.

**Landing** (`incoming-landing.md`): recompute target lifecycle at landing time (never cached). New →
`create-discovery-topic --phase {routing}`; fresh → plain `init-phase`; in-flight/decided → append `### {concern}`
subsection + reopen if completed. If the resolved target is the current topic, route to normal
subtopic handling, not Incoming.

Entry shape:
```
### {concern}
*From: {origin} · {phase} · {date}*

{concern as captured}
```

**Drain** (`drain-incoming.md`): runs once at session start (before the loop, regardless of the
findings check), invoked from both initialize and resume/reopen paths. Discussion → `pending`
subtopics; research → seed threads in the body. Delete each folded subsection; reset to `(none)`.

**Conclusion gate:** `conclude-{discussion,research}.md` block with a `⚑` callout when `## Incoming` ≠
`(none)`. `document-review.md` gains an Incoming-consistency check on both sides.

**Reopen-bridge hazard — verified as already handled, no guard added.** Re-concluding a reopened
topic re-fires the pipeline bridge. This is epic-only (single-topic never lands an Incoming entry, so
it never reopens via Incoming). For epics the specification phase already treats a discussion that
regressed to `in-progress` as a first-class `[extracted, reopened]` source and offers
re-incorporation (`workflow-specification-entry` `display-groupings.md` / `display-single-grouped.md`)
— the bridge re-firing into the epic menu is the *designed* path. So no warning is added; `conclude-*`
just carries a one-line note. KB re-index on re-conclude is safe (idempotent — replaces chunks).

## PR stack

Scope per PR:

- **PR 1** — `create-discovery-topic` CLI + tests (also carries this design log).
- **PR 2** — `create-discovery-topic.md` shared ref + migrate full-spawn sites (§F, topic-splitting).
- **PR 3** — migrate discovery-only sites onto the CLI directly (confirm-and-persist §A, ensure-discovery-item §D, analysis-approval-gate §C, absorb-into-epic §J, manage-work-unit pivot).
- **PR 4** — Incoming substrate: templates + initialize-* seed `## Incoming (none)`; CLAUDE.md + test declare `incoming:{origin}` provenance. (Stub *creation* on a fresh target is landing-time — PR 5.)
- **PR 5** — Incoming landing: `incoming-landing.md` (classify target → new / fresh / existing+reopen), caller-side target resolution with an ambiguity menu, trigger wiring (discussion §F, epic-research §C), non-epic routing (feature §E).
- **PR 6** — drain + conclusion gate + reopen guard.
- **PR 7** — make the off-topic `pivot` option real: extract the feature→epic conversion core (set `work_type epic`, reindex, register the discovery-map topic, `create-discovery-topic`) from `manage-work-unit.md` into a shared `pivot-to-epic.md`; `manage-work-unit` loads it (no behaviour change). Wire the off-topic `pivot` (feature §E, discussion §F non-epic) to load it, then land the triggering concern as a topic. Today `pivot` only points the user at the manage menu — a no-op the off-topic menu shouldn't pretend to perform.

PRs 1–3 are a behaviour-preserving no-op refactor. Only PRs 4–7 introduce new behaviour.

**Execution: per-PR redo.** A first pass built the whole stack in one go and violated the authoring
conventions, so the work is being redone one PR at a time. The first-pass PRs #359 and #361–#365 are
**closed** (their branches deleted); only #360 (PR 1, CLI) is kept. There is no standalone design-log
PR — the original PR 0 (#359) was deleted and this design log now lives on **PR 1's branch**, merging
to main with it. From PR 2 onward each PR is re-cut fresh on top of its redone parent, on a new branch
(old closed branches are left in place).

| PR | Branch | Base | GitHub | State |
|---|---|---|---|---|
| 1 | `idea/incoming-pr-1-create-topic-cli` | `main` | #360 | open — carries design log |
| 2 | `idea/incoming-pr-2-shared-create-topic` | PR 1 | #366 | open — redo (old #361 closed) |
| 3 | `idea/incoming-pr-3-discovery-direct-cli` | PR 2 | #367 | open — redo (old #362 closed) |
| 4 | `idea/incoming-pr-4-template-substrate` | PR 3 | #368 | open — redo (old #363 closed) |
| 5 | `idea/incoming-pr-5-incoming-landing` | PR 4 | #369 | open — redo (old #364 closed) |
| 6 | _to re-cut_ | PR 5 | — | pending (old #365 closed) |
| 7 | _to cut_ | PR 6 | — | pending — make off-topic `pivot` real |

## Decisions taken during implementation

- **Entry From-line dropped `session {NNN}`.** Research and discussion track no session number
  anywhere, so the line is `origin · phase · date`. Detection keys on the `## Incoming` heading,
  the `(none)` placeholder, and `### ` subsections — not the From line — so this is safe.
- **`create-topic` renamed to `create-discovery-topic`.** The command (and its `create-topic.md`
  shared ref → `create-discovery-topic.md`) spawns a topic onto an epic's discovery map; the old name
  read as a universal "create any topic". Single-topic types create their topic via `init` + a single
  `init-phase` and never call it, so the name now states the real epic-only scope.
- **Shared-ref output vars renamed to avoid caller collisions.** `create-discovery-topic.md` returns
  `created_topic` (§F already binds `{topic}` to the parent); `incoming-landing.md` returns
  `landed_topic`.
- **Research Incoming lives in `epic-session.md` §C (Topic Awareness)**, the conversational-concern
  home — kept deliberately distinct from §D's written-drift split. Non-epic research routing
  (log / pivot / ignore) added to `feature-session.md`.
- **Drain commits its own changes** (`{phase}({wu}/{topic}): drain incoming`) rather than folding
  into an initialize/resume commit, and is invoked **once** at the session step (discussion Step 5,
  research Step 6) — both fresh and resume/reopen funnel through it; a fresh `(none)` artefact no-ops.
- **No reopen-bridge guard.** Verification showed the epic specification phase already handles a
  reopened (regressed-to-`in-progress`) source via its `[extracted, reopened]` state and re-analysis
  offer, and single-topic types never reopen via Incoming. An initial `⚑` warning was added and then
  removed — it was redundant for epics and a false positive on the shared non-epic conclude path.
- **PR 3's discovery-only sites call the `create-discovery-topic` CLI directly, not the shared ref.**
  The ref (`create-discovery-topic.md`) is the *interactive* full-spawn helper — its section A renders a
  collision menu with `**STOP.**` and has no flag to suppress it. The discovery-only sites are
  non-interactive and several require a silent idempotent no-op (`ensure-discovery-item` §B), which the
  ref's collision menu would break. Routing them through it would inject STOP gates that never existed.
  Post-CLI the create is one line, so a wrapping ref would be parameter boilerplate with no instruction
  density. Net: ref = interactive human-naming sites; CLI = non-interactive programmatic sites.
  (`map-operations.md` §F is a topic *rename*, not a fresh spawn — deliberately excluded.)
- **PR 4 confirmed substrate-only.** It seeds the `## Incoming (none)` section into both templates +
  `initialize-*`, and declares `incoming:{origin}` (CLAUDE.md enum + one proving unit test). Nothing
  reads or writes Incoming yet. Closed #363 over-scoped "substrate" by bundling `incoming-landing.md`
  and `drain-incoming.md` (both landing/consuming behaviour) — those stay in PR 5/6.
- **`## Incoming` is terminal in both templates.** Research artefacts are freeform with no reliable
  interior `## ` boundary, so the only robust detection edge is "`## Incoming` heading → EOF". Placing
  it terminal in both templates (research: after the freeform body; discussion: after `## Summary`)
  keeps them symmetric and findable regardless of body content. Working content stays above it.
- **Elevation's hand-built seed reconciled in PR 5.** `discussion-session.md` §F builds its elevated
  seed file directly, bypassing `template.md`, so an elevated discussion won't carry `## Incoming` from
  PR 4. Left deliberately: landing (PR 5) is robust to a missing section and reconciles creation paths
  there.
- **PR 5 target resolution lives caller-side, with an ambiguity menu.** The trigger sites (discussion §F,
  epic-research §C) resolve which topic a concern belongs to before loading `incoming-landing.md`: one
  clear match → propose + confirm; several plausible candidates or an unsure near-match → present a menu
  of candidates plus an `n`/`new` option; nothing fits → propose a new kebab-case name. Creating a topic
  is therefore always user-chosen, never a silent "no exact match → create" fallback.
- **Landing classifies on `phase=` presence, not a lifecycle string.** `incoming-landing.md` keys off the
  live `discovery.cjs` row: no row → create (`incoming:{origin}` provenance via `create-discovery-topic`);
  row with no `phase=` → `init-phase` per its `routing` + stub; row with `phase=` → append to that
  artefact and reopen (flip the `phase=` item to `in-progress`) only when its status is `completed`.
  Keying on `phase=` rather than enumerating lifecycle values sidesteps the terminal `handled`/`cancelled`
  rows (no `phase=`, never proposed as sensible targets) — they fall through to the re-create path.
- **Reopen is the concluded-target path** (the case discussed at length): a concern routed onto a finished
  topic reopens its phase item so it recomputes as actionable, then drains the entry when next run.
- **Elevation's hand-built seed reconciled in landing, not in §F.** Landing §D adds the `## Incoming`
  heading if the target file lacks one (e.g. an elevated discussion seed built outside `template.md`), so
  the PR 4 gap closes here without changing the elevation flow.
- **Refactor (PRs 2–3) leaves one non-semantic diff:** discovery-item key order
  (`status,routing,source,summary,description` from `create-discovery-topic` vs the old sequential `set`
  order). Values identical.

## Verification

- CLI: `bash tests/scripts/test-workflow-manifest.sh` green incl. new create-discovery-topic cases; manual runs
  against a temp `.workflows/` fixture for full-spawn, discovery-only, duplicate-error, omitted-field,
  missing-flag paths.
- Refactor no-op: diff resulting `manifest.json` + artefact before vs after migration on a temp
  fixture — byte-identical (modulo intended content); commit messages/staged paths unchanged.
- Incoming e2e (temp epic fixture): land new/fresh/decided targets; drain folds + removes; conclude
  blocked on non-empty Incoming; non-epic offers inbox/pivot/ignore with no Incoming section.
- Lifecycle/provenance: `discovery.cjs <wu>` renders reopened target actionable, shows "from {origin}".
- KB safety: stub creation triggers no `knowledge index`; index only at conclude (idempotent on re-conclude).
