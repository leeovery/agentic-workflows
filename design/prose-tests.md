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

- **P1 — cases are structured natural language.** A case declares
  `id`, `files:` (prose scope, drives diff-selection), `world:` (the
  fixture it starts from, or none for pure prose-structure claims),
  `walk:` (entry point + termination), `user:` (scripted answers for
  the menus the walk hits; an unscripted question is a FAIL — the
  prose asked something the case didn't predict), `expect:` (concrete
  checkable claims: routing assertions graded by the agent with quoted
  line evidence, end-state assertions diffed by code), `origin:` (the
  finding or flow it pins). Granularity is whatever the case needs —
  compact routing cases live several-per-file, long end-to-end walks
  get their own file, under `tests/prose/{flow}/`.
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
- **P3 — deterministic wherever possible.** The model supplies only
  the walk; the facts come from code. Engine responses are real,
  end-state expectations are verified by a deterministic diff, worlds
  are byte-frozen snapshots. CI (`npm test`, zero tokens) holds the
  deterministic perimeter: every snapshot rebuilds from its recipe
  byte-identical (drift red-flags in the PR that moved the world, as
  a reviewable snapshot diff), and every case's `files:` paths and
  section anchors resolve. Recipes run deterministic — pinned clock
  or normalised volatile fields, same constraint the simulation
  already lives with.
- **P4 — walker/grader separation.** The walking agent never sees the
  `expect:` block; an agent that knows the expected answer will find
  it. The walker gets world + walk + user script only and returns a
  transcript; grading happens after, against the transcript.
- **P5 — run on command, never in CI.** Walks cost tokens. The runner
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
  pre-filtered by CI (P3).

## Architecture

- `tests/prose/{flow}/` — case files per flow (research, discussion,
  planning, implementation, review, discovery, …).
- `tests/prose/fixtures/{name}/recipe.cjs` + `snapshot/` — the world
  library. One canonical fake project (same name, same topics
  throughout) so fixtures stay comparable and cases read familiarly.
- Runner (node): case parsing, diff-selection, world building,
  walker-prompt assembly, end-state diffing, verdict table. Owns
  everything deterministic.
- `/prose-test` skill (thin): dispatch and grading discipline —
  invokes the runner, sends walkers, grades transcripts, escalates
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
  machine-assembled and never contain expects. CI gains two token-free
  suites (corpus validation, snapshot rebuild-compare); the `/prose-test`
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
  invocation only — tokens are spent deliberately, CI holds the
  deterministic perimeter; Sonnet→Opus escalation; happy path
  first-class, corpus seeded from the sim's mainline enumeration
  before the failure harvest.
