# Entry layer — one skill per phase, one continue skill, a lighter start

The layer between the menus and the work is shaped by a history it no
longer has: the phase entry skills (`workflow-*-entry`) and the continue
skills (`workflow-continue-*`) were once invoked by the person, and none
is now — `workflow-start` is the one door. This programme folds each
phase's entry into its phase skill, moves every epic action that has no
topic yet into the epic menu, merges the continue skills that differ only
by work type, retires consult references, loads the framework once per
conversation, and moves `workflow-start`'s rare branches out of the path
every start reads. It builds on the mod handoff (`design/mod-handoff.md`,
v0.8.10), whose one table of targets is where every move into work is
named.

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
  each the phase's own.
- **The epic menu's specification row takes a different road from the
  specification menu.** It goes down the entry's topic path, which skips
  what the specification menu's route does: registering consult
  references, and incorporating a specification that already sources one
  of the grouping's discussions.

## Rulings

- **E1 — each phase's entry folds into its process skill** (Lee,
  2026-10-01). The phase skill owns its own Step 0: the checks, the status
  branch, the interview where no carrier exists.
- **E2 — the `storage_paths` backfills are dropped** (Lee, 2026-10-02).
  Twelve checks across eight planning, scoping, implementation and review
  files record the field mid-session for a plan that predates it (the
  field arrived 2026-07-23); the checks go, with no migration.
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
    CONVENTIONS' "every flow skill opens its `## Instructions` section"
    narrows to the skills a conversation opens on.
  - Accepted: a conversation that compacts inside a menu, which carries no
    recovery protocol, opens its next skill on the belief the framework is
    held. Menus are short and clear at the pick.
  - `OPENING_SKILLS` (`domain/handoff.cjs`: `workflow-start` plus every
    handoff target) is the one list the conventions lint and the
    prose-test entry rule read; help is no prose-case entry, since a
    session reaches it only from the start menu.
- **E5 — promotion keeps both units' records true** (Lee, 2026-10-07).
  Promoting an epic specification moves its source discussions' files
  into the new cross-cutting unit, but the epic went on reading them
  `completed` with nothing behind them — its grouping could propose a
  specification over one — and the new unit kept them under their epic
  names, which no route into a single-topic unit reaches, so a revisit
  started an empty discussion. The epic marks each discussion it moves
  `promoted` (+ `promoted_to`), a terminal status the grouping, counts,
  reopen and the field surface treat as finished, the topic reading
  decided; the new unit takes each moved discussion's whole item and its
  specification records them as sources; single-topic routing names a
  phase's own item where it is not the unit's name, so revisit reaches a
  moved discussion. Migration 070 records past promotions. Research never
  moves. The fold's dropped missing-source-file check stays dropped —
  the cause is fixed.
- **E6 — this stack is exempt from the display touch rule** (Lee,
  2026-10-07), as the function-hook stack was: the hand-drawn displays in
  the files it touched stay tracked by the lint's ratchet and
  `ideas/migrate-remaining-hand-drawn-displays.md`.

## The shape

Agreed with Lee 2026-10-06.

**S1 — every epic action that has no topic yet moves into the epic menu.**
A phase skill always receives `{work_type} {work_unit} {topic}`.
- The `d`/`r` doors: the epic menu asks for the name (`back` returns to
  the menu), runs `render direct-entry-gate` — whose refusal names the
  way back for a topic with no row: `e/reactivate`, `f/forward` while a
  postponed topic's roadmap item still waits, `c/completed`, discovery's
  reopen for a dead end — creates the map row (`source: direct-start`,
  with its summary and description) and hands off to the phase with the
  name in hand (`references/new-topic.md`).
- The specification grouping: `s/spec` runs in the epic menu's
  conversation (`references/specification-display-and-menu.md`,
  `analysis-flow.md`; gateway verbs `spec-scenario`, `spec-view`,
  `spec-completed-menu`; the discovery itself
  `domain/specification.cjs` `specificationDiscovery`) — the scenario
  read, the prerequisites, the analysis (presence scan, grouping context,
  the read, the reconcile, the cache document), the groupings and
  specifications menus, unify, and the confirm — then hands off with the
  picked topic. The analysis reads every completed discussion; the clear
  at the pick discards that reading, so the specification starts clean.
- The grouping menus gain `b/back` to the epic menu, and their declines
  re-render it, where today they end on "re-run this command when ready".
  Where the epic menu's hard gate on analysing while a discussion is open
  and the scenario's `blocked-discussions-open` refuse the same thing, one
  refusal stays.

**S2 — a specification works out its own incorporation.** A grouping can
take in a discussion a started specification already sources
(`lockingSpecs`, `domain/derivations.cjs`) — wherever fewer than a
majority of the grouping's discussions are that specification's sources,
the analysis keeps the grouping apart rather than mapping it onto the
specification. Today only the specification menu's route incorporates it
— the handoff names the specification, and completion supersedes it; the
epic menu's start row builds from the discussions alone and leaves both
specifications sourcing one discussion.
- `topic start` on a proposed grouping records what it incorporates
  (`incorporates`) — a reading of "started specifications sharing my
  discussions" is symmetric once both have started, so the direction is
  recorded at the start. `engine topic incorporations` answers it;
  session setup, construction, review and completion read it on every
  route, and completion supersedes each.
- The confirm (`render spec-confirm-gate`) renders only where the pick did
  not show what happens: a start that incorporates a specification, a
  selection that unified groupings (`--unify`), and the single-discussion
  path, where the menu proceeds on the person's behalf (`--single`) — on
  the epic menu's start row and the groupings menu alike. A plain start,
  continue or refine hands off on the pick.

**S3 — what crosses to a phase only as handoff text becomes the phase's
own.** Nothing passes a handoff but the skill and its arguments.
- Planning's additional-context gate and its cross-cutting references move
  into planning's initialisation, which writes both into `planning.md`
  (`## Plan Context`, `## Cross-Cutting References`) so a resume finds
  them; the traceability review reads them as inputs, never findings.
- Interview answers go with the interview into the phase skill.
- The specification's source lists and incorporations are manifest reads
  (S2).
- Discussion's focus question on resume (`gather-context-continue.md`)
  goes; its answer is discarded today.
- The experiment record picker already lives with the process
  (`select-record.md`).

**S4 — the entries fold (E1).** Each phase skill's Step 0 opens with the
code gate (implementation, review), then `render entry-gate`, then one
status branch — new, resume, reopen with its phase note and the reconcile
advisory, the terminal blockers — merged with the resume detection the
process already runs, then the interview where no carrier exists. The
duplicate status reads, the specification's `ls` re-check of its sources,
the dead `Source:` and implementation/review handoff fields and every
no-topic arm go; the single-caller validate and display references inline;
the dependency check's mark-satisfied branch and the epic menu's become
one (`workflow-shared/references/mark-dependency-satisfied.md`). Each
phase skill keeps its entry's "stay in your lane" line (scoping's
described the entry itself, and goes); a postponed or cancelled item's
stop renders through `render entry-gate … --own`; the experiment picker's
back hands an epic off to its menu. The phase skills keep their
`-process` names — the position record and the compaction answer in the
open mod work name them so.

**S5 — one linear continue skill.** The feature, bugfix, quick-fix and
cross-cutting continue skills become `workflow-continue-linear`, keyed by
the work unit with its type read from the manifest. Every continue
skill's pick-a-unit step goes, the epic menu's included (pivot and absorb
pass the epic's name). The epic menu and the linear continue menu gain
`b/back`, which re-renders the start menu through
`workflow-start/references/start-menu.md`, as help, the roadmap and the
baseline do.

**S6 — a lighter start.** The five branches of `workflow-start`'s Step 0
that fire rarely — the migration review, the mod's notice and stop, the
walkthrough offer, the session-label prompt, the baseline judgment (about
11 KB) — move behind load lines into references, the pattern the
knowledge gate already uses.

**S7 — legacy residue goes**, before the fold so the fold moves only live
branches. Measured against the five projects:
- Experiment series status `cancelled` — written by the per-item
  `topic cancel … experiment` of v0.7.22–v0.7.54, never migrated (none in
  the five projects). The old cancel abandoned every open record first,
  so migration 069 sets each such series `completed` and drops its
  `previous_status`; the map row is left alone — the topic lifecycle never
  reads experiment items. The branches go from the experiment entry,
  `experiment.cjs`, `derivations.cjs` and the schema.
- The `analysis-rerun` scenario is live, not legacy. The analysis cache's
  checksum covers the discussion files, which a topic cancel or postpone
  leaves alone while it discards the proposed groupings over the topic's
  discussion, and a specification cancel takes a grouping or a
  specification; once none is left over two or more completed
  discussions, the still-valid cache lands `s/spec` there, under text
  that says it comes only from before proposed groupings. It folds into
  `analyze`, which reruns the analysis behind its proceed gate.
- The interview for a unit with no discovery log — dead for bugfix and
  quick-fix (only units from before v0.4.13 lack a log: 47 in the five
  projects, none in progress). A cross-cutting unit made by `workunit
  promote` has no log and can reach a fresh discussion (reactivate →
  revisit), so discussion alone keeps the interview, for that unit;
  research's arm goes. `workunit create --no-session-log` goes.
- Review's single/multi/all scope (prose only — never stored; its plan
  reference is `read-plan.md`), the specification gateway's unused
  `index` verb, and the `storage_paths` checks (E2).

**S8 — the handoff table points at the phase skills.** `phaseSkill(phase)`
names the phase skill and every epic phase takes a topic
(`EPIC_TOPICLESS_PHASES` goes); the bridge's single-topic continuations
hand off the engine's `next_route` / `revisit_routes`; the epic and
work-unit projections, the simulation's route audit, the prose-test entry
rule (`tests/prose/lib/cases.cjs`, reading `OPENING_SKILLS`), the
conventions lint and about 150 of 190 cases' entries follow. CLAUDE.md's
Skill Architecture, CONVENTIONS and the docs describe the layer as built.

## The stack

Stack #1472, each PR folding its share of the `/review-work` fixes:

1. #1470 — consult references retired (E3; migration 068).
2. #1471 — legacy residue out (S7, E2; migration 069).
3. #1473 — the epic menu names a new topic before it hands off (S1).
4. #1474 — the specification grouping runs in the epic menu, and a
   specification works out its own incorporation (S1, S2).
5. #1475 — research, discussion, investigation, scoping and experiment
   start in their own skill (S3, S4, S8).
6. #1476 — specification, planning, implementation and review too; no
   entry skill remains (S3, S4, S8).
7. #1477 — one linear continue skill, and a way back to start (S5).
8. #1478 — the framework once per conversation (E4).
9. #1479 — a start reads only the branches that fire (S6).
10. #1482 — promotion keeps both units' records true (E5; migration 070).

Measured, main → the stack (bytes read): a typical start 42,195 →
32,015; a discussion's opening 42,987 → 34,254; the linear continue menu
7,837 → 5,003; skills 38 → 26.

## Log

- 2026-10-03 — opened from the mod handoff programme's audits; E1 and E2
  carried in; builds after that stack lands.
- 2026-10-06 — the framework load raised from the mod handoff's walks
  (the epic menu's in-place re-read skipped in three of four walks).
- 2026-10-06 — the mod handoff stack landed (v0.8.10); what it moved is
  listed under Material.
- 2026-10-06 — E3: consult references retired, their detection carried
  by the grouping's tension lines.
- 2026-10-06 — E4: the framework loads once per conversation, at the head
  of the skills a conversation opens on.
- 2026-10-06 — the audits re-verified against v0.8.11, with the five
  projects measured: a second divergence on the epic menu's specification
  row (incorporation), `analysis-rerun` reachable today. The shape agreed
  (S1–S8) and the stack ordered.
- 2026-10-07 — built as stack #1472; `/review-work` over the whole stack
  (eight dimensions) folded about thirty fixes into their layers; E5 and
  E6 ruled, E5 built on top as #1482.
