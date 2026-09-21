# Plan Review — fidelity, not completeness

The planning phase restructures the specification into work. It carries
every decision the record made, product and how alike, into phases,
tasks, and the criteria that prove them, and adds only the work's own
structure. It states no mechanism the specification did not decide and
settles none: a how the record left open stays open for the implementer,
who reads the task, the specification sections it cites, and the code,
and stops only on intent. The plan's review checks fidelity to the
record and the soundness of the plan's own structure, never what an
implementer would have to guess. Design log for the stack. Opened
2026-09-21 on one Fable 5.1 run, from `ideas/plan-review-fidelity.md`.

## Motivation — the mandate the brakes left in place

Portal's `lazy-resume-on-attach` plan review ran on 2026-09-20 under
`auto`: thirteen cycles on disk, fifty-three findings, every one
`settled` or a single `choice`, fifty-three applied, none declined, the
plan grown from 63,929 to 72,515 words against a 13,274-word
specification. The convergence programme (`planning-review-convergence.md`,
2026-09-21) read twelve cycles and forty-nine findings at the time it
was written and bounded the loop: a floor, Observations, settled
directions, a diagnostic that can say churning, an `auto` that
concludes. It also kept, on purpose, the rule that produced the
findings — *the line is altitude, not size: the plan's how stays the
planner's to state.*

Sorting the fifty-three by what each one was:

| what the finding was | count | stream |
|---|---|---|
| the plan contradicts or misses a specification decision | 22 | traceability, 17 of 18 |
| a defect in mechanism the plan itself invented | 17 | integrity, all 17 |
| a detail a capable implementer settles alone | 6 | integrity, mostly |
| bookkeeping, documentation rows, tooling | 8 | mixed |

Traceability did the job this design names and was near clean from
cycle four. Integrity was the invention stream: half of its findings
were defects in a how the plan had written and the specification never
decided. Every escalation chain lives there. The theme probe that
began the `/dev/tty` chain was the plan's own invention at cycle one —
the specification says only that the panel runs the same appearance
gate the picker runs. Cycle ten found the probe reading the wrong
descriptor and prescribed a reader seam over a fresh `/dev/tty`; cycle
twelve's traceability pass found a bare escape byte closing a
confirmation and prescribed a resolver with a follow window and a byte
cap; cycle twelve's integrity pass found the resolver mis-terminating a
colour reply and prescribed an introducer branch and a second cap.

Task 5-3 is the whole pattern in one task. The specification decides one
behaviour: `y` and Escape are the only keys that act, and the pane never
acts on a key the screen in front of the user does not offer. Before
review the task carried that in one clause. After review it specifies
three constants, an introducer branch, two byte caps, and a test that
swallows a background-colour reply whole. The specification contains no
occurrence of escape, OSC, CSI, timer, arrow, or stdin.

The reviewers said what they were doing. Cycle twelve's traceability
proposal: *the mechanism is open in the specification and is this
plan's call; the 50 ms duration is likewise the plan's call.* That is
the honest-call rule working exactly as written. The rule is the
generator, and the three review programmes of the preceding week each
braked it without removing it.

## Diagnosis

**D1 — the template demands a how for every task.** `task-design.md`
requires **Do** (*specific implementation steps, file locations and
method names*) and **Tests** (*at least one test name; include edge
cases, not just happy path*). The task author's rule 4 makes every
field mandatory, rule 5 says tests include edge cases, and rule 1 says
any executor runs the task *without opening another document*. A
planner obeying the template writes mechanism whether or not the record
decided one, and names edges the specification never identified.

**D2 — the honest-call rule authorises the invention.**
`planning-principles.md`: a how-fork the specification leaves open is
*settled on what leans, and on your honest call where nothing does,
stating the call and what it weighed in the plan*. CLAUDE.md #8: *the
planner owns the how end to end*. The convergence design's R2 drew the
line at altitude — the plan's how, *what state it keeps, the seam a test
injects*, stays the planner's, and only the detail inside it is the
builder's. A stated mechanism is the one thing a fresh reviewer can
always find a defect in, and the rule guarantees there is always one to
read.

**D3 — both briefs make the plan a replacement for the specification.**
Integrity's purpose: an implementer executes *without referring back to
the specification*; criterion 5, no task requires reading another;
criterion 7, no criterion an implementer would have to interpret.
Traceability's depth rule: *enough detail that an implementer wouldn't
need to go back to the specification*. A plan held to that standard is
5.4 times its specification by construction.

**D4 — the doctrine contradicts the dispatch.** The executor's fourth
enumerated input is the specification path, its rule 6 is *no deviation
from the specification*, and the reviewer's first input is the same
path. The implementer has always read the specification. The
never-refer-back line exists only in the two planning briefs, where it
describes a reader who does not exist.

**D5 — the implementer's stop has no landing.** The executor's rule 4
stops on *intent or approach*; approach is the how, which this design
gives to the executor. On `blocked` the task loop renders a gate whose
ways out are retry with the user's comments, skip, and stop. An answer
rides the comment into the re-dispatch and lands in no record. A
product question met at implementation has no route to the tiers the
specification and the plan already have.

## The premise

Provenance, not altitude. The plan carries what the record decided —
product and how alike, since a discussion that chose a pattern, a
pipeline, or an architecture ratified it and the specification carries
it — and adds only the work's own structure. Every other how is left
open. A gap is a fork in what the product does; a fork in how the code
does it is not a gap at any phase after the specification, and nobody
fills it.

Capability decides who can answer; provenance decides where the answer
lives. The planner is as capable as the specifier and may derive a
product gap's answer from the record, and that answer lands in the
specification, never in the plan. The implementer is as capable as the
planner and better placed — the code written, something to run, a
screen to look at — and decides every how the record left open with the
code in front of it. The four exits for a gap are the same at every
phase: settle it from the record, a brief exchange landed in the record,
reopen or open a topic, or park it. What narrows is what qualifies.

The planner is a product owner who knows the shape of the codebase.
Product altitude for what a task delivers and how you would see that it
does; engineering judgment for how the work is cut — which task first,
what depends on what, where a slice lives.

The bar is 95 percent, not 100. A plan that states no mechanism gives
the next review cycle nothing to find a defect in, and the loop
converges by construction rather than by brake.

## The rules

**R1 — the plan states no mechanism the specification did not decide.**
The plan's own how is the how of the work: phase, task, order,
dependency, the criterion that proves a decided behaviour. The how of
the code — a seam, the state a component keeps, a byte, a cap, an
ordering inside a task, a helper's shape — is left open unless the
record decided it, in which case it travels verbatim. The honest-call
rule is retired at every site: a how the planner believes changes what
the product's user gets is a product gap and takes `resolve-spec-gap.md`;
a how that does not is left open, not settled.

**R2 — acceptance criteria are scenarios.** A criterion is a starting
state, an action, and an observable outcome — what appears on screen,
what a command does, what a call returns — checkable without opening
the code, and traceable to a specification section. Rule form (a
constraint that holds everywhere, a limit) only where a scenario would
be contrived. One shape for every work type, at the task and at the
phase. An edge the specification decided is a criterion; an edge it did
not decide is not the plan's to name.

**R3 — the task template.** Problem, Solution, Outcome, Acceptance
Criteria, Do, Context, Spec Reference. **Do** is optional and
record-sourced: what the specification decided about the how, and where
the work lives. **Tests** is retired — a scenario criterion is a test's
specification, and the executor names and writes the tests from the
criteria as it names the mechanism. **Edge Cases** is retired — a
decided edge is a criterion. Self-contained is redefined: everything
the record decided about this slice is in the task, and the task names
where the rest lives. The planning agents change with it: the task
author's rules 1, 4, and 5; the task designer's edge-case column lists
the specification's decided edges for the task, each source-cited, and
nothing it invents; the phase designer's phase criteria take the
scenario shape. One template at every authoring site: the
implementation phase's task author expands an approved proposal into
the same fields, the ad-hoc task shape carries them, and the
proposed-task surface renders no Tests block.

**R4 — traceability widens.** The standard for hallucination covers any
mechanism the specification does not decide, not product content alone;
the fix is removal, never justification. Direction 2's *where it leaves
the how open, the plan's call stands* goes. The depth rule reads: the
task carries what the record decided and names where the rest lives.

**R5 — integrity narrows.** Its purpose is that an implementer executes
the plan without making product decisions. It loses *would the
implementer have to guess* in every form, *without referring back to
the specification*, self-containment as no-other-document, template
compliance over Do and Tests, and *no criteria an implementer would
have to interpret*. It keeps scope and granularity, phase structure,
dependencies and ordering, criteria that are pass/fail and
scenario-shaped, contradictions between parts of the plan, and external
dependencies. The builder's decline at the dispose stays and becomes
the ordinary case; the dispose's honest-call arm goes with R1 — a
staged fork in the how is left open, the finding declined with that
reason.

**R6 — the implementer's stop is intent, and the build has no exits.**
The executor's rule 4 stops on intent alone: a product question the
task, the cited specification sections, and the code do not answer;
approach is the executor's. A specification decision that proves
untenable is a block too — the question is what the product does
instead. During the build a task is finished or it is being fixed:
neither stop offers a skip or a stop, and an environment that cannot be
fixed now is left in progress for the next session. On
`blocked` the orchestrator classifies before anything renders, the
three tiers one hop further down. The record settles it or a
derivation pins it → a corrigendum on the specification through
`correcting-historical-artifacts.md` §B (`implementation/{topic}` is
already an admitted correcting phase), the answer landed on the task as
an addition marked with its origin, the executor re-dispatched — no
stop, `auto` or `bounded` included, and nothing rendered before the one
line that says what landed. A product fork → a stop that overrides
`auto`, presented as the engineering stop it is, to an engineer: the
task-result header with the blocked verdict, then a block in the task
loop's report register — **Blocked on**, **What the executor found**
(what the record decides, what the code does, where they run out, with
`file:line` where it anchors), **Options** (each side's technical shape,
product consequence and cost side by side, the recommended first),
**Recommendation** — never the executor's report echoed and never the
product-first raise the proposal walks use; then the gate, whose rows
are the sides numbered with the recommended first and **Comment**, the
engine heading it with the auto-override line off the task gate mode.
A number lands that side in the owning discussion through
`landing-a-resolution.md`, the specification re-aligns by corrigendum,
the task takes the addition as the user's, the executor is
re-dispatched. A comment is the exchange: it settles, routes, or is
answered and the gate re-rendered. No skip and no stop at a block —
neither puts an answer in the record. Where the record cannot take
the answer this pass — the specification live in its own phase or held
by a peer — the answer rides the task alone and the specification takes
it when it next runs. The exchange shows the gap needs real discussion
work → the concern goes to the discussion's triage queue and the session
ends where it stands: the pause commit, one line naming the queue, a
terminal stop — never the conclude gate; the landing's staleness hop
flags the specification, the linear next-phase derivation and the epic
menu route back to the reopened record, and no new wait is built. A
question already queued there answers with the same stop until the
discussion decides it. A quick-fix's specification has no source
document and is the record itself: the answer lands on it directly by
corrigendum, and the third tier is unreachable — the work has outgrown
its type, said in a line, with skip and stop the ways out. The
reference answers the task loop with one of `landed | answered |
stopped | unsettled`. A `failed` executor — tests it could not make
pass, or an environment that will not do what the record assumes —
presents its failure in the same register (**What failed**, **What the
executor tried**, **Why**, **Next attempt**, or **What is needed** where
the environment is the cause) and the gate offers the retry, which
continues the same executor carrying the next attempt and the user's
comment, with Comment to steer it.

**R7 — supersession.** The convergence design's R2 line — *the line is
altitude, not size* — and its honest-call arm at the dispose; the
spec-gaps design's *the planner owns the how end to end*; CLAUDE.md #8;
`docs/planning.md`'s honest-call sentence. Concluded designs are frozen;
this record names what it replaces.

## Decisions taken

- **Provenance rather than a sharper altitude line.** Altitude keeps the
  planner as the how's owner and asks the reviewer to judge which hows
  are the builder's — the judgment Portal's reviewers made fifty-three
  times without once declining. Provenance asks a question with a
  measurable answer: did the specification decide this?

- **The honest-call rule is retired, not narrowed.** A narrowed rule is
  the rule the last three programmes kept. The one thing the planner
  does with a how the record left open is leave it open.

- **Do is optional, not removed.** The record does decide hows — a
  pattern the discussion chose, a file the specification cites — and
  they must travel. What the field may not hold is a how the planner
  chose.

- **Tests and Edge Cases are folded into criteria.** A scenario is a
  test's specification and a decided edge is a scenario. Two fields
  that could only be filled by naming tests and edges the record never
  decided were the standing invitation to invent them.

- **Self-contained is redefined, not dropped.** The implementer still
  works from one task; the task carries every decision that bears on it
  and points at the specification for the rest, which the executor and
  reviewer already receive.

- **No new door to the specification.** The executor's fourth input is
  the path. The doctrine catches up with the dispatch; nothing is added.

- **The planner reads the specification alone; decisions still land in
  the discussion.** The specification is the condensed record the plan
  is built from, and the discussion is where a decision is ratified. A
  gap's answer lands discussion first, then the specification by
  corrigendum — the 2026-09-20 ruling, unchanged.

- **The executor's block is in this stack.** Moving the how to the
  implementer without fixing the implementer's stop leaves the line half
  drawn. Its own layer, Delivery-side.

- **No new wait for implementation's third tier, and the pause is a
  terminal stop.** The staleness hops and the epic menu already route a
  session back to a reopened discussion; a plan is already held while
  its specification is unsettled. The task loop's own stop path lands
  on the conclude gate, whose only forward answer marks implementation
  complete — wrong for a pause — so the pause ends the session where it
  stands instead. Routing through the bridge as planning does was
  declined: the epic continuation's paused banner needs a stored wait to
  name, which is the wait this design does not build.

- **The block is a decision menu in the report register, not a prompt
  and not a raise.** A prompt row is for a question back or feedback,
  never how a gate is answered; a gate is answered by its command rows,
  so the sides are numbered with a firm recommendation. And the
  executor's stop is an engineering moment for an engineer close to the
  code: the register the task loop already uses for every other result
  moment, with the product consequence one fact inside each option
  rather than the frame. The proposal walks' product-first raise, and
  the planning review's choice menu, keep their shape; whether they
  should take this one is a separate call.

- **No skip and no stop during the build.** A skipped task is a hole
  in the product — the login page, say — and a stop from inside a task
  landed on the conclude gate. A failing task is fixed: retry with the
  block's diagnosis and the user's guidance, on the same executor. The
  dependency gate rendered when no task can start, which still offers
  skip and stop, is the one surface left for a follow-up.

- **A quick-fix's specification is the record.** Scoping writes it with
  no discussion or investigation behind it, so the second tier has no
  source document to land in and the third has nothing to route to.
  The answer lands on the specification directly; a question that needs
  real discussion work means the quick-fix has outgrown its type.
  Guarding the tiers off for the type was declined: it would keep the
  answer landing nowhere for one work type.

- **The specification's review is untouched.** Its gap pass closes the
  edges of decided mechanisms and screens at 90–95 percent, where this
  week's programmes left it; that is the right phase for it and the
  plan is not a second pass at it.

- **The loop's exits stay as the net.** Churn and the cap remain;
  convergence is expected from construction, in two or three cycles.

- **Existing plans are read as they stand.** A task authored under the
  old template keeps its Tests and Edge Cases fields; every reading path
  takes the fields it finds. No migration.

## Boundaries

- The specification phase — construction, review, the incoherence flow,
  the gap exit — is unchanged.
- Research, discussion, and their reviewers are unchanged.
- `resolve-spec-gap.md`'s three tiers and their landings are unchanged
  at planning; implementation gains a caller, not a new flow.
- The review phase's verifiers are unchanged; scenario criteria are what
  its change-set verifiers already measure.
- The consolidation boundary, the bank, and the proposal walks are
  unchanged.
- No new manifest field, no new gate-mode value, no migration.
- The convergence diagnostic and the plan's growth baseline are
  unchanged.

## Watch items

The next Portal and tick planning and implementation runs after release:

- findings per cycle and cycles to conclusion, against Portal's
  thirteen — and whether any integrity finding still carries a
  mechanism in its Proposal;
- plan words against specification words at the review's close, against
  Portal's 5.4×;
- executor blocks per implementation run and their tier split — the
  target is tier one silent, tier two rare, tier three rarer;
- whether product-level criteria leave the executor blocked on intent
  more often than the old template did, which would say the
  specification is under-deciding rather than that the plan should say
  more;
- where the dispose declines a staged how-fork and a later phase shows
  the how mattered to the user — the signal that a product gap was
  filed as the builder's.

## The stack

0. **This design doc** — standalone, merges last.

1. **Engine** — the executor block gate takes the fork's sides as a
   payload for `blocked` and renders them numbered, recommended first,
   with Comment, the auto-override line off the task gate mode;
   `failed` renders the retry with Comment. The proposed-task surface
   loses its Tests block and renders criteria before Do.
   Render tests, goldens, a simulation permutation.

2. **Planning prose** — `task-design.md` (the template, R3);
   `planning-principles.md` (R1, the product-owner framing, self-contained
   redefined); the phase designer, task designer, and task author agents
   and their invoke references; `review-integrity.md` and
   `review-traceability.md` (R4, R5) and their agents;
   `process-review-findings.md` (the dispose's honest-call arm goes, the
   decline is the rule); `ad-hoc-plan-changes.md`'s task template; the
   output-format contract and each format's field table where they name
   the retired fields; CLAUDE.md #8; `docs/planning.md`.

3. **Implementation prose** — the executor agent's rule 4; `task-loop.md`
   §C (the tiers on `blocked`, the gate on `failed`); the implementation
   task author and the ad-hoc task shape (R3, the same fields);
   `resolve-spec-gap.md` taking an `implementation` lane, or its
   classify-and-land core shared; `invoke-executor.md`; CLAUDE.md #9;
   `docs/implementation.md`.

4. **Prose cases** — `planning-settles-a-derivable-choice` re-pinned (the
   how-fork is left open, not settled); `planning-review-declines-a-builders-finding`
   held; new `planning-review-removes-an-invented-how` (traceability
   flags a mechanism the specification never decided; the fix is
   removal); new `planning-authors-scenario-criteria` (the author writes
   the new template; no Tests, no Edge Cases, Do only where the record
   decided); new `implementation-settles-a-block-from-the-record` (tier
   one, no stop under `auto`) and `implementation-lands-a-block-decision`
   (tier two, the exchange, the landing, the re-dispatch); every
   planning and implementation case whose claims name the retired fields
   re-pinned.
