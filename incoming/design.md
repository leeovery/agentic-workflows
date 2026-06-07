# Incoming: Off-Topic Surfacing + Shared Topic-Creation Infra

**Status:** In progress

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
hardened shared infra: an atomic `create-topic` CLI command + a `create-topic.md` shared reference.

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

## Component 1 — `create-topic` CLI command (atomic)

`skills/workflow-manifest/scripts/manifest.cjs`. Mirrors `cmdInitPhase`'s lock/atomic pattern: one
`withLock` → `readManifest` → in-memory mutations → single `writeManifestAtomic`.

```
create-topic <work-unit>.<topic> [--phase research|discussion] --routing <r> --source <src> [--summary s] [--description d]
```

- First positional is a **two-segment** dotted path `wu.topic` (the discovery item it addresses) — a
  deliberate divergence from `init-phase`'s three-segment `wu.phase.topic` (phase is a flag here, not
  a path segment).
- Always creates the **discovery** item with `routing`/`source` (required) + `summary`/`description`
  (optional) on the discovery item.
- `--phase` additionally creates `phases.{phase}.items.{topic} = {status:'in-progress'}` — status
  only (preserves the existing asymmetry: the four fields live on the discovery item).
- `--summary`/`--description` truly omittable (key absent, not `""`).
- **Errors if either target item already exists** (checked before any write) — removes the
  half-built-topic hazard outright.
- `--phase` and `--routing` validated against `research`/`discussion`.

## Component 2 — `create-topic.md` shared reference

`skills/workflow-shared/references/create-topic.md` encodes the **common core** only: name-validation
loop, idempotent `pull dismissed`, the `create-topic` CLI call, no commit (returns dirty to caller).

Stays site-specific: artefact creation/templates, originating-side markers, summary/description
generation, commit messages + staged paths, post-action prompts, trigger/offer gates.

**Behaviour-preservation note:** §F and research-split today pull dismissed *only* on
`matches-dismissed`; the shared reference pulls *unconditionally*. Observably identical — `pull` is a
no-op when the name is absent, and on the `ok` path the name is never in dismissed.

## Component 3 — Incoming (the new behaviour)

**Substrate:** `## Incoming` with a `(none)` placeholder in both templates; `initialize-*` seed it;
new `drain-incoming.md` + `incoming-landing.md` shared references; `incoming:{origin}` provenance.

**Landing** (`incoming-landing.md`): recompute target lifecycle at landing time (never cached). New →
`create-topic --phase {routing}`; fresh → plain `init-phase`; in-flight/decided → append `### {concern}`
subsection + reopen if completed. If the resolved target is the current topic, route to normal
subtopic handling, not Incoming.

Entry shape:
```
### {concern}
*From: {origin} · {phase} · session {NNN} · {date}*

{concern as captured}
```

**Drain** (`drain-incoming.md`): runs once at session start (before the loop, regardless of the
findings check), invoked from both initialize and resume/reopen paths. Discussion → `pending`
subtopics; research → seed threads in the body. Delete each folded subsection; reset to `(none)`.

**Conclusion gate:** `conclude-{discussion,research}.md` block with a `⚑` callout when `## Incoming` ≠
`(none)`. `document-review.md` gains an Incoming-consistency check on both sides.

**Reopen-bridge hazard:** re-concluding a reopened *decided* topic re-fires the pipeline bridge. The
reopen path must detect existing downstream phase work and at minimum surface a `⚑` warning before
re-concluding. KB re-index on re-conclude is safe (idempotent).

## PR stack

- **PR 0** — this design-log doc (long-lived, merge last).
- **PR 1** — `create-topic` CLI + tests.
- **PR 2** — `create-topic.md` shared ref + migrate full-spawn sites (§F, topic-splitting).
- **PR 3** — migrate discovery-only sites (confirm-and-persist, ensure-discovery-item, analysis-approval-gate).
- **PR 4** — Incoming substrate (templates, initialize-*, stubs, CLAUDE.md provenance).
- **PR 5** — Incoming landing (full incoming-landing.md, trigger wiring, non-epic routing).
- **PR 6** — drain + conclusion gate + reopen guard.

PRs 1–3 are a behaviour-preserving no-op refactor. Only PRs 4–6 introduce new behaviour.

## Verification

- CLI: `bash tests/scripts/test-workflow-manifest.sh` green incl. new create-topic cases; manual runs
  against a temp `.workflows/` fixture for full-spawn, discovery-only, duplicate-error, omitted-field,
  missing-flag paths.
- Refactor no-op: diff resulting `manifest.json` + artefact before vs after migration on a temp
  fixture — byte-identical (modulo intended content); commit messages/staged paths unchanged.
- Incoming e2e (temp epic fixture): land new/fresh/decided targets; drain folds + removes; conclude
  blocked on non-empty Incoming; non-epic offers inbox/pivot/ignore with no Incoming section.
- Lifecycle/provenance: `discovery.cjs <wu>` renders reopened target actionable, shows "from {origin}".
- KB safety: stub creation triggers no `knowledge index`; index only at conclude (idempotent on re-conclude).
