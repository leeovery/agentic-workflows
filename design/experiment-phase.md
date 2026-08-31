# Experiment phase — measured evidence for decisions

A tool used by research and discussion: controlled experiments against
real systems or processes, designed before they are measured, producing
dependable results that feed back into the conversation that asked for
them. This is the design log. Opened 2026-08-30; model rewritten
2026-08-31 to the corrected shape (see the amendments for the record).

## Motivation

### The incident this starts from

During Fumi's space-homing research, window-placement behaviour was
tested hands-on inside research sessions — no pre-stated question, no
decision rule, no controlled setup. The numbers exist, but they were
collected exploratorily, and now they carry decision-bearing weight
they were never built for: the layouts covered are unclear, the rule
that would settle the choice was never written, and the gaps are making
the decision harder than the testing was. The counterfactual is what
this phase supplies: a design written and confirmed before the first
measurement, then results that mean something against it.

### The prior art

Two bodies of practice were studied (2026-08-30) before this design:

- **The dex experiment system** (`dex/business/experiments/`) — a
  working small-scale lab: a register of experiments conceived-to-
  verdict, a governing METHOD accreted from real failures, reports in
  scientific-method order with pre-registered decision rules. Its scars
  are the syllabus: rules changed after data void the run; instruments
  freeze before measuring; controls are concurrent, never historical;
  corrections are append-only and planned, never reflexive. Its
  execution pattern carries too: the agent writes deterministic code
  and the code does the work — calls, parsing, measurement — with the
  agent running and observing it, not assessing by feel.
- **The external record** — pre-registration and registered reports
  (the frozen plan, graded deviation routes, the amendment window
  closing at first result), ELN practice (append-only records,
  deviations logged as they happen), ML experiment tracking (the run as
  first-class record, named baselines), and industry experimentation
  culture (pre-declared decision maps, "experiments do not fail —
  hypotheses are proven wrong", one primary measure).

Both converge on one temporal invariant: **the design exists before the
data**. Everything else is that invariant applied to a different moment
of the lifecycle.

## The model

### An addendum, not a peer phase

Experiment is not a stage of the pipeline the way specification or
planning are. It is an **umbrella tool that research and discussion
use**: a conversation hits a question that talking cannot settle, and
hands it to the laboratory. The phase machinery — its own entry, its
own skill, bridge-routed transitions — exists for one reason: **context
isolation as a scientific control**. An experiment run inside the
conversation that spawned it would know what the conversation hopes
for, and that biases the result; a session deep enough to hit an
empirical wall is also the session closest to compaction. So the
laboratory always begins in fresh context, knowing the problem but not
the hopes, and the conversation's context is never polluted with a
second phase's instructions.

Consequences, all deliberate:

- **Experiments are never a topic's first phase.** Discovery routes
  every topic to research or discussion — a topic cannot be born
  measurement-first, because at discovery nothing is shaped enough to
  warrant an experiment. The only door into the phase is the spawn.
- **The remit is narrow.** Instructions in → design (collaborative) →
  perform → results recorded → verdict fed back. Nothing else: no
  off-topic rerouting, no roadmap parks, no inbox capture, no triage
  queues, no session loop. A stray thought mid-experiment is out of
  remit; the spawning conversation owns everything that is not this
  experiment. Triage in particular is untouched by this phase in every
  direction — concerns never land in an experiment, and an experiment
  never reroutes one. A concern that *feels* measurable still lands in
  the target topic's research or discussion; that conversation decides
  whether to spawn.
- **Narrow does not mean small.** An experiment can run for hours or
  days, spin background processes, and produce substantial artifacts.
  The scope is narrow; the work inside it is not.

### Exploratory and confirmatory

Research and discussion still poke at things hands-on — legitimate, and
those sightings stay labelled exploratory. The moment a number is going
to bear a decision, the sessions **offer** the experiment — never
prescribe it. Declining is always valid: an ad-hoc inline measurement,
no ceremony, remains part of the conversation. Accepting graduates the
question to the laboratory, where the design-before-data invariant
takes over.

### The spawn — the phase's one door

Mid-conversation in research or discussion, a measurable point is
offered. On yes, the session records the spawn right there, while the
conversation still holds the knowledge:

1. **The id.** `experiment create` allocates E{n} — increment off the
   manifest series — with a kebab slug derived from the problem.
2. **The problem file**, in the record's directory: the problem in
   plain terms — what we need to pick or learn, the space around it,
   what we hope — with a provenance line naming the phase, topic,
   point, and date it was born from. **No design content.** The
   spawning phase is the client at the laboratory door: it states the
   problem and stops. Question refinement, prediction, decision rule,
   setup — all the laboratory's job. The client is not expected to
   speak the laboratory's language.
3. **The lock.** `awaiting_experiments` gains E{n} on the spawning
   phase's own item — research and discussion identically. A locked
   phase cannot conclude (`topic complete` refuses engine-side); the
   lock means "this phase raised a question it needs answered before it
   can honestly conclude", and that applies to a research record
   exactly as to a discussion.
4. **The choice**: go now — the session pauses mid-phase and routes
   back to the menu, closing ceremony skipped — or later — the session
   continues, conclusion stays blocked, and it pauses at a natural end
   the same way. Both roads end at the menu with the experiment queued.

Nothing enters another phase's processing skill mid-session, and the
bridge is not the spawn's carrier either — it crosses phase walls at
phase completion with a deliberately minimal template. The **menu is
the router**: the spawning session ends its turn; the laboratory is
entered fresh.

### The menu is experiment-shaped

Each queued or live experiment renders its own menu entry
(`E1 {slug} — {Topic} · experiment`), appearing at spawn and retiring
at conclusion. Experiments rank above other recommendations; the pick
stays the user's — working E1 then E2, or E1 then the half-unblocked
conversation, are both legitimate orders. Cancelling a
no-longer-needed experiment releases its lock, and a phase whose locks
have all released becomes the recommendation again.

### Entry is per-experiment

`workflow-experiment-entry` takes the record id — the session enters to
deal with E1, the way a discussion is entered for a topic.
Initialisation reads the problem file, then — provenance-driven — the
spawning artifact **on disk, in full**: the source document is
mid-flight, unconcluded and unindexed, so the knowledge base cannot
serve it. Linked research, briefs, and seeds surface as usual. Then the
laboratory designs, collaboratively — asking the user its own
questions, reading whatever else it needs.

### The lifecycle of one experiment

```
conceived (the spawn) → designed → approved (the freeze) → running
                                          → concluded | abandoned
```

- **Design** (`design.md`): question, hypothesis and prediction with
  the reason and expected values where possible, the decision rule
  ("if X, we do A; if Y, B" — executable by a third party), setup
  (method, instruments and their versions, sample, environment), plus
  controls-and-biases and what-this-does-not-measure sections when the
  shape warrants them (stochastic outputs, destructive operations,
  multi-arm comparisons). Depth scales; ceremony doesn't fork. One
  primary question — a second primary question is a split.
- **The briefing**: the design presented in plain terms — what we'll
  do, what we expect and why, what each outcome triggers — and the
  user's confirm freezes it. From the freeze, changes happen only
  through the amendment protocol: dated amendments re-confirmed before
  results are visible; frozen permanently after. Old data is never
  re-scored under new rules.
- **The run**: mostly autonomous, by design — the collaboration was
  front-loaded into the design. The orchestrating session is empowered
  to choose the execution shape that produces the most dependable
  results: doing it directly, writing deterministic code that does the
  work while the agent runs and observes it, background shells with
  monitors, or ad-hoc sub-agents. No custom workflow agents exist for
  the phase; the shape of the experiment follows the shape of the
  problem, proposed at design time. Deviations are logged as they
  happen.
- **The report** (`report.md`): results (every number traceable to a
  file in the record's directory or a named source), reading kept
  separate from measurement, the conclusion executing the
  pre-registered rule, reproduce notes, corrections append-only and
  dated. A measure conceived after seeing data is labelled
  exploratory — it can motivate a successor, never settle this run.
- **Abandoned** is a first-class terminal: the row and its reason
  persist; the lock releases.

### Splits

A running experiment may discover its question decomposes. That is the
laboratory's internal method, and it never leaks back into the spawning
phase's state: the parts become **sub-experiments** — E1.1, E1.2 — each
walking design → freeze → run → report in miniature, with E1's verdict
synthesising them. The lock stays on E1 and releases once, when E1 as a
whole concludes.

### The return leg

An experiment concludes with its one-line verdict and routes back via
the bridge to the menu. The lock releases and flags the spawning item;
the paused conversation becomes the recommendation once unblocked, and
its re-entry surfaces the evidence — the register, the reports read in
full — before the waiting point settles. **Experiments measure;
conversations decide.** The verdict is the rule's mechanical outcome,
and the discussion that reads it can override it. Specs keep sourcing
discussions only; there is no experiment→spec edge.

An abandonment surfaces the same way, with its reason, and the waiting
point reverts to open — the conversation settles it another way or
spawns a successor.

### The series and the register

A topic accumulates a series — every experiment its conversations ever
spawned, E1 → E2 → …, numbered per-topic off the manifest. The register
(id, slug, status, verdict or reason per row; abandoned rows kept) is a
render surface off the manifest, never a hand-maintained file, and is
the topic's full measurement history.

### Framework, not content

The workflows supply structure, gates, and logging discipline. Measures
are the design's own declarations — the framework never imposes,
tracks, or mentions cost; that is the user's concern and, where
declared, the experiment's subject matter.

### Artifacts and storage

```
.workflows/{wu}/experiment/{topic}/
├── E1-window-placement/
│   ├── problem.md     the spawn's problem statement + provenance
│   ├── design.md      frozen at the confirm gate
│   ├── report.md      grows during/after the run; corrections append-only
│   ├── data/          curated extracts the report cites
│   └── …              instruments live with the record
├── E2-multi-monitor/
```

Harness code an experiment builds is instrument, not product code — it
lives with the record. Raw output is kept by default; genuinely bulky
output may stay out of git with the report linking by path. Ephemeral
working files use the cache (`.workflows/.cache/{wu}/experiment/{topic}/`).

### Knowledge base

Designs and reports index at the topic's phase conclusion under the
`experiment` phase, with **standard decay** — no second golden class
beside specs. A measurement describes the world at a commit; decay is
correct behaviour. The append-only corrections discipline is a property
of the file, independent of KB confidence.
`correcting-historical-artifacts.md` stays spec-only.

## What deliberately does not change

- **Triage** — untouched entirely, in every direction. The phase
  borrows the *idea* of a queue, nothing of the machinery.
- **Discovery** — routes topics to research or discussion only;
  unaware the laboratory exists.
- **No experiment→spec edge.** Specs source discussions only.
- **`deferred` semantics** — untouched; the lock is a distinct state
  ("blocked pending evidence", never "parked by choice").
- **Bugfix and quick-fix pipelines** — untouched.
- **KB decay classes** — specs remain the only golden record.
- **No cost machinery** — anywhere, ever.
- **The bridge** — phase-completion walls only; never a context
  carrier for spawns.

## Banked

- **Per-project conduct accretion**: a per-project method addendum the
  skill reads (linter-discovery shape) — bank until real usage shows
  the need.
- **A document-review analogue at series conclusion** — deliberately
  absent ahead of evidence from real usage.

## Test footprint

- Pipeline simulation: the spawn (create + problem + lock) from both
  research and discussion, now-and-later exits, per-experiment menu
  entries, the walk to verdict, release/flag edges, abandonment and
  cancellation releases, splits, series continuation, reopen.
- Engine suites: schema, transitions, derivations, render surfaces,
  register/gate projections, lock symmetry.
- Prose cases: the spawn-and-return round trip for each phase, the
  freeze, the amendment boundary (before results vs after), the
  abandonment return.
- Full `docs/` pass, including the experiments chapter, once the
  implementation lands.

## Implementation plan

PR0 is this document, standalone. Rebuilt as a fresh stack (the first
stack, #1058–#1063, is closed and superseded — its engine core and
process substance carry forward; its routing, triage, and session-loop
machinery does not):

1. **PR1 — engine.** The surviving core (series records, verbs, locks,
   register, gates, KB identity) plus: lock symmetry on research items,
   sub-experiment ids, per-experiment menu entries, the review pass's
   engine fixes, and the removal of routing/triage/lifecycle machinery
   the model excludes. Simulation + suites.
2. **PR2 — skills.** `workflow-experiment-entry` (per-record contract)
   and `workflow-experiment-process` (linear: initialize → design →
   briefing/freeze → run → report → verdict → bridge), authored fresh;
   templates, conduct, amendment protocol carried forward.
3. **PR3 — integration.** The spawn offer in research and discussion,
   the now-or-later exit, menu entries and recommendation ranking,
   re-entry evidence surfacing, release edges in the continue flows.
4. **PR4 — cross-cutting.** KB wiring verification, absorption, docs
   (full pass + experiments chapter), prose cases, CLAUDE.md/README.

## Implementation record — 2026-08-30 (superseded stack)

Landed as stack #1060 off main: #1058 engine state → #1059 render
surfaces → #1061 skills → #1062 integration prose → #1063
cross-cutting + docs. The stack implemented the model as first written;
the review pass and the owner walk that followed corrected the model
(see the amendments), and the stack was closed in favour of the rebuild
above. Decisions from it that stand: the keyed series records and
guarded container, `approve` as its own verb, the KB identity shape
with per-canonical-path replacement, no migration needed, and the
engine fixes the review pass verified.

## Amendment — 2026-08-31: the spawn seam rebuilt — menu-routed, problem-first, phase-symmetric

The review pass exposed the mid-discussion exit as mis-designed. Direct
invocation retired (nothing enters another phase's processing skill
mid-session; the bridge is not the spawn's carrier; the menu is the
router and the laboratory always begins fresh). The spawn became id +
problem file + lock, recorded in the spawning session — design is the
experiment phase's job (the laboratory model). Per-experiment menu
entries. Research locks identically to discussion. The
one-live-experiment-at-a-time rule deleted. Superseded machinery from
the first stack: the `Spawned from:` handoff lines, the walk's
spawn-await conditional, the session-loop spawned-arrival logic, both
direct `/workflow-experiment-entry` invocations.

## Amendment — 2026-08-31 (second): the umbrella ruling — narrow remit, no routing, no loop

The owner walk that followed settled the phase's nature: an addendum
tool used by research and discussion, separated for context isolation
as a scientific control — not a peer phase. Rulings: the remit is
instructions in → design → perform → results → feed back, nothing
else — no off-topic rerouting, no roadmap parks, no inbox capture, no
session loop; triage is untouched in every direction (a measurable
concern rerouted between topics lands in research or discussion, which
decides whether to spawn); discovery never routes to experiment — the
spawn is the phase's one door; splits are sub-experiments (E{n}.{m})
under the spawned id, the lock never churning; execution shape is the
orchestrator's empowered choice (direct, deterministic code doing the
work, background shells and monitors, ad-hoc sub-agents — no custom
workflow agents). The model sections above were rewritten in place to
this shape; the first stack's routing surfaces (three-way discovery
routing, the first-phase gate's experiment arm, `x/experiment`,
map-lifecycle routing legs, roadmap pull-forward widening) and its
triage/off-topic machinery are superseded wholesale.
