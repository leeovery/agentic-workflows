# PR1 — Sessions Layout

Move discovery session logs from `discovery/session-NNN.md` into `discovery/sessions/session-NNN.md`, across every reader, with a migration for existing work units. **Pure mechanical relocation — zero behaviour change.** This is the foundation the rest of the stack rebases on.

> Read `00-overview.md` first for the design and orchestration model.

## At a glance

- **Branch:** `feat/deep-discovery-pr1-sessions-layout`
- **Base / target:** `feat/deep-discovery-pr0-docs` (the docs base, PR0)
- **Builds on:** nothing but the docs base
- **Design slice:** the `sessions/` half of the layout (`00-overview.md` → Design → Layout). Briefs/`briefs/` come in PR5.

## Why first, and why it's bigger than it looks

Every later slice references session-log paths. Landing the final path first means every later PR rebases onto stable paths. **Critical subtlety:** the path move is **not** epic-only — four single-phase (non-epic) entry points read the discovery log at a hard-coded path. They must move too, or non-epic seeding breaks. Behaviour stays identical; only the literal path changes.

## Tasks

### 1. Path edits (pattern: `discovery/session-{NNN}.md` → `discovery/sessions/session-{NNN}.md`)

Grep first to get the full set, then edit. Known sites:

**Discovery skill** (`skills/workflow-discovery/`):
- `references/template.md` — the session-log path (~line 6) and any path in the lazy-creation notes.
- `references/initialize-discovery.md` — `mkdir -p .workflows/{wu}/discovery/sessions/`.
- `references/confirm-trigger.md` — `mkdir` + `session-001.md` write path (~lines 80, 83).
- `references/session-loop.md` — session-log read path (~line 35) and any other literals.
- `references/confirm-and-persist.md` — `git add` path (~line 87).
- `references/resume-detection.md` — working-state path + `rm` path (~lines 40, 49).
- `references/document-review.md` — exists-check, re-read, `git add` (~lines 26, 46, 67).
- `references/map-operations.md` — the ~7 `git add` paths.
- `references/topic-synthesis.md` — Exploration source path (~line 13).
- `references/first-phase-routing.md` — verify (Conclusion write goes via `session_number`; confirm no literal).
- `references/show-dismissed.md` — verify (re-invokes discovery; grep showed no literal).
- `SKILL.md` — "Resuming After Context Refresh": `session-*.md` glob → `sessions/session-*.md` (~line 56).
- `scripts/discovery.cjs` — `findLatestSessionLog()` dir join (~line 39): `path.join(cwd, '.workflows', workUnit, 'discovery', 'sessions')`.

**Non-epic entry points (CRITICAL — the unchanged-path guard):**
- `skills/workflow-research-entry/SKILL.md:165` (`session-001.md`)
- `skills/workflow-discussion-entry/SKILL.md:147` (`session-001.md`)
- `skills/workflow-investigation-entry/SKILL.md:122` (`session-NNN.md`)
- `skills/workflow-scoping-entry/references/invoke-skill.md:21` (`session-NNN.md`)

### 2. Migration `045-move-discovery-sessions.sh`

`skills/workflow-migrate/scripts/migrations/045-move-discovery-sessions.sh`. Mirror `044-allow-workflows-mv.sh`.
- For every `.workflows/*/discovery/session-*.md`: `mkdir -p .../discovery/sessions/` and move the file in.
- **Idempotent:** skip if the file is already under `sessions/` (e.g. guard on the source glob existing; never double-move).
- Moves **all** work units, including single-phase ones (they have `session-001.md`).
- bash 3.2 (no `mapfile`/`declare -A`); inline `node` or pure shell `find`+`mv`; **never the manifest CLI**.
- **No manifest rewrite needed:** `active_session` holds only the NNN string; the path is reconstructed in `discovery.cjs`. Confirm by reading `discovery.cjs`.
- End with `report_update` if anything moved, else `report_skip`; `return 0`.

### 3. Test `tests/scripts/test-migration-045.sh`

Mirror `tests/scripts/test-migration-044*.sh` harness (`set -euo pipefail`, PASS/FAIL, `assert_eq` label/expected/actual, `setup`/`teardown` temp dir, `report_update`/`report_skip` stubs). Cover:
- happy path — `session-001.md` (and `-002`) moved into `sessions/`;
- idempotency — run twice, exactly one copy, no error;
- no-op when already under `sessions/`;
- content preservation — file bytes unchanged after move;
- multi-work-unit;
- single-phase work unit with `session-001.md` (the non-epic guard).

## Conventions to honour

- Path edits are mechanical, but any touched **prose** still obeys prose economy — no "(moved)"/"now in sessions/" narration; the path simply reads as `sessions/...`.
- Migration + test follow the migration conventions in `CLAUDE.md` (idempotent, bash 3.2, direct manifest I/O, mandatory test covering happy/skip/idempotency/content-preservation).

## Risks / hazards

- **Missed reader = broken non-epic seeding.** The 4 non-epic entry points are the highest risk. Grep the whole repo: `grep -rn "discovery/session" skills/ src/ | grep -v sessions` must return nothing after the edits.
- **Migration must catch single-phase work units** — they finalise via `first-phase-routing.md` and still have a `session-001.md`.
- `SKILL.md` "Resuming" block is also touched by PR2/PR3 — keep PR1's edit to the **path string only** so later rebases are clean.

## Verification

- `bash tests/scripts/test-migration-045.sh` — green.
- Run the full migration runner against a temp `.workflows/` fixture (copy to scratchpad): `PROJECT_DIR=<tmp> bash skills/workflow-migrate/scripts/migrate.sh` — confirm sessions moved, idempotent on re-run.
- `node skills/workflow-discovery/scripts/discovery.cjs <wu>` against a fixture with logs under `sessions/` — `next_session_number` / latest-log still resolve.
- `grep -rn "discovery/session" skills/ src/ | grep -v sessions` → empty.
- Full suite green.

## Definition of done

All readers use `discovery/sessions/`; migration + test green; grep clean; full suite green; no behaviour change for any work type.

## When this PR is approved

- **Confirm the approval**, then **do NOT merge** — the stack stays open and lands at the end.
- **Plan PR2 now, in this same session.** Enter plan mode and write the executable plan for **PR2** from `deep-discovery/pr-2-conversation.md`: branch `feat/deep-discovery-pr2-conversation`, base/target `feat/deep-discovery-pr1-sessions-layout`, what it builds on, the plan, verification, and its own when-approved hand-off (→ PR3).
- **Do not clear context yourself, and do not ask the user to.** When the user accepts the PR2 plan, the harness's *clear-and-proceed* carries it into a fresh session that executes PR2.
