# One Task, One Call — the batching programme

D7's second half. The render-surfaces programme made rendering one-call;
this programme does the same for writes: a flow never prescribes a run of
sequential engine calls for one logical operation.

## Motivation (2026-07-22)

- **The fumi harvest**: 24 sequential `discovery-map add` calls; the model
  aliased the engine path into `$E` to cope, zsh's no-word-split killed all
  24 (exit 127). The improvisations models invent to cope with repetition
  are where the failures live.
- **The portal transcript** (found mining runtime transcripts): a live
  `for id in 1-1 1-2 …; do node manifest.cjs …` shell loop over task IDs —
  the author-tasks fan-out improvised in the wild, exactly as predicted.
- **Atomicity**: a sequential run can die halfway, leaving partial state;
  a batch is all-or-nothing under one lock and one commit.
- **#495's lesson** (closed unmerged): implementation before census is
  backwards. The census is below; every PR cites it.

## The contract

- **C1 — per-verb batch forms, never a command-runner.** A batch is the
  N-ary form of an existing verb — `<verb>-batch` or `<verb> --file`,
  whichever the verb's grammar carries cleanly — with the single form
  retained. No generic "run these commands" verb.
- **C2 — payload by file, validated loudly, before any mutation.** The
  model writes JSON with the Write tool (no shell quoting), the engine
  validates every entry per-field before touching anything; a bad entry
  fails the whole batch with the entry named (self-correcting).
- **C3 — one lock, one write, one commit.** Per manifest touched: single
  lock, single read-modify-write, and the transaction's one scoped commit.
  The response reports per-entry outcomes on the one JSON line.
- **C4 — prose swaps ride the verb's PR.** A batch form lands together
  with the call sites it collapses — the verb is earned by its sites.
- **C6 — uniform batch grammar.** A batch's arguments are all one shape:
  every pair `<field>=<value>`, or a payload file. Never a positional
  first pair with assigned extras — asymmetry is a misfire surface.
- **C5 — prefer the cheaper class.** Before a new batch form: can the
  site use an existing multi-field/batch shape (existing-form fold)? Can
  the data ride a response the flow already has (dump/read fold)? A new
  verb is the last resort.

## Census (2026-07-22 — two agent audits + mechanical scan + transcripts)

Classes: **BV** batch verb · **EF** existing-form fold (the call shape
already exists; prose never used it) · **DF** dump/read fold (#488
pattern) · **ST** structural (the loop itself is wrong) · **OK** fine.

| Site | Shape today | Class |
|---|---|---|
| discovery harvest (confirm-and-persist B) | N× `discovery-map add` | BV — `add --file` (pilot; recovered from #495 tip b683fea7) |
| spec-entry reconcile (analysis-flow 101-116, display-groupings 50) | delete/create fan-out over proposed specs × members | BV — `specification reconcile --file` or manifest apply |
| resolve-dependencies 104-149 | per-match `manifest set` pairs (two topics per match) | BV — manifest apply (multi-dotpath) |
| author-tasks G (219) | per-task batched set + per-task commit | OK — reclassified (stage 3): the per-task commit is a durability boundary (resume gate reads the position it advances); the set was already batched. Dynamic git-add → stage 5 |
| scoping write-tasks C (67) | 11× `manifest set` SAME dotpath + 2 lifecycle | DONE (#507) — one multi-field set |
| scoping write-tasks task_map (85) | per-task `manifest set task_map.{id}` | DONE (#507) — folded into the same set |
| summary-backfill 148 | per-item `manifest set` | BV — manifest apply |
| session-setup 19 (consult refs) | per-ref `manifest set` | BV — manifest apply |
| spec-completion 87/97 | per-source/per-ref exists+set loops | BV — manifest apply |
| process-review-findings (task_map writes) | per-finding set | DONE (#507) — one set (adds) / apply (removals) per finding |
| drain-triage | per-entry `discussion-map add` | BV — `discussion-map add --file` |
| map-operations E/H/I/J loops (192/302/411) | per-name edit/rename/handle | BV — `discovery-map edit --file` (or OK if typical N=1 — measure first) |
| brief-synthesis 50/70 | per-brief gets/sets | DONE (#509) — subtree reads ×2 + one apply each for cleanup and flags |
| sequence-discovery-map 39/52 | 2×N `manifest get` + N-ary sequence call | DONE (#509) — one subtree get |
| read-plans 13 | per-plan gets | DONE (#509) — one planning subtree get |
| analyze-task-graph 21 | 3 gets in one fence | OK — 3 distinct fields, one fence, no loop |
| project-skills-discovery 182 | 3 calls | OK — distinct one-time setup |
| linear/authoring 15/33 | 3 calls + per-team persist | OK — external-format setup, N=1 |
| initialize-plan 61 | 2 calls | OK |
| task-loop 25 | 1 call, "once at loop entry" | OK — explicitly hoisted already |
| gap/research-analysis stamp | 1 call | OK |
| inbox-working-set 154 | one command, many args | OK — already batched |
| shell cluster: 11 dynamic `git add {format task paths}` sites | model-assembled argv | DONE (#510) — storage_paths recorded at init, engine commit --plan derives; 2 restart cleanups raw-git-from-state (item deleted pre-commit); code-led commits OK-by-design |
| shell cluster: read-then-paste restarts (planning/scoping SKILL) | value read → pasted into later call | ST — restructure or dump-fold; decide at its PR |
| shell cluster: read pipelines into agent dispatch | multi-stage stdout carries | ST — likely OK (judgment content); revisit last |

## Staged plan (stacked PRs, pr-stacked discipline)

1. **Pilot: `discovery-map add --file`** — the fumi site; contract kernel
   (shared batch-payload validation helper) + harvest swap. Root PR.
2. **`manifest apply --file`** — [{dotpath, fields…}] across one work
   unit; the manifest fan-out family (reconcile, resolve-dependencies,
   summary-backfill, session-setup, spec-completion) + swaps.
3. **Task-map batch + one-commit authoring** — author-tasks, write-tasks,
   process-review-findings; kills the portal loop.
4. **Existing-form + dump/read folds** — write-tasks C, sequence map,
   read-plans, brief-synthesis reads.
5. **Shell clusters** — decide `commit --also` vs structural per site.

Each PR: verb + tests + prose swaps + census row ticked here.

## Log

- 2026-07-23 — System-wide round 3 (#514): six slices, wide — epic
  journey, adversarial CLI hammering, engine state-machine audit,
  quickfix/bugfix journeys, crash/resume seams, corpus-wide reference
  sweep (328 load-links, 691 local links, 113 menus, engine response
  fields — all clean). Engine majors: empty dotpath segments aliased
  the PROJECT manifest under a work-unit lock; `commit ''` swept all
  of .workflows; `workunit create` reuse could silently cross work
  types; phaseStatus's non-live filter was order-dependent; a topic
  with every attempted phase cancelled rendered fresh with a dead-end
  action; cancel lost the map item's order; promoted items weren't
  terminal. Crash-resume seams sealed in prose: task-loop
  reconciliation, verifier-push dedupe (+ distinct-count in the
  resume gate), actions-loop staging resume, author-tasks re-author
  guard, analysis-loop cycle resume, spec-extraction re-read.
  Ambiguities parked for Lee: promote paths bypass the bridge and
  force discussion; bugfix spec source-name unpinned; review prose
  names a non-existent upstream; gate-mode boilerplate on gate-less
  phases.

- 2026-07-22 — Deep-dive round 2 (#513): three literal-executor
  walkthroughs + textual forensics + dual-authority rules audit +
  engine mutation-check. Majors: the planning backbone's Hard Rule #2
  contradicted its own references (still commanding raw git for the
  --plan'd operations); pre-upgrade plans hit unrouted mid-session
  --plan throws on three resume paths — each now carries a routed
  backfill guard at entry. Also: resolve-dependencies' pre-existing
  missing per-dependency loop (improve-doctrine fix), the unify
  anchor-collision guard, the restored synthesis sourcing note, and a
  spread of literal-executor tightenings. Forensics clean across 47
  files; every round-1 engine guard proven load-bearing by mutation
  reasoning.

- 2026-07-22 — End-of-stack review (Lee's full-analysis gate): six slices
  (harvest, spec-entry, task-map+commit-plan, engine code, test adequacy,
  conventions), findings adversarially verified, fixed on #510's branch:
  two MAJORs (resolve-dependencies' stale re-resolve orphaned by the
  working-list swap — corrected pair now feeds the list; write-tasks'
  storage_paths derivation missing from its prelude) plus symmetric
  empty-batch guards, display-groupings' own unify-ops.json, the
  process-review-findings file-level commit rule (missed by both earlier
  sweeps) onto --plan, restart-cleanup expansion guidance, engine
  hardening (dangling --plan, malformed-vs-missing storage_paths,
  non-string batch names), and the validateStoragePaths test gap closed
  on both write paths. Everything else traced clean with evidence.

- 2026-07-22 — Stage 6 up (#510): commit --plan, per the plan agreed with
  Lee — formats declare Storage Pathspecs in authoring.md (tick [".tick/"],
  others []), init records storage_paths on the planning item (validated at
  write), the engine derives the commit scope (wu + project manifest +
  declared paths, exists-or-tracked guarded). Six sites swapped; the two
  restart cleanups stay raw git (planning item deleted pre-commit) staging
  {storage_paths} from state; code-led commits stay with the session by
  design. Pre-upgrade plans fail loudly with a one-line repair.

- 2026-07-22 — Stage 5 up (#509): the dump/read folds — zero engine code
  (the whole-subtree get was always there). sequence-discovery-map and
  read-plans onto single subtree reads; brief-synthesis cleanup and
  propagation onto collect-then-apply.

- 2026-07-22 — Stage 4 up (#508, from Lee's #507 review): manifest set's
  mixed grammar retired — positional three-arg single OR uniform
  <field>=<value> batch, never mixed (refused loudly). Nine prose sites,
  the legacy-split apply script (its suite caught it), both test suites
  swept in the same change. Contract addendum C6: batch argument grammars
  are uniform — a batch never mixes positional and assigned forms.

- 2026-07-22 — Stage 3 up (#507): the task-map family folds onto existing
  forms — ZERO engine code (C5 in action). write-tasks 13+N calls → 3;
  review-findings upkeep one call per finding. author-tasks G reclassified
  OK: per-task commit is a durability boundary, its set already batched.

- 2026-07-22 — Stage 2 up (#506): manifest apply --file — batched
  set/delete across one work unit, native-JSON values, per-entry loud
  validation, all-or-nothing. Four families swapped: spec-entry reconcile
  (collect-then-apply, crash can't half-reconcile), resolve-dependencies
  (working-list collect, one apply), summary-backfill, session-setup
  consult refs (whole-map read + missing-only payload). Census
  corrections: spec-completion 87/97 are single whole-map gets — OK;
  resolve-dependencies' per-match pairs were also same-dotpath (EF) but
  the loop across matches made BV the right class anyway.

- 2026-07-22 — Stage 1 up (#505): discovery-map add-batch, recovered from
  the closed #495 tip and re-landed census-first; harvest swapped to one
  Write + one call, zsh-quoting guidance deleted. C1 wording adjusted:
  the pilot uses a `-batch` subcommand — overloading `add --file` would
  muddy its positional grammar.

- 2026-07-22 — Programme opened. Census merged from the stage-5b audits,
  a fresh mechanical scan (35 flagged, classified above — new finds:
  scoping write-tasks 13-call fence, spec-completion loops), and runtime
  transcript mining (portal's manifest for-loop). Contract C1–C5 drafted.
