# Plan: Incoming — off-topic topic surfacing + shared topic-creation infra

## Context

In the agentic-workflows system, when an off-topic concern surfaces mid research/discussion,
there is today **no clean way to record it against the topic it actually belongs to**. The only
moves are *fission* (elevation §F / research-split spawn a brand-new sibling) or burying it in the
current artefact. There is no way to route a concern into an **existing** topic on the discovery
map, and the spawn paths don't even check whether a matching topic already exists (so they create
duplicates).

This plan adds **Incoming**: an off-topic concern lands in an `## Incoming` section of a *target*
topic's artefact (existing or new — landing is uniform); the target's own processing skill drains
Incoming into its working map when that topic's phase next runs. Symmetric across research and
discussion. A topic can't conclude with a non-empty Incoming.

Building it surfaced that the "create a topic" sequence is **already duplicated across 6 call
sites** and is non-atomic (multi-command, with explicit "stop before commit to recover" prose
because a mid-sequence failure half-builds a topic). So the feature ships on top of extracted,
hardened shared infra: an atomic `create-topic` CLI command + a `create-topic.md` shared reference.

Outcome: off-topic concerns are never lost and never pollute the wrong artefact; topic creation is
atomic and defined once; existing spawn behaviour is unchanged.

---

## Hard Constraints (non-negotiable)

1. **CONVENTIONS.md is strictly followed on every skill-file edit.** Human review happens at the
   end; convention errors there elongate the release. Before editing ANY `skills/**/SKILL.md` or
   `skills/**/references/**/*.md`, re-read CONVENTIONS.md in full (do not pattern-match from siblings).
   Per-PR compliance checklist is in the **Convention Compliance** section below — run it before each PR.

2. **PRs 1–3 (creation infra) are a behaviour-preserving no-op refactor.** Code moves; the observable
   logic process is unchanged. No new behaviour, no "while I'm here" improvements. The only acceptable
   consolidation is one that is *observably identical* (documented explicitly for the reviewer — see
   the dismissed-pull note in PR 2).

3. **Only the Incoming system (PRs 4–6) introduces new behaviour.** Keep new behaviour out of the
   refactor PRs entirely so review can treat them as "did this preserve behaviour?" vs "is this new
   behaviour correct?".

4. **Write as if authored fresh** (CONVENTIONS.md Prose Economy). When adding Incoming to existing
   files: no `(new)` markers, no "formerly/now" notes, no migration backstory. Files must read as
   though the feature was always there. The refactor must leave migrated files reading natively, not
   as "code that was moved here".

---

## Locked Design (decided with user — do not re-litigate)

- **Storage:** Incoming lives in the **target's artefact file**, an `## Incoming` section. A `fresh`
  target with no file yet → landing creates a seed artefact stub. (Artefact-only; **not** a manifest
  array — hybrid was explicitly rejected.)
- **Surfacing is dumb + symmetric:** the landing step writes **only** `## Incoming`. It never injects
  into the target's Discussion Map / research threads. Folding Incoming → working map is the
  *consuming* process's job, identically on both sides.
- **Reopen on decided:** landing on a `completed` (decided) target also flips its phase-item status
  `completed → in-progress`. Lifecycle recomputes to actionable automatically
  (`discovery-utils.cjs:313 computeTopicLifecycle` reads live status — verified).
- **Drain = remove:** when the consuming process folds an entry in, it **deletes** that subsection
  from `## Incoming` (clean for KB indexing; git history is the audit trail).
- **Conclusion gate:** a research/discussion topic cannot conclude while `## Incoming` ≠ `(none)`.
- **Provenance:** new source value `incoming:{origin}`. Renders "from {origin}" for free via
  `discovery-utils.cjs:388 computeSourceProvenance` (splits `{x}:{y}` → label `y` — verified).
  Multi-source comma-accumulation already handled.
- **Non-epic (feature/bugfix/quick-fix):** stays single-topic, no exceptions. An off-topic concern →
  **ignore**, **surface to inbox** (`workflow-log-idea`, already exists), or **pivot to epic** then
  use the main flow. No Incoming section on single-topic artefacts.
- **Coexist with extraction:** keep extraction for already-written drift (research-split moves real
  content out of a file); Incoming is for conversational concerns not yet written up.

---

## Component 1 — `create-topic` CLI command (atomic)

`skills/workflow-manifest/scripts/manifest.cjs`. Mirror `cmdInitPhase` (line 710) lock/atomic pattern:
one `withLock` → `readManifest` → in-memory mutations → single `writeManifestAtomic`.

**Signature:**
```
create-topic <work-unit>.<topic> [--phase research|discussion] --routing <r> --source <src> [--summary s] [--description d]
```

- First positional is a **two-segment** dotted path `wu.topic` (the discovery item it addresses).
  This is a deliberate divergence from `init-phase`'s three-segment `wu.phase.topic` — the phase is a
  flag here, not a path segment. Parse it directly (split on first dot; reject further dots, mirroring
  the `name.includes('.')` guard in `cmdInit` line 501). Document the divergence in the function's doc
  comment so a maintainer doesn't "fix" it.
- Always creates the **discovery** item `phases.discovery.items.{topic} = {status:'in-progress'}` and
  sets `routing`/`source` (required) and `summary`/`description` (optional) **on the discovery item**.
- `--phase` additionally creates `phases.{phase}.items.{topic} = {status:'in-progress'}` — status only,
  no other fields (preserves the existing asymmetry: the four fields live on the discovery item, the
  phase item carries status). Assert this in the doc comment.
- `--routing` and `--source` **required** (no safe default — every call site sets a different source).
  `--summary`/`--description` **truly omittable** (key absent, not `""`) — `ensure-discovery-item.md`
  creates routing+source-only items and a later backfill distinguishes absent from empty.
- **Errors if either target item already exists** (mirror `cmdInitPhase` line 728 `die`). Check both
  targets *before* writing. This removes the half-built-topic hazard outright.
- Dispatch switch (~line 1036): add `case 'create-topic': cmdCreateTopic(args); break;`.
- Usage string (line 1033): add `create-topic` to the command list.
- `--phase` value validated against `VALID_PHASES` (line 15) restricted to `research`/`discussion`;
  `--routing` likewise.

**Tests** — `tests/scripts/test-workflow-manifest.sh` (run_cli / assert_equals harness, lines 40–113):
full-spawn (with `--phase`), discovery-only (no `--phase`), omitted summary/description (assert key
absent), duplicate-discovery error, duplicate-phase error, missing-required-flag (`--routing`,
`--source`) errors, atomicity (a failing run leaves manifest unchanged).

**`pull dismissed` stays OUT of `create-topic`** — it's a separate idempotent command, kept in the
shared reference before the create-topic call (folding it in would couple concerns and complicate the
atomic write).

---

## Component 2 — `create-topic.md` shared reference + migrate spawn sites

New `skills/workflow-shared/references/create-topic.md`. Encodes the **common core** only:

1. Name-validation loop — load `topic-name-validation.md` with `work_unit`/`proposed_name`, loop on
   `collision-active` until `ok`/`matches-dismissed`/cancel.
2. `pull {wu}.discovery dismissed "{topic}"` (idempotent no-op if absent).
3. The `create-topic` CLI call with the four fields + optional `--phase`.
4. **No commit** — returns dirty to caller (mirrors `ensure-discovery-item.md:96`), so the caller's
   commit covers artefact + manifest together.

**Stays site-specific (NOT in the shared reference):** artefact creation (different templates;
research-split additionally moves content verbatim out of the source file and deletes it), the
originating-side marker (§F's `↑ Elevated:` row; research-split has none), summary/description
*generation*, commit message + staged paths (§F: one topic; split: N topics, stages whole
`research/` dir), the post-action user prompt (split's "which topic to continue with?" STOP; §F just
returns), and the trigger/offer gates (`e`/`k`, `y`/`n`).

**Behaviour-preservation note for the reviewer (PR 2):** §F and research-split today pull dismissed
*only* on `matches-dismissed`; the shared reference pulls *unconditionally*. This is **observably
identical** — `pull` is a no-op when the name is absent, and on the `ok` path the name is never in
dismissed. Call this out explicitly in the PR description as the single intentional consolidation.

**Migration targets (PR 2, full-spawn):** `discussion-process/references/discussion-session.md` §F
(steps 1, 4) and `research-process/references/topic-splitting.md` (steps 1, 4).

**Migration targets (PR 3, discovery-only):** `discovery/references/confirm-and-persist.md`,
`shared/references/ensure-discovery-item.md`, `shared/references/analysis-approval-gate.md` — these
call `create-topic` *without* `--phase`. Split from PR 2 so the omittable-field path reviews
independently.

---

## Component 3 — Incoming (the new behaviour)

### Substrate (PR 4)
- Add `## Incoming` with a `(none)` placeholder to **both** templates:
  `discussion-process/references/template.md` (after Discussion Map, before first subtopic) and
  `research-process/references/template.md` (after Starting Point). **Pin the exact heading
  (`## Incoming`) and exact placeholder (`(none)`)** — the conclusion gate and drain detect against
  these literals.
- Update `initialize-discussion.md` and `initialize-research.md` to seed the section as `(none)`.
- New `shared/references/drain-incoming.md` — the consuming-side primitive (see Drain below).
- New `shared/references/incoming-landing.md` — the landing primitive (see Landing below).
- Provenance docs: add `incoming:{origin}` to `CLAUDE.md` (the authoritative source enumeration,
  ~line 106). No code change (`discovery-utils.cjs` handles `{x}:{y}` generically). Optionally update
  the `discovery-map/` design-log doc (secondary — historical record).

### Landing — `incoming-landing.md` (PR 5)
Recompute the target's lifecycle **at landing time, never cached** (lifecycle is live; a target
elevated earlier in the same session must resolve correctly). Three cases:

- **New** (not on map) → `create-topic.md` with `--phase {routing}`, `--source incoming:{origin}`;
  create artefact stub from template with the Incoming entry.
- **Fresh** (discovery item exists, no phase work) → plain `init-phase {wu}.{phase}.{topic}`
  (per the discovery item's `routing`) + create artefact stub. **Not** `create-topic` (it errors on
  the existing discovery item — correct).
- **In-flight / decided** (artefact exists) → append the `### {concern}` subsection to `## Incoming`;
  if the phase item is `completed`, `set {wu}.{phase}.{topic} status in-progress` (reopen).

Incoming entry shape (pin this):
```
### {concern}
*From: {origin} · {phase} · session {NNN} · {date}*

{concern as captured}
```

**Target resolution:** match the concern against the live discovery map (`discovery.cjs` output).
If the resolved target **is the current topic itself**, this is not Incoming — route to normal
subtopic handling (discussion: add to Discussion Map; research: a thread), do not land. Incoming is
strictly for a *different* target.

**Wiring the trigger:** `discussion-session.md` §F gains an Incoming branch (target new/existing)
alongside elevate/keep; research `epic-session.md` D / `topic-splitting.md` gains the
conversational-concern → Incoming path, kept distinct from the existing drift-extraction split.

### Drain — `drain-incoming.md` (PR 6)
Runs **once at session start**, before the loop and before "check for findings" (that step is skipped
on the first iteration; drain must run regardless, and must not reshuffle the map mid-turn). Invoked
from BOTH the initialize path (fresh start) and the resume/reopen path (a reopened decided topic
resumes, it doesn't initialise) — that's why drain is its own shared reference.

- **Discussion:** each `### {concern}` → a `pending` subtopic on the Discussion Map.
- **Research:** each `### {concern}` → folded into Starting Point / body as a seed thread (research
  has no formal map; the freeform body is the home).
- After folding each entry, **delete its subsection**; reset `## Incoming` to `(none)` when empty.
  Include the drained map in the same initial/resume commit.

### Conclusion gate (PR 6)
In `conclude-discussion.md` and `conclude-research.md`, before setting status `completed`: read the
artefact's `## Incoming` section; if it is not exactly `(none)`, **block** with a `⚑` callout
(CONVENTIONS.md Callout Flag) and return to the session loop. Mirror the existing review-cycle safety
net format in `discussion-session.md` §G. Add an Incoming-consistency check to `document-review.md`
(both sides) the way it already audits Open Threads drift, to catch placeholder drift.

### Known risk to handle explicitly (PR 6)
**Reopen-bridge hazard.** Re-concluding a reopened *decided* topic re-fires the pipeline bridge
(`conclude-discussion.md` terminal bridge invocation). If a downstream phase (specification+) already
consumed the first conclusion, the bridge re-triggers into it. The reopen path must detect existing
downstream phase work and handle it (at minimum surface a `⚑` warning to the user before
re-concluding; ideally the bridge already no-ops when downstream work exists — verify and document).
KB re-index on re-conclude is safe (idempotent, replaces chunks — verified).

---

## PR Stack (managed with the `stack` CLI)

Linear stack, bottom → top. PRs 1–3 are the no-op infra and merge on their own merit even if the
Incoming PRs iterate. All `manifest.cjs` + test changes live in PR 1 so the test file isn't touched
twice. Use `stack sync --dry-run` before any sync and `stack merge` (dry-run by default) per the
pr-stacked skill; squash-merge, descendants rebase onto main after each merge.

- **PR 0 (design-log, long-lived):** design doc following the `discovery-map/phase-NN-*.md`
  convention (next sequential number). Branch off main, open the PR early so it sits ready, keep
  logging decisions to it as the stack progresses, **merge last**.
- **PR 1 — `create-topic` CLI + tests.** `manifest.cjs` (cmdCreateTopic, dispatch, usage),
  `tests/scripts/test-workflow-manifest.sh`. Pure addition; breaks nothing.
- **PR 2 — `create-topic.md` shared ref + migrate full-spawn sites.** `shared/references/create-topic.md`,
  `discussion-session.md` §F, `topic-splitting.md`. Behaviour-preserving (note the dismissed-pull
  consolidation). Depends on PR 1.
- **PR 3 — migrate discovery-only sites.** `confirm-and-persist.md`, `ensure-discovery-item.md`,
  `analysis-approval-gate.md`. Behaviour-preserving. Depends on PR 2.
- **PR 4 — Incoming substrate.** both `template.md`, `initialize-discussion.md`,
  `initialize-research.md`, new `drain-incoming.md` + `incoming-landing.md` (stubs/contracts),
  `CLAUDE.md` provenance. Depends on PR 1 (uses create-topic in landing contract) — stack on PR 3.
- **PR 5 — Incoming landing.** `incoming-landing.md` (full), trigger wiring in `discussion-session.md`
  + research `epic-session.md`/`topic-splitting.md`, non-epic routing (inbox/pivot/ignore). Depends
  on PR 4.
- **PR 6 — drain + conclusion gate + reopen guard.** `drain-incoming.md` (full) invoked from
  initialize + resume/reopen paths, `conclude-discussion.md`/`conclude-research.md` gate,
  `document-review.md` consistency check (both), reopen-bridge guard. Depends on PR 4 + PR 5.

---

## Convention Compliance (run before EACH skill-file PR)

- Re-read CONVENTIONS.md in full before editing.
- Every user-facing fenced block preceded by a rendering instruction (`> *Output the next fenced block as a code block:*` / `... as markdown ...`); model-instruction blocks (bash, paths) exempt.
- Menus: `· · · · · · · · · · · ·` framing, command options first (backtick shorthand) + one prompt option last (plain bold, "Tell me…" directive), `— description`, single source of truth.
- STOP gates: exactly `**STOP.** Wait for user response.` / terminal variant.
- Headings: H2 sections, H4 `#### If`/`#### Otherwise` conditionals (lowercase, backticked values), every branch self-routes.
- Navigation: only `→ Proceed to` / `→ Return to`; reference headers `*Reference for **[skill](../SKILL.md)***`; `→ Return to caller.` default exit; no link before internal routing.
- Callout `⚑` at 2-space indent for the conclusion-gate block.
- Status terms in `[brackets]`; reopened state uses `reopened` vocabulary where displayed.
- Prose economy: no `(new)`, no historical/migration notes, no WHY where WHAT suffices; files read as authored fresh.

---

## Verification

- **CLI:** `bash tests/scripts/test-workflow-manifest.sh` — all green, including new create-topic cases. Manually run `node skills/workflow-manifest/scripts/manifest.cjs create-topic …` against a temp `.workflows/` fixture (never a real project — copy to a temp dir) for full-spawn, discovery-only, duplicate-error, omitted-field, and missing-flag paths; inspect resulting `manifest.json`.
- **Refactor (PRs 2–3) is a no-op:** for each migrated site, diff the *resulting manifest.json* and artefact produced by an end-to-end run before vs after migration on a temp fixture — they must be byte-identical (modulo intended content). Confirm commit messages/staged paths unchanged.
- **Incoming end-to-end** (temp epic fixture): (a) land a concern on a new target → discovery+phase items + stub with `## Incoming` entry, source `incoming:{origin}`; (b) land on fresh target → phase item + stub; (c) land on decided target → appended entry + status flipped to `in-progress`, lifecycle recomputes to `discussing`/`researching` via `discovery.cjs`; (d) start that target's session → drain folds entries into map/threads and removes them, `## Incoming` back to `(none)`; (e) attempt conclude with a non-empty Incoming → blocked; (f) non-epic → inbox/pivot/ignore offered, no Incoming section created.
- **Lifecycle/provenance:** `node skills/workflow-discovery/scripts/discovery.cjs <wu>` renders the reopened target as actionable and shows "from {origin}".
- **KB safety:** confirm stub creation triggers no `knowledge index`; index only fires at conclude (idempotent on re-conclude).
- **Conventions:** spot-check each edited skill file against the checklist; the final human review should find zero convention drift.
