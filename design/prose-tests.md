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

- **P1 — a case is a directory, one file per element.**
  `tests/prose/cases/{case-id}/`: `case.json` (the values code branches
  on — origin, scoped files, scripted answers, stub bindings),
  `fixture.md` + `fixture-state.cjs` (the starting world in prose and in
  engine calls), `act.md` (the coarse instruction), `assert.md` (the
  expected path), `assertion-state.cjs` (the world the walk should
  produce; absent means "unchanged"), and the two generated snapshots.
  Nothing is parsed: JSON is JSON, prose files are read whole, recipes
  are required as modules. Prose and code never share a file.
- **P1a — the file boundaries are load-bearing.** `act.md` and
  `assert.md` are separate because that is the P4 boundary — the walker
  must never see the expected path, and a file boundary enforces it
  structurally rather than by convention. `fixture-state.cjs` and
  `assertion-state.cjs` are separate because they change for different
  reasons: the fixture when the precondition changes, the assertion when
  the prose's behaviour changes. Worlds are per-case; duplication is
  accepted, because a case readable in one directory beats a
  deduplicated fixture library chased across the tree.
- **P1b — coarse act, granular assertion.** `act.md` never scripts the
  workflow's own steps: if the case says which commands to run, the
  walker stops deriving the path from the prose and the case would pass
  with the skill file deleted. Granularity belongs in `assert.md`, where
  a step-by-step expected path catches the real threat — a walker that
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
- **P4 — walker/asserter separation.** The walking agent never sees
  `assert.md`; an agent that knows the expected answer will find it.
  The walker gets the world, the coarse instruction, the answer script
  and the stubs, and returns a transcript. The asserter sees the
  transcript, the expected path, and the world delta — never the
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
- **P6 — one model, chosen for trust.** Walker and asserter both run on
  **Opus**. Measured, not assumed: across three runs a Sonnet walker
  performed the walk correctly every time but narrated it in summary,
  omitting the quoted evidence the asserter requires — even with a
  worked transcript example in front of it. A tiered arrangement then
  produces a disagreement on every case, which is noise, not a signal.
  A result you cannot rely on is worth nothing, so the cheaper tier is
  a false economy. The orchestrator never overrides the model: each
  definition names the model its result is trusted at.
- **P6a — a FAIL is confirmed by repetition, not by promotion.** A
  failing case re-runs once from a fresh world at the same models. A
  defect in the prose reproduces; a one-off does not, and is reported
  as FLAKY with both runs quoted. Nothing is auto-resolved.
- **P6b — a nested agent per case.** The `/prose-test` skill dispatches
  one **prose-orchestrator** per case, which builds the world, dispatches
  **prose-walker**, computes the delta, dispatches **prose-asserter**,
  escalates a failure, destroys the world, and returns a verdict alone.
  Transcripts never reach the main session — the reason the design
  scales past a handful of cases. Standing instructions live in
  `.claude/agents/prose-*.md`; only the per-case payload comes from
  `tests/prose/prompts/`, so no agent ever reads words composed in code.
- **P6c — run the test, nothing else.** Every agent in the chain is
  forbidden from fixing anything and from working out why a case failed.
  A failure is a finished result; diagnosing it is a separate, human-led
  act. This is stated in prose in each definition rather than relied on
  from tool restrictions, which an agent may hold regardless.
- **P7 — a failing case is a finding either way.** Either the prose
  broke, or the world/design moved and the case is stale. The
  adjudication is the point; only the typo-class staleness is
  pre-filtered by the perimeter (P3).
- **P8 — cases are hand-written, never generated.** Deriving an
  `assert.md` from a recorded walk would make authoring far faster and
  would quietly convert the whole corpus into approval testing: every
  case would pin what the prose *currently does*, defects included, and
  a mummified bug passes forever. The authoring effort — reading the
  prose closely enough to state what it *should* do — is the part that
  finds pre-existing defects, as it did twice in the first corpus. It
  is the point, not the overhead. Snapshots are generated because the
  engine authors them and drift is visible; expectations are written
  because only a person can say what correct means.

## Architecture

- `tests/prose/cases/{case-id}/` — the cases, one directory each.
- `tests/prose/mainlines/{work-type}.cjs` — shared pipeline stages, so
  a case's state recipes are a few lines of composition. This is where
  reuse lives: as functions, not as deduplicated snapshots.
- `tests/prose/stubs/{name}.md` — named substitutions: description
  above a `---` fence, exact bytes below.
- `tests/prose/lib/` — `cases.cjs` (load and validate a case
  directory), `worlds.cjs` (run recipes, snapshot, hash-skip, diff,
  materialise), `fake-clock.cjs`.
- `run.cjs` — the deterministic CLI: `list · select · world · prompt ·
  diff · assert · snap · verify · destroy`.
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

- 2026-07-25 — First real runs, and the nested-agent shape. The framework
  executed end to end for the first time: a Sonnet walker followed
  root-cause-validation.md against a live world — real engine calls, the
  scripted answer, the stub firing at its trigger — and a Sonnet asserter
  graded five path steps with quoted evidence and classified the lone
  world difference (an agent-row timestamp) as volatile. PASS, ~107k
  tokens, 2.5 minutes.
  **The negative test is the more valuable result.** With `agent scan`
  deleted from the world's own copy of the prose, the run correctly
  FAILED — the asserter quoted the missing call and raised a DEVIATION.
  Crucially **the world delta was byte-identical to the passing run**:
  `incorporate` sets `incorporated` from any prior status, so skipping
  `scan` converges on the same end state. Whole-world assertion alone
  would have passed a real defect; only the granular expected path caught
  it. Lee's argument for granularity, proven by evidence rather than
  reasoning.
  Two changes came out of the runs: the walker must quote every block the
  prose directs it to emit (a skipped emission was invisible), and the
  agent layer moved into `.claude/agents/` as prose-orchestrator →
  prose-walker + prose-asserter, so transcripts stay out of the main
  session (P6a) and standing instructions stop being JS string literals
  in the runner. Noted, not actioned: `incorporate` never requires a row
  to have reached `pending` — forgiving by design, since recovery paths
  close rows that never produced a report, but it is why this class of
  skipped step is invisible to state.

- 2026-07-25 — A case becomes a directory (Lee, still reviewing in the
  TUI). Three faults in the flat-markdown shape, all his: **(1)** code
  regex-parsed values out of markdown — the exact pattern this project
  spent the analysis-state campaign eliminating. Now `case.json` holds
  what code branches on, prose files are read whole, recipes are
  modules; nothing is parsed and prose never shares a file with code.
  **(2)** `world_before`/`world_after` named foreign fixtures the case
  merely pointed at, and the scatter was real — six locations for one
  test. A case now owns its worlds: `fixture-state.cjs` and
  `assertion-state.cjs`, split because they change for different
  reasons, with their snapshots beside them. Duplication accepted;
  reuse moved to `mainlines/` as functions. **(3)** The naming follows
  the stage it serves — fixture, act, assert — so `assert.md` and
  `assertion-state.cjs` sit together by design. Added with it: a
  recipe-hash skip, without which per-case worlds would make the gate
  grow linearly (proven: 0.09s when nothing moved, full rebuild and
  DRIFT when a mainline's content changed).

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
