# Build Order — one sequence over an epic's topics, for spec, planning and implementation

An epic's topics arrive as a set, not a sequence. Nothing tells the user
which one to specify, plan or build first. The workflow already knows how
to order topics — the discovery map has carried a soft `order` since
sequencing shipped — but that order stops at the discovery/discussion
layer and never reaches the build phases. This is the design log for
carrying it forward. Opened 2026-08-20.

## Motivation

### The failure this starts from

An epic with two plan-completed topics: `nuxt-frontend-auth-scaffold` and
`template-authoring-system`. The latter's Phase 1 walking-skeleton
acceptance criteria assume the SPA already exists with auth-aware routing
and Sanctum session login — which is exactly what the former ships. The
epic menu offered both as equally startable. Nothing carried the fact that
one comes first.

The dependency was real, obvious to any human reading the plan, and stated
in plain English in the acceptance criteria. It simply never became data.

### Resolve is not discover

The machinery that *would* have caught it works correctly and cannot help,
because of where its input comes from.

`resolve-dependencies.md` (planning Step 8, epic-only) reads the
specification's **Dependencies section** and nothing else. §B transcribes
each row into `planning.{topic}.external_dependencies`. §D resolves
forward — if the named topic has a plan, match the task and record
`state: resolved` + `internal_id`. §E runs the reverse check, scanning
every *other* topic's declared dependencies for entries pointing at this
one and wiring those up too.

That pass is exhaustive over the tables and blind to everything else. It
**resolves** declared dependencies; it never **discovers** them. Because
of §E, planning order does not matter — a dependency declared before its
target is planned gets fixed up later. The graph converges. It just
converges on whatever was written down.

Verified: the spec's Dependencies section is the only thing that
**creates** an `external_dependencies` entry. Two other places flip an
existing entry's `state` to `satisfied_externally` — the menu's `u/unblock`
(`epic-display-and-menu.md:79`) and implementation entry's `s/satisfied`
(`check-dependencies.md:150`) — which is why §B explicitly preserves that
state rather than overwriting it.

§C additionally deletes any manifest entry not backed by a spec row,
calling it stale. That sweep is **conditional**: a spec with no
Dependencies section routes straight to §E, skipping §B and §C entirely
(`resolve-dependencies.md:18-26`).

### What blocking currently does, and why it is the wrong move

Two gates enforce declared dependencies today:

- **The epic menu.** `resolveDeps` (`domain/epic-detail.cjs:141`) treats a
  dependency as satisfied when the dep topic's implementation is
  `completed` *or* its `completed_tasks` contains the referenced
  `internal_id`; its callers mark the plan item and the menu entry
  `blocked` (`:241`, `:339`). `epic-display-and-menu.md` §B refuses the
  selection and offers `u/unblock`.
- **Implementation entry.** `validate-dependencies.md` →
  `check-dependencies.md` re-evaluates from the manifest; `i/implement`
  is a terminal stop.

Both are correct and both are too coarse. The gate is on **starting the
topic**, so one unsatisfied dependency freezes the entire plan. A 30-task
plan where a single task needs an upstream task cannot be started at all —
the other 29 tasks are workable and unreachable.

### The soft gates already argue for this design

`epic-display-and-menu.md` carries one gate labelled **Hard gate check**
plus a table of soft ones. The labelled gate is on a *route*: the
`analyze_discussions` selection refuses while any discussion is
in-progress and no specification items exist — **all discussions must
settle before the first grouping**.

(That is the only gate on a *phase route*. The blocked-dependency refusal
described above is a separate hard gate on an *item*, and B9 changes it.)

Phase-to-phase progression, though, is advisory:

| Selected action | Gate message |
|---|---|
| `start_planning` | "{N} of {M} specifications not yet completed. Completing all specifications first helps identify cross-cutting dependencies." |
| `start_implementation` | "{N} of {M} plans still in-progress. Task dependencies across plans may be missed." |

Those messages state this programme's premise. They name the reason to
finish a layer before starting the next, then produce nothing that acts on
it. They are nags without a payload — the user clicks through and the risk
they warn about is still unmitigated.

The gating derivation confirms the shape is deliberately permissive:
`can_start_planning: hasCompletedSpec`, `can_start_implementation:
hasCompletedPlan` — **any** one completed item opens the next phase
(`domain/epic-detail.cjs:396-397`).

### The precedent is already built

`workflow-shared/references/sequence-discovery-map.md` does precisely this
job one layer up, and its own description is the contract we want:

> The order is soft: it sorts the map rows and selects which item is
> `(recommended)`, but never gates. It is re-derived wholesale — a full
> renumber of all live topics — whenever a new one lands without an order.

Mechanically: Claude reads the live topic set holistically, weighs what is
foundational versus dependent, assigns contiguous integers `1..N`, and
writes them in one call (`engine discovery-map sequence {wu} {topic}={N}
…`). The engine derives `needs_sequencing` when any live item lacks an
order (`computeNeedsSequencing`), and `compareMapRows` sorts lifecycle
tier first, with `order` as the tiebreak *within* a tier. Cancelling a
topic stashes `previous_order` and reactivation restores it — on the
discovery-map item only (`transitions.cjs:795-802, 862-864`).

This programme extends that pattern to the build phases. It is not new
machinery — it is the second half of something already half-built.

Three places where the analogy is looser than it looks, each addressed in
the decisions below: the discovery precedent sorts tier-first rather than
flat (B6), its `needs_sequencing` flag is derived from map items alone and
cannot see a spec item (B4), and its cancel/reactivate stash reaches only
the map (Open items).

## The settled shape

**B1 — The build order is born at grouping.** All discussions settle
(existing hard gate), the grouping analysis collapses them into
specification topics, and the same analysis assigns the order. Grouping
already reads every discussion holistically; ordering is that same read
asked one more question.

Specification is a lens on the discussions, so the moment the topic set
first exists is the moment it can be sequenced — and that is before the
user starts specifying, which is when they need it.

Two corrections to how this reads at first glance:

- **There is no confirmation gate on the grouping itself.**
  `analysis-flow.md` persists the whole reconcile through `manifest apply`
  and commits *before* the user sees anything; `display-groupings.md` then
  offers a *selection* menu, not an approve/reject. The order lands
  silently on the manifest the same way the groupings do — which is what
  B10 wants, but nobody should go looking for a gate that does not exist.
- **Grouping is not the only birth site.** A one-discussion epic takes the
  `single` fast path (`projections/specification.cjs:228-230`) and creates
  its spec item through `confirm-create.md`, never running the grouping
  analysis — and its item is born inside the *process* skill's `topic
  start`, several steps past the entry skill's routing, so no entry-side
  prose can order it at creation. Settled at the review (2026-08-24): the
  path stays unwired and B4's flag seats the item at the next epic entry —
  the same healing pivot takes. On a one-topic epic nothing can misorder
  in the interim. (The `unify` reconcile, a third birth site the build
  surfaced, IS wired — it rides `unify-ops.json` exactly as grouping rides
  `reconcile-ops.json`.)

**B2 — One order, three phases, joined by name.** A single `order` field
on the specification item. Planning and implementation items share the
topic name, so they read it by join. No duplication, no drift, no
per-phase orders that can disagree.

**B3 — Advisory everywhere. It never blocks.** Specification, planning and
implementation all sort by it. None of them gate on it. Being out of order
is visible and permitted.

The asymmetry decides this. A wrong order costs one switch. A hard gate on
a ten-topic epic costs every spec and every plan before a line of code —
weeks with no working software, which is the failure mode walking
skeletons exist to prevent. The existing design already made this call
twice, in the same table, and it holds.

**The order feeds the existing recommendation; it does not replace it.**
`pickRecommendation` (`domain/projections/epic.cjs:623-689`) is already a
first-match-wins cascade, and three of its existing rules outrank anything
this programme adds:

- An interrupted discovery session wins absolutely (`:606-609`).
- With a map and `convergence_state === 'in-progress'`, the picker returns
  a discovery entry and never reaches the build phases at all (`:611-618`)
  — so a freshly-rerouted or gap-analysis topic suspends build-order
  recommendation entirely, by design.
- `!e.input_moved` is a hard filter (the blocked twin retired with the
  menu row itself — B9). A topic carrying `reconcile_needed` is not
  recommended however low its order.

The order is therefore a **tiebreak inside the existing cascade**, not a
new top-level rule. It orders the candidates the cascade already permits.
There is a second picker in the no-map branch (`:639-666`); both need the
same treatment.

**Phase outranks order.** The cascade walks `BUILD_PHASES` in pipeline
order, so a startable specification still beats a startable plan, which
still beats a startable implementation. The order decides *which* topic
within the winning phase, never which phase wins. Given topic A (order 1,
ready to implement), B (order 5, ready to plan) and C (order 7, ready to
spec), the recommendation stays C.

The alternative — order as the primary key across the whole board — was
rejected for contradicting a gate this programme keeps. B7 warns when you
work a topic while lower-ordered ones are unstarted; a recommendation
pushing depth-first would propose a move and then question it. Phase-first
also matches the stated preference: work each phase through, and depart
from it deliberately when the epic is large enough to warrant it.

This costs visibility. On a large epic the recommendation points at
specification work for a long time and the order does nothing at the top
of the menu until the spec phase drains. The order earns its keep in the
sorting (B6) and the gates (B7), not in the `(recommended)` marker — and
working out of order is never obstructed: nothing is ahead of topic 1, so
implementing it early trips no gate at all.

**B4 — Re-derived, never frozen.** Wholesale renumber of the live set.
Two automatic triggers plus B5's manual one, and one home that serves both.

1. **Any live topic lacking an order** — something arrived by a route that
   does not assign one (pivot, regroup, gap analysis, reroute).
2. **A specification completed since the last sequencing.** The order is
   first assigned at grouping, when only the discussions exist — a read of
   which topic is foundational, made without the specs. Declared
   dependencies are exactly the information that sharpens it, so the order
   is recomputed as they land.

**Both reach the same gate through one flag,
`build_order_needs_sequencing`**, derived on `EpicDetail` beside its
sibling. It is true when the live set's orders are not exactly a
contiguous 1..N permutation — a topic without an order, a duplicate, or
a hole (a cancel's stash, a malformed birth write) — **or** when
`build_order_stale` is set; the verb's write invariant, read back
(settled at the review, 2026-08-24). Spec completion sets
`build_order_stale`; sequencing clears it.

The flag has to be new. The existing `needs_sequencing` is derived from
discovery-map items alone (`derivations.cjs:317`, fed by
`buildDiscoveryMap`) and a spec item moves it not at all — reusing the
name would collide exactly as the shared `order` field nearly does. And
the staleness has to be a stored boolean rather than a comparison: "a spec
completed since the last sequencing" would need a last-sequenced marker,
and none exists — `sequenceMap` writes orders and nothing else.

**Two hosts, by role.** *Birth* belongs to the grouping analysis, which
assigns the order in the same `reconcile-ops.json` it already writes — no
new engine surface, and it covers regrouping for free. *Refresh* belongs
to a new epic-entry step in `workflow-continue-epic`, mirroring Step 7's
discovery sequencing exactly: read the flag, run the sequencing reference,
re-run the gateway so the display sees the new order. Epic entry is the
self-healing backstop — whatever route left a topic unordered, the next
visit to the epic repairs it.

Trigger 2 does **not** get its own hook at spec completion. It only needs
to set the boolean; the epic-entry step does the work. That keeps one
place that sequences, not two.

**The live set is every spec item except `cancelled`, `superseded` and
`promoted`.** `completed` items keep their number. This is the one
predicate an implementer must not invent, and it follows discovery, which
excludes exactly the terminal and non-actionable tiers (`⊘`, `⊙`) and
keeps decided topics numbered. Excluding `completed` would renumber the
remaining queue every time a spec finished — churn under the user for no
gain — and including the three terminal statuses would leave the flag
stuck true forever, since no judgment pass has any reason to order them.

**B5 — A re-sequence action on the epic menu.** B4's triggers fire on a
*missing* or *stale* order, never on a *wrong* one. The user needs a way
to say "this is wrong, redo it". Discovery has no equivalent action today
(`map-operations.md` covers remove, rename, re-route, edit summary/
description, handle/unhandle — no re-sequence); this is a deliberate
divergence, taken because the build order governs three phases and drifts
as plans reveal what specs could not.

**B6 — Sorts the dashboard and the spec-entry menu, not just the epic
menu.** The dashboard is where the shape of an epic is read; ordering only
one surface would leave them contradicting each other.

**Order is a tiebreak within an existing grouping, never a flat re-sort.**
This follows the precedent exactly: `compareMapRows` sorts lifecycle tier
first and uses `order` to break ties inside a tier. So the specification
tree keeps `displayOrder`'s proposed-first split
(`domain/projections/epic.cjs:146-152`) and orders *within* each half.
Nothing that is grouped today becomes ungrouped.

Three surfaces, not one:

- The epic dashboard's specification, planning and implementation trees.
- **The spec-entry menu** (`domain/projections/specification.cjs:312-361`,
  over `detail.actionable`) — currently manifest insertion order,
  unsorted. This is the surface whose entire job is "which of these do I
  take next", so leaving it arbitrary would miss the point of B3's
  queue-position argument more completely than the dashboard would.
- The epic menu's numbered entries.

The sub-view pickers — `epicCompletedMenu`, `epicCancelMenu`,
`epicReactivateMenu` — keep their phase grouping in pipeline order, and
within each phase inherit the build order from the detail-level sort
(settled at the review, 2026-08-24: the sort lives in `epicDetail`, which
is what made B3 free, so the pickers read pre-sorted arrays; within-phase
insertion order was never a promise, and matching the dashboard helps find
the row). They gain no ordinals and no ceremony — lifecycle management,
not "what next".

**B7 — Two soft gates are rewritten in terms of the order — condition as
well as message.** Counting is the weakest thing the engine can say with
the state it holds.

The condition has to change with the message, because the two predicates
are independent. Today `start_planning` fires on *"specification items
exist with some in-progress or proposed"*. That is not the same claim as
"topics ahead of this one are unplanned": a ten-topic epic where topic 1
is the only unfinished spec fires the gate when the user plans topic 2,
and the new message would name nothing. Conversely an epic with every spec
complete and topics 2–3 unplanned fires nothing while the user plans topic
5 — the case the gate exists for.

| Action | New condition | New message |
|---|---|---|
| `start_planning` · `continue_planning` | a lower-ordered live topic has no completed plan | "You're about to plan \"Billing\" — \"Auth\" and \"Reports\" are ahead of it in the build order and unplanned." |
| `start_implementation` · `continue_implementation` | a lower-ordered live topic has no completed implementation | "You're about to implement \"Billing\" — \"Auth\" is ahead of it in the build order and unbuilt." |

The table's other two rows (`start_discussion*`, `start_specification`)
keep the counting idiom deliberately. Their condition is upstream *phase
completeness*, not sequence, so the order has nothing to say about them.
The table carries two voices on purpose.

**Specification gets no order gate at all.** Its order is a queue-position
signal (see below), and gating on it would be exactly the ceremony B10
forbids. It shows in the menu ordering and nowhere else.

**B8 — No verification pass.** The order is one integer per topic on a
read the grouping analysis already performs. B4's re-derivation at spec
completion *is* the verification. A dedicated agent for an advisory sort
key is the ceremony B10 forbids.

**B9 — A blocked implementation entry leaves the menu.** Today a blocked
plan gets a selectable menu row that refuses when chosen. That is
inconsistent with both existing precedents:

- **Blocked specification** — no menu row at all, enforced twice by two
  mechanisms, and the code says it outright in both. A blocked *continue*
  entry is filtered: *"A blocked spec is not actionable — no menu row; the
  display tree carries its blocked state"*
  (`domain/projections/epic.cjs:498`). A blocked *proposed grouping* never
  becomes a start entry: *"A blocked grouping is not actionable: it stays
  out of the menu and shows its blocked state on the display tree
  instead"* (`domain/epic-detail.cjs:327`).
- **In-session topic** — struck through, still selectable, behind a
  confirm gate. Presence is awareness, not exclusion; the held session
  might be dead. Noted only to be dismissed: presence covers `research`
  and `discussion` alone (`presence.cjs:26`), so a `start_implementation`
  entry can never carry `in_session`. This precedent cannot apply here
  even in principle — the blocked-spec shape is the only live candidate.

A blocked plan is the first kind, so it leaves the menu.

**Removing the row costs more display than it first appears**, and the
gap has to be closed in the same change. The blocked-spec precedent leans
on a tree cue that plans do not have:

- The tree renders `· blocked` off `item.blocked_by`
  (`domain/projections/epic.cjs:146-148`), and `blocked_by` is set only on
  specification entries (`domain/epic-detail.cjs:321`). A dep-blocked
  planning item's tree row shows a bare status.
- The key's blocked legend fires on `specBlockedAny` (`:415, :420`) and
  its text — *"a source discussion is back in-progress; re-conclude it and
  the item returns to the menu"* — is simply wrong for a dep-blocked plan.

What *does* carry them is the `⚑ Plans not ready for implementation` block
(`plansNotReadyBlock`, `:281-297`). That is enough to justify the removal,
but the tree cue and a plan-appropriate key line are part of the work, not
a bonus.

**The `u/unblock` replacement is a new render surface, not a menu line.**
It is reached today *by* selecting the blocked row, so the flow knows the
topic. Standalone it needs a plan picker and then a dependency picker —
and under the standing rule that every menu is engine-rendered, that is a
new projection. It would also become the third UI writing the same
`satisfied_externally` state, alongside `epic-display-and-menu.md:79` and
`check-dependencies.md:150`; consolidating those three is worth
considering while the surface is being built.

**B10 — The order must never grow ceremony of its own.** Sort, recommend,
one cue when off-sequence. No new confirmation prompt, no new "are you
sure", no justification required for working out of order. The moment the
order starts asking permission it is a gate wearing a costume, and B3 has
been reversed by accident.

Scope: this forbids *new* ceremony. It does not touch the existing soft
gates. B7 rewrites those two rows in place and they keep their
`◆ Proceed anyway?` — that prompt predates this programme, applies to
phase progression rather than to the order, and stays exactly as advisory
as it is today. B10 is the rule that stops a *third* prompt appearing
because a topic was taken out of sequence.

Silent renumbering is the other half of this rule. B4 re-derives on every
spec completion, so a ten-topic epic reshuffles its queue up to ten times.
That churn is invisible by design — a re-sequence notice on every
completion would be exactly the ceremony this forbids. The order is
advisory; a user who cares reads the dashboard.

### Where the value actually sits

The order is one thing, but it does not earn its keep evenly:

- **Implementation** — matters most. Wrong order means building against
  something that does not exist yet.
- **Planning** — matters mildly. §E's reverse check already repairs plans
  authored out of order.
- **Specification** — barely matters for correctness. Grouping creates
  every topic up front, so a spec can name a dependency on any sibling
  regardless of when it is written.

Specification order is therefore a **queue-position signal**, not a
correctness one: it tells the user which subset to take when they are not
taking all of them. It is still worth showing. Absent an order the choice
is arbitrary, and a suggested order makes at least as much sense as a
random one.

## Rejected shapes

- **Merged or blended epic plans.** Converging plans into one epic-level
  plan at the point all plans complete. Rejected: a ten-topic epic is a
  thousand-task queue, which is untenable to loop over; and it destroys
  two load-bearing boundaries — the topic-scoped review and the
  plan-authored phase consolidation gate.

- **An epic-wide ready queue.** Pushing cross-plan dependencies into the
  format as real task-graph edges so an unscoped `tick ready` answers
  "next task anywhere in the epic", with the menu collapsing to a single
  "implement the next ready task". This was layers 2 and 3 of idea 21.
  Rejected on the same thousand-task grounds, plus the cost of cross-plan
  edge support in every format adapter, plus the mental-model shift from
  "work this topic" to "work the epic's queue" that nobody has agreed to.

  Verified as never shipped: no cross-plan handling exists in any of the
  three formats' `graph.md`, and every tick ready-set query is
  `--parent`-scoped.

- **A hard gate on all-specs-done or all-plans-done.** Rejected per B3.

- **An appraisal agent that infers dependencies into the manifest** (idea
  21's layer 1, as written). Two problems, and the second is the one that
  settles it.

  First, the inferred entry's survival is **unpredictable**.
  `resolve-dependencies.md` §C sweeps any `external_dependencies` entry
  not backed by a spec row — but only on a re-planning session, and only
  when that spec *has* a Dependencies section. So an inferred entry on a
  spec that declares nothing survives indefinitely, then silently vanishes
  the moment that spec is reopened and gains its first declared
  dependency. A rule that deletes data depending on an unrelated later
  edit is worse than one that deletes it predictably.

  Second, the fix for that is worse than the disease. Landing inferred
  entries in the spec instead means a planning-phase step writing into a
  completed specification, which cuts against artifacts changing only
  inside their own phase. Marking them with provenance and teaching §C to
  spare them creates a second source of dependency truth the spec does not
  know about.

  The order sidesteps the entire tension by not being a dependency. It
  makes no claim the spec must agree with, so nothing has to sweep it and
  nothing has to write back.

- **Deriving the build order from the discovery map's order.** The join
  exists — a spec item's `sources` are discussion names, and those are
  discovery-map items carrying `order` — so a spec topic could inherit
  `min()` or `mean()` of its members' positions. Rejected on three counts.
  The two orders answer different questions: discovery ranks what to
  *explore* first (riskiest, most foundational to understand), the build
  order ranks what must physically exist first, and those come apart
  routinely. The prior is **staler than the evidence in hand** — discovery
  order is assigned at the harvest when topics are one-line sketches,
  while the grouping analysis reads discussions that have concluded. And
  the collapse makes it arbitrary: a grouping of discussions ordered 1 and
  9 has no principled position relative to one ordered 2. Offering it even
  as a soft prior risks anchoring the judgment into "the discovery order,
  reshuffled" — which would look like it works while doing nothing.

  Note the discovery order carries no user authority to inherit in any
  case: `sequence-discovery-map.md` has no STOP and no gate — Claude
  assigns it and it is written silently.

- **A verification pass over the order.** Rejected per B8.

## Relationship to idea 21

This largely closes idea 21 (*Cross-Plan Implementation Ordering*) in a
much smaller form than it was written. That idea's remaining piece was a
content-appraisal agent inferring cross-plan dependencies. The failure it
targeted — "nothing told me the auth scaffold comes first" — is answered
by an order, at a fraction of the cost and with none of the write-back
problems.

One residue is worth keeping as optional future work, separable from this
programme: **cross-plan dependency edges at task granularity**, so a plan
*drains* as far as it can rather than freezing whole. `tick ready` already
skips blocked tasks (verified against the installed binary: *"lists tasks
with no unresolved blockers, no open children, and no dependency-blocked
ancestor"*), so the plan would yield every workable task and only hand off
when dry — and the hand-off is to the other *topic*, worked from its own
ready head, never a jump to a specific blocking task (which may itself be
blocked). This is separable from the rejected epic-wide queue: the edges
are cheap, it is the unscoped queue that is not.

The drain is **phase-scoped, not plan-scoped**, which bounds the win.
Implementation reads `tick ready --parent {phase}`
(`output-formats/tick/reading.md:73`) and each plan-authored phase closes
through a consolidation boundary, so a blocked task in the *current* phase
still stalls the topic even when later-phase tasks are workable. The
change turns "one dependency freezes 30 tasks" into "one dependency
freezes the rest of this phase" — a real improvement, not an elimination.

Cheap in the literal sense — tick already claims the capability
(`output-formats/tick/about.md:56`: *"Explicit dependencies (`tick dep
add`) handle cross-phase and cross-topic blocking"*), so this needs prose
to author the edges, not a new format capability. Note the same line is a
trap for a reader skimming the format docs: it describes what tick *can*
do, not something the workflow currently does. Nothing authors a cross-plan
edge today.

Build only if a frozen plan with idle tasks is actually hit in practice.

## Consequences to handle at build time

- **Regrouping wrecks the order, and B4 must own the repair.**
  `analysis-flow.md`'s reconcile deletes every existing-proposed item not
  in the new target set (§C step 5) and re-upserts survivors (step 7),
  while *never* touching an anchor's status or sources (`:108`). So after
  a regroup: recreated and renamed groupings hold no order, anchors hold
  their old numbers, and the set is a partial ordering with holes and
  duplicates. B4's wholesale renumber repairs it — but only once the flag
  from B4 exists, and it should ride the same `reconcile-ops.json` rather
  than run as a second pass.

- **Cancel and reactivate need a spec-side stash — and expose a live
  bug.** `cancelTopic` stashes `previous_order` and deletes `order` on the
  **discovery-map** item, keyed by topic name, *regardless of which phase
  was cancelled* (`transitions.cjs:795-802`). Spec topic names collide
  with discovery topic names by construction — an independent discussion
  becomes a grouping of one (`analysis-flow.md:110`) — so
  `engine topic cancel {wu} specification auth-flow` **today** strips the
  discovery map item `auth-flow`'s order. Reproduced against a fixture: a
  map of `auth-flow: 1, billing: 2` becomes `billing: 2, auth-flow: null`
  after cancelling only the *specification* item, `needs_sequencing` flips
  true, and the still-live topic sorts last until the whole map renumbers
  on next entry. It is reachable from the cancel menu. That is a
  pre-existing bug this programme forced into the open. **Fixed
  independently on PR #996** — both the stash and the restore are now
  gated on the map's lifecycle phases (`research`, `discussion`), with
  covering tests that fail without the gate. What remains for this
  programme is only the *spec-side* stash: the build order needs its own
  cancel/reactivate round-trip, which does not exist yet.

- **Pivot leaves a spec item that can never be ordered.**
  `pivotWorkUnit` (`workunit-lifecycle.cjs:245-295`) flips a feature to an
  epic and backfills one discovery-map item, no order. Pivot is legal for
  a feature with a completed specification, and a single spec item routes
  to the `single` fast path, never through grouping. The map item gets
  order 1 on next entry; the spec item gets nothing, forever. B4's
  live-set predicate closes this — its flag must see ordered-less
  non-terminal spec items, not just map items.

- **Absorption** is guarded to no-spec-or-beyond, so it cannot strand an
  order — but the absorbed topic changes the set the next regroup
  produces, which is the regrouping case above.

- **Concurrent re-sequencing races, and that is accepted.** Presence
  tracks `research` and `discussion` only, so a spec/planning/
  implementation session is invisible to it, and B5's re-sequence is
  epic-scoped anyway — no presence row could cover it. `sequenceMap` runs
  under the work-unit lock, so the write is atomic, but two epic sessions
  re-sequencing is last-write-wins with no warning, and a session
  mid-specification can have the queue renumbered under it. Accepted: the
  order is advisory and a stale number costs a suggestion, not a
  correctness failure. Recorded so the next reader does not mistake it for
  an oversight.

- **Two orders now exist.** The discovery map orders *discovery* topics
  for research and discussion. The build order orders *specification*
  topics for spec, planning and implementation. Grouping collapses N
  discussion topics into M specification topics, so these are different
  sets over different phases — same field name, same soft character,
  neither derived from the other. The flag names must differ (B4) and
  displays must not imply they are one sequence.

- **Epic-only.** Single-topic work types have nothing to order. The
  sequencing reference gates on work type exactly as
  `sequence-discovery-map.md` §A does.

## Engine surface (sketch)

- **`build-order sequence <work-unit> <topic>=<N> …`** — the spec-side
  twin of `discovery-map sequence`. Note the atomicity argument for a
  dedicated verb does *not* hold: `manifest apply --file <ops.json>` is
  already one lock and one atomic write across dotpaths, and
  `analysis-flow.md` already uses it for the grouping reconcile, so the
  order can ride `reconcile-ops.json` at birth with no new surface. The
  case for the verb is **validation** — `sequenceMap` enforces positive
  contiguous integers and existence (`discovery-map.cjs:165-175`), which
  `apply` does not. Decide whether the verb also enforces the full
  renumber: `sequenceMap` writes only the topics handed to it and never
  clears unnamed ones, so "wholesale renumber" is prose discipline today,
  not an engine guarantee.

- **`build_order_needs_sequencing`** on `EpicDetail`, derived beside
  `needs_sequencing` — true when the live set's orders are not a
  contiguous 1..N permutation, or `build_order_stale` is set (B4).

- **`build_order_stale`** — a boolean on the epic, set at specification
  completion, cleared by sequencing. Deliberately a stored flag rather
  than a last-sequenced marker (B4).

- **A blocked-plan unblock projection** — the plan-then-dependency picker
  B9 orphans.

- **Tree cue and key line for a dep-blocked plan** — `blocked_by` is
  spec-only today (B9).

## Test plan

- **Pipeline simulation** (`tests/scripts/test-pipeline-simulation.cjs`) —
  mandatory: a new engine verb and changed prose call sequences both
  trigger the standing rule. Scenarios: order born at grouping; order born
  on the `single` fast path; regroup-then-renumber; spec cancel not
  touching the map's order (the bug above); spec cancel/reactivate
  round-tripping its own order; pivot leaving no unordered spec item.

- **Projection suites** — `test-engine-epic-projections.cjs` and
  `test-gateway-for-workflow-continue-epic.cjs` both assert menu and tree
  contents; B6's re-sort and B9's row removal will move existing
  expectations. Re-pin deliberately.

- **Prose cases** — at minimum the re-sequence action, the regroup-then-
  renumber path, and a blocked plan no longer appearing in the menu
  (the first two queued in the coverage campaign at the review; the
  third delivered as `epic-menu-unblocks-a-dep-blocked-plan`). Run
  `node tests/prose/run.cjs select --diff main` at the end of each PR in
  the stack.

## Build plan

All design questions settled; the stack shape below is the proposal.

1. **Engine** — the live-set derivation,
   `build_order_needs_sequencing`, `build_order_stale`, the `build-order
   sequence` verb, and the spec-side `previous_order` stash. Simulation
   extended. (The `topic cancel` phase-gating bug this surfaced is already
   fixed on PR #996, off main and independent of this stack.)
2. **Prose — birth and refresh** — the sequencing reference; wired into
   grouping and the `single` fast path for birth (riding
   `reconcile-ops.json`), plus a new `workflow-continue-epic` step
   mirroring Step 7 for refresh.
3. **Prose — surfaces** — B6's three sorts, B3's tiebreak in both
   pickers, B7's two rewritten gate rows.
4. **Prose — blocked plans** — B9: row removal, tree cue, key line, and
   the unblock projection.
5. **Prose cases** — the walks named in the test plan.

## Log

- 2026-08-20 — Programme opened out of a discussion that started as a
  review of idea 21 and reframed it. Established by measurement against
  the tree: the spec's Dependencies section is the only *creator* of
  `external_dependencies` (two other prose sites flip an existing entry to
  `satisfied_externally`); §C sweeps unbacked entries but only on a
  re-planning session whose spec declares dependencies; the epic menu and
  implementation entry both gate at topic granularity; idea 21's layers 2
  and 3 never shipped; the discovery map's soft `order` is fully built and
  is the precedent. The reframe: three problems were wearing one coat —
  task dependencies (solved inside a plan by the format graph), coarse
  plan ordering (unsolved, this programme), and cross-topic interleaving
  (not a real problem — the Folio skeleton *was* a topic; what was missing
  was only that it came first). Shape settled in discussion: born at
  grouping (B1), one order joined by name (B2), advisory everywhere (B3),
  re-derived (B4), re-sequence action (B5), dashboard sorted (B6), soft
  gates rewritten (B7), no verification (B8), blocked entries leave the
  menu (B9), no ceremony (B10). Merged plans, the epic-wide ready queue,
  hard gates, the appraisal agent and a verification pass all rejected.
  Sub-grouping within an epic raised and parked as idea 44.

- 2026-08-25 — A second review pass over the fix commits themselves
  (four finders, fresh angles). Its headline: the first pass's own
  topic-throw in the soft gate dead-ended a legitimate menu row — a plan
  outlives its spec through a direct cancel, a unify supersede, or a
  promote — reverted to the silent pass, with only the unknown-action
  refusal kept. Alongside: the unify branch now clears
  `build_order_stale` like its regroup twin; the spec tree trails
  terminal residue like every other consumer; `manifest push` refuses
  `order`; the Cue legend re-aligned; the unblock tail reverted to the
  plain action register; the o/order branch earned its chrome; the
  CONVENTIONS footer variant moved to the Backward table with the bare
  form stated as remaining valid; the user docs caught up
  (lifecycle-operations' forward-navigation paragraph described the
  retired predicate); and this branch's own stale idea-21 row deleted so
  the merge cannot resurrect it. B4's body and the engine sketch now
  state the widened predicate the log had claimed; B7's table drops its
  ordinals. Prose-case debt recorded: regroup-then-renumber and the
  o/order walk are both queued in the coverage campaign, not authored.

- 2026-08-24 — The stack built (#1001 → #1005 → #1008 → #1009 → #1010,
  stack #1006) and the standing review pass run over it: eight finder
  dimensions, every finding verified against the tree, ~35 fixes folded
  into the owning PRs. Nine rulings taken with Lee, now reflected above:
  idea 21 closed; the single path stays flag-healed (B1 amended) while
  the review-surfaced `unify` birth site is wired; the `→ On return,
  return to` footer variant sanctioned in CONVENTIONS and the `o/order`
  walk queued rather than authored; the soft gate fails closed on an
  unknown action via a single exported vocabulary; the sub-view pickers'
  inherited sort accepted (B6 amended); `build_order_needs_sequencing`
  widened to read the whole contiguous-permutation invariant back
  (covering cancel holes and malformed births); the gate message drops
  its ordinals and the unread `PhaseEntry.order` exposure is deleted; the
  Cue legend qualifies its two blocked lines by phase; and the bare
  cancel confirm migrated to `render cancel-gate` under the adopt rule.
  Alongside: the grouping reconcile now clears `build_order_stale` (a
  regroup is a sequencing — its judgment no longer re-derived at the next
  entry), `order` writes are typed at the field surface, terminal
  planning items carry no dependency state, and a pre-existing prose case
  that the new entry step had silently invalidated pre-sequences its
  fixture.

- 2026-08-24 — The `topic cancel` order-stripping bug pulled out of this
  stack and fixed on its own PR (#996, off main): the stash and the restore
  are gated on the map's lifecycle phases. Reproduced first, then covered
  by tests that fail without the gate. A second-order effect surfaced while
  fixing — after a cancel triggered a wholesale re-sequence, reactivating
  wrote the stale stashed order back over the fresh one, so two topics
  could hold the same number. Both directions now inert for build phases.
  This programme keeps only the spec-side stash, which is new work.

- 2026-08-24 — Problems 2 and 3 settled with Lee. **Recommendation:**
  phase outranks order — the order picks the topic within the winning
  phase, never the phase. Order-as-primary-key rejected for contradicting
  B7, which warns about working ahead of unstarted lower-ordered topics; a
  depth-first recommendation would propose a move and then question it.
  Accepted cost: on a large epic the `(recommended)` marker points at
  specification for a long time and the order shows only in the sorting
  and the gates. **Inheriting the discovery order** raised and rejected —
  the two orders answer different questions (explore-first vs
  build-first), the discovery prior is assigned at the harvest from
  one-line sketches while grouping reads concluded discussions, the
  collapse makes any aggregate arbitrary, and offering it as a prior risks
  anchoring the result into a reshuffled copy. Also established: the
  discovery order is never user-confirmed — `sequence-discovery-map.md`
  has no gate — so it carries no authority to inherit. Build order stays a
  clean-slate judgment over the groupings.

- 2026-08-23 — Problem 1 settled with Lee: the re-derivation runs in two
  places by role — grouping assigns at birth (riding `reconcile-ops.json`,
  covering regroup for free), and a new `workflow-continue-epic` step
  mirroring Step 7 refreshes on entry, the self-healing backstop for every
  route that leaves a topic unordered. Trigger 2 (recompute once specs
  land) kept: the grouping-time order is a read of the discussions alone,
  and declared dependencies are exactly what sharpens it. It gets no hook
  of its own — spec completion sets `build_order_stale`, sequencing clears
  it, and the one epic-entry step does the work. Silent reshuffle accepted
  as the cost, consistent with B10.

- 2026-08-20 — Two verification passes over the draft, both against the
  tree. **Claims:** five corrections, the substantive one being that §C's
  stale sweep is conditional — a spec declaring no dependencies skips it —
  so an inferred entry's survival would be unpredictable rather than
  impossible; the appraisal-agent rejection now rests on the write-back
  tension, not the sweep. **Coherence:** the analogy to discovery was
  looser than the draft claimed at three seams, each now addressed —
  `needs_sequencing` is map-only and needs a separately named twin (B4),
  `compareMapRows` sorts tier-first so order is a tiebreak and never a
  flat re-sort (B6), and `previous_order` stashes only on the map.
  Corrected: B1 claimed a grouping confirmation gate that does not exist
  and missed the `single` fast path as a second birth site; B3 ignored
  `pickRecommendation`'s existing cascade, which outranks the order in
  three ways; B4's second trigger needed a last-sequenced marker that does
  not exist, so it became an event; B6 missed the spec-entry menu, the one
  surface whose job is "what next"; B7 changed the message but not the
  condition, which are independent predicates; B9's in-session precedent
  cannot apply (presence covers research and discussion only) and removing
  the row loses a tree cue plans never had; B10 read as forbidding the
  soft gates B7 keeps. Live-set predicate settled (everything but
  `cancelled`, `superseded`, `promoted`). Concurrent re-sequence races
  accepted as advisory. Two questions left open: the re-derivation host,
  and what "the head" means once the order is a tiebreak. One pre-existing
  bug surfaced and scheduled into the build: `topic cancel` on a
  specification strips the same-named discovery-map item's order.
