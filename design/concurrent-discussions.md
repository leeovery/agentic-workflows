# Concurrent Discussions — multiple live discussion sessions on one epic

Two (or more) Claude Code sessions, each running a discussion on a
different topic of the same epic, in the same checkout, on the same
branch. Design log for the stack that makes it safe. Assessed
feasible 2026-07-31 (read-only sweep of the engine, the discussion
flow, and every shared-resource surface); this doc records the
converged design and tracks the open decisions as the PRs land.

## Motivation (2026-07-31)

- **Discussions are the one phase that parallelises.** Implementation
  is inherently serial — same code, same files, and each phase builds
  on the last. Discussions on disjoint topic surfaces share almost
  nothing: per-topic manifest subtrees, per-topic cache, per-topic
  artifact files. Two sessions on two topics is a natural fit the
  system already almost supports.
- **No "concurrency mode" exists or should.** Nothing in the workflow
  prose declares single-session operation; discussion entry gates only
  on the target topic's own status; the epic dashboard already renders
  multiple in-progress discussions; the only guard is an advisory soft
  gate that itself says proceeding is safe. Every change in this stack
  is engine-side or lands in an existing prose seam. A solo session
  sees no behavioural difference. Sessions never know about each
  other and never need to.
- **No worktrees.** The manifest lock works *because* both sessions
  share one `.workflows/` path. Worktrees would give each session its
  own manifest copy — both locks succeed against different files, and
  the rejoin is a guaranteed manifest merge conflict. The shared
  checkout is a feature: discussions never touch code, so the usual
  reason for worktrees does not apply.

## What the feasibility sweep found

Safe by construction today:

- **Manifest**: every mutation verb is a locked atomic
  read-modify-write (`kernel/manifest-io.cjs` — per-work-unit O_EXCL
  lock file, stale-break at 30s, temp-file + rename). Disjoint
  per-topic dotpaths (`phases.discussion.items.{A}` vs `{B}`) cannot
  lose each other's writes.
- **Cache**: `.workflows/.cache/{wu}/{phase}/{topic}/` is strictly
  topic-partitioned, including the agent-state store and restart
  cleanup.
- **Knowledge base**: O_EXCL lock + temp-rename writes; unlocked
  reads are stale-tolerant by design. `index`‖`index` serialises,
  `query`‖anything is safe.
- **Engine process model**: fresh process per invocation, no
  in-memory state between calls.
- **Harness stale-write protection**: Edit/Write fail on a file
  modified since last read, so a peer's write between a session's
  read and write surfaces as a failed tool call forcing a re-read —
  churn, not silent loss.

The three real hazards, each owned by one PR below:

1. **Git.** `engine commit {wu}` stages the whole work-unit directory
   and `git commit` runs with no pathspec (whole index). With the
   commit-after-every-write cadence, session A constantly snapshots
   B's half-written file under A's message; B's own commit then
   reports "nothing to commit" and its recovery point silently
   vanishes; the movement classifiers (`closing-gates.md`,
   `final-review.md` — `git log --since -- {own file}`) read A's
   sweep-up commits as movement on B's file and trigger unearned
   re-review; context-refresh recovery via `git log` assumes sole
   authorship. `kernel/git.cjs` has no `index.lock` retry, and the
   commit at the tail of a transaction (`topic complete`,
   `discovery-session close`) is not try/caught — a collision there
   reports `ok: false` after the manifest write and KB index already
   landed.
2. **Triage delivery.** The `## Triage` append into another topic's
   live file is a model-driven read-then-write — the one place two
   discussion sessions write the same file. Harness protection turns
   the race into edit-failure churn rather than loss, but the
   delivery is still fragile, and the landing path has to create a
   whole template stub for an unstarted topic just to hold a parked
   concern.
3. **The bridge.** The first session to conclude runs epic-wide
   coherence analysis, which can `topic triage` into — and reopen —
   the other *live* topic mid-conversation, and overwrites the shared
   `.workflows/{wu}/.state/` staging files ("overwrite any prior
   pass").

Minor findings carried in the stack: lock and temp files are
stageable (`.workflows/{wu}/.lock`, KB `store.msp.tmp` — migration
049's `.workflows/.gitignore` covers only `.cache/` and manifest
temps); `create-discovery-topic.md` ignores `discovery-map add`'s
duplicate refusal (new-topic name race); concurrent boots run
migrations unlocked.

## Principles

- **P1 — commits are action-scoped, never territory-scoped.** A
  commit's pathspec is "the paths this action wrote", not "my topic's
  directory". A reroute is *your* action landing in another topic's
  territory, so *you* commit it, under your message. The layout is
  the routing table: every topic's files live at predictable
  per-topic paths, so "what this session edited" equals "this topic's
  paths" by construction — nothing observes or infers authorship.
- **P2 — the pathspec'd commit bypasses the shared index.**
  `git commit -m msg -- <paths>` builds a temporary index: HEAD plus
  the worktree content of only the named paths. Other sessions'
  dirty files — staged or not — are ignored and left untouched.
  Four sessions can interleave commits freely; each slices out its
  own quadrant.
- **P3 — the manifest is the one shared file, and that's fine.** It
  is lock-serialised and valid at every instant, so a commit can
  never capture a torn state. A's commit may snapshot fields B just
  wrote — attributional impurity, self-healing (B's next commit
  includes the manifest too), never loss.
- **P4 — triage is a message queue, not a document section.**
  Concerns land as individual engine-created files with unique
  names — append-only by construction, no shared file, no lost
  update possible. The polled-queue model is already the design:
  drain runs at every session-step entry and the conclude gate
  bounces anything that landed after the last drain. Real messaging
  into a peer's context is impossible anyway (its conversation is
  turn-based with a human); the queue is the correct primitive.
- **P5 — presence is awareness, never mutual exclusion.** A
  heartbeat lets the bridge defer epic-wide analyses and lets the
  cleanup pass reason about foreign dirt. Nothing ever blocks on it.
- **P6 — a safety net, not a mechanism.** Correctness of *when*
  things get committed doesn't matter as long as nothing is lost. A
  presence-gated cleanup pass at conclude sweeps dirt whose owner is
  gone (crash recovery) and leaves dirt whose owner is live.

## The components

### Commit door (engine)

`engine commit {wu} --topic {phase}/{topic}` computes the pathspec
deterministically from the layout:

- `.workflows/{wu}/{phase}/{topic}.md` (or the topic's artifact
  directory for structured phases)
- the topic's triage sidecar directory (drain deletions)
- `.workflows/{wu}/manifest.json`
- `.workflows/.knowledge` only on verbs that actually touched the KB

Then, under a commit lock (`acquireLockFile` reused —
`.git/workflows-commit.lock`): `git add -- <paths>` (catches untracked
files), `git commit -m msg -- <paths>`. Belt-and-braces: retry on
`index.lock` in `kernel/git.cjs` (the user can hold it too), and
try/catch on every transaction-tail commit so a collision degrades to
a "commit pending" note instead of `ok: false` after state landed.
Topic-less `engine commit {wu}` remains for work-unit-scoped moments
(initialise, conclude-with-KB, single-session flows) — unchanged
behaviour where no peer exists.

### Triage sidecar queue

Concerns become files: one engine-created file per concern, unique
name minted under the work-unit lock, in a per-topic sidecar
directory (exact path an open decision — see log). `topic triage`
becomes a self-committing transaction (precedent: `topic reactivate`,
`workunit pivot`, `sequence-discovery-map`): write the concern file,
update the manifest, commit `[manifest.json + the file it wrote]` in
one verb. The engine wrote every byte, so it knows the exact
pathspec; attribution is correct; no uncommitted content ever sits in
another topic's territory.

Drain mirrors on the owning side: read the queue files, fold into map
and document, delete them, commit doc + manifest + sidecar. The
conclude gate changes from "`## Triage` ≠ `(none)`" to "sidecar dir
empty". The template-stub creation branch in `triage-landing.md`
disappears — the queue holds the concern; the document is created
when the topic starts; drain runs at first session entry. Restart
stops needing to preserve triage entries inside the document it
resets — the queue survives untouched. A migration converts existing
in-document `## Triage` entries to sidecar files.

Solo-session wins, independent of concurrency: no stub files for
unstarted topics, concerns out of the main document where they never
belonged, a simpler conclude check, a cleaner restart.

### Presence heartbeat

A per-topic timestamp refreshed at each session-step entry, stale
after minutes (same discipline as the lock files). Consumers:

- `triage-landing.md` — a cue that the target's session is live
  ("will drain shortly") vs parked.
- The bridge — defer coherence/gap analysis while any discussion
  presence is fresh. The analyses are cached and self-healing;
  skipping a pass is already a supported state, so this is one
  condition in existing prose, not machinery.
- The conclude cleanup pass — `git status --porcelain -- .workflows`;
  foreign dirt with fresh presence is left (theirs to commit), with
  stale or no presence is swept (crash recovery — exactly the case
  where a sweep is correct). An unconditional sweep would re-create
  the theft the commit door removed; the presence check is what makes
  the net safe.

### Hygiene riders

- Migration extending `.workflows/.gitignore`: `.lock`,
  `.lock.breaking`, `.project-lock`, KB temp files.
- `create-discovery-topic.md` gets an arm for `discovery-map add`
  refusing a duplicate (name race).
- Optional: serialise boot's migration run behind a lock.

## Hazard → resolution

| Hazard | Resolution | PR |
| --- | --- | --- |
| Whole-index, whole-WU commits steal peer work | Pathspec'd commit door, action-scoped | 3+4 |
| Movement classifiers poisoned by sweep-up commits | Falls out of the commit door — peer commits stop touching the file | 3+4 |
| `index.lock` collision fatal in transaction tails | Commit lock + retry + try/catch tails | 3 |
| Lock/temp files stageable | Gitignore migration | 2 |
| Cross-topic `## Triage` append races | Sidecar queue, self-committing triage | 5 |
| Stub creation for unstarted topics | Removed by sidecar | 5 |
| Bridge reopens live peer topic | Presence-gated deferral | 6 |
| `.state/` staging overwritten across sessions | Deferred with the bridge (same gate) | 6 |
| Crash leaves uncommitted work | Presence-gated cleanup pass at conclude | 6 |
| New-topic name race unhandled | Duplicate-refusal arm | 6 |

## The stack

1. **PR 1 — this document.** Base of the stack; keeps logging as the
   PRs land; merges at the end.
2. **PR 2 — gitignore migration.** Tiny, standalone, useful today.
3. **PR 3 — commit door (engine).** The load-bearing PR: removes the
   dominant hazard solo. Engine contract suite.
4. **PR 4 — commit door (prose adoption).** Discussion-flow
   session-cadence commits switch to `--topic`; the conclusion commit
   carries `--kb`; simulation pins the call shapes. Deliberately
   deferred to later layers: the reroute commits stay work-unit
   scoped until the sidecar makes cross-topic delivery
   self-committing, and restart keeps the shared resume-detection
   semantics (residual whole-WU sweeps, covered by the cleanup pass).
5. **PR 5 — triage sidecar.** Engine verb + prose
   (`triage-landing.md`, `drain-triage.md`, conclude gate) +
   migration + prose test case. Switches the reroute commit sites.
6. **PR 6 — presence, bridge deferral, cleanup pass, hygiene arms.**

Every PR is independently valuable in solo operation — nothing waits
on the full set to justify itself.

## Decision log

Settled:

- Action-scoped pathspec commits over per-topic index files, batching,
  or worktrees (2026-07-31 — see Principles).
- Sidecar queue over engine-owned in-document append (2026-07-31 —
  append still loses to the owning session rewriting from a stale
  in-context copy; files are append-only by construction, and the
  queue is wanted on solo merits).
- Triage self-commits (2026-07-31 — action-scoped attribution, no
  uncommitted foreign dirt).
- The conclusion commit carries the KB dir via an explicit `--kb`
  rider on `--topic` (2026-07-31, PR 4) — `topic complete` indexes
  the store without committing, so the conclusion is the one
  session-cadence moment whose own action dirtied the KB; implicit
  KB staging stays off `--topic` everywhere else.
- The commit lock lives in the `.git` dir
  (`.git/workflows-commit.lock` via `rev-parse --git-path`), not under
  `.workflows/` (2026-07-31, found in PR 3 — a lock inside
  `.workflows` is staged by the very commit it guards, turning clean
  trees into phantom commits; the `.git` dir can never be staged, and
  `--git-path` gives linked worktrees their own lock, matching the
  per-worktree index it serialises).

Settled in PR 5 (2026-07-31):

- Sidecar path: `.workflows/{wu}/{phase}/.triage/{topic}/NNN-{slug}.md`,
  numbered by the engine under the work-unit lock. Not KB-indexed —
  transient by design; drained content reaches the KB inside the
  artifact it folds into.
- Concern transport: `--concern <file>` written to the origin topic's
  phase cache; the engine consumes the scratch on delivery. `-m` is
  required with it — attribution belongs to the rerouting session.
- Migration 054 one-shot converts existing in-document sections — no
  drain fallback: boot runs migrations before any session, so a drain
  can never meet an in-document entry.
- Drain stays prose — the folding is judgment work; only the delivery
  and the commit needed engine ownership.
- The queue store stays the filesystem (2026-08-01, from #673's
  review, considered against manifest storage): concern bodies are
  judgment-written prose — content belongs in files (the briefs
  idiom), and queue files keep recovery commits human-readable where
  manifest-embedded bodies would be escaped JSON blobs. Every
  state-cleanliness benefit of manifest storage is had instead by the
  engine owning the layout: the `topic queue` read verb answers
  `{count, files}`, and no skill prose spells `.triage/`.
- Mid-session triage surfacing (2026-08-01): the session loops'
  findings check polls `topic queue`; a mid-flow landing is offered
  at the next natural break (drain now / later). Deferral is
  thread-scoped — the offer re-raises at every subsequent natural
  break, the review-findings cadence — and the conclusion gate
  remains the never-lost backstop.
- Landing phase is judged, not liveness-derived (2026-08-01): the
  origin session judges research-vs-discussion from the concern's
  nature and recommends at the existing reroute gate; the delivery
  handles any target state (park / untouched / reopen). A
  research-side landing beneath a completed discussion sets
  `reconcile_needed: research` in the same locked write — staleness
  begins at landing — surfaced by the reconcile advisory's research
  arm; the lifecycle join renders the combination as `researching`
  so the epic menu resurfaces it. New targets route at the judged
  phase, not the origin's.
- Verification addenda (2026-08-01, from #673's review): a migration
  over judgment-written content hands its blind spots to judgment —
  optional `info` (intent, project-agnostic) + `verify` returned from
  `run()` (project checks, returned on skip paths too: a skip can be
  a false negative). Boot carries executed migrations' addenda as
  `migrations.verify`; workflow-start Step 0.1 performs the checks
  before the confirm gate, fixes riding the migration commit. Fires
  once, never for recorded migrations. 054 opts in — straggler sweep
  plus empty-section residue cleanup on non-completed documents.

Settled in the presence layer (2026-08-01):

- Presence is a per-topic heartbeat file in the topic's cache dir
  (gitignored, mtime is the signal) — the textbook ephemeral session
  machinery. Staleness 900s; loops beat per turn; concludes clear on
  orderly exit; a crash ages out. `presence scan` is the one shared
  read, rendering the deferral callout as an engine section.
- The conclude sweep is presence-gated and action-scoped: a live
  row's dirt is the peer's; a dead session's leavings commit per
  dirty topic via `--topic`, never a whole-index sweep.
- Boot serialisation: accepted edge — migrations are idempotent and
  tracking-logged; no lock.
- Research adopts `--topic` commits (final layer): judged landings
  make concurrent research designed-for; only the topic-split commit
  stays work-unit scoped (genuinely cross-topic).
