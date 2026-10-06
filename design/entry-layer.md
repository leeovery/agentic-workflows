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
  specification's incorporations and consult references, interview
  answers: a fold has to make each a read from disk at the phase's start.

## Rulings

- **E1 — each phase's entry folds into its process skill** (Lee,
  2026-10-01). The phase skill owns its own Step 0: the checks, the status
  branch, the interview where no carrier exists.
- **E2 — the `storage_paths` backfills are dropped** (Lee, 2026-10-02).
  Nine process files record the field mid-session for a plan that
  predates it (the field arrived 2026-07-23); the checks go, with no
  migration.

## Raised first when the design opens

- **Consult references.** The epic menu's row that starts one proposed
  grouping takes the entry's topic path, which never registers the
  grouping's consult references (`domain/specification.cjs:179-182`,
  `workflow-specification-process/references/session-setup.md:15-32`), so
  a specification started there can conclude without them; the
  specification menu's route registers them. No grouping in five epics
  (agntc, mint, pigeon, portal, tick) has declared one. Fix it on both
  routes, or retire consult references and let the knowledge base carry
  sibling decisions.
- **The framework load.** Every flow skill opens by loading `framework.md`,
  whose rule says to re-read its files every time, whatever is in context —
  a rule written for one long conversation, where compaction could drop the
  rules while their conclusions survived. With every move into work now a
  handoff into a fresh conversation, the first skill there loads the
  framework into an empty context, and the gate mod re-reads skill and
  framework after compaction in a work conversation (#1461); the remaining
  loads are in place — a phase's entry, then its process skill, then the
  bridge, three in one conversation where only the first does anything, and
  the epic menu opened in place from the start menu, whose re-read walks
  skipped in three runs of four. Load the framework once per fresh
  conversation, at the head of the skill a handoff lands on: whether an
  in-place skill (the bridge, a menu opened from the start menu) loads it
  at all, and whether the "never skip" rule survives.

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

## Log

- 2026-10-03 — opened from the mod handoff programme's audits; E1 and E2
  carried in; builds after that stack lands.
- 2026-10-06 — the framework load raised from the mod handoff's walks
  (the epic menu's in-place re-read skipped in three of four walks).
