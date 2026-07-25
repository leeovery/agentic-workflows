# Prose Tests — end-to-end tests for the prose logic

The missing test layer. Unit tests prove the engine's functions, the
pipeline simulation proves the engine's call sequences — but the prose
that *drives* those calls (arms, guards, routing, resume detection) has
no test at all. Prose tests close that: natural-language test cases an
agent executes by walking the real skills against a real, materialised
project state. As close to real life as it gets before live-session
testing.

## Motivation (2026-07-24)

- **The analysis-state review rounds proved the method.** Six rounds of
  agents walking prose against hand-constructed state found every
  defect the unit tests and simulation structurally could not see:
  arm-ordering swallows, resume-guard hijacks, fix compositions. The
  rounds also proved the cost of *not* having this — each round's
  fixes manufactured the next round's defects until the strict
  enumeration process pinned them. This framework mechanises what the
  rounds did by hand, permanently.
- **Reviews are samples; tests are proofs.** A review finding fixed
  once can regress silently. Every finding henceforth lands twice:
  the fix, and the case that would have caught it.
- **Happy path is first-class** (Lee, 2026-07-24). This is not an
  edge-case archive. The obvious mainline is tested precisely because
  it is obvious *now* — a failing mainline case later means we broke
  or changed something, and the case forces the decision: regression,
  or intended change (update the case with intent).

## The contract

- **P1 — cases are Given-When-Then.** One case per file, flat:
  `tests/prose/{case-id}.md`, filename equal to the id and validated as
  such. Nothing groups cases but their `files:` scope, which is what
  selection runs on. **Given**: `world_before` (a fixture) and nothing
  else — the world before anything happens. **When**: one coarse
  instruction — where to enter, what to follow, where to stop — plus
  everything the harness feeds in *during* the act: `answers` (the
  scripted user responses; an unscripted question is a finding, the
  prose asked something the case didn't predict) and `stubs`, each with
  the moment it fires.
  **Then**: `world_after` (a fixture, or `unchanged`), a granular
  `trace` of the path the prose should have taken, and any further
  `notes`.
- **P1a — coarse When, granular Then.** The When never scripts the
  workflow's own steps: if the case says which commands to run, the
  walker stops deriving the path from the prose and the case would pass
  with the skill file deleted. Granularity belongs in the Then, where a
  step-by-step expected trace catches the real threat — a walker that
  silently course-corrects around broken prose instead of surfacing it.
  Claims name behaviour, never coordinates.
- **P2 — worlds are real, never imagined.** A fixture is authored by a
  **recipe** (a node script running real engine calls + perturbations
  against a scratch project) and committed as a **golden snapshot**
  (its output). The world builder materialises a case's world by
  copying the snapshot into a fresh temp project — unique suffix,
  parallel-safe — with the repo's current `skills/` copied to the
  installed layout (`.claude/skills/`), `git init` run, and a
  keyword-only knowledge store baked in. The agent's cwd is that fake
  project; engine reads answer for real; prescribed mutations execute
  for real, in the sandbox. Hand-typed fixture JSON is forbidden — a
  hand-faked state can be a state the engine could never produce.
- **P3 — code states the facts, the agent judges them.** Expectations
  are whole worlds, not literals: code computes the factual delta
  between the acted world and the expected fixture, and the asserting
  agent classifies each difference as volatile (timestamps, SHAs,
  allocated ids) or material. No normalisation table to maintain, no
  hand-written per-field assertions, and nothing goes unchecked
  because nobody thought to assert it. Engine responses during the
  walk are real. **`npm test`** holds the deterministic perimeter —
  zero tokens, and run before every commit, this project having no
  automated CI: every snapshot rebuilds from its recipe byte-identical
  (so a world the engine moved goes red at the gate and lands as a
  reviewable snapshot diff in the PR that moved it), and every case's
  paths, anchors, worlds, stubs, and trace resolve.
- **P4 — walker/asserter separation.** The walking agent never sees the
  `then` block; an agent that knows the expected answer will find it.
  The walker gets the world, the coarse instruction, the answer script
  and the stubs, and returns a transcript. The asserter sees the
  transcript, the expected trace, and the world delta — never the
  reverse.
- **P4a — substitutions are declared and marked.** A stub is named
  content; the case arming it owns the trigger, so one stub serves
  many moments. The walker records `SUBSTITUTED:` for each, and the
  prompt labels them as harness mechanics, so the asserter never
  credits the walk for what the framework supplied. Whatever a stub
  covers is not under test in that case — some other case must walk it
  unstubbed.
- **P5 — run on command, never in the test suite.** Walks cost tokens,
  so they never ride `npm test` — only the perimeter of P3 does. The runner
  is invoked deliberately: scoped by diff-intersection (the same
  computation powers the PR-end suggestion — "these N cases intersect
  this PR's prose changes"), by hand-picked ids, or `--all`. An
  engine-only PR intersects nothing and suggests nothing.
- **P6 — tiered walkers.** Sonnet walks by default; any FAIL re-runs
  on Opus before it is believed. Persistent disagreement surfaces to
  Lee with both walks quoted — failures are findings, never
  auto-resolved gates.
- **P7 — a failing case is a finding either way.** Either the prose
  broke, or the world/design moved and the case is stale. The
  adjudication is the point; only the typo-class staleness is
  pre-filtered by the perimeter (P3).

## Architecture

- `tests/prose/{case-id}.md` — the cases, flat.
- `tests/prose/stubs/{name}.md` — named substitutions: description
  above a `---` fence, exact bytes below.
- `tests/prose/fixtures/{name}/recipe.cjs` + `snapshot/` — the world
  library, holding both start and expected-end worlds. One canonical
  fake project per work type so cases read familiarly.
- Runner (node): case parsing and validation, diff-selection, world
  building, walker-prompt assembly, world diffing, asserter-prompt
  assembly, snapshot regeneration. Owns everything deterministic.
- `/prose-test` skill (thin): dispatch and verdict discipline —
  invokes the runner, sends the walker, sends the asserter, escalates
  failures, reports.

## Stages

1. **Design log** — this document.
2. **Framework** — case format + parser, staleness/anchor check,
   fixture recipe/snapshot infra + rebuild-compare check, world
   builder, runner, `/prose-test` skill.
3. **Happy-path corpus** — one PR per work type mirroring the
   simulation's mainline enumeration, plus the core loops (planning
   approval, implementation task loop, review cycle, council
   lifecycle).
4. **Failure-case harvest** — transpose the rounds-4–6 edge maps,
   crash matrices, and exit-state tables from the analysis-state
   campaign into cases.

## Log

- 2026-07-25 — The Given-When-Then reshape (Lee, reviewing the corpus in
  the TUI). Four corrections, all his: **(1)** cases are flat, one per
  file, filename equal to the id — grouping by work type organised the
  corpus around the build sequence rather than the prose under test, and
  any single-parent taxonomy lies about cases spanning skills.
  **(2)** The hand-written assertion DSL is gone. The world is a
  directory that changed; the expectation is another committed world;
  code diffs them and the asserting agent classifies each difference.
  That deleted the grammar *and* closed the gap where anything nobody
  thought to assert went unchecked — no normalisation table, no
  engine-written-versus-model-written split to adjudicate.
  **(3)** Stub triggers belong to the case, not the stub: binding a
  substitution to a moment is what *prevents* reuse, and the same
  content is wanted at different moments (first dispatch vs re-dispatch,
  gaps-found vs validated). A stub is named content; the case says when.
  A trigger-less stub is arrange in disguise and fails validation.
  **(4)** Granularity belongs in the Then. Lee's argument, which holds:
  coarse assertions let an agent silently course-correct around broken
  prose — good in production, fatal in a test. The When stays coarse
  (else the walker stops deriving the path and the case passes with the
  skill deleted); the Then carries a step-by-step expected trace, so a
  silent repair shows as a trace mismatch. Also added: a `DEVIATION:`
  marker for prose that cannot be followed literally, findings in their
  own right. Sections renamed given/when/then after BDD, which reads
  closer to a specification than arrange/act/assert.

- 2026-07-25 — Stage 3b, the bugfix corpus. Three fixtures along
  `crash-fix` (created / investigating / investigated) and four cases
  covering only what bugfix does differently: continue-bugfix routing a
  fresh bug to investigation, investigation entry seeding from the
  carrier without re-asking, the root-cause validation agent's full
  lifecycle, and a specification sourced from the investigation rather
  than a discussion. Two framework extensions the corpus demanded,
  both small: a free-text **`stub:` section** — prose that dispatches a
  background agent is walked with the walker playing the agent (writes
  the report at the engine-allocated path, returns the stated result),
  because the case tests the lifecycle around the agent, never the
  agent's judgment; and a **`json` state assertion** so the agent row's
  closing status is checked deterministically in the cache store rather
  than read out of a transcript. Both proven by hand-walking the
  lifecycle in a live world before the cases shipped.

- 2026-07-25 — Stage 3a, the feature corpus. Five stop-point fixtures
  along the canonical feature mainline (`pay` — created / discussed /
  specified / planned / implemented), composed from staged builders in
  `_shared/feature-mainline.cjs`: engine calls mirror the sim's pinned
  sequences, content files carry the artifacts the prose actually reads
  (template-shaped session log with backfilled Exploration; real
  local-markdown task files per the format's authoring contract). Seven
  cases: workflow-start surfacing, continue-feature selection and
  forward routing, each phase entry's validation-and-handoff, and the
  implementation pickup through to the first task start. Every claim
  verified against the prose at authoring time — the reads surfaced
  and fixed a fixture bug before it shipped (an invented session-log
  shape that would have misrouted discussion entry into
  gather-context), and pinned two authoring-relevant facts:
  ensure-discovery-item no-ops for non-epics (entry walks are
  mutation-free until the process skill starts the topic — hence the
  "restraint" state assertions), and continue-feature never
  auto-selects, even with a single feature. All six fixtures proven
  byte-deterministic; full gate green.

- 2026-07-25 — Brittleness review (Lee, on the stage-2 smoke cases):
  cases written in prose coordinates (step numbers, numbered headings)
  break on cosmetic renumbering — failure for the wrong reason. Ruling:
  **cases name behaviour, never coordinates** (the walker is an agent
  reading prose — the binding is semantic and rename-robust; only
  coordinate-phrased claim text rots), and anchors became substring
  fragments matched with `includes` (`#Boot` survives a renumber, still
  goes red token-free if the heading vanishes). Prose test hooks
  (`data-test`-style markers in skill files) considered and **parked**:
  the only machine consumer of anchors is the staleness check, so hooks
  would put permanent plumbing into shipped prose to serve a consumer
  that barely needs it — revisit on evidence if arm-level references in
  the failure harvest (generic headings like "If valid") produce real
  renumber noise; the grammar extends to `probe:` references without
  breakage.

- 2026-07-24 — Stage 2, the framework. `tests/prose/`: case parser and
  corpus validation (`lib/cases.cjs`), fixture recipes under a frozen
  clock with golden snapshots (`lib/fixtures.cjs`, `lib/fake-clock.cjs`
  — snapshots exclude `.git` and the binary knowledge store, escape
  product-written `.gitignore` files), the world builder
  (`lib/world.cjs` — installed-layout skills, hermetic git, keyword-only
  store re-derived at materialise), and the runner (`run.cjs`: list ·
  select · world · prompt · grade · snap · verify · destroy). The
  `prompt` command is the P4 boundary — walker prompts are
  machine-assembled and never contain expects. `npm test` gains two
  token-free suites (corpus validation, snapshot rebuild-compare); the `/prose-test`
  dev skill owns the model layer (Sonnet walks, Opus confirms, quoted
  evidence or it didn't happen). First fixture: `base` — a post-boot
  keyword-only empty project, proven byte-deterministic across rebuilds.
  Two smoke cases exercise every moving part end-to-end; the full pipe
  (world → boot-in-world → deterministic grade) executed clean.

- 2026-07-24 — Design agreed with Lee. Key decisions: static fixtures
  over sim-replay (decoupling; the sim stays the engine's test bed,
  prose tests own their worlds) with the engine kept at authoring
  time via recipes; recipe + golden snapshot over either alone
  (always-current *and* visible drift *and* frozen runs); on-command
  invocation only — tokens are spent deliberately, `npm test` holds
  the deterministic perimeter; Sonnet→Opus escalation; happy path
  first-class, corpus seeded from the sim's mainline enumeration
  before the failure harvest.
