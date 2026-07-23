# State Out of Prose — the analysis-state programme

The last pocket of hand-edited state. The batching programme made writes
one-call; this programme makes every state *transition* an engine call —
no workflow state is written to or read from file frontmatter again.

## Motivation (2026-07-23)

- **Lee's fumi note (2026-07-22)**: the background-agent surfacing family
  tracks its lifecycle (`status`, `announced`, `surfaced`) in cache-file
  YAML mutated with Edit. The prose itself declares "the cache file is
  the only state."
- **Round 4's proof by omission**: the executed contract audit found the
  engine/prose seam drift-free, and the pipeline simulation now audits
  every engine-recorded transition — but frontmatter state is invisible
  to both. It is unvalidated (a typo'd status just sits there), unlocked,
  and unsimulatable: precisely the silent-drift class the review rounds
  kept finding.
- **The artifact layer already made this move**: "Specification metadata
  is stored in the work-unit manifest, not in file frontmatter"
  (specification-format.md). This programme extends that line to the
  machinery.

## The contract

- **S1 — the engine owns every transition.** Prose never writes or reads
  frontmatter. Legacy frontmatter in existing files is left in place,
  permanently unread — never deleted.
- **S2 — durability picks the store.** Persisted state (gate decisions,
  approvals, tracking flips, anything that must survive sessions and
  machines) lives in the work-unit manifest. Ephemeral session machinery
  lives in an engine-owned `state.json` colocated with the state's
  subject — `.workflows/.cache/{wu}/{phase}/{topic}/state.json` —
  validated vocabularies, locked atomic writes, gitignored. Deleting a
  scope's directory removes state and content together: cleanses are
  structural. Two stores, one owner.
- **S3 — content stays markdown.** Agent findings prose, staging task
  bodies, candidate descriptions, tracking narratives: files, committed
  where they are committed today. Only lifecycle moves.
- **S4 — every transition ships simulated.** Each stage extends
  `test-pipeline-simulation.cjs` with its new verbs (the CLAUDE.md
  standing gate).
- **S5 — one exception: local-markdown.** Its task-file frontmatter is
  the format's declared backend — the analogue of tick's DB or Linear's
  API — and is untouched. No other frontmatter survives as a write or
  read target.
- **S6 — migration fixes forward.** One `.cjs` migration translates live
  frontmatter state for in-progress work units into the new stores.

## Census (2026-07-23 — grep sweep, 39 files, 91 mentions)

| Family | State today | Disposition |
|---|---|---|
| F1 background-agent surfacing (research review/deep-dive, discussion review/perspective/synthesis, both final-reviews) | `in-flight→pending→acknowledged→incorporated`, `announced`, `surfaced[]`, finding-id lists — Edit-mutated cache frontmatter | cache `state.json`, `engine agent` verbs; skeleton files abolished (dispatch records the row; the content file's existence is completion) |
| F2 investigation validations (root-cause, fix-validation, fix-exploration) | same skeleton pattern, `in-flight→pending→read` | same store, same verbs |
| F3a review-actions staging (`review-tasks-c{N}.md`) | frontmatter `gate_mode` + per-task pending/approved/skipped — the CONVENTIONS-sanctioned carrier | statuses + gate_mode → manifest (durable: the file is committed); the sanctioned exception dissolves |
| F3b implementation analysis staging (`analysis-tasks-c{N}.md`) | same shape | same — manifest |
| F3c analysis candidates (`.state/*-candidates.md`) | `gate_mode` + per-candidate status, deferral survives boots | statuses + gate_mode → manifest (deferral is cross-machine; content stays `.state` markdown) |
| F4 tracking files (`review-*-tracking-c{N}.md`) + report stats | `in-progress→complete` flip gating completion; convergence reads `total_findings` etc. from report frontmatter | flip → manifest; stats returned in agent completion output and engine-recorded |
| F5 local-markdown task files | `status`/`priority`/`depends_on` | KEEP — the format's backend (S5) |
| F6 artifacts (spec, discussion, research docs) | none — metadata already in manifest | already done; the precedent |
| Adjacent: `planning.md` inline approval markers | `status: approved` + `approved_at` written into the document body, read back by later steps | → manifest (state in natural language, same disease without the YAML) |
| Adjacent: `fix-tracking-{internal_id}.md` placement | engine-written, cache — but it is the per-task fix history convergence reads and post-hoc flow analysis wants | promote to committed `implementation/{topic}/` beside the analysis reports (placement only; already engine-owned) |

Correctly cache, unchanged: render payloads and ops files (pure scratch),
agent findings content files (everything of value is surfaced and
incorporated into real artifacts before conclusion; final-review drains
stragglers).

## Stages

1. **Engine agent-state store + verbs** — `domain/agent-state.cjs`;
   `agent dispatch/scan/ack/announce/surface/incorporate`; per-row
   validated lifecycle; `scan` promotes in-flight→pending on content-file
   existence and returns the decision-ready snapshot the surfacing
   protocol and conclusion gates read. Render surfaces ride the family
   swaps (earned by their sites, per batching C4). Tests + simulation.
2. **Research family swap** — review-agent, deep-dive-agent,
   final-review, session in-flight checks, background-agent-surfacing
   rewritten engine-driven.
3. **Discussion family swap** — review, perspective, synthesis,
   final-review, discussion-session.
4. **Investigation family swap** + fix-tracking promotion to
   `implementation/{topic}/`.
5. **Durable staging → manifest** — F3a/b/c statuses + gate modes, F4
   flips, report stats via completion output.
6. **planning.md approval markers → manifest.**
7. **Migration + doc sweep** — the `.cjs` migration for in-progress
   units; CONVENTIONS (staging exception dissolves; no-frontmatter
   rule), CLAUDE.md, docs site.

## Log

- 2026-07-23 — Review round 2 (#534), six fresh lenses over cleared
  ground per Lee's no-single-pass rule. The re-review of "clean"
  surfaces paid: the round-1 fix for the task-writer HIGH had placed
  the handoff after the fence (three slices converged on it); the
  engine review reproduced eight defects black-box rounds missed
  (stale-synthesis resurrection, path traversal via unguarded topic
  args, NNN overflow, corrupt-row crashes, matcher over/under-match);
  the journey walks caught the fresh-session re-author over approved
  text and the analysis loop's missing resume arms; the inventory
  closed stages 3-6 at 537 units, 0 lost (770 programme-wide), and
  found migration family six (in-flight authoring decisions). Real
  data re-rehearsed clean. Accepted: pre-programme crashed skeletons
  count as legacy cycles (final review backstops; documented in the
  gateway).

- 2026-07-23 — End-of-stack review (#533): three slices + a real-data
  rehearsal (sandbox copies of fumi and portal — 16 + 64 assertions,
  0 failures, byte-stable re-runs; originals untouched). One HIGH:
  the task-writer agents were missed as staging consumers — approved
  work would silently never reach the plan; orchestrators now pass
  the approved numbers. Two more majors: the spec side's oldest
  tracking carriers still prescribed frontmatter, and the authoring
  amendment contract had no producer. Migration hardened against the
  real historical shapes (CRLF, dead skeletons, dotted names, the
  container leak its new pin caught). Census closure: 233-unit
  inventory in round 2, corpus-wide census here — the no-frontmatter
  claim now holds everywhere outside local-markdown and legacy.
  Accepted residuals: pre-programme in-flight skeletons count as
  legacy review cycles (rare, self-healing); per-finding resolution
  lines stay content records.

- 2026-07-23 — Stage 6 up (#532): migration 051 carries in-progress
  installs across the whole programme in one idempotent pass — agent
  rows, candidate subtrees (spent gates translate to nothing), staging
  cycles, tracking flips, fix-tracking relocation. planning.md
  approvals deliberately unparsed (one re-presented gate self-heals).
  CONVENTIONS gains the standing State Ownership rule; CLAUDE.md
  records the principle. The stack stands complete at #527–#532 for
  the end-of-stack review.

- 2026-07-23 — Stage 5 up (#531): the natural-language state. Plan
  approvals become manifest dates (approvals.structure /
  approvals.tasks.p{N}); the authoring loop's per-task heading
  suffixes become staging.author-p{N} rows keyed by internal id
  (rejected joins the staging vocabulary), cleared when the phase's
  authoring completes. The task-author agent writes bare headings —
  rejected tasks are named by the prompt and their feedback
  blockquotes, content not state.

- 2026-07-23 — Stage 4 up (#530): the durable half. Staging cycles
  record per cycle in the manifest (decisions double as convergence
  history); candidate gate state under analysis_staging, cleared when
  a gate completes; tracking flips under tracking.{stem}, read by both
  completion checkpoints; report stats become a Stats body section.
  All vocabulary-guarded at the engine. CONVENTIONS' sanctioned
  staging-frontmatter exception dissolves. Deliberate line: tracking
  files' per-finding resolution lines stay body content — a record
  with notes (fix-tracking's class), not a mutated lifecycle — raise
  at end-of-stack review if the line sits wrong.

- 2026-07-23 — Stage 3 up (#529): the investigation family. Validations
  walk dispatch → land → scan → incorporate (consumed inline, never
  surfaced — the store's existing verbs fit with nothing new). The
  fix-options draft turned out to be content, not state (its status
  had no consumer) — lifecycle dropped entirely. Fix-tracking promoted
  to committed history beside the analysis reports; the per-task
  commit stages it. Net −43 lines.

- 2026-07-23 — Lee: colocate the store with its topic
  (`{phase}/{topic}/state.json`, one per topic) rather than one blob
  per work unit — every verb is topic-scoped, so the wu blob bought
  nothing, and colocation makes the restart cleanse structural. The
  purge verb (round 2's procedural fix) deleted with it.

- 2026-07-23 — #528 round 2 (behaviour inventory, crash/resume seams,
  fix-round cold review): the inventory answered Lee's deleted-prose
  concern by count — 233 behavioural units in the old files, 0 lost,
  0 weakened, 30 promoted to enforced engine guards, 1 justified drop
  (write-only decision field). Two new majors, both fixed: topic
  restart's rm -rf silently inverted from complete cleanse to partial
  (state lives above the deleted dir) — new `agent purge` verb, called
  from both restart flows; and `--set` bypassed the legacy-collision
  guard — a dead session's stale synthesis file could surface as a
  fresh council's report. Hardened with them: synthesis requires a
  complete landed set at the engine; one-per-set applies to live rows
  (dead-synthesis recovery); ack refuses synthesis inputs; the watch
  path bounces instead of falsely satisfying the gate (the round-1
  fix had turned base's stall into a false pass — caught cold).

- 2026-07-23 — #528 review round (three slices: protocol walkthrough
  vs engine, dispatch-site audit, conventions pass): five verified
  majors, all fixed on the branch. The big one: set identity for the
  perspective council died with the skeletons' shared `set:` field —
  restored as engine state (multi-label dispatch shares one number,
  synthesis joins by `--set`, one per set). Also restored: the drain
  gate's in-flight block (concurrent-review guarantee) and the last
  finding's engagement bounce (final-review routes on the raise, not
  row status — surface's auto-incorporate had swallowed it). `created`
  now rides every scan row for freshness checks; the heading contract
  standardised on `### {ID}: {label}`. Confirmed accepted: legacy
  pending reviews are invisible to the store until the stage-7
  migration translates them.

- 2026-07-23 — Stage 1 up (#527): the `engine agent` noun over
  `.workflows/.cache/{wu}/state.json`. Skeleton files abolished —
  dispatch records the row, the content file's non-empty existence is
  completion. `scan` answers `next` (the one action to take). Eleven
  tests + a simulation scenario and a standing store invariant.
- 2026-07-23 — Stage 2 up (#528), merging planned stages 2+3: the
  shared surfacing protocol is engine-driven, so research AND
  discussion swap together (a one-family swap would leave the other
  loading a half-converted protocol mid-stack). Five agent prompt
  files now write pure markdown — the `## {ID}` headings are the
  finding-id contract. `incorporate` widened to any live state for
  synthesis-consumed perspectives and abandoned rows. The discussion
  gateway's `review_cycles` reads store rows; legacy files count by
  existence, frontmatter never read. Investigation becomes stage 3.

## Decisions

- 2026-07-23 — Lee: net result is no frontmatter written or read
  anywhere going forward; legacy stays in place unread. Local-markdown
  is the sole exception (its frontmatter is the format itself).
  Persisted state belongs in the work-unit manifest; cache-driven state
  belongs in an engine-owned manifest living in the cache directory,
  cleaned at work-unit close. Confirmed in-scope: planning.md inline
  approval markers, fix-tracking promotion to committed, report stats
  via agent output. Design PR first, stacked PRs after, pause per stage.
