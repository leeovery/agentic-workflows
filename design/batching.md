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
| author-tasks G (219) | per-task `manifest set task_map.{id}` + per-task commit | BV — task-map batch + ONE commit (portal transcript's loop) |
| scoping write-tasks C (67) | 11× `manifest set` SAME dotpath + 2 lifecycle | EF — multi-field `set` exists today; task_map entries ride it |
| scoping write-tasks task_map (85) | per-task `manifest set task_map.{id}` | BV — same task-map batch as author-tasks |
| summary-backfill 148 | per-item `manifest set` | BV — manifest apply |
| session-setup 19 (consult refs) | per-ref `manifest set` | BV — manifest apply |
| spec-completion 87/97 | per-source/per-ref exists+set loops | BV — manifest apply |
| process-review-findings (task_map writes) | per-finding set | BV — task-map batch |
| drain-triage | per-entry `discussion-map add` | BV — `discussion-map add --file` |
| map-operations E/H/I/J loops (192/302/411) | per-name edit/rename/handle | BV — `discovery-map edit --file` (or OK if typical N=1 — measure first) |
| brief-synthesis 50/70 | per-brief gets/sets | DF/BV — split: reads fold into discovery dump, writes batch |
| sequence-discovery-map 39/52 | 2×N `manifest get` + N-ary sequence call | DF — summary/description already ride the dump (#488); finish the fold |
| read-plans 13 | per-plan gets | DF — bulk read or dump extension |
| analyze-task-graph 21 | 3 gets in one fence | OK — 3 distinct fields, one fence, no loop |
| project-skills-discovery 182 | 3 calls | OK — distinct one-time setup |
| linear/authoring 15/33 | 3 calls + per-team persist | OK — external-format setup, N=1 |
| initialize-plan 61 | 2 calls | OK |
| task-loop 25 | 1 call, "once at loop entry" | OK — explicitly hoisted already |
| gap/research-analysis stamp | 1 call | OK |
| inbox-working-set 154 | one command, many args | OK — already batched |
| shell cluster: 11 dynamic `git add {format task paths}` sites | model-assembled argv | ST — candidate `engine commit {wu} --also <path>…`; decide at its PR |
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

- 2026-07-22 — Stage 1 up (#505): discovery-map add-batch, recovered from
  the closed #495 tip and re-landed census-first; harvest swapped to one
  Write + one call, zsh-quoting guidance deleted. C1 wording adjusted:
  the pilot uses a `-batch` subcommand — overloading `add --file` would
  muddy its positional grammar.

- 2026-07-22 — Programme opened. Census merged from the stage-5b audits,
  a fresh mechanical scan (35 flagged, classified above — new finds:
  scoping write-tasks 13-call fence, spec-completion loops), and runtime
  transcript mining (portal's manifest for-loop). Contract C1–C5 drafted.
