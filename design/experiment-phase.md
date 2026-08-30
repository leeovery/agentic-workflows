# Experiment phase — measured evidence for decisions

A new pipeline phase beside research and discussion: controlled
experiments against real systems or processes, designed before they are
measured, producing dependable results that feed decisions. This is the
design log. Opened 2026-08-30.

## Motivation

### The incident this starts from

During Fumi's space-homing research, window-placement behaviour was
tested hands-on inside research sessions — no pre-stated question, no
decision rule, no controlled setup. The numbers exist, but they were
collected exploratorily, and now they carry decision-bearing weight
they were never built for: the layouts covered are unclear, the rule
that would settle the choice was never written, and the gaps are making
the decision harder than the testing was. The counterfactual is exactly
what this phase supplies: a thirty-second design (question, prediction,
decision rule, setup) written and confirmed before the first
measurement, then results that mean something against it.

### The prior art

Two bodies of practice were studied (2026-08-30) before this design:

- **The dex experiment system** (`dex/business/experiments/`) — a
  working small-scale lab: a register of experiments conceived-to-
  verdict, a governing METHOD accreted from real failures, reports in
  scientific-method order with pre-registered decision rules, a
  research ledger and lab journal giving every decision a traceable
  evidence chain. Its scars are the syllabus: rules changed after data
  void the run (E9: "rules change → fresh run, never re-applied to
  this data"); instruments freeze before measuring; a model never
  marks a test the model cannot pass; controls are concurrent, never
  historical; corrections are append-only and planned, never
  reflexive.
- **The external record** — pre-registration and registered reports
  (the frozen Stage-1 plan, In-Principle Acceptance, graded deviation
  routes, the amendment window closing at first result), ELN practice
  (append-only records, deviations logged as they happen), ML
  experiment tracking (the run as first-class record, named baselines,
  the comparison as the deliverable), and industry experimentation
  culture (pre-declared decision maps, "experiments do not fail —
  hypotheses are proven wrong", execution-first triage of a disproven
  hypothesis, one primary measure with few guardrails).

Both converge on one temporal invariant: **the design exists before the
data**. Everything else — decision rules, confirmatory/exploratory
labels, amendment discipline — is that invariant applied to a
different moment of the lifecycle.

### The boundary with research

Research is exploratory; experiment is confirmatory. Research still
pokes at things hands-on — legitimate, and its numbers stay labelled
as exploratory sightings. The moment a number is going to bear a
decision, it graduates: an experiment item, a design (however light),
then the measurement. The phase's value is turning "we poked at it and
saw things" into "we planned it, measured it, and the rule we wrote
beforehand says what it means".

## The model

### Placement

A phase in the Discovery stage, beside research and discussion, for
the research-bearing work types: **epic, feature, cross-cutting**.
Pipeline position between research and discussion — research produces
hypotheses, experiments prove or disprove them, discussions consume
the evidence. Bugfix and quick-fix stay out: investigation is already
the bugfix's empirical phase, and a bug that genuinely needs a
controlled experiment is usually the signal it isn't a bugfix.

### Experiments measure; discussions decide

An experiment never decides. Its pre-registered decision rule executes
in the report's conclusion ("rule said: adopt if all six layouts place
correctly; layout 4 failed; not adopted"), but the record of the
decision lives in the topic's discussion, which reads the report as
seed material — like completed research — and can override the
result. Specifications keep sourcing discussions only; there is no
experiment→spec edge, for the same reason there is no research→spec
edge. This keeps source gating, `incorporated`/`stale`, staleness
hops, and cascade-cancel machinery uniform, and it means a report
whose rules misfired (dex's E9) never flows into a spec as if its
verdict were clean.

### One process, scaling depth

No light/heavy fork, no second tier. Every experiment answers the same
skeleton before measuring — **question, prediction with its reason,
decision rule, setup** — and only the length of the answers scales. A
ten-minute local test writes four lines; a multi-day multi-arm run
writes pages and adds the sections its shape calls for (staged
smoke-then-full runs, variance repeats, controls declarations). The
skill prompts for the heavier sections when the design's shape warrants
them and not otherwise. The one thing that never scales down is the
ordering: the skeleton is written and user-confirmed **before the
first measurement**. That gate is the phase.

### Framework, not content

The workflows supply structure, gates, and logging discipline — as
strict as the work needs. Measures are the design's own declarations:
cost, latency, coverage, correctness — all equally declarable, none
imposed. The workflows never track, cap, or mention cost themselves;
that is the user's concern and the experiment's subject matter, never
the framework's.

### The series

A topic holds a **series** of experiments, not one. Each experiment is
a frozen design plus a report; a report's learnings seed the next
design; the chain runs E1 → E2 → … like dex's register. Numbering is
per-topic. The register — id, name, status, one-line verdict per row,
abandoned rows kept with their reason — is a render surface off the
manifest, never a hand-maintained file. The phase concludes when the
user judges the question has enough evidence to feed the discussion —
a conclude gate like research's, not an automatic "the last experiment
finished".

### Lifecycle of one experiment

```
conceived → designed → [briefing + user confirm] → approved → running
                                                        → concluded | abandoned
```

- **Design** (`design.md`): question (one line, plus what decision it
  feeds), hypothesis and prediction with the reason and expected
  values where possible, the decision rule ("if X, we do A; if Y, B"),
  setup (method, instruments and their versions, sample/layouts,
  environment), declared controls and biases, and what the experiment
  does **not** measure. Frozen at the confirm gate.
- **Briefing**: before the confirm, the user gets the design in plain
  terms — what we'll do, what we expect and why, what each outcome
  triggers. The user's challenges are part of the method; changes fold
  in before the freeze.
- **Report** (`report.md`): results (every number traceable to a file
  or a named source), reading (kept separate from measurement),
  conclusion with the decision rule's verdict, reproduce notes, and a
  dated append-only corrections section. Any measure conceived after
  seeing data is labelled **exploratory** — it can motivate the next
  experiment, never settle this one.
- **Abandoned** is a first-class terminal: the row and its reason
  persist in the register; any waiting discussion point is released
  (see below).

### Amendments and deviations

Two temporal rules plus honest logging:

1. **Before any results are visible**: the design can change — as a
   dated, recorded amendment re-confirmed with the user, never a
   silent edit.
2. **Once results are visible**: the design is frozen permanently.
   Flaws found after go in the report's corrections and trigger the
   *next* experiment with the fixed design. Old data is never
   re-scored under new rules.

Execution deviations (harness broke, environment surprised) are logged
in the report as they happen, so the record shows the run as it went.

### Birth routes

Three same-topic births, plus the existing cross-topic route:

1. **Discovery curation** (epic): the routing question becomes "do we
   answer this by reading, by talking, or by measuring?" — map items
   gain `routing: experiment`.
2. **Research conclusion**: the conclude flow asks whether anything
   found needs measuring before it is discussion-worthy; a hypothesis
   worth testing spawns the same-topic experiment item
   (researching → experimenting → discussing).
3. **Mid-discussion**: a point hits the empirical wall. The point
   moves to a **waiting-on-experiment** state, the experiment item is
   created, and the session exits straight into the experiment design
   with context hot — the specification gap-exit precedent (pause
   in-progress, route onward with the item named). The menu re-entry
   path remains for when the user would rather break.
4. **Cross-topic**, any session: a concern needing an experiment in
   another topic rides the existing off-topic reroute/triage flow,
   landing with reroute provenance. Nothing new.

### The waiting state

Waiting-on-experiment is distinct from `deferred`:

- `deferred` stays *parked by choice* — a legitimate way to conclude
  around a point.
- waiting-on-experiment is *blocked pending evidence* — the decision
  is live, the input isn't in. A discussion holding one **cannot
  conclude**; the conclude gate refuses engine-side, like
  `topic complete` refusing over `pending`/`stale` source rows.

The gating chain then holds itself: the discussion can't conclude →
spec entry's existing hard-block on open discussions keeps the spec
shut → the experiment is load-bearing in the chain. When it concludes,
discussion re-entry surfaces the report (reconcile-cue shape), the
waiting point reopens with evidence, settles, and the chain unblocks.
The epic dashboard cues it per-item ("discussing · awaiting E1").

Release edges — a wait must never dangle:

- **Experiment abandoned**: the point reverts to open, the
  abandonment surfaced at re-entry with its reason; the discussion
  settles another way or spawns the successor.
- **Experiment cancelled from outside**: same release, and the cancel
  confirm names the waiting discussion (softer than the spec-source
  cascade — nothing collapses).

### Artifacts and storage

```
.workflows/{wu}/experiment/{topic}/
├── E1-window-placement/
│   ├── design.md      frozen at the confirm gate
│   ├── report.md      grows during/after the run; corrections append-only
│   ├── data/          curated extracts the report cites
│   └── …              harness scripts, fixtures — instruments live with the record
├── E2-multi-monitor/
```

Harness code an experiment builds is instrument, not product code — it
lives with the record, beside the design that froze it. Raw bulk
output is kept by default (a report whose numbers can't be traced to
files is the failure mode); genuinely bulky output may stay out of git
with the report linking by path. Ephemeral working files use the
existing cache (`.workflows/.cache/{wu}/experiment/{topic}/`) —
machine-local, purged at work-unit close.

### Knowledge base

Reports index at the topic's phase conclusion like research and
discussion, under a new `experiment` phase, with **standard decay** —
no second golden class beside specs. A measurement describes the world
at a commit; decay is correct behaviour. The append-only corrections
discipline is a property of the file, independent of KB confidence.
`correcting-historical-artifacts.md` stays spec-only.

## What changes

### 1. Engine — schema and state

- `kernel/manifest-schema.cjs`: `WORK_TYPE_PIPELINES` gains
  `experiment` between `research` and `discussion` for epic, feature,
  cross-cutting; `VALID_ROUTINGS` gains `experiment`;
  `VALID_PHASE_STATUSES.experiment` defined. Phase items keep the
  unified per-topic structure; the series lives on the item (per-
  experiment records: id, slug, status, verdict — exact field shape at
  implementation).
- `transitions.cjs`: `MAP_LIFECYCLE_PHASES` join (map lifecycle gains
  `experimenting` / `evidence ready`); `flagDownstream` learns the
  hop — a concluded/reopened experiment flags the same-topic
  discussion; `topic complete` on a discussion refuses while any
  waiting-on-experiment marker is live; experiment cancel/abandon
  releases waits and names the waiting discussion in the refusal/
  confirm payload.
- `derivations.cjs`: `computeNextPhase` learns the slot — experiment
  item present and unconcluded routes there; a discussion holding a
  waiting point routes back out to the experiment.
- Waiting marker: engine-owned field on the discussion item (written
  by the exit flow, released by conclude/abandon/cancel), never
  prose-tracked.
- Presence, commit door (`--topic experiment/{topic}` layout scope),
  cache layout, session labels: the new phase joins each existing
  mechanism; no new machinery.

### 2. Engine — render surfaces

- Register render: the series table for a topic (id, name, status,
  verdict; abandoned rows with reasons).
- Design/confirm gate render (the briefing gate), conclude-gate
  surface for the phase, epic dashboard rows and cues
  ("experimenting", "discussing · awaiting E1"), soft-gate row
  (unfinished experiments count upstream of discussion/spec), menu
  entries in `workflow-continue-epic` and the bridge.
- All menus engine-rendered per the standing rule — no prose menus.

### 3. New skills

- `workflow-experiment-entry`: phase entry — validation, new/resume/
  reopen, invoked by discovery, `workflow-continue-*`, the bridge,
  and the discussion exit.
- `workflow-experiment-process`: the processing skill — design
  conversation, briefing + confirm gate, run discipline, report
  authoring, amendment protocol, series continuation, conclude gate.
  References carry the conduct rules distilled from dex's METHOD and
  the external record: design-before-data, instruments named and
  frozen in the design, decision rules pre-registered, exploratory
  labelling, deviations logged live, corrections append-only,
  controls concurrent, mechanical scoring before close reading where
  scoring exists. Durable phase inputs (seed, brief, completed
  research) read at initialisation per the fetch-at-initialisation
  rule.

### 4. Discovery

- Routing question widens to three answers; map operations accept the
  new routing; lifecycle phrases and tags updated
  (`discovery-map.cjs`, `derivations.cjs`, render projections).

### 5. Research

- Conclude flow gains the "needs measuring" arm: hypothesis worth
  testing → same-topic experiment item created, confirmed with the
  user.
- Research prose names the boundary: hands-on sightings stay
  exploratory and are labelled as such; decision-bearing measurement
  graduates to the phase.

### 6. Discussion

- Waiting-on-experiment state (map + manifest marker), the
  straight-through exit into experiment design, re-entry surfacing of
  concluded/abandoned experiments (reconcile-advisory shape), conclude
  gate refusal.

### 7. Cross-cutting integration

- Gap analysis (epics) reads completed experiment reports alongside
  research and discussions.
- Absorption allowlist gains the experiment directory and fields;
  pivot inherits items as-is.
- Epic topic cancel: experiment items follow topic cancellation like
  research items; the wait-release edge rides the same transaction.
- KB: `experiment` phase indexing at conclusion; `knowledge remove`
  scopes.

### 8. Migration

Likely none — the phase is additive and absent nodes are tolerated;
confirm at implementation, and add one only if a validator or
projection requires the node to exist.

### 9. Docs

CLAUDE.md (phases, layout, conventions), README, CONVENTIONS.md only
if a new authoring pattern emerges.

## What deliberately does not change

- **No experiment→spec edge.** Specs source discussions only.
- **`deferred` semantics** — untouched; waiting is a new, distinct
  state.
- **Bugfix and quick-fix pipelines** — untouched; investigation keeps
  its own empirical machinery.
- **KB decay classes** — specs remain the only golden record.
- **No cost machinery** — anywhere, ever. Cost is experiment content
  when a design declares it, never framework.
- **Triage/reroute** — the cross-topic carrier is the existing one.
- **Spec-side coherence, staleness hops, cascade-cancel** — extended
  to know the new phase, not reshaped.

## Banked

- **Per-project conduct accretion**: dex's METHOD accretes
  project-specific scar rules over time. A per-project method addendum
  the skill reads (linter/project-skills discovery shape) is plausible
  but undesigned — bank until real usage shows the need.
- **Exploratory-sighting labelling in research** beyond a prose rule
  (e.g. a structured marker the experiment phase could query) — start
  with prose, revisit.

## Test footprint

- Pipeline simulation: experiment mainline for epic and feature
  (design → confirm → run → conclude → discussion reads report),
  waiting-state permutations (conclude refusal, abandon release,
  cancel release), series continuation, routing/lifecycle joins.
- Engine suites: schema, transitions, derivations, render surfaces,
  register/gate projections; goldens for new renders.
- Prose cases: mid-discussion exit and return; research-conclusion
  spawn; the confirm gate refusing measurement before the design;
  amendment before results vs frozen after.
- Docs lint / conventions suites as touched.

## Implementation plan

PR0 is this document, standalone. The stack:

1. **PR1 — engine: schema + state.** Pipelines, routings, statuses,
   series records, waiting marker, transitions (hops, refusals,
   releases), `computeNextPhase`. Simulation + engine suites.
2. **PR2 — engine: render surfaces.** Register, gates, dashboard
   rows/cues, soft-gate row, menus. Goldens.
3. **PR3 — skills.** `workflow-experiment-entry`,
   `workflow-experiment-process` + references (templates, conduct,
   amendment protocol).
4. **PR4 — integration prose.** Discovery routing, research conclude
   arm, discussion waiting/exit/re-entry, epic display + menu, bridge.
5. **PR5 — cross-cutting + docs.** Gap analysis, absorption, cancel
   edges, KB wiring, CLAUDE.md/README, prose cases, `select --diff`
   sweep.
