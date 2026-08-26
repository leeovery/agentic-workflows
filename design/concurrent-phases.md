# Concurrent Phases — every document phase runs concurrently; code runs alone

Extends `design/concurrent-discussions.md` (shipped v0.6.27) from two
phases to the whole pipeline: any number of sessions, in any
permutation of the document phases, on one checkout — and a single
code session at a time. Design log for the stack; decisions converged
2026-08-26, recorded here as the PRs land.

## Motivation (2026-08-26)

- **The 0.6.27 foundations are already phase-agnostic.** The
  per-work-unit manifest lock (atomic read-modify-write, disjoint
  dotpaths can never lose each other), the strictly topic-partitioned
  cache, and the commit door's pathspec map (which already covers all
  seven phases) were built once and generalise for free. What is
  phase-specific is adoption: only research and discussion ever
  converted their prose commits, grew presence, and gained the
  triage/deferral protections.
- **Discovery steals from live sessions today.** Discovery runs
  concurrently with research and discussion right now — the epic menu
  delegates map refinement while a peer session holds a topic — and
  its 12 prose commit sites plus 2 engine transaction tails
  (`discovery-map.cjs`, `discovery-session.cjs`) are whole-index,
  whole-work-unit commits. A discovery session snapshots a peer's
  half-written document under a `discovery(…)` message; the peer's
  next `--topic` commit finds nothing to commit and its recovery
  point is gone. Hazard #1 of the original design, live for the pair
  the original stack never converted.
- **Code cannot partition.** Every document phase shares nothing
  across topics; implementation and review share the code tree and
  the git index, which are checkout-wide. Review is not read-only:
  its verifiers run the test suite and measure the tree (garbage
  under a concurrent mutator), and its apply lane writes code. So the
  model is one rule with no middle: document phases concurrent
  without limit, code phases one at a time.
- **Prose-prescribed heartbeats are not reliable.** The walk
  campaigns repeatedly recorded walker-narrated-but-unrecorded calls
  — a prose instruction to run a beat is exactly the call that
  silently drops under context pressure. Liveness must ride the verbs
  a session already cannot skip.

## The model

- **Document phases** — discovery, research, discussion,
  investigation, scoping, specification, planning: any number of
  concurrent sessions, any permutation, cross-phase and cross-topic,
  on one checkout. Same-topic entry is gated (red, explicit,
  overridable), never forbidden.
- **Code phases** — implementation and review: one session at a time
  across the whole checkout, either kind. Gated red at every entry
  route, overridable with explicit wording. "Per checkout" is the
  honest scope: presence lives in the gitignored cache, so two clones
  cannot see each other — and one checkout is where file clashes
  live.
- **Every block is advisory.** No gate in the system is
  unoverridable. The machine's verdict is precise about process
  existence (`held` verifies pid + start time — a SIGKILLed session
  reads unheld on the next scan); what no mechanism can judge is
  intent — an open-but-abandoned session holds forever, and only the
  user knows it is dead weight. The gate states the facts and the
  risk; the user decides.

## Principles

Numbered continuing `design/concurrent-discussions.md` (P1–P6, all
upheld — P5's "nothing ever blocks on it" survives in letter: the
code gate is the strongest advisory in the system, not mutual
exclusion).

- **P7 — derive, don't declare; where you must declare, verify and
  backstop.** Workflow artifacts commit by layout-derived pathspecs —
  never a model-remembered list (a forgotten file sits in a peer's
  blast radius; a wrongly named one is theft). Code has no layout, so
  code commits take Claude-declared paths — through an engine verb
  that validates them, commits confined under the lock, and answers
  with the residual dirt so the session reconciles what it forgot.
  Declared paths are safe *because* of the code gate: one code writer
  at a time means a wrong name cannot hit a peer.
- **P8 — liveness is mechanical.** Beats ride the verbs a session
  already must run; no prose instruction maintains presence, and the
  prose never mentions it. A verb beats only when it is structurally
  self-referential — the session acting on its own topic. Foreign-
  acting verbs (triage delivery, the conclude sweep) never beat: a
  beat stamps the current process's identity, and stamping it onto
  another topic manufactures a false hold.
- **P9 — one gate family, red, explicit, overridable.** The code
  gate and the same-topic gate share one shape: a blocked-register
  fact (who, where, last active), the consequence of proceeding, and
  the explicit condition — "only proceed if you know that session is
  no longer working." Menu rows stay visible (struck/red), never
  dropped: a dropped row is a hard block with the override made
  unreachable.
- **P10 — code is the unpartitionable resource.** Everything else in
  the system partitions by topic; the tree and the index do not. The
  one-code-session rule is not a phase ordering opinion — it is the
  shape of the resource.

## What the audit found (2026-08-26)

Safe already, untouched by this stack: manifest lock, cache
partitioning, KB store locking, harness stale-write protection, the
commit lock and index.lock retry, `TOPIC_COMMIT_ARTIFACTS` (all seven
phases), triage sidecar (research/discussion/investigation), the
`held`/`live` identity verdicts, the SessionEnd cleanup hook.

The gaps, each owned by a PR below:

1. **Whole-index prose commits everywhere but research/discussion.**
   Discovery 12 sites (+2 engine tails), planning 16, specification
   ~15 (2 legitimately work-unit-wide), implementation 12, review 9,
   scoping 4, investigation 2, spec-entry 2, shared 2, continue-epic
   1. Each stages `.workflows/{wu}` and commits the whole index —
   the exact theft the commit door removed for two phases.
2. **`commit --plan` is whole-index.** It widens the *staged* scope
   to the plan's storage paths but still commits everything staged.
3. **Code commits sit outside the machinery entirely.**
   `task-loop.md` and review's `apply-do-now.md` use raw `git add`
   on listed paths then a pathspec-less `git commit` — no commit
   lock, no index.lock retry, and the commit takes whatever a peer
   had staged in the add→commit window.
4. **Presence is hard-coded to two phases.** `PHASES` in
   `domain/presence.cjs` gates beat/scan/cleanup; every other
   phase's session is invisible to the epic menu, the deferral, the
   sweep, and the spec-side held-doc check.
5. **Beats and clears are prose-owned** — the unreliable channel
   (see Motivation).
6. **Work-unit-wide staging unprotected beyond one consumer.**
   `.state/` analysis files carry overwrite-any-prior-pass
   semantics; only the topic-discovery dispatch defers on live
   presence. The spec-entry grouping analysis does not.
7. **Build-order sequencing race.** Two spec completions can both
   set `build_order_stale` and both sequence; B's pass can clear a
   flag A's completion set after B read.
8. **The conclude sweep would auto-commit code.** Its rule ("dead
   session's dirt commits action-scoped") is correct for `.workflows`
   artifacts and wrong for a half-finished task's code.

## The components

### Presence widening + mechanical beats (engine)

`PHASES` grows to research, discussion, investigation, scoping,
specification, planning, implementation, review. Discovery stays out:
`discovery-session open` already refuses a second session per epic
(`active_session`) — engine-serialised, nothing for presence to add.

Beats become side effects of self-referential verbs:

- `commit --topic {phase}/{topic}` — beats (the session-cadence
  commit; "last active" becomes "time since last real write").
- `commit --topic … --kb` — **clears instead of beats.** The design
  log already establishes the `--kb` rider as the one terminal
  session-cadence commit; if it beat, it would re-stamp presence
  after the conclusion and the topic would read held forever.
- `topic queue` — beats (polled by the session loops' findings check
  every iteration: turn coverage with no writes).
- Three-segment `manifest set`/`apply` on a presence phase — beats
  (every state transition heartbeats).
- Agent-store writes — beat.
- The conclude sweep's `commit --topic` carries a suppression flag in
  its fenced template — a sweeper stamping its own identity onto the
  dead topic it just cleaned would resurrect the hold. `topic triage`
  never beats — it acts on the *target* topic from the origin's
  session.

Prose is stripped: the beat lines at the session-loop heads and the
`presence clear` conclusion steps go. `presence scan` stays — the one
read that feeds judgment (the sweep, the spec-side held-doc check,
the gates). The `beat`/`clear` CLI verbs remain for tests and repair.
SessionEnd `presence cleanup` hooks extend to every presence-phase
process skill.

### Commit door adoption (prose) + new scopes (engine)

- Specification, planning, investigation, scoping, and the
  implementation/review *artifact* commits convert to
  `--topic {phase}/{topic}` (`--kb` where the action indexed).
- Discovery gets its own engine scope — `commit {wu} --discovery`:
  `discovery/sessions/` + `discovery/briefs/` + `manifest.json` —
  adopted at the 12 prose sites; the two engine transaction tails
  confine to the same paths.
- `commit --plan` confines its *commit* to its staged scope
  (pathspec'd, like `--topic`), not just its staging.
- The engine-internal transaction tails audit: each `commitScoped`
  caller already names its scope; the change is committing confined
  to it (`git commit -- <paths>`), after verifying per transaction
  that the scope covers every path it touched (including staged
  `git rm` deletions — inbox, absorb, promote).
- Deliberately still work-unit-wide: the spec-entry grouping/
  reconcile commits and the shared analysis commits (genuinely
  cross-topic; protected by the deferral below), and workunit-level
  lifecycle transactions (create, cancel, pivot, absorb — no peer
  can hold what they touch).

### `commit --paths` (engine) — the code commit verb

`engine commit --paths <file>… -m msg [--for {wu}
{implementation|review}/{topic}]`: validates every path (in-project,
no globs, refuses `.workflows/` paths — those have derived scopes,
and a code commit naming one is a category error), takes the commit
lock, `git add -- <paths>`, `git commit -m msg -- <paths>`, and
answers with `left_dirty` — tracked files still modified — so the
prose closes the loop in one line ("anything in `left_dirty` you
touched for this task, commit it now"). `--for` beats the named code
topic. `task-loop.md` and review's apply lane switch to it; the raw
`git add`/`git commit` pattern retires. Model fallibility becomes a
visible check with a deterministic backstop instead of silent loss.

### The gate family (engine render + projections + prose)

- **Code gate.** A project-wide presence read (`presence scan`
  without a work unit walks the cache root — the traversal
  `cleanupPresence` already has). Any `held` implementation or
  review row anywhere gates every code-phase entry route: the epic
  menu (row stays, struck/red), the per-type continues, the bridge,
  and a Step-0 backstop in `workflow-implementation-entry` and
  `workflow-review-entry` for direct invocation. Red
  blocked-register fact — "Another session is implementing {topic}
  ({wu}) — last active {age} ago. Code phases run one at a time:
  concurrent sessions write the same files, and even worktrees end
  in merge conflicts." Explicit condition — "Only proceed if you
  know that session is no longer working." Options: back
  (recommended) / proceed.
- **Same-topic gate.** The existing in-session confirm gate upgrades
  to the same register and wording, for every presence phase. One
  gesture, learned once.
- An overriding user is informed: the gate wording carries the
  consequence, and the escape hatch for a wedged-but-alive session
  (`presence clear`) is named in the gate.

### Riders

- **Deferral extension**: the spec-entry grouping analysis takes the
  same live-presence deferral the topic-discovery dispatch already
  runs — hold off while any source-phase presence is live; the
  cache self-heals at the next entry. `.state/` stays work-unit-wide
  (grouping is inherently epic-wide; one pass at a time is the
  correct semantics).
- **Build-order**: `build-order sequence` re-reads
  `build_order_stale` and the live set inside the manifest lock —
  last writer over identical inputs, converges, no prose involved.
- **The sweep's code/doc distinction**: a dead session's
  `.workflows` dirt commits action-scoped as today; dead *code* dirt
  (implementation/review) is surfaced — named to the user, never
  auto-committed. A half-finished task's code is not a
  `chore: sweep` commit.

## Hazard → resolution

| Hazard | Resolution | PR |
| --- | --- | --- |
| Discovery's whole-index commits steal live peers' work today | `--discovery` scope + 14 site conversions | 2+3 |
| Whole-index commits in spec/planning/inv/scoping | `--topic` adoption | 4+5 |
| `--plan` commit takes the whole index | Pathspec-confined `--plan` | 2 |
| Raw-git code commits outside lock, whole-index | `commit --paths` + task-loop/apply adoption | 2+6 |
| Transaction tails commit whole index | `commitScoped` → pathspec-confined, per-tail audit | 2 |
| Doc sessions invisible outside research/discussion | `PHASES` widening | 2 |
| Prose beats silently dropped | Mechanical beats on self-referential verbs | 2 |
| Conclusion ordering: clear then beat resurrects the hold | `--kb` clears instead of beats | 2 |
| Sweeper/deliverer stamping foreign topics live | Sweep suppression flag; triage never beats | 2 |
| Two code sessions clash on tree + index | Code gate at every entry route, red, overridable | 7 |
| Second session on a held same topic | Same-topic gate upgraded to the family | 7 |
| Grouping analysis tramples under live sources | Deferral extension | 8 |
| Build-order double-sequence race | Re-check inside the manifest lock | 8 |
| Sweep auto-commits a dead session's half-finished code | Code dirt surfaced, never committed | 6 |

## The stack

1. **PR 1 — this document.** Base; keeps logging; merges at the end.
2. **PR 2 — engine: presence + beats + commit confinement.**
   `PHASES` widening, mechanical beats/clears with the
   self-referential rule, project-wide scan, `--discovery` scope,
   `--paths` verb, `--plan` confinement, transaction-tail audit.
   Contract suites; the two-process commit-door stress test whose
   invariant is the whole programme in one line: *no commit ever
   contains a foreign session's path*.
3. **PR 3 — discovery prose conversion.** The 12 sites to
   `--discovery`. Independently valuable — fixes a live theft.
4. **PR 4 — specification prose.** `--topic` conversion + presence
   hooks (SessionEnd cleanup), and the research/discussion prose
   strip (beat lines, clear steps — now mechanical).
5. **PR 5 — planning, investigation, scoping prose.** Same
   conversion; planning also adopts the confined `--plan`.
6. **PR 6 — implementation + review prose.** Artifact commits to
   `--topic`, code commits to `--paths` with the `left_dirty`
   reconcile line, sweep code/doc distinction.
7. **PR 7 — the gate family.** Render surfaces, epic projections,
   entry backstops, same-topic upgrade.
8. **PR 8 — riders.** Deferral extension, build-order lock re-check.
9. **PR 9 — simulation + prose cases.** Interleaved two-session call
   sequences per phase pair (sequential interleaving is the
   correctness test — every engine call is atomic under its locks),
   gate walk cases, sweep cases.

Every PR lands independently valuable in solo operation.

## Decision log

Settled 2026-08-26:

- Planning is in scope; "spec and below" has no hole.
- Review is a code phase, gated identically to implementation — its
  verifiers measure the tree and its apply lane writes code. One
  code slot covers both; parallel-verify-with-apply-lock was
  considered and rejected as machinery ahead of need (relax later if
  wanted).
- All blocks are soft — red, explicit, overridable; menu rows never
  dropped (a dropped row is an unreachable override). The
  dep-blocked-plan row treatment was considered and rejected for
  gates a user may legitimately override.
- Beats are engine-side only, and the prose does not mention them —
  invisible machinery is not narrated. `--kb` clears; the sweep
  suppresses; triage never beats the target.
- Cross-session messaging (ask the holding session / "commit and
  release") rejected: the abandoned-live session's uncommitted
  window is one write deep under the commit cadence, the sweep
  covers the dead case, and a session nudging another session into
  action cuts against human-led operation. Liveness without the
  harness already exists — the `held` pid + start-time verdict.
- Discovery stays out of presence (`active_session` already
  serialises it engine-side); scoping and investigation come in
  (cheap, uniform).
- "Per code base" means per checkout — presence is cache-resident
  and gitignored; two clones cannot see each other. Documented
  limit, not a mechanism.
