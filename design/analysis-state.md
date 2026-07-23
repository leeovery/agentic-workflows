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
  lives in an engine-owned `state.json` under `.workflows/.cache/{wu}/`
  — validated vocabularies, locked atomic writes, gitignored, purged by
  the close purge. Two stores, one owner.
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
