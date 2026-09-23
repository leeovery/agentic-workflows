# Topic postpone — a topic leaves the epic for the roadmap, and comes back by the pull

A topic on an epic's map that is valid but not this epic's to build has
one honest home: the product roadmap, under the horizon the person names.
Today the only route there is cancel, which says "not doing this" and
removes the record from retrieval. Postpone says "doing this later": the
topic leaves the epic whole, a roadmap item is born or re-waits in the
same transaction, nothing is deleted or moved, and the way back is the
pull. Opened 2026-09-15 from Fumi, an epic that predates the roadmap,
whose v1 map holds topics that belong to a later release and had no door
out; idea 44 (sub-groups within an epic) was the earlier answer to the
same need and is retired by this design.

## Motivation

- **A topic born in the epic has no way to the roadmap.** The cancel-revert
  hop returns a *pulled* item to waiting when its topic is cancelled; a
  topic the epic raised itself, which is every topic on a pre-roadmap
  epic, has no join to revert. The park verb births a capture-weight
  item from a surfaced idea; it never takes an existing topic with it.
- **Cancel is the wrong act, in feel and in fact.** It marks the row
  cancelled, abandons open experiments, and removes the topic's
  knowledge-base chunks. "Not yet" is not "never", and a topic the next
  epic will pick up must not read as declined in this one.
- **Sub-groups inside the epic duplicate horizons one level down.**
  The need idea 44 answered was "not now"; the roadmap's horizons are
  that grouping already, and the epic is the now-horizon's delivery
  container.
- **A gap-analysis topic's substance decays.** An approved candidate
  carries a one-line summary and a description on the map row; the
  analysis it was extracted from is overwritten at every re-run. A topic
  that waits a year on the roadmap and points at that record comes back
  to a paragraph and a rewritten file.

## Rulings

- **R1 — Postpone is topic-level over the Discovery-stage unit.** The
  unit is cancel's: the map row with every research and discussion item
  under its name and the experiment series. A topic whose discussion a
  *started* specification sources is not postponable; the refusal names
  the specification, and there is no cascade — a topic past specification
  is past "not yet". A proposed grouping over the discussion is discarded,
  as cancel discards it. Epic-only, as cancel is: a feature's topic is the
  work unit, and a pulled feature's "not now" is the work-unit cancel's
  revert already.
- **R2 — Postpone is not cancel.** The map row takes `postponed: true`,
  every live item under the name stashes `previous_status` and reads
  `postponed`, the experiment series is left as it stands, and every file
  stays where it is. The topic's knowledge-base chunks leave with it —
  its conclusions are on hold, and retrieval inside this epic must not
  surface them — and return when the topic is concluded again. A
  postponed unit is excluded from phase aggregation, gating, next-phase
  readiness, epic completion, and the gap analysis's input exactly as a
  cancelled one is.
- **R3 — One transaction, one waiting item.** The postpone births the
  roadmap item when the topic was the epic's own — name = topic name,
  derived and never confirmed; summary = the map row's; origin
  `postpone:{work_unit}` — and re-waits the existing item when the topic
  was pulled from the roadmap: the join is reverted and the item moved to
  the chosen horizon, its origin untouched. Either way the item records
  `postponed_from: {work_unit, topic}` and its `sources` gain the topic's
  brief, research, and discussion files where they exist. A waiting item
  already holding the name that is not this topic's refuses the postpone
  naming the clash; the roadmap's rename or remove resolves it. The clash
  is read twice — in the plan, before the epic writes, and again under the
  project lock at the landing — so a name a peer takes between the two
  refuses rather than overwrites. The landing runs inside the work unit's
  lock before the epic manifest is saved, so a refusal on the roadmap side
  — an illegal horizon name, the clash — writes nothing on the epic.
- **R4 — The horizon is the person's.** Named in the instruction → that
  one. Unnamed with horizons on the map → `horizon-pick`. Unnamed with no
  map → a name in prose, and the map is born with it. The backlogging
  design's rule, reused whole.
- **R5 — Every postpone confirms at one engine gate.** The statement
  names what goes, in the cancel gate's shape, and where it lands, in the
  park gate's shape: the item, its summary, the horizon flagged new, the
  roadmap born when there is none. `y/yes`, `n/no`, Comment. No prose
  gate anywhere.
- **R6 — The return is the pull, never reactivate.** A pull-forward into
  the epic that postponed the topic restores the unit: marker cleared,
  every stash returned, each restored `completed` artifact re-indexed,
  the join re-recorded — the mirror of reactivate under the pull's name.
  A pull into another epic seeds a fresh topic (`source: roadmap`) whose
  map row carries `prior: {work_unit, topic}` from the item's
  `postponed_from`; its research or discussion reads the prior record in
  full at initialisation through the shared `read-prior-record.md` —
  brief, research file, discussion file, and both triage queues'
  undelivered concerns — as a durable input beside the brief, and
  relitigates everything. The old queue is read as record, never as mail:
  a concern whose ask still applies enters as an open question the way a
  brief's do — a pending subtopic on the discussion map, an open thread on
  the research register — and one that no longer applies takes a line in
  the phase's opening context; nothing is copied, raised through the
  mailbox machinery, or absorbed, and no tracking field records the read
  because the record is frozen. The pull
  itself reads the same set at `pull.md`'s record read, derived from
  `postponed_from`, never enumerated from `sources`. The prior epic's
  files are its record and are never drained, edited, or moved by the
  later one. The epic menu carries the return's own row, the postpone's
  mirror: a sub-view over the roadmap items this epic postponed that
  still wait, restoring the unit through `pull-forward` and a `restore`
  receipt; an item another epic has since pulled is rowless, and an item
  that was never this epic's stays the discovery session's pull-forward.
- **R7 — After the postpone the roadmap owns the topic.** `roadmap
  remove` over an item carrying `postponed_from` cancels the epic's row
  in the same transaction — marker and stashed items alike — so "actually
  never" has one door. `topic cancel` and `topic reactivate` refuse a
  postponed row naming the roadmap. `roadmap move` re-buckets it freely.
  `topic triage` accepts a postponed row: a concern for a topic that
  waits is mail that waits with it.
- **R8 — A live experiment locks, and so does a dead end.** Any
  non-terminal record on the topic's series refuses the postpone naming
  the record; conclude or abandon it first. A laboratory cannot run under
  a topic that has left the epic, and abandoning it is the destructive
  act this design avoids. A dead-ended (`handled`) topic refuses too: it
  has nothing to carry forward, so "later" is a contradiction — reopen
  it first. The horizon's legality is a lock as well, so a name the
  roadmap could not hold (`v2.1`) is refused at the confirm.
- **R9 — Presence is a cue, never a lock.** A unit a live session holds
  shows its in-session age on the menu row and in the gate; cancel's
  ruling, reused.
- **R10 — Three doors and a fourth, one reference.** The epic menu is the
  primary door: a row beside cancel, a pick list in the cancel menu's
  shape. The topic's own session is the second: a standing `## Postponing
  the Topic` section beside `## Cancelling the Topic`, and the session
  ends through the bridge because its topic has left. Any other session
  in the epic is the third: the same section, the trigger naming a
  sibling, the flow skipping the commit, the agent close, and the bridge,
  and returning to the interrupted turn. Discovery's map operations are
  the fourth, for the conversational batch. The words draw the line on
  the object: an idea backlogs, a topic — this one or a named one —
  postpones.
- **R11 — The gap-analysis gate gains a third arm.** Beside approve and
  skip, postpone lands the candidate as a map row and postpones it in the
  same turn, so a candidate that is valid but not this epic's takes the
  one shape every postponed topic has. Its brief has a home (R12), the
  already-on-map filter keeps the analysis from re-proposing it, and the
  dismissed list is untouched.
- **R12 — An approved gap candidate gets a brief.** The approve arm
  writes `discovery/briefs/{topic}.md` and sets `brief_path`, the same
  file every harvest-born topic has and the same reader every phase runs
  at initialisation. The content is what the analysis knows: the gap, the
  artifacts it was read out of, why it matters — not soft decisions and
  rejected paths, because no conversation produced any. The description
  on the map row stays as the phase's opening context. Independent of the
  postpone and shipped first.
- **R13 — The word is postpone.** The discussion map already uses
  `deferred` for an item state; a topic status of the same word would
  mean two things in one system. Verb `topic postpone`, status
  `postponed`, marker `postponed: true`, origin `postpone:{work_unit}`.

## The settled shape

### The transaction

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic postpone {work_unit} {topic} --horizon "{horizon}"
```

One verb, stage implied (the Discovery unit is the only one that
postpones). It reads `postponePlan` — the items it stashes, the proposed
groupings it discards, and every lock: a started specification over the
discussion, a non-terminal experiment record, a row already postponed or
cancelled, a roadmap name clash — the one derivation the gate, the menu,
and the verb share, built on cancel's `liveUnitItems`, `specIsStarted`,
and `proposedGroupings`. On a clear plan it mutates the epic manifest in
memory (marker, stashes, discards), lands the roadmap side under the
project lock nested inside the work unit's (the item born or re-waited,
the horizon and the map born JIT, `postponed_from`, the sources
extended), then saves the epic manifest — a roadmap-side refusal leaves
the epic untouched — and after the lock removes the stashed `completed`
artifacts' chunks, releases the calling session's own presence rows on
the topic, and lands one confined commit over both manifests. Its response names the items
stashed by phase, the discards, and the roadmap side — `{name, horizon,
born_map, born_horizon, reverted_join}`.

### The derivations

- `postponePlan(manifest, name, project)` in `derivations.cjs`, beside
  `cancelPlan`, its locks folded in so a menu row and a refusal read one
  source: no such topic, already postponed, cancelled, dead-ended, a
  started specification over the discussion, a live experiment record, a
  roadmap name clash.
- `computeTopicLifecycle` reads `postponed: true` first, beside
  `cancelled`, and answers `postponed`. Every non-live status list gains
  `postponed` where it names `cancelled` — `NON_LIVE`, the aggregation
  filters, the entry discovery filters, the gap analysis's input set —
  and the field surface refuses a `status` write onto a postponed item
  and any `delete` of it, as it does for cancelled.
- The epic detail joins the project roadmap by `postponed_from` to render
  the horizon: the tree drops the row and a compact line beneath the
  phases lists each postponed topic with its horizon.

### The roadmap side

- `roadmap.cjs` gains the postpone arm (birth or re-wait, `postponed_from`,
  sources extension, the clash refusal), the `remove` cascade over a
  `postponed_from` item (the epic's row cancelled in the same
  transaction), the `pull-forward` restore branch (a postponed row of
  the target name in the target epic restores instead of creating), and
  `bind` copying `postponed_from` onto the new map row as `prior` when
  a pull lands elsewhere.
- Schema: `postponed_from` on a roadmap item, `prior` and `postponed` on
  a map row, `postponed` as an item status.
- No migration: nothing on any install is postponed.

### The surfaces

- `render postpone-gate {wu}.{topic} --horizon <h>` — per-topic address;
  the statement in two halves, what goes (a never-started topic: the row
  alone; a started one: its items by phase) and where it lands (the item,
  its summary, the horizon with `(new)` over an existing map, the roadmap
  created with it over none); rows `y/yes`, `n/no`, Comment. Refused with
  the plan's lock, so a locked unit is met at the confirm.
- `gateway.cjs postpone-menu {wu}` — every Discovery unit; a locked row
  keyless with its reason, a held one with its age; `b/back`.
- `render topic-receipt {wu}.discovery.{name} --verb postpone` — the
  verb enum extended; the receipt names the horizon.
- `render horizon-pick` — reused as it is.
- `gateway.cjs pull-forward-menu {wu}` — the return's sub-view: the
  roadmap items this epic postponed that still wait, one row each with
  its horizon, the key carrying the item's own name.
- `render topic-receipt {wu}.discovery.{name} --verb restore` — the pull
  forward's receipt, naming the statuses the unit's items returned to.

### The doors

- `workflow-shared/references/postponing-the-topic.md`, lettered, always
  entered at **A**. **A. Resolve the unit** — the named topic or the
  session's own; a non-epic work type answers in one line that the topic
  is the work unit and returns. **B. The horizon** — named, picked, or
  typed, per R4. **C. Confirm** — the session's own topic commits what it
  has written first; the gate renders; a refusal is surfaced verbatim and
  returns. **D. Postpone** — the session's own topic closes its in-flight
  agents first; the verb runs; the receipt renders; the session's own
  topic invokes `/workflow-bridge {wu} {phase} none postponed`, a sibling
  returns to the interrupted turn.
- A standing `## Postponing the Topic` section on the eight process
  skills, in `## Cancelling the Topic`'s shape; the trigger sentence names
  the object — this topic, or a topic on the map by name — so an idea
  keeps taking the backlogging door.
- The epic menu: a row beside cancel, the pick list, the horizon step,
  the gate, the verb, the receipt, back to the menu.
- Discovery's `map-operations.md`: a Postpone operation, gated as Remove
  is gated and loading the shared reference at **B** for the act; the
  session log records it under Edits.
- The candidate gate's postpone arm: `discovery-map add` as approve
  writes it, then the shared reference at **B**; the row and the item
  land in one turn.
- The bridge: a `postponed` outcome routing to the epic continuation as
  `cancelled` does.
- The pull side: `pull.md`'s record read derives the prior record from
  `postponed_from` beside the sources; the research and discussion
  initialisations load `read-prior-record.md` beside the brief read —
  brief, research, discussion, and both queues' files as concerns to
  raise where they still apply — as a durable input, never relayed
  through the handoff.
- The epic menu's `f/forward` row: the pull-forward sub-view, the verb
  with `--routing` naming nothing, the restore receipt, back to the menu.

### The gap brief

`analysis-approval-gate.md`'s approve arm writes the brief from the
staged block — the gap, the artifacts it was read out of, why it matters,
under the brief template's heading with sections the analysis can fill —
and lands `brief_path` on the row through `discovery-map add --brief-path`.
The write rides the gate's own commit.

## Rejected shapes

- **Cancel plus a roadmap park, two steps.** Cancel removes chunks as a
  declaration and abandons experiments; the person doing two steps by
  hand is the failure this design starts from.
- **Reactivate as the return.** Mechanically the restore is reactivate's
  code; as an act it is the pull, and the roadmap item's join must be
  re-recorded. A pull-forward that meets its own postponed row is the
  one verb with both halves.
- **An unbucketed roadmap state.** "Just later" is the tail horizon; the
  map already treats the tail as its loose end, and `--horizon` stays
  required.
- **Moving the artifacts into the next epic.** Strips the prior epic's
  record, wrecks the same-epic restore, and inherits decisions a later
  conversation should relitigate. Pointers carry the depth; the roadmap
  holds no brief store by its own design.
- **Moving the triage queue.** Concerns queued against a waiting topic
  are read by the topic that returns, from where they sit; signed off
  where they no longer apply, woven in where they do. Nothing drains
  across epics.
- **Sub-groups within the epic (idea 44).** Horizons one level down.
- **A status named `deferred`.** Taken by the discussion map.
- **Abandoning open experiments with the postpone.** Destructive; the
  lock is the honest refusal.
- **A brief-shaped file at product level.** Briefs are never written at
  product level; the next epic distils its own from the pointed-at
  record.

## Consequences

- **`design/product-roadmap.md` and `design/topic-cancel.md` are
  frozen**; this document records the change to both: the roadmap gains
  a second way an item comes to wait, and the Discovery unit gains a
  second terminal-for-now state beside cancelled.
- **Idea 44 is retired** with the postpone PR.
- **The glossary** gains `postpone`; `park` and `backlog` stay.
- **Presence.** The verb releases the calling session's own rows on its
  own topic, as `topic cancel` does; a sibling postpone beats nothing.
- **Knowledge base.** Removal on postpone, re-index on the same-epic
  restore for `completed` items; a new-epic topic indexes its own
  artifacts at its own conclusions.

## Engine surface

| Surface | Change |
| --- | --- |
| `derivations.cjs` | `postponePlan` + locks; `computeTopicLifecycle` reads the marker; `postponed` in every non-live list |
| `transitions.cjs` | `postponeTopic` (manifest, KB removal, presence release, commit over both manifests); cancel/reactivate/start/reopen/complete refuse a postponed row; `triageTopic` accepts one |
| `roadmap.cjs` | birth/re-wait arm, `postponed_from`, sources extension, clash refusal; `remove` cascade; `pull-forward` restore branch; `bind` copies `prior` |
| `fields.cjs` | status write and delete refused on postponed items |
| `epic-detail.cjs` / `projections` | the postponed line with horizons; the menu row |
| `render.cjs` | `postponeGate`; `topic-receipt --verb postpone|restore`; the candidate gate's `p/postpone` row |
| `gateway.cjs` (continue-epic) | `postpone-menu`, `pull-forward-menu` |
| `discovery-map.cjs` | `add --brief-path` |
| schema | `postponed`, `postponed_from`, `prior` |
| `engine.cjs` / `commands.md` | usage lines |

## Test plan

- `test-engine-render-surfaces.cjs` — `postpone-gate`: never-started and
  started statements, `(new)` over an existing map, the first-item
  statement over none, each lock's refusal, a dead address refused.
  `topic-receipt --verb postpone` names the horizon. `postpone-menu`:
  every unit listed, locked rows keyless with reason, held rows with age.
- `test-pipeline-simulation.cjs` — an epic with a fresh topic, a
  researched topic, a decided topic, and a spec'd topic: postpone each
  (the spec'd one refuses); the map born at the first; a second postpone
  under a new horizon flags it; the lifecycle, aggregation, epic
  completion, and gap-analysis input hold; `topic triage` lands on a
  postponed row; `topic cancel`/`reactivate` refuse it; `roadmap remove`
  cancels the row; `pull-forward` into the same epic restores with the
  chunks re-indexed and the join re-recorded; `pull` into a new epic
  and `bind` carry `prior`; a pulled-from-roadmap topic postponed
  re-waits its own item. The audit holds throughout.
- `test-engine-manifest.sh` — status write and delete refused on a
  postponed item.
- Prose cases, authored with snapshots: `epic-menu-postpones-a-decided-topic`
  (the row, the pick, the horizon pick, the gate, the verb, the compact
  line), `discussion-postpones-its-own-topic` (the section, the commit
  first, the bridge), `research-postpones-a-sibling` (no bridge, the turn
  resumes), `gap-gate-postpones-a-candidate`, `gap-gate-approve-writes-a-brief`,
  `epic-menu-restores-a-postponed-topic`, `discussion-reads-a-prior-record`
  (the new-epic topic's initialisation reads the prior files and raises a
  queued concern), `roadmap-pull-reads-a-postponed-record`.

## Build plan

Design doc standalone (PR0). The gap brief standalone (PR1), then a stack
of three, each one agent, each reviewed against the tree before the next
opens.

- **PR1 — the gap brief.** `discovery-map add --brief-path`; the approve
  arm writes the brief; its test; the case.
- **PR2 — engine.** The verb and its transaction, `postponePlan`, the
  lifecycle and non-live lists, the roadmap arms, the pull-forward restore
  branch, `bind`'s `prior`, the field-surface refusals, the schema, the
  surfaces and the menu gateway, render tests, the simulation permutation.
  Green on `npm test`, `npm run test:cli`, `npm run typecheck`.
- **PR3 — the doors.** `postponing-the-topic.md`; the standing section on
  eight process skills; the epic menu row and sub-view; the map operation;
  the candidate gate's arm; the bridge outcome; `CLAUDE.md`; `docs/`; the
  glossary; idea 44 retired; the door cases with snapshots.
- **PR4 — the return.** `pull.md`'s prior read; the research and
  discussion initialisation's prior-record read with the queued concerns;
  `docs/`; the return cases with snapshots.

## Log

- 2026-09-23 — Review pass, eight dimensions, before the hand review.
  The stranding on a bad horizon closed by validating at the gate and
  landing the roadmap side before the epic save; the prior record's
  queued concerns re-ruled as open questions in the record, not mail (the
  mailbox machinery is never involved); the sequencer refuses a closed
  row; every non-live status list, the commit door's terminal list, and
  the specification entry's filter learned `postponed`; the glyph moved
  into the circle family (`⊖`); the cancel door gained its off-ramp to
  postpone; the roadmap's remove relays the epic row it cancels.
- 2026-09-22 — Built as PR1 #1273 (the gap brief) and stack #1281
  (#1273 → #1280 engine → #1285 doors → #1288 return), each slice one
  agent, each reviewed against the tree before the next opened. Settled
  during the build: a dead end locks the postpone (reopen first); the
  roadmap name clash is re-read under the project lock at the landing;
  the epic menu carries the return's own `f/forward` row over the items
  this epic postponed; the horizon step is one shared reference
  (`choosing-a-horizon.md`) the park and the postpone both load; the
  prior record's queued concerns are raised through the existing raise
  and fold with no tracking field; `--routing` names nothing on the
  return branch of `pull-forward`. Walks owed on the user's word.
- 2026-09-22 — Opened as `design/topic-postpone.md` (PR0). Rulings
  R1–R13 agreed in conversation 2026-09-15 to 2026-09-22: the need behind
  idea 44 is the roadmap's; postpone is cancel's unit with a different
  meaning and a different exit; chunks leave and return; nothing moves;
  the pull is the return; the roadmap owns a postponed topic; a live
  experiment locks; presence cues; the gap gate gains an arm and the gap
  brief is its own fix; the word is postpone because `deferred` is
  taken. Walks owed on the user's word.
