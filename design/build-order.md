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

Verified: `external_dependencies` has exactly one writer, the spec's
Dependencies section. §C additionally deletes any manifest entry not
backed by a spec row, calling it stale.

### What blocking currently does, and why it is the wrong move

Two gates enforce declared dependencies today:

- **The epic menu.** `resolveDeps` (`domain/epic-detail.cjs:141`) joins
  each dependency against the dep topic's `implementation.completed_tasks`
  and marks the entry `blocked`. `epic-display-and-menu.md` §B refuses the
  selection and offers `u/unblock`.
- **Implementation entry.** `validate-dependencies.md` →
  `check-dependencies.md` re-evaluates from the manifest; `i/implement`
  is a terminal stop.

Both are correct and both are too coarse. The gate is on **starting the
topic**, so one unsatisfied dependency freezes the entire plan. A 30-task
plan where a single task needs an upstream task cannot be started at all —
the other 29 tasks are workable and unreachable.

### The soft gates already argue for this design

`epic-display-and-menu.md` carries one hard gate and a table of soft ones.
The hard gate: the `analyze_discussions` route refuses while any discussion
is in-progress and no specification items exist — **all discussions must
settle before the first grouping**. Everything downstream is advisory:

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
(`domain/epic-detail.cjs:394`).

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
order (`computeNeedsSequencing`), and `compareMapRows` sorts tier → order
→ name. Cancelling a topic stashes `previous_order`; reactivation restores
it.

This programme extends that pattern to the build phases. It is not new
machinery — it is the second half of something already half-built.

## The settled shape

**B1 — The build order is born at grouping.** All discussions settle
(existing hard gate), the grouping analysis collapses them into
specification topics, and the same analysis assigns the order. One read,
one confirmation gate. Grouping already reads every discussion
holistically; ordering is that same read asked one more question.

Specification is a lens on the discussions, so the moment the topic set
first exists is the moment it can be sequenced — and that is before the
user starts specifying, which is when they need it.

**B2 — One order, three phases, joined by name.** A single `order` field
on the specification item. Planning and implementation items share the
topic name, so they read it by join. No duplication, no drift, no
per-phase orders that can disagree.

**B3 — Advisory everywhere. It never blocks.** Specification, planning and
implementation all sort by it and recommend its head. None of them gate on
it. Being out of order is visible and permitted.

The asymmetry decides this. A wrong order costs one switch. A hard gate on
a ten-topic epic costs every spec and every plan before a line of code —
weeks with no working software, which is the failure mode walking
skeletons exist to prevent. The existing design already made this call
twice, in the same table, and it holds.

**B4 — Re-derived, never frozen.** Wholesale renumber of the live set,
matching discovery. Triggers: any live topic lacking an order
(`needs_sequencing`, automatic), and a specification completing since the
last sequencing — declared dependencies sharpen an order that product
intuition alone could only approximate.

**B5 — A re-sequence action on the epic menu.** B4's triggers fire on a
*missing* or *stale* order, never on a *wrong* one. The user needs a way
to say "this is wrong, redo it". Discovery has no equivalent action today
(`map-operations.md` covers remove, rename, re-route, edit summary/
description, handle/unhandle — no re-sequence); this is a deliberate
divergence, taken because the build order governs three phases and drifts
as plans reveal what specs could not.

**B6 — Sorts the dashboard, not just the menu.** The specification,
planning and implementation trees render in build order. The dashboard is
where the shape of an epic is read; ordering only the menu would leave the
two surfaces contradicting each other.

**B7 — The soft gates are rewritten in terms of the order.** Counting is
the weakest thing the engine can say with the state it holds. Replace:

```
before   "3 of 5 specifications not yet completed. Completing all
          specifications first helps identify cross-cutting dependencies."

after    "You're about to plan topic 5 — topics 2 and 3 are ahead of it
          in the build order and unplanned."
```

Same advisory character, same "Proceed anyway?" — a specific claim instead
of a vague one.

**B8 — No verification pass.** The order is one integer per topic on a
read the grouping analysis already performs. B4's re-derivation at spec
completion *is* the verification. A dedicated agent for an advisory sort
key is the ceremony B10 forbids.

**B9 — A blocked implementation entry leaves the menu.** Today a blocked
plan gets a selectable menu row that refuses when chosen. That is
inconsistent with both existing precedents:

- **Blocked specification** — no menu row at all. The code says it
  outright: *"A blocked spec is not actionable — no menu row; the display
  tree carries its blocked state"* (`projections/epic.cjs:489`,
  `epic-detail.cjs:317`).
- **In-session topic** — struck through, still selectable, behind a
  confirm gate. Presence is awareness, not exclusion; the held session
  might be dead.

A blocked plan is the first kind. It leaves the menu; the dashboard's
existing `⚑ Plans not ready for implementation` block already carries it,
so nothing is lost from the display.

This orphans the `u/unblock` escape hatch, which is currently reached *by*
selecting the blocked row. It becomes a command option, surfaced when any
plan is blocked.

**B10 — The order must never grow ceremony.** Sort, recommend, one cue
when off-sequence. No confirmation prompt, no "are you sure", no
justification required. The moment it asks permission it is a gate wearing
a costume, and B3 has been reversed by accident.

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
  21's layer 1, as written). Even setting aside cost, the output does not
  survive: `resolve-dependencies.md` §C sweeps any `external_dependencies`
  entry not backed by a spec row. Inferred entries would be deleted by the
  next planning session on that topic. Landing them in the spec instead
  means a planning-phase step writing into a completed specification,
  which cuts against artifacts changing only inside their own phase. The
  order sidesteps the whole tension by not being a dependency.

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
skips blocked tasks, so the plan would yield every workable task and only
hand off when genuinely dry — and the hand-off is to the other *topic*,
worked from its own ready head, never a jump to a specific blocking task
(which may itself be blocked). This is separable from the rejected
epic-wide queue: the edges are cheap, it is the unscoped queue that is not.
Build only if a frozen plan with idle tasks is actually hit in practice.

## Open items

- **The engine verb.** `discovery-map sequence` writes the discovery map's
  order atomically across topics. The build order needs an equivalent —
  the order lives on specification items, so per-topic `manifest set` is
  not atomic across the set. Shape to settle during implementation.

- **Two orders now exist.** The discovery map orders *discovery* topics
  for research and discussion. The build order orders *specification*
  topics for spec, planning and implementation. Grouping collapses N
  discussion topics into M specification topics, so these are different
  sets over different phases — same field name, same soft character,
  neither derived from the other. Displays must not imply they are one
  sequence.

- **Topics arriving after grouping** (gap analysis, reroutes, regrouping)
  land without an order. `needs_sequencing` catches them and B4 renumbers
  wholesale, matching discovery's behaviour.

- **Epic-only.** Single-topic work types have nothing to order. The
  sequencing reference gates on work type exactly as
  `sequence-discovery-map.md` §A does.

## Log

- 2026-08-20 — Programme opened out of a discussion that started as a
  review of idea 21 and reframed it. Established by measurement against
  the tree: `external_dependencies` has a single writer (the spec's
  Dependencies section); §C sweeps unbacked entries; the epic menu and
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
  Sub-grouping within an epic raised and parked as an idea.
