# Workflows reshaped — control moves up a level

The workflows were built when a model could not be trusted with process or
with decisions, so they script both: step-by-step prose, a gate at every
fork, review loops that run until nothing is found. On the Claude 5
generation that scripting has turned from a help into a hindrance. It slows
the work, buries the user in questions whose answer they would have given
anyway, and boxes in a model that now plans, schedules and judges well on its
own. This programme moves control up a level. The engine keeps what the
person sees and what gets recorded, identical every time. Claude takes how
the work gets done. The person keeps the product, and the calls a learned
ask rule sends them. Three strands carry it: **A — restructure** (loosen
procedure, keep contracts), **B — trust** (learn when to ask), **C —
verification** (agents prove their work). Opened 2026-10-06 from a
conversation about whether the workflows are still needed at all.

This doc is shape-level by ruling: the mod handoff's second phase and other
gate-mod work land first and will move files, so nothing here names files
or numbers. Detailed designs per strand get their own docs when they start.

## Motivation

- **Fumi stalled in discussion.** About 350k words across 13 discussion
  documents, 1,201 commits to its workflow files between 17 July and
  29 September, and no product code. `note-window.md` alone is 85k words
  on one window. 287 decision headings; 129 headings exist to resolve a
  background-review finding. The decisions are at the grain of "a
  redundant `rm` is an error" and "there is no `tag` verb" — calls Opus 5.5
  would make and the person would accept on sight.
- **Switchboard shows the opposite failure.** Built without the workflows
  from near one prompt, it works, and its third refactor is now slowly
  re-deciding UI, UX and data-model calls nobody made up front. Both
  failures are decisions made at the wrong moment relative to when they
  are cheap.
- **The system's own weight.** 287k words of skill prose, 41k lines of
  engine, 67 migrations, a 21k-word development CLAUDE.md. Every model
  generation, prose written to steer the previous model becomes
  instruction the next one must obey where its own judgment is better.
- **Five independent review layers in build and review.** Every task is
  checked twice (task reviewer during the build, task verifier in review)
  and the whole change-set twice (the analysis loop, the change-set
  verifiers), with phase consolidation between.
- **The person does not read what is not on screen.** Ledgers, design
  docs and records written to the repository go unread. What the person
  must see has to arrive in the flow.

## Evidence

Read from the owner's dex knowledge base and verified against the fetched
items. Every source is dated and names the models it measured; reading
leads the experiments, and this project's own measurements decide (R18).

- **Instruction budget.** Dex Horthy (HumanLayer, 2026-03): frontier
  models reliably follow about 150–200 instructions; their 85+-instruction
  planning prompt silently skipped steps; the fix was prompts under 40
  instructions with control flow in code — "don't use prompts for control
  flow if you can use control flow for control flow".
  `2026-03-29-everything-we-got-wrong-about-research-p-37aba6`
- **Anthropic's skill-authoring guide** (fetched 2026-10-06): freedom
  matched to fragility (exact scripts only where a step must not vary),
  checklists Claude copies into its reply and ticks, test a skill on every
  model it runs on. `2026-10-04-time-to-review-your-skill-files-again-ev-59ccaa`
- **TDD in the agent loop.** Böckeler (Thoughtworks, 2026-09; Sonnet 4.6
  coding, Opus 4.8 judging, small greenfield tasks): no clearly
  discernible quality difference, 2.96–8.5x session tokens, TDD
  suppressed up-front design; she stopped prescribing test-first and
  monitors outcomes. Bache's rebuttal: add a test list and "habit hooks"
  (deterministic smell sensors). Older models than this project runs; the
  direction is expected to hold or strengthen.
  `2026-09-24-the-last-year-has-changed-everything-i-k-52b1b3`
- **Trust is earned through verification.** Lauren Tan (Cursor,
  2026-09): verification run locally, then agents reacting to signals,
  then auto-merge, no shortcut; a verify skill plus a feature map; hard
  layers (lints, CI) beat soft rules agents forget; greenfield apps grown
  without constraints become an "organic architecture" nobody understands.
  `2026-10-03-lauren-tan-workshop-xai-grokbot-4169a7`
- **Approval fatigue and per-question preferences.** gstack v1 (2026-04):
  53 question categories, 12 one-way kinds always ask, 41 two-way kinds
  silenceable per user, auto-decisions annotated inline.
  `2026-04-19-apparently-there-s-a-new-version-of-gsta-e0474d`
- **Oversight moves to monitoring.** Anthropic (2026-02): experienced
  users auto-approve about twice as often and interrupt more; Claude stops
  to ask more often than people interrupt it, most often to present a
  choice between approaches. `2026-02-19-measuring-ai-agent-autonomy-in-practice-ffc322`
- **Decision models are weakest at "should I ask".** REFLEX (2026-09):
  Jev 68.8% on clarification decisions, 51.2% on risk, 52.0% on whether
  to call a tool at all, wrong calls averaging 0.778 confidence; swapping
  the definitions bound to yes/no flips 32.5% of decisions, neutral names
  fix it. CMU: thresholds per workload from about 100 local labels by a
  lower-bound rule. `2026-09-27-xiaomi-and-deepseek-just-solved-the-bigg-affd85`
- **Escalation needs a channel and a policy.** Wiser Human (2026-08): a
  structured report tool plus a written policy cut reward hacking from
  23.6% to 5.3% at no cost; the tool alone reached 15.0%.
  `2026-09-01-2094806744052715668-a248e2`
- **Clef and Jev.** Cloudflare's Clef (2026-10, Apache 2.0, Jev-API
  compatible, a free Workers AI tier of about 700 calls a day); Jev leads
  reasoning-heavy rows and When2Call, Clef leads classification; an
  independent test found Jev cheaper and faster from a client machine.
  `2026-10-06-clef-open-source-decision-model-cloudfla-3165f7`

## Rulings

### The shape

- **R1 — Control moves up a level.** The engine owns what the person sees
  (stages, gates, menus, screens) and what gets recorded (artifacts, their
  shape and location, state, events). Claude owns how the work gets done.
  The person owns the product and the calls the ask rule (R16) sends them.
- **R2 — Walls and rope.** Every rule in the prose is sorted into one of
  three kinds, and this sort is strand A's work plan:
  - **Contract** — where something lands, what shape it takes, what gets
    recorded, which door a change goes through, what the person sees.
    Stays a wall, held by the engine rather than prose: a verb that is the
    only door (it picks the path, writes the shape, records the event,
    refuses what is wrong), and hard checks behind the verbs. The prose
    shrinks to one line naming the verb.
  - **Required procedure** — steps that must all happen (closing a phase,
    concluding a topic). The engine holds a checklist; every item ends
    done or skipped with a recorded reason; Claude orders and performs
    them as it likes.
  - **How-to** — everything else. Deleted, leaving a goal and a
    done-condition.
- **R3 — Explicitness, not length.** Obedience comes from explicit rules
  and single doors. A one-line rule naming a verb beats pages of steps.
  Control flow lives in the engine, never in prose.
- **R4 — Drift is caught by outcomes.** Prose tests assert outcomes (calls
  made, write order, the world afterwards), never steps. A contract that
  keeps slipping gets a verb or a check, never more prose. The prose is
  evaluated per model it runs on and re-audited after each model release.
- **R5 — What the person must read reaches them.** Anything the person has
  to see or answer arrives in the flow: a gate, or a mod surface (a pane,
  a slide-over, a rendered document). Nothing requires opening a file.
  Records, logs, ledgers and design docs are for Claude and provenance,
  and they are written for that reader.
- **R6 — Not perfect, about 90%.** One closing pass replaces every loop
  that runs until nothing is found. A reviewer asked for gaps finds some
  even in sound work; findings clear the existing consequence floor.

### Strand A — restructure

- **R7 — Stages stay; phases change.** Stages remain Discovery, Definition,
  Delivery. Phases: discovery, decision, experiment, investigation
  (Discovery); specification (Definition); implementation, review
  (Delivery). Research folds into **decision**. Planning splits: the phase
  cut moves into specification, tasks are written at each build phase.
  Scoping goes with the quick-fix ceremony (open, R24). The implementer's
  role is called the builder.
- **R8 — Discovery keeps its shaping.** The shaping conversation, the
  work-type commit, the map, briefs and the gap analysis stay. Each topic
  is routed **discuss** (it holds questions that need the person) or
  **build** (it holds none; the builder makes its calls against the brief).
  Each brief lists its topic's agenda: the questions that need the person.
- **R9 — Decision.** Research and discussion merge into one conversational
  phase. Each topic keeps a **record** (current decisions only, rewritten
  in place, each with its why and what it rules out) and a **log** (the
  journey, false paths included, appended). This absorbs the record-and-log
  programme. Its tools: deep dives to learn, **spikes** to see and feel,
  experiments to measure. The map is seeded from the brief's agenda and
  the phase is done when it settles; only questions that need the person
  go on it. Calls Claude can make go to the ledger (R15); "don't care"
  hands a call to the builder. One closing review pass, aimed at
  unsettled questions that need the person and contradictions with other
  topics.
- **R10 — Spikes are encouraged, and their artifacts are evidence.** A
  spike is anything that can be looked at or pressed: a design board,
  a constrained design generator, draft code in a throwaway worktree.
  What informs a decision — exported images with their live source link,
  draft code, pulled data — lands as a tracked asset, linked from the
  record, whoever made it. Each asset is **canonical** (the spec carries
  it, the builder builds to it, it is replaced when the design changes) or
  **reference** (the builder may consult it). No design tool is named in
  the workflows.
- **R11 — Topics talk through mailboxes.** A topic never writes into
  another topic's record: a call obvious from one lens can read
  differently with the other topic's context in view. The mailbox stays a
  queue of files. What changes is the ceremony of answering it: the
  receipt for a queued item ends with one command that opens the target
  topic on that item; a target already in session raises it from its
  loop. Loading the target's record into the sending conversation is
  rejected — permanent context pollution. The mailbox rename lands
  separately, before this programme.
- **R12 — Specification stays the golden record.** Topics are grouped into
  buildable units and the spec is assembled from their records and the
  build topics' briefs. It marks what it leaves to the builder. It ends
  with the phase cut: phases, each with acceptance criteria as scenarios —
  the test list. Each invariant names the hard check that enforces it
  where one can (R20). One review pass: fidelity, contradictions between
  topics, unsettled questions that needed the person. Correcting a
  concluded spec stays the corrigendum route, as one verb.
- **R13 — The builder runs the build.** Per phase:
  - tasks are written when the phase starts, against the code the
    previous phase left, and recorded with their dependencies before
    anything runs;
  - a design question several tasks share is settled when the tasks are
    written, never by two builders separately;
  - Claude schedules: order, parallel worktrees, subagents;
  - no prescribed red-green loop — tests are written from the acceptance
    criteria in any order, and their adequacy is checked by outcome (R19);
  - the builder's calls go to the ledger; a question the ask rule sends
    the person is raised through an engine gate while other tasks run on;
  - **no code change without a task**: ad hoc work goes wherever Claude
    judges (this phase, a later one, the inbox, the roadmap) through a
    verb, and the commit door refuses a code commit naming no task;
  - observations for later (today's banking) are notes written by a verb
    and read by the phase review — the machinery around banking goes;
  - one independent **phase review** closes each phase: each task's
    criteria, the phase's coherence, consolidation.
- **R14 — Review layers go from five to two.** The phase review (R13) and a
  final review: the whole change-set against the spec's intent, and the
  ledger read as a whole. The per-task reviewer goes only after a measured
  comparison on a real phase.

### Strand B — trust

- **R15 — The ledger.** Every call Claude makes without asking is
  recorded: what it decided, what it guessed, the kind of question,
  its confidence. Written by a verb, never edited by hand.
- **R16 — The ask rule.** Ask when P(overturn) × reversal cost exceeds the
  cost of asking. Reversal cost is a 1–10 scale per kind of question; "the
  person cares about it" raises it. A short list of always-ask kinds —
  data model, external contracts, destructive operations, security — is
  frozen: the learned numbers never loosen it. Raising is an engine
  command paired with the written rule, never prose alone.
- **R17 — The trust log and the matrix.** An append-only, user-level log
  in the person's workflows config directory, written only by the engine
  (Claude cannot edit it or the thresholds). Events: each raise with
  Claude's lean and the answer; each gate answer by surface name, with the
  recommended option and the picked one; each ledger call; each later
  overturn, pointing back at the call it reverses; each spot-check
  answer. Keys carry scope (project, kind). The matrix is derived from the
  log, never stored, per person × model × kind; a new model starts from
  its predecessor's counts, discounted, so it asks a little more at first.
  - **Silence is not agreement.** An unread ledger entry is no evidence.
    The engine samples silent calls and puts them to the person as spot
    checks in the flow (R5); those answers are the labels for silent kinds.
  - **Survival over assent.** A call that held weighs more than a bare
    "I agree", which may be fatigue.
  - **The record of the person.** Preferences with their reasons,
    proposed by Claude when it sees a pattern or the person states one,
    confirmed at a gate before they steer anything.
- **R18 — Measure before trusting.** The bare loop ships first: the log,
  the ledger, the counts. A decision model (Jev or Clef behind one
  provider interface, written to Jev's API) comes later as one input,
  never the ask oracle, with neutral option names and a threshold per kind
  set from about 100 of the person's labels by a lower-bound rule. Which
  model is chosen per question kind by running both on the labelled set.
  Starting numbers come from mining the Fumi, Portal and Tick transcripts
  for every point Claude offered a choice with a lean, and from a Fumi
  decision replay whose answering agent is never told it is being
  evaluated. The loop adjusts only on evidence larger than noise, checked
  against held-out data.

### Strand C — verification

- **R19 — Agents prove their work.** A per-project verify capability,
  built by interviewing the repository (what a user touches, how it runs,
  how to drive it, what to observe, whether instances isolate): launch, a
  health check, drive, evidence, cleanup, plus a **feature map** (how a
  user reaches each feature, how an agent drives it, what proves it
  works), run once end to end before it counts and kept honest against
  drift. The builder verifies each task through the user's real path;
  review reads the evidence.
  - **Evidence is computed, never narrated.** Scripts produce verdicts;
    zero tests is "not proven"; a criterion whose tests were skipped is
    "named, not run".
  - **Test adequacy by outcome.** Every acceptance criterion has a test;
    test quality is checked by machine — mutation testing where the
    language has a tool, otherwise deliberate breaks that must turn tests
    red; habit hooks catch named smells.
  - **Verified work is cheaper to get wrong.** A call whose result is
    proven by running it lowers its reversal cost in the ask rule (R16).
- **R20 — Hard checks over soft rules.** A spec invariant names the check
  that enforces it (an architecture test, a lint, an import-graph rule)
  where one can. A review finding that recurs becomes a project rule. The
  person's coding rules (e.g. thin controllers, the action pattern, data
  objects, no primitives) split: what can be checked becomes an
  architecture test; the rest stays guidance handed to the builder. How
  project skills reach the builder is rethought within this strand.

### The deterministic core

- **R21 — Engine and mod.** The verbs are the only doors. A hook refuses
  writes under `.workflows/` outside the layout. The commit door confines
  paths and requires a task for code. Checklists are engine-held. The mod
  draws raises and spot checks, logs gate answers, and offers a reading
  surface for material the person may want but need not read.

### Measures and levers

- **R22 — The system adjusts itself through four measures.** Overturn rate
  per kind moves how often Claude asks. Review findings per phase show
  where the build cuts corners. Bugs found after review show verification
  gaps. Contracts slipping in prose tests name the contract that needs a
  verb or a check. Every optimising loop keeps a counter-measure and the
  frozen anchors of R16.

### Work types

- **R23 — Five types, reshaped.**
  - **Epic** — discovery → decision (discuss topics) → specification →
    implementation → review.
  - **Feature** — an epic with one topic; decision is skipped when the
    brief holds nothing for the person.
  - **Bugfix** — discovery → investigation → specification →
    implementation → review. Investigation is the log of finding the
    cause; the specification is what the builder works from; the fix's
    test fails on the unfixed code.
  - **Quick-fix** — no scoping document and no plan; still a tracked work
    unit; review only if behaviour changed; work that needs a design
    conversation moves to feature or bugfix. (Open, R24.)
  - **Cross-cutting** — discovery → decision → specification, ending
    there: a project-level record later topics read.

## Sequence

1. **Clear the base.** The mod handoff's second phase, the other gate-mod
   work, and the mailbox rename land first.
2. **Measure.** Transcript mining and the Fumi replay. Nothing in the
   workflows changes; it tests the premise and names the kinds of question
   the ledger needs.
3. **Foundations shared by A and B.** The ledger, raise and gate-answer
   logging, the user-level store. Logging collects from the day it ships.
4. **Restructure (A)**, with **verification (C)** alongside — C stands on
   its own and is useful under today's workflows.
5. **The ask rule on (B)**, calibrated to ask what is asked today, loosening
   only as evidence supports; the decision model last.

## Open

- **R24 — Still to walk:** quick-fix and bugfix in detail (Portal's live
  bugfix as the test case); the review stage in detail; the epic menu once
  phase gating thins out.
- **The product record.** A current view of the product's character at
  project level beside the roadmap — record-and-log one level up. It would
  reverse the roadmap's ruling that nothing is distilled at product level;
  the feature map (R19) is a candidate form. The person's call.
- **The trust store's shape:** the kinds of question, the cost scale, how
  the project engine reaches the user-level store.
- **Overlap with the entry-layer work** (design branch `design/entry-layer`):
  land first or fold in.
