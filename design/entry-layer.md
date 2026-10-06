# Entry layer — one skill per phase, one continue skill, a lighter start

The layer between the menus and the work is shaped by a history it no
longer has: the phase entry skills (`workflow-*-entry`) and the continue
skills (`workflow-continue-*`) were once invoked by the person, and none
is now — `workflow-start` is the one door. This programme folds each
phase's entry into its process skill, merges the continue skills that
differ only by work type, and moves `workflow-start`'s rare branches out
of the path every start reads. Opened 2026-10-03 from the mod handoff
programme (`design/mod-handoff.md`), whose handoff now crosses this layer
on every move into work; it builds once that stack has landed, onto the
handoff's one table of targets.

## Motivation

- **An entry has no place of its own.** Every entry re-reads the state its
  process skill reads again, both load the framework (about 22 KB read
  twice at every phase start — measured in the handoff lab), and a
  completed topic meets a "Reopening" note and then a separate
  continue-or-restart menu.
- **Four continue skills are one.** The feature, bugfix, quick-fix and
  cross-cutting continue skills differ only in nouns, one constant and
  one result key (51 KB together); their pick-a-unit step is unreachable,
  every caller passing the unit.
- **The start menu carries its rare branches on every start.** About
  11 KB of `workflow-start/SKILL.md`'s 17.7 KB is branches that fire on a
  first run, after migrations, or on a restart.
- **Some entry content crosses to the process only as handoff text.**
  Planning's additional-context answer and cross-cutting references,
  specification's incorporations, interview answers: a fold has to make
  each a read from disk at the phase's start.

## Rulings

- **E1 — each phase's entry folds into its process skill** (Lee,
  2026-10-01). The phase skill owns its own Step 0: the checks, the status
  branch, the interview where no carrier exists.
- **E2 — the `storage_paths` backfills are dropped** (Lee, 2026-10-02).
  Nine process files record the field mid-session for a plan that
  predates it (the field arrived 2026-07-23); the checks go, with no
  migration.
- **E3 — consult references are retired** (Lee, 2026-10-06). Only the
  specification menu's route registered them; the epic menu's start row
  takes the entry's topic path, whose handoff carries no consult block, so
  a specification started there could conclude without them. No grouping
  in five epics (agntc, mint, pigeon, portal, tick) declared one, and the
  discussion-time sibling check (`knowledge-usage.md` §G), which reroutes a
  correction into the sibling's own triage queue as it is decided, has
  caught the same correction at its source since August. Where the
  grouping analysis finds a discussion owing a sibling grouping a
  correction, it writes a `**Tension**` line on the receiving grouping
  naming the sibling discussion and what it changed — session setup reads
  tension lines from the analysis file whatever route led there, and
  construction raises each. The consult machinery goes: the analysis's
  hand-off section and `**Consult**` line, the gateway's hint parser, the
  consult rows in the specification projections and the confirm gate's
  payload, the handoff blocks, session setup's registration, construction's
  narrow read, the completion check, and the `consult_references` manifest
  field, which a migration deletes wherever a released version wrote it.
  The sign-off gate goes with them: a tension is raised in construction,
  never checked again at completion.
- **E4 — the framework loads once per conversation** (Lee, 2026-10-06).
  framework.md's rule — read every file every time it is loaded, never
  skip one — was written for one long conversation, where a compaction
  summary kept the rules' conclusions and dropped their text. Every move
  into work now starts a fresh conversation, so only its first load does
  anything: a phase conversation loaded the framework at its entry, again
  at its process skill and again at the bridge, and walks skipped the epic
  menu's in-place re-read after the start menu in three runs of four. The
  hazard the rule guarded is met where it arises: all twelve long-running
  skills (the ten phase skills, discovery, the roadmap, the baseline) carry
  a context-refresh recovery protocol that re-loads the framework by name.
  - The rule becomes: loaded once per conversation; a skill opened later
    in the same conversation carries on from it; after a context refresh,
    the skill's recovery protocol re-loads it.
  - The head load stays on every skill a conversation can open on —
    `workflow-start` and every handoff target (the phase skills, the epic
    menu, discovery, the roadmap, the baseline). Where one of them is
    opened in place — the epic menu from the start menu, discovery from the
    roadmap's epic pull, the roadmap from discovery's genesis — the
    conversation already holds the framework and carries on.
  - The head load comes off the skills only ever opened in place: the
    bridge, help, the linear continue skill, the legacy research split.
  - Accepted: a conversation that compacts inside a menu, which carries no
    recovery protocol, opens its next skill on the belief the framework is
    held. Menus are short and clear at the pick.

## Candidate shape — from the audits, not yet decided

1. Every topic-less epic action moves into the epic menu, so a phase skill
   always receives a topic: the `d`/`r` name prompt and its direct-entry
   gate, and specification's scoped path (the grouping analysis, the
   groupings menu, the confirm gates, unify) — navigation, not phase work.
   A name typed at the menu then survives the handoff, which the menu now
   makes with the name in hand.
2. Handoff-only content becomes state the phase reads at its start.
3. The entries fold (E1): the code gate first for implementation and
   review, then the entry gate, the status branch merged with resume
   detection, the interview; duplicate reads and dead arms dropped.
4. The four linear continue skills become one, keyed by the work unit with
   its type read from the manifest; each navigation menu gains a back row
   to the start menu. Every continue skill's pick-a-unit step is
   unreachable — the epic menu's too, since the mod handoff stack made
   pivot and absorb pass the epic's name — and goes.
5. `workflow-start`'s rare branches move into references.
6. Legacy residue goes (the audit's list: the experiment series'
   `cancelled` branch, specification's `analysis-rerun` scenario, the
   logless interviews for linear units, review's single/multi/all scope,
   the dead `Source:` handoff fields), with migrations wherever a released
   version could have written the state.
7. The handoff table's targets become the phase skills; the prose-test
   entry rule (`tests/prose/lib/cases.cjs`) and the conventions lint's
   allowlist follow, and about 150 of 190 cases change their entry.

## Material

Two audits, taken at `0b05093e7` (v0.8.9, before the mod handoff stack),
working material until the design settles and removed before it merges:

- `design/entry-layer/audit-entry-layer.md` — each entry skill step by
  step with who reaches each branch, the continue skills diffed, start's
  sub-steps sized, the legacy residue, the suggested shape.
- `design/entry-layer/audit-handoff-sites.md` — every skill-to-skill
  transition and every target's argument contract (the handoff table was
  built from it).

What the mod handoff stack (v0.8.10, `design/mod-handoff.md`) moved since
the audits were taken — read them through it:

- Every move into work hands off through `workflow-shared/references/handing-off.md`,
  loaded with one `route` (`/{skill} {args}`); `engine handoff`
  (`domain/handoff.cjs`) holds the table of targets, its argument checks,
  and `entrySkill(phase)`, the one home of the `workflow-{phase}-entry`
  name the epic and work-unit projections build routes from. Retargeting
  the handoffs to the phase skills is that table, those projections, and
  the route audit in the pipeline simulation.
- Plan mode is gone: the bridge's continuations, review's route back to
  implementation and a specification's gap pause (now through the bridge,
  `PAUSING_PHASES`) all hand off; the handoff-sites audit's plan-mode rows
  are history.
- `workflow-continue-epic` takes `$1` completed_phase and `$2` outcome and
  leads its menu with `references/banner-and-completion.md` (the paused
  or completed banner, the completion offer); its backfill hands the menu
  off to start afresh. Pivot and absorb pass the epic's name, so every
  continue skill's pick-a-unit step is unreachable.
- Research and discussion leave through one in-flight check
  (`workflow-shared/references/in-flight-agents.md`, `--pause` for a
  pause), and a conclusion's recap sits above its conclusion gate.
- About 150 of 190 prose cases enter through an entry skill; a handoff
  ends a walk (`tests/prose/lib/announce-handoff.cjs`), and the entry rule
  in `tests/prose/lib/cases.cjs` admits the skills a handoff lands on.

## Log

- 2026-10-03 — opened from the mod handoff programme's audits; E1 and E2
  carried in; builds after that stack lands.
- 2026-10-06 — the framework load raised from the mod handoff's walks
  (the epic menu's in-place re-read skipped in three of four walks).
- 2026-10-06 — the mod handoff stack landed (v0.8.10); what it moved is
  listed under Material. The design opens on the two questions raised
  first.
- 2026-10-06 — E3: consult references retired, their detection carried
  by the grouping's tension lines.
- 2026-10-06 — E4: the framework loads once per conversation, at the head
  of the skills a conversation opens on. Both questions raised first are
  settled; the candidate shape is next.
