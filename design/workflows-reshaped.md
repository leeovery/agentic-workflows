# Workflows reshaped — control moves up a level

The workflows were built when a model could not be trusted with process or
with decisions, so they script both: step-by-step prose, a gate at every
fork, review loops that run until nothing is found. On the Claude 5
generation that scripting has turned from a help into a hindrance. It slows
the work, buries the person in questions whose answer they would have given
anyway, and boxes in a model that now plans, schedules and judges well on
its own. This programme moves control up a level, the way an engineer's
remit grows from junior to senior to principal: standards and checkpoints
stay, micromanagement goes. The engine keeps what the person sees and what
gets recorded, identical every time. Claude takes how the work gets done.
The person keeps the product, and the calls a learned ask rule sends them.

Three strands carry it:

- **A — restructure.** Loosen procedure, keep contracts.
- **B — trust.** Learn when to ask, from the person's own record.
- **C — verification.** Agents prove their work by running the product.

Opened 2026-10-06 from a conversation about whether the workflows are still
needed at all. The answer reached: they are, because structure, consistent
outputs and a durable record are what make agent work dependable and
reviewable — but the walls are too thick for today's models and must become
rope. The goal is Claude making the calls the person would have made had
they been asked, so the product comes out the way they want it rather
than the way a model's priors would make it; the person being asked less
follows from that and is never the aim.

## What the workflows are for

The person's statement of purpose, 2026-10-13, distilled.

Building anything complex surfaces gaps: questions about what the
product should do that nobody has answered yet. They surface either
early, while the person is in the zone of talking the product through, or
late, as the code is written, when they are harder to answer and the
person has moved on. The workflows exist to bring them out early.

Without the workflows, a long early conversation feels thorough, but
nothing checks that everything said was written down, nothing challenges
it, and nothing looks for what was missed. An internal product the
person built that way went well at first; then the build met its gaps and stopped to ask,
question after question, after the spark had gone. Run through the
workflows, most of those questions would have been answered upfront —
the design challenged, the gaps found, the decisions recorded — so the
build runs in one go, and the few gaps left are mostly answered by what
is already decided.

So the workflows want more findings, not fewer. Reviews that challenge
the design, look for gaps and enrich the record are the point, and more
capable models find more. What the person cannot do is answer all of
them: they tire, and Claude does not. The trust layer is what lets the
findings grow: Claude answers most of them as the person would have,
learned from the person's own answers and recorded so every call can be
traced, overruled and learned from, and the system backs off where its
calls start proving wrong and relearns, following the person's taste as
it changes. The few that need the person reach them, with periodic
checks that the work is still heading the right way. When Claude's calls
match the person's, of ten findings about one reaches the person, most
are answered by Claude and a couple go where they belong; today's lanes
often show the reverse ("three need nothing from you, six need your
attention").

The goal is never to ask the person less. It is Claude deciding as the
person would have decided, through the matrix, the ledger and what is
already recorded about the product. Being asked less is the side effect
of that, and the workflows never trade a question the person should see
for a quieter session.

The two halves need each other. A trust layer with the reviews cut has
little left to decide and leaves the gaps for the build; reviews without
the trust layer bury the person. Together they get what is in the
person's head out of it — early, collaboratively, and recorded in a
coherent, deterministic way the build can depend on — so strong
conventions produce strong code, and the product comes out the way the
person wants it.

## About this record

This record is shape-level by ruling: it names behaviour, not files. Each
strand gets its own detailed design when it starts. It is written for the
sessions that carry the programme, as its provenance and its survival
across context resets; the person does not read it (R6). It was
consolidated on 2026-10-12 against `main` at v0.8.16, after the entry
layer, the gate-mod compaction work, the mailbox and inbox rework and the
engine displays had landed. A browser picture of the flow drawn
mid-conversation lives at
`https://claude.ai/artifact/Leag18MVTRNbbB1usbHPJQ`; it predates the
migration, verification and trust rulings and is redrawn by the shape
review (Open).

## Motivation

- **Fumi stalled in discussion.** Measured 2026-10-06: about 350k words
  across 13 discussion documents, 1,201 commits to its workflow files
  between 17 July and 29 September, and no product code — the checkout
  held a README and its workflow files. `note-window.md` alone is 85k
  words about one window (surface, colour, positioning, drop interaction,
  inline rendering, editing, tags, the conflict reconciler, delete, version
  history). 287 decision headings; 129 headings exist to resolve a
  background-review finding. The grain: "a redundant `rm` is an error",
  "there is no `tag` verb", "`restore` un-deletes; no invented
  truncations" — calls Opus 5.5 would make and the person would accept on
  sight. Its Spike Backlog paragraph is six dated amendments deep: prose
  keeping an amendment trail of drawings, because the workflows had no
  place to land a design image (any-file imports arrived 2026-09-17,
  after most of that work).
- **Switchboard shows the opposite failure, and then the cure.** Built
  without the workflows: v1 from a 3.5-hour talk and "I'm giving you
  authorisation to build the whole thing", v2 on "be creative… have fun
  with it!" — clever and unusable, the brief rather than a missing step
  at fault. Its third version, milestone 7, the person ran the workflows
  by hand: five days of design rounds in Paper (about 40 rounds, 77 frames
  signed off, frames drawn by generators as terminal-cell grids), "no
  build before sign-off", a 14-stage plan approved from a 600-word
  outline, then an orchestrated build (481 agent
  launches, up to 10 slices in parallel, the stage order held). The build
  has reopened only UI edge cases where a frame and the spec disagreed;
  the data model is what keeps being re-decided (the day-summary format is
  on its third version, a fourth planned). Read 2026-10-12 from its
  repository and transcripts:
  - **The record is the weak part.** One 87k-word design document, about
    93% description, rewritten in place with git as history, some sections
    stale; the reasons ("owner" appears 16 times) and rulings live outside
    git — a 28k-word log and the generators in a Claude session folder,
    25k words of stage plans in a temporary scratchpad, and memory.
  - **Questions.** Of 69 replies to a Claude question or recommendation,
    about 25 agree outright, 20 agree with an amendment, 7 overrule, 2
    defer and 15 are not really answers (confusion, a different question,
    a redirect). Before replying the person read a median 173–261 words,
    some turns over 1,000 ("I'm only reading this last message"). Menus
    mid-flow were rejected ("Just tell me what's going on"). Nearly all the
    person's anger was about communication — acting on a question,
    cryptic or three-line answers, not pausing — not about the product.
  - **Silent calls overturned:** a Claude suggestion written into the spec
    as decided ("I don't remember signing off an hourglass"), two defaults,
    building while the design was still open.
  - **Reviews do not converge.** `/code-review` returned 15 findings round
    after round; 12 of 17 fix commits were review findings; the ledger
    needed four rounds and still had time-zone and race bugs; 55 phantom
    resets a day were found by using the product.

  The person's verdict: v3's success is testament to slowing Claude down,
  a strictly prescribed process, validated design and collaboration — "if
  we don't collaborate together on the product decisions, then how on
  earth could you possibly build something that I'm going to agree to?"
  The internal product, also vibed (229 commits, 27 Sep – 1 Oct), has stalled on
  Claude surfacing questions — the person is burnt out answering — while
  code was written before the product was designed. Fumi and Switchboard
  are the same failure from opposite sides: decisions made at the wrong
  moment relative to when they are cheap.
- **FlowX shows the shape working by hand.** A spike in code and
  conversation (June–August 2026): free-flowing discussion of event
  sourcing and durable workflows, with prescribed documentation. Its
  `spec/` states the current model and "is not a changelog"; `design/` is
  the journal, wrong turns kept on purpose — record and log. Its draft
  code lives in the docs in two sets, `trust: prototype`, indexed, "consult
  before re-solving anything", "neither is scrap, neither is wired". Every
  document carries machine-readable trust derived from where it lives and
  its status, never set by hand; a generated index with a staleness queue
  is kept current by a pre-commit hook; claims carry inline validation
  marks; sources of truth are ranked code, cluster, cloud, infra, then the
  person — "invaluable for intent/history, but fallible".
- **Shaping is not optional.** Two-way decisions are not independent:
  fifty small calls made against the wrong idea of the product are a
  one-way door in aggregate. Delegating the product's shape ("wow me")
  produced 60% of what the person wanted, and dialling the rest in is
  slow collaborative work. The person keeps engineering their products:
  their taste and experience are the value they bring, and delegating all
  thinking would make the product the model's rather than theirs.
- **The system's own weight.** 287k words of skill prose across 389
  files, 41k lines of engine, 67 migrations, a 21k-word development
  CLAUDE.md, 418 commits in the five weeks to 2026-10-06. At v0.8.16:
  278k words across 327 files, 43k lines of engine, 72 migrations, a
  2k-word CLAUDE.md — the files thinned, the prose did not. Every model
  generation, prose written to steer the previous model becomes
  instruction the next one must obey where its own judgment is better.
- **Planning is the heaviest phase and the most replaceable.** Its prose
  (31k words) exceeds every other phase's; it turns a spec into tasks for
  an executor to follow, which Opus 5.5 does natively.
- **Five independent review layers in build and review.** Every task is
  checked twice (the task reviewer during the build, the task verifier in
  review) and the whole change-set twice (the analysis loop's
  architecture, duplication and standards agents; review's change-set
  verifiers), with the phase consolidation boundary between.
- **The build is slow.** The task loop runs one task at a time with a gate
  after each. Outside the workflows, Claude given permission to parallelise
  orchestrated subagents, review and fixes well on its own.
- **The person does not read what is not on screen.** Ledgers, design docs
  and records written to the repository go unread. What the person must
  see has to arrive in the flow.
- **A professional engineer's tool, not the fastest path.** Anyone can ask
  for X and walk away. The workflows exist to produce well-engineered,
  well-specified products — architecture, modelling, product, design,
  spikes — as fast as those standards allow. A slower step that yields a
  better system stays; ceremony that yields nothing goes.

## Evidence

Read from the owner's dex knowledge base (`dex-engineering`) and the web,
verified against the fetched items unless marked. Every source is dated and
names the models it measured; reading leads the experiments and this
project's own measurements decide (R7).

- **Instruction budget.** Dex Horthy (HumanLayer, talk filmed 2026-03-24):
  frontier models reliably follow about 150–200 instructions before
  adherence degrades; their 85+-instruction planning prompt silently
  skipped steps, such as asking clarifying questions first; the fix was
  prompts under 40 instructions with control flow in code — "don't use
  prompts for control flow if you can use control flow for control flow".
  Also: reviewing an 8-page plan takes about as long as reviewing the code
  it produces. `2026-03-29-everything-we-got-wrong-about-research-p-37aba6`
- **Anthropic's skill-authoring guide** (fetched 2026-10-06): freedom
  matched to fragility — exact scripts only where a step must not vary,
  text instructions where several approaches are valid; for complex tasks
  a checklist Claude copies into its reply and ticks off; test a skill on
  every model it runs on. Reported via Simon Scrapes (cited, not linked):
  skills written for older models are often too prescriptive for Fable 5
  and can make output worse.
  `2026-10-04-time-to-review-your-skill-files-again-ev-59ccaa`
- **Anthropic removed scaffolding as models improved.** Sprint
  decomposition was deleted from Anthropic's long-running harness once
  Opus 4.6 could decompose tasks natively. Reported by the dex sweep, not
  verified here: over 80% of Claude Code's system prompt cut for Opus 5
  and Fable 5 with no measurable loss on coding evaluations; a reviewer
  asked to find gaps usually reports some even when the work is sound.
- **TDD in the agent loop.** Birgitta Böckeler (Thoughtworks,
  martinfowler.com, 2026-09; Sonnet 4.6 coding, Opus 4.8 judging blind,
  small greenfield tasks, a small sample): no clearly discernible quality
  difference between TDD and non-TDD runs, Opus more than once ranking
  non-TDD higher, mutation scores overlapping; TDD cost 2.96–8.5x session
  tokens (a metric that overstates dollar cost) and far more turns; TDD
  suppressed up-front design and left untested behaviour unbuilt. She
  stopped prescribing test-first and monitors outcomes: mutation testing,
  static analysis, approved scenarios. Emily Bache's rebuttal: the TDD
  prompt lacked a test list, and refactoring needs "habit hooks" —
  deterministic sensors that detect a named smell and inject its fix. The
  models are older than this project's; the person's own reading elsewhere
  agrees that a strict TDD loop slows and weakens current models.
  `2026-09-24-the-last-year-has-changed-everything-i-k-52b1b3`
- **Spec-first as batch size.** Kent Beck: describing the whole spec before
  implementation assumes nothing learned while building would change it;
  the objection is batch size, not test-first ordering.
  `2026-01-07-untitled-49454d`
- **Prototyping and fog of war.** Matt Pocock (2026-07/08): `/prototype`
  builds throwaway variants in the real app to settle questions talk
  cannot; `/wayfinder` maps large work as a frontier of decidable tickets
  (research, prototype, grilling, task) inside a fog of war, and plans in
  one session when the path is known.
  `2026-07-24-in-the-land-of-ai-agents-the-verifiers-a-11e008`,
  `2026-08-05-wayfinder-nothing-is-too-big-to-plan-any-606352`
- **The decision ledger.** David Zhang (2026-08-20): a coding session hands
  back every decision it made where the spec was silent, least confident
  first; a two-day run yields about thirty, of which he overturns about
  four. Auditors run as independent sub-agents that cannot change code.
  `2026-08-20-ian-xiaohei-illustrations-skill-anti-slop-5efd56`
- **Trust is earned through verification.** Lauren Tan (@poteto, Cursor;
  workshop uploaded 2026-09-11): verification run locally, then agents
  reacting to signals, then auto-merge, with no shortcut; she now wakes to
  about 20 merged PRs. pstack's `/create-verification-skill` interviews the
  repository on surface, run, drive, observe and isolate, writes a verify
  skill and a feature map, and runs it once end to end ("a generated skill
  that was never executed is a draft, not a deliverable"); a maintenance
  skill keeps the map honest. Hard layers (lints, compiler errors, CI)
  beat soft layers (rules, skills, style guides) that agents forget; a
  review comment written to enforce an invariant is a smell. Greenfield
  apps grown without constraints become an "organic architecture" nobody
  understands; she spent 600+ PRs moving Grok Bot onto an agent-friendly
  architecture. pstack has no planning skill and targets established
  codebases with guardrails. Its router copies a playbook into the task
  list verbatim, a skipped step staying in the list with its reason; its
  `/automate-me` drafts a personal mode skill from the person's own
  transcripts. Its eval playbook keeps candidates blind to being evaluated
  (no "eval", "test", "judge", "rubric" anywhere they see), uses a judge
  from another model family, and grades chain-following from transcripts.
  `2026-10-03-lauren-tan-workshop-xai-grokbot-4169a7`. In a later
  conversation with Matt Pocock (uploaded 2026-10-03) she calls
  verification the single most important skill, since without it the
  person stays the proxy between agent and output; puts the deterministic
  part in a CLI so agents stop rebuilding verification tooling each time;
  reviews by sampling and fixes the environment (lints, constraints,
  skills) when several agents take the same shortcut; and says one-way
  doors effectively become two-way where the work is verifiable.
  poteto-mode's rule: before asking a "which approach" question, check
  whether running something could answer it, and if so prototype instead.
  She expects skills to keep shrinking as models stop needing
  implementation detail. `2026-10-01-live-poteto-creator-of-pstack-on-shippin-5da913`
- **Approval fatigue and per-question preferences.** gstack v1 (Garry Tan,
  2026-04-18): 53 question categories across 15 skills fired every time;
  users "just say yes yes yes". v1 checks a per-user preference before each
  question and annotates auto-decisions inline; 12 one-way kinds
  (destructive operations, security, data forks) always ask, 41 two-way
  kinds can be silenced; claimed curve: session 1 unchanged, by session 5
  the always-same questions gone, by session 20 only novel ones interrupt.
  `2026-04-19-apparently-there-s-a-new-version-of-gsta-e0474d`
- **Oversight moves to monitoring.** Anthropic, "Measuring AI agent
  autonomy in practice" (2026-02-18): full auto-approve rises from about
  20% of sessions for new users to over 40% by about 750 sessions while
  interrupts also rise; Claude stops to ask more often than people
  interrupt it, most often (35%) to present a choice between approaches;
  the recommendation is oversight by monitoring, not approve-every-action.
  `2026-02-19-measuring-ai-agent-autonomy-in-practice-ffc322`
- **Confidence bands.** TypeSafe's documentation: door type decides
  whether a call may ever be automated, confidence decides which instances
  still need a person; thresholds are set per action and re-derived from
  labelled data. Recorded in the dex `human-in-the-loop` wiki page.
- **The person's own cascade.** In the dex product, Jev settles whether a
  new fact replaces an old one: at 0.8 or above it acts silently with a
  receipt, between 0.5 and 0.8 a strong model reads both, below 0.5 both
  stand, and the strong model may put the call to the person as a card.
  `2026-09-24-i-remember-years-ago-there-was-a-little-7e9e3f`
- **Decision models are weakest at "should I ask".** REFLEX (NTU,
  2026-09-22; Jev 1.13): Jev took over 99% of tool selections but only 28%
  of clarification decisions; 68.8% accurate on clarification, 51.2% on
  risk decisions, 52.0% on whether a tool should be called at all, with
  wrong calls averaging 0.778 confidence. "Type-Safe Is Not Error-Free":
  swapping the definitions bound to yes and no flips 32.5% of Jev's
  decisions; neutral names (A/B, 0/1, random strings) fix it. JEV-as-a-Judge
  (CMU): set thresholds per workload from about 100 local labels by a
  one-sided lower-bound rule; thresholds chosen by point estimate lost
  over 2 points in 40–50% of resamples. Raw probabilities may need
  recalibration: an independent paper on police crash narratives found
  Jev uncalibrated on its domain, then well calibrated after recalibrating
  on 2,416 labels. `2026-09-27-xiaomi-and-deepseek-just-solved-the-bigg-affd85`,
  arXiv 2609.24052
- **Escalation needs a channel and a policy.** Wiser Human (arXiv
  2608.29460, 2026-08-29): a structured report tool plus a written policy
  cut coding agents' reward hacking from 23.6% to 5.3% at no measurable
  cost; the tool alone reached 15.0% — "what determines uptake is design,
  not availability"; reports named the actual defect 99.4% of the time.
  `2026-09-01-2094806744052715668-a248e2`
- **Jev and Clef.** Jev (TypeSafe, launched 2026-09-15): typed decisions
  (yes/no, choice, score) with probabilities, no text; reported at $0.042
  per million input tokens, output free. Clef and Clef-flash (Cloudflare,
  about 2026-10-02): open weights under Apache 2.0, Jev-API compatible,
  vision input, a 64K context against Jev's 32K, no-read/no-store/no-train
  on hosted requests; Clef-flash $0.09 per million input tokens on
  Cloudflare's page, Clef $0.24; Workers AI's free tier covers roughly 700
  Clef calls a day by Better Stack's measure. On Cloudflare's own full
  table Jev leads the reasoning-heavy rows and When2Call (81.0 against
  72.4) and Clef leads classification and tool calling; Clef-flash
  collapses on some rows. Better Stack's independent test from a client
  machine found Jev more accurate against an Opus 5.5 referee (86% against
  83%), faster (7.2 s against 27.2 s for 200 comments) and 6.5x cheaper.
  Cloudflare launched an RL fine-tuning service alongside, not yet
  self-serve. `2026-10-06-clef-open-source-decision-model-cloudfla-3165f7`;
  developers.cloudflare.com (Clef changelog and model page)
- **Preference memory loses scope.** A field report on Mem0's automatic
  conflict resolution: "async for design reviews" was deleted as
  contradicting "sync for incident calls". Scope belongs in the stored
  fact, and every deletion is logged. (dex sweep)
- **Self-adjusting loops game their metric.** A loop "can only see its
  metric"; pair every optimising loop with a counter-metric and keep
  frozen anchors it cannot tune. (dex sweep)
- **Parallel agents lose what they are handed.** In one paper, what a
  child agent received of its parent's handoff fell to 0.32–0.55 against
  near 1.0 in one shared context; Cursor fixed "split-brain design" by
  having planners settle shared design so no two subtrees decide the same
  question. (dex sweep)
- **Directives as migrations.** The person's dex product performs some
  upgrades as directives: natural-language instructions the engine issues,
  written, reviewed and rehearsed before release, naming the files they
  may touch, recorded done by a verb only once their check passes,
  redone from the start rather than resumed when interrupted, and never
  asking the owner anything. (Read from that project's contract,
  2026-10-07.)

## Principles

- **R1 — Control moves up a level.** The engine owns what the person sees
  (stages, gates, menus, screens) and what gets recorded (artifacts, their
  shape and location, state, events). Claude owns how the work gets done.
  The person owns the product and the calls the ask rule (R24) sends them.
  The workflows are standard operating procedures for capable staff, not
  supervision of incapable ones.
- **R2 — Walls and rope.** Every rule in the prose is sorted into one of
  three kinds, and the sort is strand A's work plan:
  - **Contract** — where something lands, what shape it takes, what gets
    recorded, which door a change goes through, what the person sees.
    Stays a wall, held by the engine rather than prose: a verb that is the
    only door (it picks the path, writes the shape, records the event,
    refuses what is wrong), and hard checks behind the verbs (R34). The
    prose shrinks to one line naming the verb.
  - **Required procedure** — steps that must all happen (closing a phase,
    concluding a topic). The engine holds a checklist; every item ends
    done or skipped with a recorded reason; Claude orders and performs
    them as it likes.
  - **How-to** — everything else. Deleted, leaving a goal and a
    done-condition.

  What matters is that the documents' structure, where imports go, the
  logging, the outputs and the process the person sees are the same every
  time; how a plan gets made, or how Claude reasons, does not.

  The person's picture of the result, 2026-10-12: gates, corridors and
  fields. A phase is entered and left through gates. Some stretches are
  corridors, short and linear because what they produce has a fixed shape:
  cutting the work into phases at the end of specification, writing a
  phase's tasks as it starts, the final review. Between them lie fields:
  inside the build Claude works the task list as it judges best — order,
  parallel worktrees, agents, how tests get written. A field has a
  suggested path (the phase's goal, its done-condition and its guidance)
  and no fence. Whatever Claude does in a field stays in the field: what
  reaches the person, what gets recorded and every question to the person
  go out only through the engine's verbs and gates. The layout hook, the
  commit door and the engine's checklists refuse anything else; what they
  cannot refuse — a question asked in plain prose in the build, an extra
  review round — prose walks catch, since they assert outcomes (R4). In
  discussion, questions are asked in conversation (the person, 2026-10-18:
  "Those decisions are meant to be collaborated on and answered through
  conversation, ideally"), so there the walks check that every answer was
  recorded (R11).
- **R3 — Explicitness, not length.** Obedience comes from explicit rules and
  single doors, not from volume; length dilutes. A one-line rule naming a
  verb is more explicit than pages of steps around it. Control flow lives
  in the engine, never in prose. A rule carries what was measured behind
  it only as today's authoring rule allows: one line, where it changes
  what Claude does at the rule's edge (Claude's call, 2026-10-19, on the
  person's thought of 2026-10-15: "It gives Claude a real reason to
  follow the rules. Maybe. I don't know.").
- **R4 — Drift is caught by outcomes.** Prose tests assert outcomes (calls
  made, write order, the world afterwards), never steps. A contract that
  keeps slipping in walks gets a verb or a check, never more prose. When
  the workflows move to a new model, the prose is walked on it at the
  efforts the workflows dispatch, and one pass cuts what that model no
  longer needs (the person, 2026-10-06: "we have to make sure that we
  loosen the reins as the model gets more intelligent"; agreed
  2026-10-19).
  - **Among the rebuilt cases** (agreed by the person 2026-10-20): the
    task writer meets a gap partway through a phase's tasks, and only the
    tasks the gap touches change. It guards against the whole-phase
    rewrite that today's prose prescribes and Mint ran (R15).
- **R5 — About 90%.** The target is 90–95% and then iteration; a product is
  never perfect. One closing pass replaces every loop that runs until
  nothing is found: a keen reviewer always finds something, and much of it
  is a different opinion, not a defect. Findings clear the existing
  consequence floor.
- **R6 — What the person must read reaches them.** Anything the person has
  to see or answer arrives in the flow: a gate, or a mod surface (a pane,
  a slide-over, a rendered document in the terminal). Nothing requires
  opening a file. Material the person may want but need not read is one
  keystroke away on a mod surface. Records, logs, ledgers and design docs
  are written for Claude and for provenance. The redesign never trades
  questions for long documents the person is expected to read.
- **R7 — Our measurements decide.** Published results lead the
  experiments; this project's own measurements, on its own projects and
  models, decide. Every source is weighed with its date and the models it
  measured.
- **R8 — One canonical path.** Every change ships with a migration that
  brings every existing project fully onto the new shape. No second set of
  skills, no old units on old prose, no runtime code that recognises what
  an earlier version left (CLAUDE.md, Migrations). See Migration.
- **R45 — Event-sourced, for engineers.** Ruled by the person 2026-10-15:
  the workflows are built by an engineer for engineers, and their state is
  event-sourced, named as an engineer would name it. Everything that
  happens is an event on an immutable stream, appended and never edited:
  a question asked, a fact found, a decision made, a decision replaced, a
  decision confirmed after what it relied on changed. Each kind of event
  has its own schema, and the engine holds every write to it. Everything
  anyone reads — a topic's record, the map, the product record, "what
  have you decided without me?", the matrix — is a projection of the
  streams, worked out from them and never kept by hand. The project's
  stream is the ledger (R23); the person's own, across all their
  projects, is the trust log (R25); projections give the current view at
  every level: topic, work unit, session, project and the person. The
  product presents itself in these terms.
- **R46 — Agents write what the workflows prescribe; the person sets the
  session.** Agreed by the person 2026-10-19.
  - **Every prescribed artifact is written by a named agent** whose
    model and effort are fixed in its own definition: the spec
    (assembled from the ledger), the phase cut, the tasks, reviews, deep
    dives, gap analysis and experiment write-ups. All are Opus at medium
    until a measurement says otherwise.
    - Each agent's one job is that artifact, with its rules and
      references boxed inside it.
    - Its decisions come back to the orchestrator and take the trust
      matrix's route.
    - It works from the record, not the conversation, which also tests
      that the record holds everything (R14).
    - It keeps the main session's context small, and it is what the
      measurements test.
  - **The conversation stays in the main session**, at the person's
    effort: discussion conversations, research included, the calls the matrix
    routes, and the build's orchestration.
  - **The main session's effort is recommended, never set.** The
    recommended minimum is medium, Opus 5.5's own default, stated in
    the docs. `workflow-start` reads the session's level and says so
    once if it runs below that, then carries on.
  - **Why it is split this way**, measured 2026-10-19:
    - A skill's `effort:` holds only for the turn it is invoked in,
      whether by slash command or by Claude, and the next message runs
      at the session's level again. So no skill can hold a conversation's
      effort. A probe across four turns showed it.
    - An agent definition's effort holds whatever the session runs at.
    - A top-level `effortLevel` in the project's `.claude/settings.json`
      would outrank the person's own saved level in every session there.
      The file is committed, so it would override everyone's choice;
      that is why the workflows only recommend.
  - **Every job measured so far performs as well at medium:**
    - builders and reviewers on Switchboard's replay;
    - the task writer on Mint (R15);
    - decisions, measured 2026-10-19 on the Fumi replay.
      - The set: 37 of the person's recorded calls, posed blind to an
        Opus with no tools, at medium, high and extra-high, two runs
        each, every run graded blind by two graders.
      - Calls matching the person's: medium 19.2 of 37, high 16.0,
        extra-high 18.8. Medium's own two runs gave 21.0 and 17.5.
      - Extra-high cost twice as much and took three times as long. No
        level cleared the bar fixed before the runs.
      - Every run missed the same 14 points. Each was a preference the
        record does not imply.
      - "Would check with the person first" fired on about 45% of wrong
        calls at every effort, and on none of 6 of those 14.
      - What fails is knowing when to ask, not depth of reasoning.
  - **No extra-high agent without a use case**, ruled by the person
    2026-10-20. A gap checker at every phase was considered and dropped:
    on the task writer and the reviewers, extra-high's extra findings were
    mostly not real or minor.
  - **Investigation's root-cause validation runs at extra-high (R20)**,
    inferred, not measured. The person ruled 2026-10-20 to infer it from
    the measurements so far rather than run a check.
    - The check sketched would have been 78 validator runs on clones of
      Portal and Tick, at about $150–250. The person judged it too heavy.
    - Portal's investigations test against tmux, and a validator with
      Bash could have reached the person's live server.
    - **Why extra-high:**
      - The job reasons through code to a conclusion. That is the one
        kind of work where extra-high measurably gained: the implementer
        wrote half the bugs.
      - It runs once per bug.
      - A wrong root cause is the costliest miss a bugfix makes, because
        the fix, its test and the spec are all built on it.
    - Its extra objections cost little, since Claude acts on what the
      validation finds and drops what does not hold up.
    - The level is fixed in the agent's definition, never Claude's pick.
    - Fix validation stays at medium. It checks a fix against a cause
      already settled.
  - **Following the workflow's prose at medium is not yet measured.**
    - The person ruled 2026-10-20 against a dedicated test: they move to
      medium at release, perhaps sooner, run it live, and the
      recommendation moves on what that shows.
    - The design bet is that the engine deciding what comes next, and
      refusing a wrong move, makes the main session's adherence matter
      less than it does today.

## Stages and phases

- **R9 — Stages stay; phases change.** The stages remain Discovery,
  Definition and Delivery. The phases:
  - **Discovery stage:** discovery, discussion, experiment, investigation.
  - **Definition stage:** specification.
  - **Delivery stage:** implementation, review.

  Research folds into **discussion**, as one of its tools. Planning splits:
  the phase cut moves into specification, and tasks are written at the
  start of each build phase. Scoping goes with the quick-fix ceremony
  (R21). The phase names `implementation` and `review` stay; the
  implementer's role is called **the builder**.

  The merged phase is called **discussion**, ruled by the person
  2026-10-20: research is one of its tools, and experiment is invoked
  from it, its results coming back to be discussed. In their words: "You
  can have a discussion. You can be in discussion. You can't be in
  workshop." And: "As a result of discussion, we make decisions." The
  way there: deliberation, design and refinement were rejected
  2026-10-13 (wrong for what the phase is; confused with visual design;
  polishing something that exists, where the phase goes wide first);
  decision was kept as a placeholder, since it names the outcome rather
  than the activity; workshop was considered and rejected 2026-10-20, as
  it names a place, not something you are in.

## Strand A — restructure

### Discovery

- **R10 — Discovery keeps its shaping.** The high-level shaping
  conversation is the strongest part of the workflows: the person talks
  the product through once and the conversation becomes the record the
  topics come out of. The product-level conversation on the roadmap, the
  work-type commit, the discovery map and the briefs stay. What changes:
  - **One phase, at whatever level the conversation reaches.** The person
    starts and talks; the conversation finds its level and moves between
    levels as it goes (the pivots run both ways). The type call comes down
    to four: the product across time (the roadmap, where nothing is
    created until an item is pulled, and the pull goes through discovery
    to whatever type the work is, R17; principles are talked through
    here, R22), building something in one topic (feature) or several
    (epic), fixing something broken (bugfix), a small known change
    (quick-fix). A
    separate product-level phase was considered and rejected: it would
    make the person name the level before they start. Ruled by the person
    2026-10-13.
  - **Claude asks no detail questions in discovery.** It shapes scope and
    what the work touches; detail is discussion's. Today's guidance invites
    decisions in an epic's second conversation, and the person pushed back
    every time it did: "Why are you asking that question? We're in
    discovery"; "the whole point of this process is to surface topics…
    It's not for making decisions or shaping CLI" (Fumi); "rather than
    making granular decisions at this discovery stage, we should be
    thinking about what else is affected" (Portal's
    tagging-and-filtering). The length stays: Fumi's discovery ran to
    about 150 of the person's replies over two sessions.
  - **Feature and epic stay two types, and the call between them is
    light.** A feature is linear by definition and its menus are simpler.
    Discovery leans one topic; the work becomes an epic only when the
    conversation shows parts that each need their own decisions. The one
    time the person held a reading against Claude's in shaping, they kept
    one feature where Claude saw several (Portal's theming: "It might seem
    like multiple features, but I think really it just comes down to one
    feature"). A feature that grows pivots, as Mint's did two days in, so
    the boundary needs no more confidence than the rest of the type call;
    today's detection asks for more, holding that the boundary has no
    safety net. Ruled by the person 2026-10-13.
  - **Two shaping rules**, Claude's, covered by the person's yes on
    2026-10-13 ("On the whole, I think that sounds good"):
    - an inbox item that already pins the work, cause and fix known, is
      confirmed in one line, not shaped again (on projects-filter the
      person said there was nothing to add and still went through two
      more gates);
    - a known cause with a mechanical fix is a quick-fix, not a bugfix
      (five such units went different ways: two as quick-fixes, three
      through a full investigation).
  - **Product-level discovery writes the product record.** The project's
    product-wide ledger entries, read as one view and owned by the
    workflows: what the product is, who it is for, what it values, and the
    standing rules that cut across topics. It is a projection of ledger
    entries (R23, R45): an entry is replaced, never edited, and each says
    who decided it and where. The engine renders it to a file whenever a
    product-wide entry changes, so a CLAUDE.md line can point at it (the
    person, 2026-10-13, agreeing a file the workflows own: "yes ok"); the
    file is gitignored and sits beside the knowledge base's rendered
    records (Claude's call, R44). Its three forks — where it grows, who
    approves a line, apart from the feature map — are as below, agreed by
    the person 2026-10-13 ("Okay, cool. That sounds good."). Every topic's opening view reads
    it with the decided records (R11), so a new epic's first topic starts
    narrower (R24). Several of Claude's misses in the replay were the
    product's character, not facts (R24). The roadmap keeps capabilities
    in horizons, an item's substance left in its session logs until a pull
    creates its topic; the product record sums up character, not items,
    so that rule stands. It is not CLAUDE.md, which loads into every
    session and subagent and is the person's to write: Portal's and
    Switchboard's hold only how to work on the code, and the internal product, run by
    hand, kept its settled decisions in their own file with CLAUDE.md
    pointing at it. The workflows never write CLAUDE.md; a pointer there is
    the person's line. It is never a phase, and Claude never asks to fill
    it; three moments touch it:
    - a conversation about the product as a whole feeds it, and decides
      nothing, ruled by the person 2026-10-19: it is discovery at the
      product level, so a principle said there ("updates never install
      themselves") is the person's stated view, carried as input; it is
      decided in the first topic it bears on, where Claude opens with it as
      the position, and goes in as a product-wide entry; one no topic
      touches yet waits until one does;
    - decisions add to it: a topic that settles something bigger than
      itself (Fumi's "updates never install themselves", decided inside
      engine-architecture) lists the entries on its decided screen,
      and the person's yes there covers them — no gate of its own, while
      the person still sees Claude widen a topic's call into a rule for
      the product. A project with no product conversation, such as Portal,
      starts empty and fills from its decisions;
    - every topic's opening view reads it, and the settled part cites it.

    It stays apart from the feature map (R32): the build writes that and
    proving the work reads it; discussion writes this and the opening view
    reads it. Adopted, with its forks, by the person 2026-10-13.
  - **Discovery's gates**, ruled by the person 2026-10-13 from the
    answers recorded since July:
    - the shape gate becomes **start this work**, an authority gate
      (R40): 14 of its 16 answers were a yes, and both others were
      questions about the type ("would it make more sense to do then
      indicudlalt as featurea? or as an epic?"; "could be processed as a
      bug??"). Learned, it could go automatic and Claude would create
      work on its own reading, which discovery never allows;
    - approving the map is one screen: the topics, their order, and what
      is parked on the roadmap in which horizon. Today's park gate (2
      answers, both "Park it") and horizon pick fold into it;
    - a change the person asked for in their own words is done and
      reported in one line, with no confirm: a rename, a summary or
      description edit, removing an unstarted topic, postponing.
      Cancelling keeps its confirm: it is picked by number from a menu,
      and a slip ends a topic;
    - the name gate and the first-phase gate are gone, and the change
      routing and dead-end map operations with them (R10's no routing,
      R17); resume and the import prompt are process gates (R40); the
      candidate gate goes with the gap analysis's background run.
  - **The gap analysis moves out of the background**, ruled by the person
    2026-10-13. Today it runs at every return to the epic menu once a
    topic's research or discussion changes and offers each candidate at
    its own gate. On Fumi about 41 runs offered 14 candidates; the person
    took 7, skipped 6 and questioned one, so the gate would never learn.
    Of the 7, two mattered — status-and-alerts (about 10 of the person's
    own calls) and search (about 8); platform-support was spreading the
    macOS 15 floor into other documents ("can you make sensible choices
    here. I dont really care"), privacy was cancelled after one "agree",
    the rest were cancelled or never started. Most gaps followed from
    decisions made after discovery. It now happens at two moments:
    - when a topic finishes: its closing pass (R11) also asks whether the
      decision creates work no topic owns, and a candidate shows on the
      decided screen with its reason, beside the product record's
      lines; the person's yes covers it, or they strike it;
    - once every topic is decided, before the spec (R17): one sweep
      across all the records for what falls between topics.

    A candidate becomes a topic only when it holds a call the person
    would make. Work that only carries a decision into other documents
    goes to those topics as messages, and calls the person would leave go
    to the builder. Nothing runs at the menu and no candidate gate stays
    there; a gap visible from the map alone waits for a topic's close or
    the sweep, which in Fumi's evidence were not the gaps that mattered.
  - **No routing.** Every topic of an epic or feature
    goes to discussion; none goes straight to the build. How much of the
    person a topic takes is set inside discussion — by how much the product
    already settles and by the ask rule (R11, R24) — never by a label
    fixed at the map. This replaces today's routing to research or
    discussion everywhere that routing reaches: the map, the first-phase gate,
    where a message sent to a topic lands, and the epic menu's new-topic
    doors. Quick-fix (R21) and bugfix (R20) keep their own paths. Ruled
    by the person 2026-10-13 on the discovery walk, replacing a proposed
    label routing each topic discuss or build. A label set from the brief
    is too coarse and too early:
    - most topics mixed a few real questions with much agreement —
      15 of 18 features held product calls only the person made, and
      Fumi's engine-architecture took about 66 replies, about 50 of them
      agreement and about 4 real questions;
    - space-homing's brief held only technical questions, so it would
      have gone to the build, when what needed the person — the bar for
      placing notes at launch, the macOS 15 floor, no kill switch — came
      out of its research;
    - a build label would have sent undecided calls to the builder,
      the internal product's failure (the shape review's evidence, Open).
  - **Nothing in discovery is a decision**, ruled by the person
    2026-10-19: "Nothing during discovery is a decision. That's the whole
    point, discovery is about discovery, decision phase is about
    decision." The brief carries what was said — the person's leans,
    rejected paths, open questions, what a spike showed about the
    direction — as input.
  - **The brief feeds the topic's opening view** (R11): the topic opens
    with Claude bringing up what discovery found, and it is decided there,
    in discussion; it is not the list of what the person will be asked. Briefs predicted that poorly: they matched where discovery
    measured a running product (Portal's project-link, 7 of its 8
    subtopics) and missed for most of greenfield Fumi, where the questions
    came from research results and other topics' decisions. Approving the
    map stays the topics and their order.

  Whether a door is one-way is set by what depends on the decision —
  persisted data, external contracts, decisions stacked on it — not by
  the size of the change; a public command surface is two-way until
  something depends on it.

### Discussion

- **R11 — One conversational phase.** Today's research and discussion
  merge into one phase, called discussion (R9).
  Research is done to give a decision its data and belongs in the same log
  as the decision. The phase:
  - **Record and log.** Each topic keeps a **record** — current decisions
    only, each with its why and what it rules out — and a **log** — the
    journey, options, false paths and reversals, appended and never
    rewritten. The record is what downstream phases and the knowledge base
    read first (R44 indexes records, never logs); the log keeps the
    person's thinking and why minds changed, and the spec's session reads
    it where it needs to know why — a why missing from it is a gap.
    **A decision is written once**, ruled by the person 2026-10-13: every
    decision and finding is a ledger entry (R23) written through an
    engine command, and the record is the engine's view of the topic's
    current entries, each shown with its short id — as menus are drawn from
    the manifest. Linking comes free, superseding stays append-only, and
    nothing is edited in place. The engine holds only identity, links and
    supersession, never the content: an entry's why can run to
    paragraphs, a scope call agreed after the opening view (what the topic
    covers) is an entry like any other, one thing to an entry (R23), and
    spikes and their
    assets are files an entry points at (R12) — Claude writes freely and
    the structure stays out of its way. This absorbs the record-and-log programme (folded
    in by the person 2026-10-12, built first in strand A) and ends the
    problem specifications were partly invented for: telling a false path
    from a final decision. FlowX kept exactly this split by hand; without
    it Switchboard's reasons ended up outside git.

    Today a topic that went through both phases has a research document
    and a discussion document, each mixing journey and outcome (Fumi's
    space-homing: 12k and 14k words; research carried across under
    "Inherited position — from research"; a reopened decision sitting on
    its earlier version, the fallback revised three times in three days).
    The split moves from by phase to outcome against journey. A changed
    mind is a new entry replacing the earlier one; the record shows the
    current answer with the answers it replaced folded beneath it (R23),
    and the change and its why are appended to the log. Ruled by the person 2026-10-13:
    - **A discussion log is kept per topic**, one dated heading per
      session. The mailbox rule (R13) keeps a discussion session to one
      topic, so the topic's whole journey sits in one file beside its
      record — for its next session and the person asking why; the
      knowledge base indexes records, never logs (R44). Discovery and the roadmap keep their logs per session:
      their conversations are about the whole epic or product.
    - **The record holds findings beside decisions,** in their own
      section, each saying how it is known (measured, documented, seen in
      a spike) and when, replaced by a new entry when superseded, as
      decisions are. With research
      merged in, its results need a home other topics read: an opening
      view reads other topics' records, not their logs, as put to the
      person 2026-10-13, and a topic opening with a log of its own reads
      it (R43) (Fumi's measured "no Accessibility
      permission is needed" turns up across six other topics' documents,
      and engine-architecture designed around a restart for a permission
      that was not needed).
  - **Every record entry says who decided it:** the person, Claude, or
    the person handing it over ("your call"); a finding says how it is
    known instead. A Claude suggestion can never sit in the record as the
    person's decision — the spec review catches an unowned decision in the
    spec.
  - **A topic opens with Claude starting the conversation**, ruled by the
    person 2026-10-18. Nothing is written ahead. The prose prescribes the
    steps before it — reading the brief and the record of every topic
    decided so far, checking what can be checked (R24), the engine's
    commands — and then Claude opens the conversation itself, never
    stopping in silence once it has read ("almost like walking into a
    room and just staring at someone and not saying hello"). What it says
    is its own and fits the topic: the shape of what has been said, a
    perspective from the brief or beyond it, what earlier decisions
    already settle and where from, the open questions with its lean on
    any where a logical one exists, and perhaps a steer towards where to
    start. Opening decides nothing: the conversation is about the shape,
    and what the person decides enters the record as theirs.
    - **A conversation, never a conveyor belt**, in the person's words,
      2026-10-18: "the decision process isn't a conveyor belt of
      decisions. Those decisions are meant to be collaborated on and
      answered through conversation… challenging ideas, playing devil's
      advocate, throwing thoughts around… It's meant to be fun." The map
      tracks what is open and never sets the conversation's order, and
      the prose never prescribes the conversation itself (a field, R2):
      prescribed too rigidly, Claude drills through questions for
      answers. Early topics are mostly conversation; as the product fills
      out there is less to discuss and more to bolt on, and one piece can
      open the discussion wide again.
    - The least a topic takes is Claude's opening and one answer — Fumi's
      build-and-release in October is minutes: most of it follows from
      earlier topics, and four things need the person.
  - **The map is the definition of done**, agreed by the person
    2026-10-13. It stores nothing: it is the topic's list of what is being
    decided and where each stands, drawn from the ledger. The person's
    questions — seeded from the open questions in Claude's opening, joined by any met
    mid-conversation, arriving as a message or a finding, or added by the
    person — sit beside Claude's calls, one line each. Only the person's
    hold the topic open: Claude's are decided when made, and the topic is
    done when nothing of the person's is open. A question of the person's
    closes by their decision, by "your call" (Claude's, marked handed
    over), by "don't care" (the builder's), or by moving to another topic
    as a message or to the roadmap as later; nothing waits half-decided as
    deferred. Each time the map shows, it lists Claude's calls since the
    person last looked, so a call is overruled when made rather than at
    the topic's close. Today every subtopic Claude names goes on the map in
    five states of its own bookkeeping: 166 across Fumi's 13 topics, 14 in
    commercialization for one or two questions that needed the person.
    The epic menu shows the person's count ("2 of 3 decided").
  - **When nothing of the person's is open**, the closing pass runs (below)
    and the **decided** screen shows what the person decided, a count of
    the calls Claude made by kind, which the person can open (R23), a
    verdict asked on each call the person changed, the proposed
    product-record lines and any new-topic candidates; the person's yes is the authority gate. It
    replaces today's closing sequence — calls flush, landed-input check,
    wait gate, map gate, closing gates — whose conclude gate took a yes
    about 50 times on Fumi, the typed answers questions the screen now
    answers ("Did you fix all those items then or not?").
  - **Once the shape is agreed, Claude fills in the rest.** The ask rule
    sends the person the few calls that need them, one at a time in the
    conversation (R24); the rest
    are Claude's, on the map and in the ledger; the topic goes to its
    decided screen (R24's convergence). "Don't care"
    hands a call to the builder and is recorded as the builder's.
  - **Tools:** deep dives to learn, spikes to see and feel (R12),
    experiments to measure (unchanged: a rigid laboratory for questions
    neither side can answer).
  - **The reviews stay, and the matrix routes what they find**, ruled by
    the person 2026-10-13 (What the workflows are for). Today's review
    machinery works and keeps running: the background review once the
    conversation has got going, with its back-off; perspective agents;
    the final review; findings slotted in at a natural pause while the
    conversation carries on, never jumped to; the lanes. What changes is
    who answers: a finding takes the path of any question — a fact is
    checked, intent goes to the matrix and becomes Claude's call (in the
    ledger, on the map under "since you last looked") or a question on
    the person's map, another topic's goes there as a message, a gap is a
    candidate on the decided screen. The gates inside the reviews
    are process gates, learned (R40).
  - **The closing pass** is the final review, run once nothing of the
    person's is open, with two readers: a fresh agent, unanchored by the
    conversation, reading this topic's entries and log, the other topics'
    current records and the product record; and the Claude that was in
    the conversation, checking every decision made in it has an entry. It
    looks for a question the log raised that has no entry or map line, a
    contradiction with another record, work the decision creates that no
    topic owns (R10's gap analysis), product-record lines, and an entry
    whose why is written nowhere. If it changed decisions, another pass
    reads what changed, unasked, until one changes nothing.
- **R12 — Spikes are encouraged, and their artifacts are evidence.** **A
  spike is code or design that is never wired into the product**; size
  does not decide it (FlowX's drafts are 323 files and still a spike;
  Switchboard v1 was wired and shipped, so it was a product built fast,
  not a spike). A spike is anything that can be looked at or pressed: a
  design board, a constrained design generator (Switchboard's
  terminal-cell generators are the example), draft code, a format trial,
  a working prototype to scroll and feel. Spikes live inside discussion
  conversations and may come early, in the first ones; FlowX — discussion
  with a spike, free process, prescribed documentation — is the model.
  What informs a decision — an exported image with its live source link,
  draft code, the generator that drew a design, pulled data — lands in the
  work unit as a tracked asset linked from the record, whoever made it
  (today's imports cover only what the person shares; Switchboard's
  generators and design log sit in a Claude session folder and would be
  lost). Each asset is:
  - **canonical** — the spec carries it, the builder builds to it, and it
    is replaced when the design changes (it belongs to the record); or
  - **reference** — the builder consults it before re-solving anything it
    covers ("we tried this, it worked"); draft code is reference by
    default (it belongs to the log).

  Claude proposes the status when the asset lands; the person can change
  it. The record states what a spike settled and points at the asset; it
  never re-describes it. An image is what was decided; its live source
  link is where work continues; both are recorded. **Lifting a piece of
  spike code into the product is an explicit, recorded act, never
  drift.** A design spike runs in rounds and ends in a **lock**: the
  locked design becomes canonical and the spike goes, a rejected spike's
  rejection is kept, and a later spike may challenge a locked design with
  a stated hypothesis (FlowX's design boards). A spike is evidence only
  for what the person reviewed in it: scaffolding nobody discussed is
  never cited as decided. No design tool is named in the workflows.

  Fitted to the ledger, ruled by the person 2026-10-13:
  - **One home for what informs a decision.** A work unit's `assets/`
    (Layout on disk) replaces `imports/`, whoever made the file; each
    asset is linked from
    the ledger entry it informs (R23) — canonical from a decision,
    reference from a finding or the log. Something living in an outside
    tool is kept as its live link and an exported image.
  - **Where a spike's files go** (Claude's call, 2026-10-19, after the
    experiment's precedent): its source — draft code, a generator, a
    design export and its live link — is kept in `assets/` as it is
    written, so nothing is left in a session folder; its dependencies,
    builds and run output go in the gitignored cache. A product-level
    spike's files go in `.roadmap/assets/`, which replaces
    `.roadmap/imports/` as a unit's `assets/` replaces `imports/`, each
    linked from the product-wide decision it informs.
  - **A lock is a question on the map** ("which design?"), closed by the
    person's choice: a ledger entry with the design as its canonical
    asset, no gate of its own. Rejected designs stay reference, the reason
    they lost in the log; a later spike that challenges a lock supersedes
    it like any decision, with its reason.
  - **Discovery may spike to see the shape** and decide the direction of
    travel — "a valid use of discovery" (the person, Fumi). It settles
    shape, not detail, so the no-detail rule stands; what it shows lands
    as reference and the first topics' opening views read it.
  - **Claude's own spikes back its calls** (R24): the reference assets
    attach to Claude's ledger entry as its evidence, so "what have you
    decided without me" shows how Claude found out.
  - **A spike for the whole epic happens in discovery**, through the epic
    menu's discovery door (key d, agreed with the person 2026-10-14) — no
    surface of its own, since discovery is
    already the epic-level conversation with a log, and can add topics and
    send messages. Its result lands as a new topic (the brief pointing at
    the spike), messages to the topics it affects (a decided one reopens
    through its mailbox), product-record lines, or a direction not taken,
    kept in discovery's log with its reason. Questions that span topics
    do arise mid-epic: Fumi's switch to CloudKit was decided inside
    storage-and-sync and reshaped three topics.

  Whether a product gets the workflows at all is the person's decision,
  made by installing them; the workflows never ask it (the person,
  2026-10-12: "I don't think it's the workflow's responsibility to decide
  if the workflows are required. It'll be me."). Building a v1 fast is
  done outside them, and a later install comes in through the roadmap's
  plan the product (R17): discovery is one conversation at whatever level
  it reaches, and an existing codebase is that conversation started from
  code. Today's brownfield assessment folds into it, agreed by the person
  2026-10-19.

### Between topics

- **R13 — Topics talk through mailboxes.** A topic never writes into another
  topic's record: a call that looks obvious through one topic's lens can
  read differently with the other topic's context in view, and in Fumi
  the back-and-forth between topics produced better decisions. The mailbox
  stays a queue of files, one message each (it was once a section of the
  discussion document; moving it out was right). With research and
  discussion merged, a topic has one mailbox, in the topic's own folder
  beside its brief and log (Layout on disk), so the choice of which
  phase a message lands in goes and a topic's path names no phase. What changes is the ceremony of
  answering:
  - **the start skill takes an optional work unit and topic**, ruled by
    the person 2026-10-16: `/workflow-start {work unit} {topic}` opens
    that topic directly, as picking it through the menus would, and a
    topic that opens with mail waiting raises the mail first. Every send's
    report ends with that command for the target, to paste in another
    pane now or use later; without it the menus show mail waiting as
    today. The command opens any topic by name, not only for mail. None
    exists today: the report says only where the message landed, phase
    skills cannot be typed as commands and the start skill takes no
    arguments. In Fumi 30 of 157 messages only corrected another topic's
    stale copy, which the ledger ends (R23);
  - a target already in session raises the message from its loop, as
    today.

  Rejected: visiting the target topic from inside the sending
  conversation — its record and log (40k–110k tokens for Fumi's larger
  topics) would sit in the sending context for good and keep pulling the
  conversation sideways. A fresh subagent that loads the target, writes
  the item in the target's terms, takes the person's answer and lands it
  is a later fallback only if the one-command open still feels clunky; a
  forked agent is rejected, since it carries the sender's lens. The
  mailbox rework landed first (v0.8.15); this record uses its names —
  mailbox, message, send.

### Specification

- **R14 — The spec is the build's working document; the ledger is the
  truth.** The spec is the document the build reads. Ruled by the person
  2026-10-14, after the ledger test: the ledger is the source of truth,
  and the knowledge base indexes the records drawn from it, never the
  spec; a finished spec is kept as history, like a plan, and never
  corrected. It stays because building from records alone is a bigger
  reasoning step: decisions into a coherent spec, then tasks, then code.
  Walked with the person 2026-10-13; 138 of their answers at spec gates
  across Portal, Tick, agntc and Mint, sign-off a yes 13 of 13.
  - One spec per work unit, ruled by the person 2026-10-14 (Open: the
    epic as a whole): no grouping step; the spec is written in sections by
    area, each assembled from its topics' records — assembly, not
    archaeology. Today Claude extracts exhaustively from the
    discussion documents, a gate per topic, with tracking files proving
    each source item incorporated.
  - **Every statement traces to an entry**: it cites the ledger entry it
    comes from (R23) or is marked the builder's, so a statement with no
    source is invented and the review finds it mechanically (Portal: "what
    do you mean portal exits with an error? Thats not what we agreed").
  - It marks what it leaves to the builder: only what the matrix makes
    the builder's, recorded as such.
  - It ends with the **phase cut**: phases in build order, each an
    independently verifiable slice with acceptance criteria written as
    scenarios. Those criteria are the test list (R33). The sections stay
    by area, ruled by the person 2026-10-15; for each phase the cut lists
    its scenarios, the sections it draws on and what it relies on from
    earlier phases or another work unit (R15, Dependencies), so a phase goes straight into the tracker and whoever
    writes its tasks reads those sections in full, and reads further
    wherever it meets a seam (the person, 2026-10-15: "He can plan ahead
    if he sees fit").
  - Each invariant names the hard check that enforces it where one can
    (R34).
  - Canonical assets are linked from it: the builder cannot build a design
    it has not seen.
  - **The review hunts gaps, and the matrix answers them** (What the
    workflows are for): fidelity to the records, contradictions between
    topics, and the undecided detail the build would otherwise meet. A
    gap found here is decided here — mostly Claude's call, sometimes the
    person's, in product terms and never by section number ("you're
    referencing specification section numbers, which mean nothing to me")
    — and written as an entry in the topic it belongs to, so the record
    stays the source. Gaps at the spec mean discussion missed them; the
    measure (R36) shows where.
  - **A re-review reads only what changed, unasked**, and stops when a pass
    changes nothing. Today each cycle rereads the whole spec and asks the
    person whether to go again ("If we're still finding errors that were
    created by the review before, how do we ever stop?").
  - **Ready to build** is the spec's gate, once per spec: the short outline
    and the phase cut (R15), replacing today's construction, finding,
    re-loop and sign-off gates. A topic's close is **decided** (R11); for a
    feature the two are one screen.
  - A concluded spec is never corrected: a later change replaces the
    entry on the ledger, and the entries that relied on it are flagged in
    the work that made the change (R23). The corrigendum and the spec's
    re-index go.

### Implementation

- **R15 — The builder runs the build.** Claude orchestrates, agents
  at a chosen model and effort write each slice, review sits between
  every slice and its merge, and the one gate before building is the
  person approving the phase cut as a short outline — Switchboard's
  14-stage plan was approved from 600 words, and the person never read
  the 41k it became. The workflows carry the shape in their own prose,
  self-contained; they never depend on a personal skill. What planning's
  set-up writes today (the plan's context) moves to the spec or the phase
  start — Claude's engineering note.

  The phase cut is made in a corridor at the end of specification (R2,
  R14): phases in build order, each independently verifiable, with
  acceptance criteria as scenarios. Across 26 units with 916 planned tasks
  the cut itself always held — phases ran in the order planned, none
  dropped, merged or reordered.

  **How work is broken up**, ruled by the person 2026-10-12 after research
  into published practice and their own projects. These principles and
  the task template replace planning's teaching:
  1. Every phase ends with the product running and its new behaviour
     reachable: the builder proves it by running it (R32) and the phase
     review checks that proof. No phase leaves work unwired for a later one
     to join up.
  2. The first phase gets the product running and drivable — it launches,
     a smoke check passes, the verify setup exists — and sets the pattern
     later work copies. It need not touch every layer; on an existing
     product it is the first capability.
  3. Shared ground first, then parallel: a design several tasks touch is
     settled, and the code they share is built by one agent, before work
     fans out; parallel tasks each own their files; work on a shared file
     runs one task at a time.
  4. Cut by what someone can do, not by layer, as far as the product
     allows; where it is too interconnected, cut so the pieces meet as
     early as they can.
  5. A task is one piece of work an agent can finish and prove in one go —
     not a single test cycle, not a grab-bag of unrelated changes. One
     likely to run past about 10,000 changed lines is probably two, since
     past that a reviewer's yield dropped sharply; there is no lower bound
     (agreed by the person 2026-10-15: "We definitely don't want every
     task to be 100 lines of code"; "the more data we can get on our
     decisions, the better").
  6. Tasks are written at the phase start against the code, at product
     altitude, naming no mechanism the record did not decide.

  Left unsaid, because the Claude 5 generation does it unprompted and
  instructing it backfires (telling it to verify makes it over-verify):
  breaking a task down, keeping its own to-do list, checking its own work,
  finishing rather than leaving stubs. Evidence:
  - Nobody ran a phase before the next began. Across 25 units phase 2
    started a median 8 minutes after phase 1 ended, walking skeletons
    included. No first-phase shape (skeleton, foundation layer,
    user-visible slice) went with fewer later fixes or less rework.
  - What mattered was whether the pieces met early. Portal's session
    resurrection built scaffolding, saving, restore and hooks and joined
    them in phase 5; it drew 12 fixes within a month, most of them broken
    contracts between its own phases. FlowX's drafts never ran end to end;
    the internal product left its screens late and the person found a dashboard of
    three cards that did nothing. In every project the defects that
    mattered were found by running the product, after tests and review had
    passed.
  - Parallel work is the best-measured part: two agents on overlapping
    features succeed about 30% less often than one doing both (CooperBench,
    January 2026); a central orchestrator holds error amplification far
    below independent agents (Google, December 2025); Cursor's swarms
    needed planners to settle shared design; Switchboard's rework gathered
    where parallel slices each settled the same timing rule; in Portal 52
    of 153 task builds edited one 5,467-line file.
  - A task carries about 10 minutes of fixed cost in Portal whatever its
    size; Anthropic's Claude 5 guidance says to give the full spec and let
    the model run, and that skills written for earlier models are often
    too prescriptive and degrade output.
  - Today's teaching came from the person's pre-AI practice in one January
    session (walking skeleton, steel thread, vertical phases, 3–6 tasks),
    and its own task examples ("Create Event model and migration") teach
    the foundation-first order its rules warn against.

  **One orchestrator runs the build across its phases**, ruled by the
  person 2026-10-12. It delegates rather than does — a task-writer agent
  writes each phase's tasks, builder agents implement, reviewer agents
  review — so its own context grows slowly and compactions are rare; when
  one comes, the gate mod's recovery note names the build log and where
  the phase stands. Rejected: a handoff at every phase boundary. It
  guarantees a lossy reset, then spends tokens re-reading skills, code and
  knowledge to regain the state the session already had, and the
  compaction recovery already carries a session on.

  **The build keeps a log**, ruled by the person 2026-10-12: appended as it
  goes — what is in flight, what was tried and dropped, what a phase left
  for the next — and read after a compaction and when a build resumes,
  beside the ledger, which keeps holding Claude's calls. On Switchboard
  Claude started one itself (`stage4-notes.md`, 87 entries, 10k words over
  stages 4–8) and read it to carry on after compactions; what survived
  every compaction there was what had been written down.

  Per phase:
  - **Tasks are written when the phase starts**, in a short corridor,
    against the code the previous phase left, and recorded through the
    engine's task verbs (R35) with their dependencies — and which can run in parallel —
    before anything runs. Each uses the task template (problem, solution,
    outcome, acceptance criteria as scenarios, spec reference) and names
    no mechanism the record did not decide. What went stale in tasks
    written ahead was exactly the mechanism and the `file:line` anchors
    into code earlier phases changed; the template's fields never needed
    amending, and 46% of all delivered tasks were already written mid-build
    against the code with only the template, the tracker's adapter and a
    short writer agent.
  - **How a phase's tasks are written**, agreed by the person 2026-10-19
    from Mint's planning run (`walks/build/mint-planning/REPORT.md`):
    - the task writer records each task through the task verb as it
      goes, one call per task, never a file it rewrites whole; the verb
      takes the task's text from a file, so no one types it twice;
    - a gap the writer finds is decided like any other gap and changes
      only the tasks it touches; it never re-runs the phase;
    - the writer reads only the spec sections its phase draws on, which
      the phase cut names.
    
    The evidence: today's planning of an eight-phase plan in Mint (Claude
    Code, 2026-10-19) ran 12.1 hours and was still writing phase 8's
    tasks, before the plan review. Claude worked 9.7 of those hours and
    waited on the person 2.4, every one of them before midday. Of the
    sub-agents' 7.3 hours:
    - 5.7 were task authoring, at 21.2k output tokens a task for about
      1.2k tokens of text that survived;
    - 2.9 were whole phases re-designed and re-authored after a spec
      defect. 27 of 32 hand-backs named one, 49 corrections landed on the
      concluded spec, and every phase from the second on ran twice;
    - about 1.5 went on the author rewriting its whole file for each
      task (483 KB written for a 60 KB file in one phase);
    - every agent read the whole 127 KB spec.

    The orchestrator spent about 50 more minutes retyping every task into
    Tick, since Tick's adapter forbids reading a description from a file.
    Every one of the run's 1,003 sub-agent requests ran at extra-high: the
    planning agents' definitions set no effort, so they inherit the
    session's.
  - **The task writer runs Opus at medium**, fixed in its own
    definition, never chosen by the orchestrator and never raised by a
    phase's size or difficulty. Ruled by the person 2026-10-19 from a
    measurement (`walks/build/task-writer/REPORT.md`, design fixed before
    any result):
    - the setup:
      - 27 writers on Mint's phases 3, 6 and 7, at medium, high and
        extra-high, three runs each;
      - each phase's spec was taken as it stood before its own
        corrections;
      - the key was the corrections Mint's extra-high planning made
        while writing them; two blind labellers agreed 10 of the 18 were
        real and 5 were not.
    - the result:
      - medium caught 16 of 30 real gaps, and high and extra-high 17 of
        30 each. One gap in 30 is the size of the labelling noise.
      - medium cost $2.03 and 4.4 minutes a phase, and extra-high $4.34
        and 11.8.
      - extra-high's five times the thinking went into raising gaps that
        weren't real: 2.7 a list against medium's 1.4.
      - the same four narrow gaps were missed at every effort.
      - a medium review of the written list caught nothing more, at more
        than extra-high's cost.
  - **No second pass over a phase's tasks**, agreed by the person
    2026-10-19.
    - A single writer catches about half of what Mint's planning found.
      Mint found the rest over 3.5 hours for those three phases. Every
      phase there was designed twice and written twice, each time by
      agents reading the whole spec, so the extra gaps came from the
      repeated passes, not from effort.
    - What a writer misses are narrow edges: an empty flag value, closed
      input at one prompt, two rules meeting in one mode, a pasted line
      meeting an existing key. The builder meets each one with the code
      in front of it, and it takes the route any gap takes: the builder's
      call to the ledger, or the person's question while other tasks run
      on. The reviewers then hold the code to it.
    - The measure (R36) records where each gap was found, so it will show
      whether gaps left to the build cost more than finding them ahead.
    - Each writer also raised about 1.5 real gaps a list that Mint's
      planning never found.
  - **Dependencies**, ruled by the person 2026-10-16. Today they come in
    three layers: between an epic's specs (each spec's Dependencies
    section, copied to the manifest as unresolved, linked to a task in
    another plan, checked by a gate when a topic's build starts, beside
    an advisory build order of the specs); within a plan (an agent clears
    and rebuilds every task link and priority once all phases are
    written, the person approving); and in the build (the tracker's
    "ready" hands over the next unblocked task). In the person's projects
    the first layer was almost unused — 6 dependencies between specs, in
    two epics, one task of 3,299 blocked by another plan, no build order
    ever set — and of 408 task links in five Tick stores 232 sat within a
    phase, 175 on an earlier phase and none on a later one; the rebuild's
    approval was "Proceed" 13 of 13. The new shape:
    - inside a work unit the machinery between specs goes — the
      Dependencies section, its states, the check at a build's start and
      the build order: there is one spec, and its phase cut (R14) orders
      every phase across the unit, each naming what it relies on, another
      work unit's delivery included, which the build checks before that
      phase starts; with phases overlapping (Open: One build across an
      epic), a phase starts once what it relies on is done;
    - a phase's tracker links are set as its tasks are written, within the
      phase and onto unfinished tasks of earlier phases; the plan-wide
      rebuild and its approval go;
    - the next task still comes from the tracker's dependencies, the
      orchestrator running ready tasks side by side where they share no
      files, and the build reads the phase cut before treating "nothing
      ready" as finished, so a phase not yet written is never taken for a
      finished one.
  - **Shared design is settled first.** A design question several tasks
    touch is settled when the tasks are written, never by two builders
    separately.
  - **Claude schedules**: order, parallel worktrees, subagents, merging
    back. The engine has no scheduler; the task-loop display shows
    progress rather than driving each step. What cannot run concurrently
    in a project (tests sharing a port or a database) is recorded in its
    environment setup so no build relearns it.
  - **No prescribed red-green loop.** Tests are written from the
    acceptance criteria in any order; their adequacy is checked by outcome
    (R33). Code quality is held by boundaries — where things live and
    belong — through the project's rules and hard checks (R34).
  - **The builder's calls go to the ledger.** A question the ask rule
    sends the person is raised through an engine gate when it arises,
    mid-phase or at its end, while other tasks run on; the person answers
    when they visit the session and the build carries on.
  - **No code change without a task**, ruled by the person 2026-10-16.
    When something outside the plan
    turns up — a bug the person reports, a gap the builder finds — Claude
    judges where it goes and it lands through a verb, one per door: a task
    in this phase or a later one, a note for later, a ledger entry (a
    call, or a question for the person through the ask rule — the spec
    is never corrected, R14), a message to another topic, the inbox, the
    roadmap. An
    agent writing a task reports a find outside its task and Claude lands
    it; today such a find has no route at all. Today the doors are mostly
    prose plus direct manifest writes and agents (only the topic send and
    the roadmap add are verbs). Fixing it off the books is impossible: the
    commit door refuses a code commit that names no task. Today it confines
    paths and checks no task, and about 76 code commits since it landed
    belonged to none because the prose prescribed them (comment
    corrections, the checkpoint before analysis); comment corrections fold
    into the task in flight, and a raw `git commit` during a build is
    refused by the hook (R35).
  - **Notes for later** are today's banking, kept as it works today, ruled
    by the person 2026-10-15 ("the banking system still has value"; "the
    banking system seems to work relatively well at the moment"). A note
    is deposited as it arrives; at the phase's end today's consolidation agent reads
    every note against the phase's finished code, analyses, groups and
    de-duplicates them, and drops what the code already settled, with its
    reason; the rest become tasks in the same phase, built through the
    same loop. In the person's words: "those get picked up, analysed,
    synthesised, de-duplicated, and cleaned up before being then broken up
    into tasks at the end of the phase, and then implemented with the same
    loop."
  - **One independent phase review** closes each phase: each task's
    criteria, the phase's coherence, what should be consolidated, and
    where the phase meets what it relies on from earlier phases, which
    the phase cut names (R14) — so a fault between phases is found as the
    next phase closes, before more is built on it, not at the end. Ruled
    by the person 2026-10-16 (the person, 2026-10-14: "if you review often
    and small, it's quicker, cheaper, and you catch issues quicker"). Its
    fixes land before the phase closes.
  - **What the person sees during the build**, agreed 2026-10-12. The
    person's aim: wide collaboration early in the cone, fewer touches as
    the work moves on, and a build that runs start to finish unattended,
    stopping only where the shape says it must — a stop for good reason is
    a good outcome, not a failure. Engine-drawn, whatever order Claude
    works in:
    - **the story stays in the transcript**, ruled by the person
      2026-10-16: a headline as work starts — a task's title, number,
      phase, what it is about to change and what to watch when it lands
      — with one block for tasks started together, never one each; and
      when a task lands, its product summary: what changed, which
      criteria its tests prove, the pair's verdict and its rounds, how
      many calls went to the ledger. The review reports are not printed:
      they go to the implementer, the orchestrator keeps the verdict, and
      the person reaches them through the task's account. Whether a gate
      follows is the phase's position (R40): every task in step, in auto
      only where the ask rule stops it. The person, 2026-10-12, of
      today's headline: "I can see this is the task title, the task
      number, and a summary of what's being worked on"; of parallel
      work: "five printouts… I would have to scroll back up to see
      what's being worked on";
    - **questions queue.** A task that needs the person parks, with
      whatever depends on it, and everything else carries on. Claude says
      so in one line in the transcript, and the question waits in a queue
      the engine holds, on the build panel until it is answered. The
      person may take one up whenever they like: a press on the panel
      puts it in the prompt box, and sending it has Claude raise it in
      full, product first, while the other tasks carry on. Otherwise
      questions are drawn one at a time when nothing left can proceed
      without an answer or a phase ends, and the build never concludes
      over one. They stay inside the build, in every work type that
      builds, ruled by the person 2026-10-19: "we shouldn't really ever
      get back to the Epic menu once build has started." An open question
      would stall the whole build; a parked task stalls only what depends
      on it;
    - **any task's account on demand**, the person 2026-10-15: from the
      mod menu at any time, for any task however long ago, its
      description, a technical account Claude writes, and diagrams; in
      step they stay on each task's gate, as today. It ships in the
      release, ruled by the person 2026-10-19;
    - when nothing can proceed, the build stops with a report: what was
      built, what waits on the person and why, what runs after the answer.
      Danger and the authority gates stop what depends on them in every
      position.

    The live progress (each task building, landed, parked; the questions
    waiting on the person; phases not yet written) shows on a build panel
    drawn by the mod, since the transcript cannot redraw it. It ships in
    the release, ruled by the person 2026-10-19. The panel is an
    addition: the build reaches the person in full without it, ruled by
    the person 2026-10-19 ("you don't have to open the mod panel to get
    the benefit of the workflows"). **It is spiked with the person before
    the release's specification is written** (ruled 2026-10-19): it is
    the one new screen, every new screen or variant is drawn in the
    specification (R17). The locked panel is drawn in the specification.
    The spike measured that two mods' panes share Claude Code's tab row,
    one tab each (2026-10-19, Claude Code 2.1.303). The other phases'
    panels follow straight after the release, discussed and spiked then
    (the workflows board, Open).

### Review

- **R16 — Review layers go from five to three.** A review after each task,
  the phase review (R15), and a final review: the whole change-set against
  the spec's intent by independent agents, with the ledger read as a whole
  for calls that looked fine one phase at a time and are wrong in
  combination. Each finds serious bugs the others miss (Switchboard's
  measured build); who reviews, how a finding is called and what each kind
  sets off are in Reviews in the build (Open). Switchboard is the evidence
  against open-ended rounds: a reviewer reading code returns a full list
  every time, and the bugs that mattered were found by running the
  product. Changed code is read again until the pair passes it (the task
  loop, Reviews in the build); extra assurance otherwise goes into verification
  (strand C) and, for slices where a subtle bug passes the tests (time,
  concurrency), tests aimed at that risk.

  Walked on 2026-10-12. Today's five layers are the per-task reviewer, the
  phase consolidation finder, the analysis loop's three agents until all
  come back clean, review's per-task verifiers and its per-section
  change-set verifiers; a failed review loops back through the build.
  Portal's kill-all bugfix wrote 69k words of review; session resurrection
  passed after 8 analysis cycles and needed 10 bugfixes in the next five
  weeks. The defects that mattered came from the per-task reviewer
  (concurrency, data loss) and from verifiers that ran the program; most
  of what escaped in Portal were runtime faults no review ran. The new
  shape:
  - The final review runs the product wherever the project has a way to;
    what could not be run is reported not proven (R32). A bugfix's test is
    run on the unfixed code and must fail.
  - **The final review is split by the spec's areas**, ruled by the person
    2026-10-16, for an epic and every other type alike. The spec is
    written by area (R14), so each area is a ready slice; each gets the
    pair every review gets, reading its area and where it meets the
    others, and running what touches it. The number of areas follows the
    spec; today's merge down to four sections goes. Today's test-surface
    agent stays (the person, 2026-10-19): one reader over all the change's
    test files, held against everything the spec asks them to guard.
    Switchboard's release review ran the same way over four areas
    and found 9 serious bugs more than 75 PR reviews had missed: a
    session's model named two ways across views, a cap dated from another
    window's event where two subsystems meet, views cut off at 80×24. An
    epic too big for one build is split on the roadmap into versions,
    each with its own review phase (R14). Seams between phases are read
    earlier, by each phase review (R15).
  - **Every finding lands somewhere.** Below the floor: dropped. Above it
    and in scope: fix tasks, written as one more build phase and built in
    the same loop as everything else, the task loop reviewing each. Then
    every area whose code the fix tasks changed is read again whole by
    its pair, until a round passes; an area nothing changed is not read
    again. Ruled by the person 2026-10-16, following the task loop ("if
    the code's been changed, then it needs to be re-reviewed"), in place
    of the whole change read against the spec once more, which at an
    epic's size rereads everything for a fix in one corner. The small
    fixes the review phase makes on the spot today become tasks too, since
    no code changes outside a task. Ruled by the person 2026-10-14. Out of
    scope: Claude drops
    what is not worth doing, groups related findings into one item, and
    files the rest to the inbox through a verb, with no keep-or-drop offer.
    The report lists what was filed; a drop is not raised or listed (the
    person, 2026-10-14: "If they're not worth going in the inbox, and
    they're not worth fixing now, then they're not worth raising"). Each
    file-or-drop call is recorded in the ledger as a call Claude made, with
    its reason, and counted in the report's line of calls decided for the
    person, so any drop is one engine call away. Ruled by the
    person 2026-10-14, on the condition that the inbox is never flooded:
    the earliest workflows filed hundreds of items. Of the 42 review
    findings filed to the inbox so far, 12 became work and 17 were
    archived later.
  - **The report is short and product first**, ruled by the person
    2026-10-14: what the person can now do that they could not, what was
    proven by running it and what was not, what was fixed, what went to
    the inbox, and one line counting the calls
    decided for the person, by kind. The detailed checks are written to a
    file, not shown. The report that closes a passing review phase covers
    the whole topic — every round, broken up by round, and every call made
    for the person across the topic, with the last build's share — and
    stands as the certificate of the work. The person asks to see the
    calls and gets them grouped by kind, the ones that change what the
    product does first. Then finish, the authority gate, which asks a
    verdict on each call the person changed in the build and the review
    phase (R23), and invites questions about what was built and answers
    them before finishing. 8
    of the person's 21 answers at today's review gate were typed, mostly
    asking what a finding meant or cost ("Can I now just safely reboot my
    computer…").
  - **The build runs straight into the review phase**, ruled by the person
    2026-10-14, in an epic too: implementation's conclude gate and the
    return to the epic menu between them go. A failing review's fix tasks
    and the rerun go on without stopping; the finish gate is the stop, and
    the epic menu follows it.
  - The task gate, the fix gate and task approval become learned (R40):
    auto was taken 42 of 49 and 40 of 44 times where offered.

### The tracking layer

- **R17 — Work tracking stays and strengthens.** The start menu, inbox,
  roadmap (which now holds every kind of work, the backlog being one of
  its horizons, with the inbox triaged onto it), work types, work units
  and the epic menu are the ledger of the person's work across sessions —
  state a model cannot hold and memory does not replace. Picking up,
  taking on and filing work into its place keep getting stronger. The
  epic menu simplifies as phase gating thins: most of its states (waits,
  holds, entry gates, staleness flags) exist to police phase order, and it
  has grown since (grouping, naming a new topic, back), so it has more to
  shed.

  Walked on 2026-10-12. Of the 76 things the menu can show, 30 police phase
  order and 19 of those go; Fumi's menu is 16 rows, the person took the
  recommended row 75% of the time, and grouping (offered 72 times), resume
  completed (72), the new-topic doors (82) and reactivate (37) were never
  picked. The menu becomes:
  - **What waits on the person first** — an authority gate (start this work, approve the
    map, decided, ready to build, finish), a builder's question raised mid-phase,
    verdicts waiting (R23) — each with its door.
  - **The phase heads the screen**, ruled by the person 2026-10-15, in
    their words: "decision phase, everything gets done. We don't move out
    of that phase until everything's finished. There is no menu for spec,
    for example, until everything's done."
  - **Topics by what they need:** in progress, decided, in session, mail
    waiting, experiments waiting. No count of a topic's questions (the
    person, 2026-10-14: "I think it's noise. I don't care."). Starting a topic is "Start", with no
    routing (R10). Once every topic is decided the menu offers the spec,
    then shows the build's phase N of M, then the review, in place of the
    plan rows; no spec or ready-to-build row shows while any topic is
    undecided.
  - The recommended row first, in the foundations-first order (R41); a
    topic in session elsewhere stays struck, so several open at once.
  - **Changing the map is discovery's**, ruled by the person 2026-10-15: a
    new topic, cancelling, postponing to the roadmap, pulling forward,
    reactivating and reopening a decided topic all go through the
    discovery row, which says what it is for. One door per kind of unit:
    an epic's go through discovery; a feature, bugfix or quick-fix has no
    menu of its own, so reopening its decision goes through manage on the
    start menu (R19). The menu keeps the topics' rows, discovery and back. Never picked from Fumi's menus: the
    new-topic doors (offered 82 times), grouping (72), resume completed
    (72), reactivate (37).
  - Gone: everything that kept research apart from discussion, everything
    about planning, and grouping (one spec per work unit, Open: the epic
    as a whole); the soft gates that remain become learned; the merged
    phase named discussion throughout. Cancelling a topic moves its waiting mail to the inbox
    (three of Fumi's four cancelled topics show "Cancelled · mail
    waiting"); "dead end" goes — a topic that ends in not doing it is
    decided with that as its decision, or cancelled.
  - **Every screen follows the existing design system**, ruled by the
    person 2026-10-19: "I don't really have any desire to redesign the
    screens. I like how they look at the moment." New screens and edits to
    existing ones keep to its standards, the tree included; most screens
    are engine-drawn, so most of the release's screens fall out of it.
    Edits and variants that fit are fine — "it needs to be consistent" —
    and every variant or change is drawn in the spec, so the person sees
    it before it is built. A new look, if one is ever wanted, is made
    across the whole product as its own release, never part of this one.
    The gate mod shows the rows as buttons, so the screen above them stays
    a printed message the engine draws.
  - **A specification waits until every topic is decided**, ruled by the
    person 2026-10-12. Grouping reads the records: groups drawn from half
    of them come out differently once the rest are decided, and a topic
    decided after its spec can change the spec's nature. Today the engine
    refuses new spec structure only while a discussion is in progress (a
    hard block since 2026-08-11, a warning before), so unstarted topics do
    not block it; the rule tightens to every topic decided, cancelled or
    postponed, and postponing a topic to the roadmap is how an epic moves
    on without it. Rejected: grouping a decided subset early — Fumi's
    decided topics were reopened up to 10 times by later ones.
  - **The start menu**, ruled by the person 2026-10-16 after a before and
    after drawn over Portal's real records. It lists work units; the
    person steps into one before picking anything in it. Each unit's row
    shows its type, phase and progress ("discussion, 1 of 4 topics
    decided"; "build, phase 2 of 3"), never its topics, and marks what
    waits on the person in it as a count ("1 question waiting for you"),
    those units first; inside, the unit's own menu lists what waits first.
    No separate waiting section and no row that jumps past the unit,
    which the person rejected: with several things waiting it repeats
    each unit's menu. Continue rows name the type first: "Continue epic:
    Tagging And Filtering", "Continue bugfix: …". One Start row, discovery
    finding the type as the person talks; the five start-by-type rows go.
    The inbox is one line with its count by kind, in place of a row per
    item (30 in Portal). Roadmap, completed and cancelled units, manage and
    help stay. The verdict queue (R23), which spans units, is a project
    row beside the inbox and roadmap, shown only while verdicts wait.
    From 144 answers across 7 projects: 82% continued a unit; start 5 of
    143, each type row 0 of 143; inbox 13 of 60, roadmap 2 of 26;
    completed 0 of 53, help 0 of 24, manage 1 of 138. The person,
    2026-10-13: "I can just start the workflow and use the 'start' option
    that takes me straight into just talking".
  - **The inbox stays true**, ruled by the person 2026-10-16:
    - **A capture commits its own file**: each capture skill ends with one
      fixed engine line that takes the item's text, writes it into the
      inbox wherever the state lives, commits under the lock and pushes
      (the person, 2026-10-16: "if we can do that as a one-liner so that
      Claude has no knowledge, then fine"). The capture skills stay
      self-contained and know nothing of the engine: a capture is often
      made from a session in another project ("let's log that as a bug"
      about Mint while working in Switchboard), and the person will not
      have engine knowledge poison a context that only logs and moves on.
      It works from any checkout or worktree, and every state commit is
      the engine's (R23). Today captures are never
      committed by the skill; the person asked for them committed three
      times (Portal 2026-08-16 and 2026-10-05, Mint 2026-07-20).
    - **Finished work closes the inbox items it resolved**: when a unit
      finishes, Claude checks the inbox against what was built and
      archives each item the work resolved through a verb recording the
      unit that did it; the finish report lists every closure, so nothing
      is silently discarded (the person, 2026-09-16) and a wrong closure
      can be reopened. The same verb closes an item fixed straight away
      ("lets just do the fix now and remove inbox item", Portal
      2026-10-01). Today 49 items wait, 12 of Portal's over 90 days; the
      person's triage visits were checks for work already done, and 11
      items were deleted by hand inside fix commits.
  - **Triage**, ruled by the person 2026-10-16. The inbox is where items
    live; triage is the act, and the start menu's row is "t/triage →
    Triage the inbox". The word is free since messages between topics
    became mail (R13), and its last use for mail goes ("triage waiting"
    on today's epic rows becomes mail waiting); the glossary says so. The
    list shows items by kind, each with its age. When the person picks
    items, Claude names others that fit with them, and the person adjusts
    the set with c change (below) — today's add, drop and view rows
    were never pressed, and the person asked in words whether others fit
    (Portal 2026-10-01, agntc 2026-10-05). Three outcomes and back, keyed by
    their words: w work them now, as one unit through discovery; r put
    them on the roadmap, on a horizon the person has named, bugs and
    quick-fixes included — Claude never names a horizon (Fumi's
    "after-launch" renamed back to "next"); a archive them; b back. The
    person, 2026-10-09: "Those items then get triaged. Either they get
    archived … or they get put on the roadmap", and "I could group a
    couple of bugs and roll straight into work with them."
  - **The roadmap**, ruled by the person 2026-10-16, who holds it the way
    forward though little used yet (14 items in 4 projects, all parked;
    never a pull, a move from the inbox, a harvest or a product
    session):
    - **Roadmapping is one step from anywhere**: "roadmap it" puts the
      item on a horizon and reports it in one line, without opening the
      roadmap (Folio 2026-09-21: "I told you to roadmap it … without
      invoking the whole ceremony"). The horizon is always the person's:
      named in their words, or asked — even when only one horizon exists,
      since the one there may be the backlog when the person wants the
      item next, in a horizon they would name. Claude never names one.
    - **Starting work from the roadmap goes through discovery**, as Start
      and triage's work do, the picked items its seeds; discovery finds
      the type, any type, quick-fixes included (the person, 2026-10-09:
      "You can pull through multiple quick fixes"), replacing R10's "the
      pull makes an epic or a feature" and today's pull, which creates the
      unit itself and skips the opener. An item can also join an epic in
      progress as a new topic, through that epic's discovery (R17's map
      changes), answering the person's "Do I need an existing epic to do
      that" (Portal 2026-09-17).
    - **The home shows each item on one line** with its kind and where it
      came from; its summary shows when picked or asked for.
    - **Its menu is explicit rows**, ruled by the person 2026-10-16: w
      work, n new (Claude asks what and which horizon), m move, a
      archive, p plan the product (discovery at the product level, R10:
      the one row that is a conversation, named for what it does), h
      help, b back. Today's "converse" row went: with the gate mod every
      row is a button, and a button that only says "talk" still leaves
      the person to say what they meant.
  - **Menus are explicit and keyed alike**, ruled by the person
    2026-10-16, for consistency across the workflows' output: anything
    with a fixed shape is its own row, and typing stays open at any menu
    for a question. The same action keeps the same key on every menu (a
    archive, w work, b back). Triage gains c change (which items the set
    holds; Claude asks which), so its menu is w work, r roadmap, a
    archive, c change, h help, b back.
  - **Every menu screen has h help**, the person's addition 2026-10-16:
    a few lines on what this screen is for and what each row does — what
    discovery, the roadmap or triage is, where the screen needs it — then
    an invitation to ask about anything else. Help is always one press
    away rather than something the person has to know they can ask for.
    The start menu's help opens the same, with the full walkthrough
    reached from it.

### Work types

- **R18 — Epic.** discovery → discussion → specification → implementation
  → review.
- **R19 — Feature.** Its own type — linear, with the simpler menus — and
  in discussion an epic with one topic: its decision can be the view and
  one answer (R11). Discovery leans one topic (R10); pivot and absorb
  stay.
  - **"Continue feature: X" goes straight to where it stands**, ruled by
    the person 2026-10-16: into its current phase, or onto what waits on
    the person there, with no menu between; the same for bugfix and
    quick-fix. Today's in-between menu ("Proceed to {phase}" or "Revisit
    an earlier phase") was "Proceed" 20 of 20 for features and 11 of 11
    for bugfixes; revisit was never picked. Revisiting moves to manage on
    the start menu beside pivot, absorb and cancel; in the new shape it
    is mostly reopening the decision, and a later change to a decision
    replaces its entry on the ledger (R23). A feature stops for the
    person at start this work, decided and ready to build (one screen,
    R14), finish, and what the ask rule sends.
- **R20 — Bugfix.** discovery → investigation → specification →
  implementation → review. Investigation's rigour stays — symptoms, code
  analysis, root cause before fix — with its procedure loosened like every
  phase's. Investigation is the log of finding the cause, dead ends
  included; the specification is what the builder works from, and the
  root cause, findings and fix are ledger entries the knowledge base
  reaches through the records. The fix's test fails on the
  unfixed code. A root cause that is really a design problem raises, and
  may become a feature; a bug folded into a feature skips investigation,
  as the mailbox rework ruled. Investigation is the log; its record is
  drawn from its entries, as for any topic.

  Walked on 2026-10-12 on Portal's `killing-all-sessions-wipes-restore-state`.
  The person likes today's bugfix — prove the bug, investigate, document —
  and every product correction they made on the case landed in discovery
  or investigation, while specification and planning drew 14 presses and
  nothing typed and restated the fix twice (6.6k and 14.9k words, plus
  10.7k of spec review tracking). Ruled by the person:
  - **Both validations always run, and Claude acts on what they find,**
    recording it in the investigation. The root-cause validation runs
    at extra-high, fixed in its definition (R46). The address-or-dismiss gates after
    them go: answered 16 times, never dismissed, and the person did not
    know what "address" meant. A finding that changes what the fix does
    for the person reaches them as a product question; the case's
    kill-versus-detach ruling came from one.
  - **Earlier fixes are part of the analysis.** Claude checks whether the
    area was fixed before and whether the cause sits in the design, as it
    reads the code; nothing is shown to the person and nothing is counted.
    When the cause sits in the design or the area keeps breaking, the
    fix-direction question gains one option: rework the area as a feature.
    Portal's restore and resume work is the evidence: 16 units since
    March, the case touching files changed by 13 of them, the hook key
    re-keyed three times, "an empty read is the truth" fixed one call site
    at a time in April, May and October — and every investigation that
    named the premise stayed a bugfix.

  - **Before setting out fix options, Claude steps back from the bug**,
    ruled by the person 2026-10-16, with the same stance as a failed
    review in the build (Reviews in the build): is the bug there because
    the implementation was wrong, or was it right and an edge case has
    turned up; is there another way to do it, a different abstraction or
    mechanism, that higher-level thinking reveals. The options show what
    that found. It replaces a proposed step of finding out how comparable
    tools handle the problem, which the person rejected as specific to
    one case: the workflows handle any work, so the rule is the general
    one (R2), and looking at other tools is one way Claude may reach for
    it. On Portal's kill-all case the person asked "How do the other tmux
    plugins which save state handle this?" because they sensed there had
    to be another mechanism; the direction chosen after it combined the
    first two options.

  - **A bugfix's spec is the spec every type writes (R14)**, ruled by the
    person 2026-10-16: assembled from the investigation's entries — the
    root cause, the fix, the existing rules it keeps with their checks —
    ending with the phase cut; its review hunts gaps and reads again only
    what changed, usually one pass at this size; ready to build shows a
    short outline and the cut. No rule of its own. On the case,
    specification and planning drew 14 presses with nothing typed and
    restated the fix in a 6.6k-word spec and a 14.9k-word plan, plus
    10.7k words of review tracking.

  - **The bug is proven before it is fixed, by a check**, ruled by the
    person 2026-10-16: the first task writes the test that reproduces the
    bug, and the engine records it run on the unfixed code, several
    times, failing every time; the commit door refuses a fix commit until
    that run is recorded; after the fix the same test passes in the
    build's own gates. Today it is guidance ("the first task always
    reproduces the bug with a failing test"), and on the case the
    reproducing test was task 8 of phase 1, and only the final review
    checked it against the old code, where it failed in 1 of 11 trials.
    Specific to bugfix because proving the bug is what the type is.

  - **Investigation's plan, check-in and conclude gates follow the
    phase's position (R40)**, ruled by the person 2026-10-16: learned in
    auto, stopping in step; ready to build stays the authority gate
    before any code. Across the person's bugfixes: the plan gate
    "proceed" 5 of 6, check-ins "continue" 5 of 6, conclude 7 of 7. The
    one typed plan answer was a constraint ("you must not use the
    current tmux server at all for testing. Its massively in use!!"):
    testing against a live server is danger, which stops in both
    positions, and the per-project verify setup (R32) holds how to run
    the product safely, given once.

  The ask rule asked the case's kill-versus-detach
  question because forgetting killed sessions deletes saved scrollback,
  which is danger; as behaviour alone it would have been Claude's call on
  the person's record (1 real loss in 69), and the person's verdict on
  that overrule was a later fix, not a real loss.
- **R21 — Quick-fix.** Quick must be quick: one session from "what's the
  change?" to closed, with no handoffs; the clean-context handoff stays
  for the heavy phases. Every way in — the start menu, the inbox (one item
  or a set), the roadmap — lands on the same short opener; today a roadmap
  pull skips it and goes straight to scoping. Claude does the work, runs
  the tests and linters, and commits; its calls go to the ledger, and a
  question the ask rule sends the person is raised as anywhere else. A
  quick-fix is its own task, so the commit door takes it without a plan.
  - **No document before the work and no plan. A short record after it**
    — what changed, why, what it leaves out — which the knowledge base
    indexes. Quick-fix specs were read later (named in nine later
    investigations, specs, discussions and reviews; one gained a
    corrigendum to what it left out); the plans never were.
  - **No review step.** A change to behaviour is proven by running the
    product where the project has a way to, and the close says what was
    proven and asks a verdict on each call the person changed (R23); the
    person can ask for a review. Reviewing whenever behaviour
    changed would have reviewed about 11 of 20; the person chose review on
    2, and neither found anything that had to change.
  - Work that needs a decision from the person beyond a quick call moves to
    feature or bugfix through a verb; today that is a line of prose with
    no route. The size check before the work goes: it never stopped one,
    though about half changed behaviour and two made a design call inside
    scoping.
  - A set from the inbox runs in one sitting as one unit (triage's w,
    ruled by the person 2026-10-16, later than this walk), each fix
    keeping its own commit and short record. It stays a tracked work unit on the start menu
    that closes.

  Walked and ruled by the person on 2026-10-12, replacing the earlier "no
  document" and "review only if behaviour changed". Evidence: 20
  quick-fixes (Portal 16, Tick 3, Mint 1), none since July; median change
  100 lines; the two with surviving sessions took about 3h20m each over
  three sessions and two handoffs, more than an hour of each build session
  spent waiting at gates that always got the same answer.
- **R22 — Cross-cutting goes as a type**, ruled by the person 2026-10-16.
  Its point was a terminal spec later work reads; the product record
  (R10) now does that job — product-wide ledger entries every opening
  view reads — and a spec is the build's working document (R14), which a
  unit with no build never needs. The person never started one: agntc's
  one cross-cutting unit (naming-and-identity, a 163-word spec of the
  name and its forms, cited by three later plans) came from an epic's
  spec grouping promoting a topic, and grouping goes (R14). A principle
  is decided where it arises and marked product-wide; one the person
  wants to talk through on purpose is a product-level conversation,
  reached through Start, where discovery meets it at the level it
  reaches, or the roadmap's plan the product (R17; the person,
  2026-10-16: "or we go into discovery, or, as I said, in the product
  roadmap, we can talk about something that's product-wide"), logged per
  session like discovery
  and the roadmap. It is discovery, so it decides nothing (the person,
  2026-10-19): its principles are carried as input and decided in the
  first topic each bears on, as product-wide entries (R10) — a folder for
  such conversations can be added if it is ever wanted. A
  design system or similar convention more often belongs in a project
  skill or CLAUDE.md, which the workflow sessions pull in anyway (the
  person). Existing cross-cutting units migrate: their specs become
  product-wide entries (R37).

## Strand B — trust

Whether Claude asks is arithmetic the engine computes over the person's
own answers; Claude supplies the question and its lean, not the decision
("make as much of that mathematical as we can. It shouldn't be Claude
deciding", the person, 2026-10-12). Designed on 2026-10-12 from the
person's history and their verdicts on it (R29); the person approved
each call on a page that day.

- **R23 — The ledger and the verdict queue.** Designed with the person
  2026-10-13. The ledger is the history of every decision and finding,
  by either side, in the project: who made it, what the other side would
  have said (Claude's sealed answer beside the person's; Claude's
  alternatives and evidence beside its own call), who moved whom, the
  kind of question, and what happened to it later. It never feeds the
  work directly — the records drawn from it do (R11). Its jobs: answer
  "what have you decided without me?" as one engine query, with nothing
  for Claude to collect (the map's "since you last looked" is the same
  query); give the matrix its evidence (R25); and keep both sides'
  mistakes to learn from later, the person's included.
  - **One ledger for the project**, ruled 2026-10-13 and ratified by the
    person 2026-10-14 after weighing one per work unit (which would need
    a second, project-level ledger and a judgement over what is copied up
    to it): each entry identified by a nanoid and shown by a short form
    of it, the way git shows a short hash — sequential numbers collide
    wherever two writers append (ruled by the person 2026-10-18) — and
    tagged with its work unit, topic, phase and session. A unit's ledger is its tagged
    entries, written only by its own sessions; a later unit reads earlier
    decisions directly. The build's calls are entries too: they draw no
    record, and the same query shows them. The product record is the
    entries marked product-wide (R10).
  - **A later work unit replaces an older decision; it never records one
    beside it**, ruled by the person 2026-10-14 — two current answers
    that contradict each other are what no fold can see. Finding the
    older decision is a judgement, made as mechanical as it can be: every
    opening view reads the whole product record; a topic's opening view
    searches earlier units' current entries in its area through the
    knowledge base; the read for conflicts before the spec covers the
    whole project's current entries in the areas the work touches. The
    entries that relied on the replaced one — a finished unit's included
    — are flagged in the work that made the change, which confirms or
    changes each; the finished unit is never reopened. Size: nothing
    reads the whole stream; a saved copy of the current state is kept
    beside it only if reads slow, and the stream is never trimmed.
  - **The ledger is an event stream, and everything read from it is a
    projection**, agreed by the person 2026-10-14, tested on real slices
    of Fumi and Switchboard (`walks/ledger-test/`), and made a principle
    2026-10-15 (R45). Five kinds of event, each with its own schema:
    asked (a question goes on a topic's map), found
    (a fact and how it is known), decided (an answer to a question: who,
    why, what it rules out, what it relies on), replaced (a new answer,
    naming the old and one of the four reasons), still holds (a topic
    confirms an answer after something it relied on changed); a question
    can also be moved to another topic. Nothing is updated; every change
    is a new event. The links — which question an answer closes, what it
    replaces, what it relies on — are fields the engine assigns, never
    prose. The map, a topic's record and the product record are folds of
    the stream, worked out when read, with no saved projection in the
    work unit; an index comes only if reads slow. The knowledge base's
    copy is the one rendering kept, ruled by the person 2026-10-17: when
    a topic's entries change, the engine renders its record and the
    knowledge base indexes it, the copy living in the gitignored
    `.workflows/.knowledge/` and rebuilt from the ledger, so a replaced
    answer drops out of search the moment it is replaced. The ledger
    itself is never indexed: it holds replaced answers, which search
    would return as current. When an answer is replaced, every entry
    relying on it is affected, and that too is a fold — an entry relying
    on a replaced one with no "still holds" or replacement since — so the
    owning topic shows among what waits on the person until it answers,
    even when it was closed. The journey stays out of the ledger: a
    topic's log, one dated heading per session, free prose written as the
    conversation goes, enough for a fresh session to carry on alone, and
    pointing at entries by short id rather than restating them.
  - **What the test on real slices settled**, ruled by the person
    2026-10-14 (`walks/ledger-test/`: a coherent spec came out of the
    records alone — Fumi's slice covered 118 of 162 builder points and
    21 in part, 41 of its 64 guesses being gaps in Fumi's own documents;
    records and logs 35% of today's documents; the floor change flagged
    its one dependent twelve days before the real correction). The loss
    it found: an entry holding a whole answer is rewritten whole when
    one part changes, and what the rewrite leaves out leaves the record
    (Fumi's corner menu lost five details when its beak was removed; 23
    of the 32 points the records lost). Three layers answer it:
    - **The stream can never be edited, mechanically**, ruled by the
      person 2026-10-18: no verb edits an event; only the engine writes
      the file, by appending, and a hook refuses any other edit. The
      engine checks append-only on every read — the ledger on disk must
      start, byte for byte, with the ledger the state branch last
      committed, and anything changed, removed or reordered stops it
      with the line it found — and the same against the parent at every
      commit. Each append replaces the file whole under the lock, so a
      read never meets half a line. A fingerprint chain was dropped
      (2026-10-18): unsigned, it caught only the accidents this check
      catches, and every migration and merge would have had to
      recompute it.
    - **One thing per entry:** the engine refuses a decision that names
      no question; whether an entry holds one rule is judged when it is
      written by a separate Claude call, never the Claude writing it,
      and an entry holding several is split before it lands.
    - **The chain is shown, never merged:** a record shows each current
      answer with the answers it replaced folded beneath it; a
      replacement is written beside the old answer and names what it
      drops; the closing pass and the spec check each replacement
      against what it replaced.
    - **Every kind of entry links the same way:** a question, a finding
      and a decision can each name what it relies on and be replaced,
      always by a new event. A finding shown wrong is replaced with the
      reason "it was wrong", and a change flags the questions and
      findings that rely on it as well as the decisions — in the test
      Fumi's floor change missed a question framed on 14 and a finding
      restating it, the sentence behind the real 2 September error.
    - **A change names what caused it**, by short id — the other topic's
      decision, the new fact, the message — and **a review finding goes
      on the stream as a question the review asked**, so its answer is
      linked to it like any other: Switchboard's test had 6 of 14
      replacements citing another topic's decision with no way to name
      it, and Fumi's documents cite the review finding behind a change
      88 times, with no home in the test. Who moved whom was already on
      every entry; the test's simplified entries left it out.
    - **The chain beneath an answer** also shows a question moved away to
      another topic and any "still holds" confirmation, so every entry a
      log names can be found from a record (in the test 37 of 169 log
      references pointed at entries no record showed).
    - **Two current answers that contradict each other** are no fold's
      to see: the read for conflicts finds them, within a topic as well
      as across topics (Switchboard's two state orders sat in one topic).
    - **An answer that settles part of a question** puts the unsettled
      part on the map as its own question, linked to the first, so
      nothing open hides behind an answer.
    - Every event carries the time the engine wrote it.
    - **Where an entry's text and the design it points at disagree**, one
      standing rule: what exists and how it behaves, the record wins and
      the design is out of date; how it looks, the design wins, because
      it was drawn. Both projects had written their own (Switchboard:
      "the frames hold"; Fumi: "the record decides; a board
      demonstrates").
  - **A decision is one entry**, ruled by the person 2026-10-14: the same
    decision reached from another topic is that entry, never a second; a
    duplicate that gives the same answer is merged where it is found,
    leaving the owner's entry as it stands. Every session
    can read every entry, by unit, topic or area and current entries
    only; nothing reads the whole stream. A topic's record shows other topics' current
    answers rather than restating them, so a change leaves no stale copy
    to correct — in Fumi 30 of 157 messages did nothing but correct one,
    and 7 of 41 reopens carried nothing else. Every change to a decision
    another topic owns goes to the owner through the mailbox, and the
    owner's session writes the replacing entry (stated 2026-10-14 in
    answer to the person's question, "does that go back to the
    originating topic that made the original decision?"), so a decision
    is only ever changed through the lens of the topic that owns it.
  - **Superseding appends:** a new entry names the one it supersedes and
    why — a new fact, another topic's decision, a changed mind, or the
    earlier one was wrong; the last applies to the person's decisions as
    to Claude's. The superseded entry folds beneath the current one in the
    record (the chain, above) and stays in the ledger.
  - **Stored as JSON lines in the project**, in `.workflows/.ledger.jsonl`
    under git (Layout on disk): one line per event, appended, each
    carrying its schema version. Ruled by the person 2026-10-18: a field
    a later release adds is optional in the schema with a stated default,
    so older lines are already valid lines of the current shape and need
    nothing. A real break — a rename, a split, a change of meaning — is a
    migration writing a converted copy of the whole stream, event
    sourcing's copy-and-transform rather than upcasting on every read:
    one reviewed migration with its tests, its check refusing unless
    every event comes through, same ids in the same order; the one commit
    the append-only check lets differ; git keeps the original file byte
    for byte. Projections read one shape only (Migrations: runtime code
    never reads an older shape). A database was weighed and rejected: a database file
    neither diffs nor merges in git, one outside git loses the history,
    and the volume is small (Fumi's 13 topics come to hundreds of
    entries); an index rebuilt from the lines is added only if queries
    slow.
  - **The workflows' state lives on a branch of its own**, ruled by the
    person 2026-10-18 and confirmed the same day once its consequences
    were laid out ("I can't think of an alternative that gives us
    everything we need… it feels a little grubby. But I think it works
    and I think it holds up"), once pull requests and stacks running side by side
    (R35) left state no single code branch to ride on.
    - `.workflows/` is a worktree of an orphan branch, checked out inside
      the main checkout and ignored by code branches. Code branches and
      pull requests never carry state, and GitHub never merges it. Every
      session, whichever worktree it runs in, writes that one copy, found
      through the common git directory; nothing ever creates a
      `.workflows/` inside a code worktree. The engine serialises writes
      with a lock held for each verb, never a daemon, so the stream stays
      one line of appends on one linear branch that nothing merges into. The tracker's driver keeps the tracker's state there too.
    - The engine pushes the state branch after every commit wherever the
      project has a remote, a failed push a warning, never a stop (the
      person, 2026-10-18: today the workflows never push, which is risky).
    - **The branch is protected**, ruled by the person 2026-10-18 after
      they asked what stops an inadvertent delete or an agent cleaning
      up. Git refuses to delete a branch a worktree has checked out, and
      a locked worktree survives `git worktree remove --force` and a
      prune after its folder is deleted (tested on git 2.56; only
      `remove -f -f` or an unlock gets through). So: the engine locks
      the worktree when it creates it ("workflows state, do not
      remove"); the hook before Bash refuses unlocking or removing
      `.workflows/`, deleting the state branch locally or on the remote,
      and force-pushing it; boot checks the worktree and the branch every
      time, restores a lost local branch from the remote, and stops
      saying so when both are gone; and on GitHub setup offers, on the
      person's yes, a rule against deleting or force-pushing the branch,
      for anything run outside Claude Code. Without a remote the lock and
      the hook are the protection.
    - A second clone, on another machine, diverges only on the state
      branch, and the engine merges it, never git: fetch, union by id,
      append this clone's unpushed entries after the remote's, in a commit
      whose parent is the remote's tip, so the append-only check holds
      and nothing pushed is ever rewritten, push with
      lease, and retry if the remote moved. No merge driver, so nothing
      to install per clone or to decay. A fact two clones could record
      independently — a migration applied, a phase concluded — takes an
      id derived from the fact, so both record the one entry; anything
      local to a machine stays off the branch.
    - Rejected: state on code branches made mergeable, since every shared
      file would need reshaping and any one missed surfaces as a conflict
      in the middle of a stack — GitHub's merge never runs a repository's
      merge drivers, `union` included; a hidden ref written by plumbing,
      since clones don't fetch it, mirrors delete it, some hosts refuse
      it, and agents read state as files; the engine writing in the main
      checkout on the default branch, which ties state to that checkout,
      needs a pull before every push and fails where the default branch
      is protected.
    - Beads ran this shape from November 2025 to February 2026, before
      moving to a database whose data rides in a hidden ref
      (`walks/ledger-branches/01-beads.md`). Its failures came from a
      second copy of state in the main tree, a daemon, git hooks firing
      inside the state worktree and per-clone merge-driver settings
      decaying, not from the separate branch; it too gave up sequential
      ids for concurrent writers within three weeks.
  - Written by engine commands only, never by hand. The person reads it
    when they choose; at a topic's decided screen they see a count of the
    calls made for them, by kind, and ask to see them if they want —
    never a list picked out as "worth a look", which reads as Claude
    doubting its own calls (the person, 2026-10-14). Every departure — an answer that amends or overrules
  Claude's lean — gets a verdict: what the product would have lost had
  Claude built its own answer, nothing, a fix later, or a real loss. The
  topic's decided screen asks it, one press each, for the calls the person
  changed in that topic, with skip beside them — ruled by the person
  2026-10-18, since a verdict left to a page they must open is a verdict
  not given ("I certainly won't be opening documents that aren't on the
  screen", 2026-10-07). The finish gate asks the same, before the
  person's finish yes, for the calls they changed in the build and the
  review phase, and a quick-fix's close for the calls changed in it —
  ruled by the person 2026-10-18; where they changed none, nothing is
  added. A skipped verdict waits in the verdict queue: a page like the one the
  person used for R29, answered when they choose. Until judged, a
  departure counts as a real loss, so a backlog only makes Claude ask
  more.
- **R24 — Whether to ask is computed.**
  - **One decision point, reached from everywhere Claude makes a call** —
    the person's ruling, 2026-10-13: casually in conversation, a review
    finding, the closing pass, a message, the build. Claude already makes
    calls by rule and by reasoning; the matrix joins that reasoning to the
    person's learned taste, and the work is weaving the touch points into
    the workflows so the decision point is there whenever a call comes
    up. The review lanes are the matrix's output: apply is what the record
    or a fact settles, decide is Claude's call, the walked lane is the
    person's question, route belongs elsewhere. The measure (R36): Fumi's
    commercialization background review on 2026-10-13 came back 15
    findings, 14 needing the person's call and 1 belonging elsewhere —
    "I really can't be bothered to work through all of those"; usually
    two or three are Claude's, ten or eleven the person's. Calls that
    match the person's reverse it — of ten, about one for the person — an
    indicator of the matrix working, never a target.
    - **The lanes measured** (2026-10-13, 46 reports with lanes from
      2026-08-12, 389 findings): 71% announced as needing a call, 13%
      apply, 9% decide, 7% route; half or more needed a call in 36 of the
      46. Of 226 raises the person took Claude's lean unchanged on 64% of
      first replies (106 in one word), 71% once their questions were
      answered; amended 12%, overruled 10% (8 of those pointing at a
      ruling already made), deferred 5% — about 1.3 to 1.7 findings in ten
      where their judgement changed anything. All 95 batch screens were
      approved unchanged. Opus 5.5 used decide for 22% against Opus 5's
      4%, but its reports grew (median 7 to 12 findings), so calls per
      report rose from 5 to 8. The calls come from the reviewer's
      tie-break ("When a finding could read either way, it is `ask`"),
      which is where the matrix plugs in; findings may only move toward
      the person, so the matrix needs a sanctioned way to move one away.
      Classifier-labelled, 82% coverage; the Opus 5.5 period is 9 reports.
      Folded into the restructure, ruled by the person 2026-10-14, with no
      fix to the shipped workflows: the tie-break gives way to the matrix;
      a finding a later decision has removed is dropped with a one-line
      note; a finding coming to the person is rechecked against answers
      given earlier in the same walk, and against the record — Claude's
      addition, since 8 overrules pointed at a ruling already made —
      before it is raised; a route names another topic, never a subtopic. A cap on
      findings per report was rejected: more findings is the point, and
      the measure is calls reaching the person.
  - **Facts are checked, intent is asked.** A question that reading the
    code, the record or running something can answer never reaches the
    person: Claude checks it. FlowX ranks the person last as a source of
    facts and first as a source of intent; poteto-mode prototypes instead
    of asking "which approach" when running something could answer it.
    Only questions of intent and taste enter the trust layer.
  - **Where there is more than one way and no obvious choice, Claude
    finds out before it leans** — the person's rule (2026-10-12), stated
    loosely on purpose. When each way has its pros, cons and risks and
    evidence can tell them apart, Claude spikes it, researches, reads or
    reverse-engineers the source, or looks at how open-source products do
    it, instead of guessing or asking. A disposable machine (a macOS image
    under Tart, say) or the person's own machine runs it; the person is
    not involved. The ledger records the evidence beside the call. It
    matters most where a wrong call means rebuilding inner machinery,
    even behind a contract. The Fumi replay's one call the person said
    would have been bad was of this kind (R29).
  - **Three parties.** Claude supplies the question and its own answer,
    sealed where the person cannot see it. The engine decides whether to
    ask, from counts derived from the log; the same inputs always give the same
    decision, and the session receives only that decision, never text from
    the log (the person, 2026-10-19: "I want it to be algorithmic. I want
    it to be numbers-based"). The person supplies answers, and each
    becomes evidence.
  - **The rule:** ask when the pessimistic rate of real loss for the
    question's kind exceeds the person's threshold.
    - **Real loss** — what the product would have lost had Claude built
      its own answer, from the person's verdict on each departure (R23).
      Only a real loss counts; a departure without a verdict yet, or one
      the person cannot call, counts as a loss until they do. Agreements
      count as no loss. This measures the cost of a wrong call per kind
      instead of setting it by feel: over 315 decided questions the
      person overruled Claude 12% of the time, and Claude's answer would
      have cost a real loss 3% (R29).
    - **Pessimistic** — per kind, per person, per project, per model: the
      upper end of a 95% range on the rate of real loss (a beta
      distribution over the counts of R25). Few answers leave the range
      wide, so the system keeps asking: with no loss, 13 answers bring it
      under 20%, 18 under 15%, 28 under 10%; one loss among 20 answers
      puts the bound at 21%.
    - **The threshold** — one number the person picks from a replay of
      their own history (R29): 20%, the person's pick. Set higher
      mid-build, where a question blocks work, once the build's own
      answers show by how much; until then the same. **Hard to undo** — a
      later change that would reach beyond the piece — halves it: a
      quarter of such departures were real losses, against a tenth of the
      rest, and in the replay the halving alone kept two real losses from
      going through.
    - **The person cares about it**, ruled by the person 2026-10-19: a
      care entry in the record of the person (R27) names one project and
      one kind ("Aircon: look"), and while it stands that kind always asks
      in that project, as danger does, however well Claude's calls have
      matched (visual design in Fumi: the person had a picture of it and
      wanted it their way). "I agree that the caring part should always
      ask, otherwise I think it has less value." A "don't care" answer
      settles that one question; if they keep coming, Claude proposes
      dropping the entry. The answers still count meanwhile, so dropping
      it leaves the counts knowing how Claude does on that kind. There is
      no every-project scope: what the person cares about depends on what
      the project is for ("I do care about different things in different
      projects").
    - **Going quiet and asking again sit apart**, ruled by the person
      2026-10-18: a kind goes quiet when its bound falls below the
      threshold, and asks again only once the bound rises a quarter above
      it — 25% at 20%, 12.5% where hard to undo. One bad call reopens a
      kind only while its evidence is thin: at 20%, a loss among fewer
      than 16 clean answers reopens it, and from 16 on it stays quiet;
      where hard to undo the line is 35. In the person's words: "one
      decision that doesn't match up with history shouldn't trigger a
      complete cascade in change, but we also shouldn't be waiting a year
      before things start to shift" (2026-10-18); "if decisions start
      proving wrong, we scale it back, and then it relearns again"
      (2026-10-13). Blind questions (R26) keep sampling a quiet kind.
    - **Danger always asks:** an option that could destroy, overwrite or
      expose the person's data or secrets, or weaken permissions or
      security. No count loosens it — 2 real losses in 28 decided, the
      highest rate of any kind. Data model and external contracts ask on
      evidence instead: a contract that would be hard to undo needs about
      28 answers without a loss, and in the replay the evidence alone kept
      94% of contract questions coming to the person. Fumi's tags were
      hard to reverse and, by the person's account, did not matter.
    - Worked, at 20%: behaviour goes quiet after 13 answers without a
      loss. A loss while it holds 13 to 15 clean answers puts it over 25%,
      and it asks again until 20 clean answers outweigh the loss; a loss
      after 16 or more leaves it quiet. A contract question that would be
      hard to undo needs the bound under 10%.
  - **The cone of collaboration narrows as the product takes shape**,
    not phase by phase — the person's framing, 2026-10-13: widest on a
    blank page, where the person drives and the framework goes in early,
    narrowing as each decided topic constrains the next, because the more
    of the product exists the fewer ways remain that make sense. Across
    an epic the first topics are the widest; across epics, a new epic's
    first topic starts narrower once the product's character is known
    (the product record, R10). The cone is never a key in the counts,
    which would split the evidence into cells too small to learn from,
    and nothing computes where in it the work is; it enters where the
    work does:
    - Discovery stays conversation: the person brings the idea, it is
      shaped together, and Claude never decides there alone.
    - In discussion, a topic's opening view (R11) carries it: the part
      earlier decisions settle grows with every topic decided, so the
      forks shrink on their own. Where research is still open the person
      is needed most — research questions departed 35% of the time
      (6 of 17), decision questions 17% (42 of 242).
    - Hard to undo halves the threshold (above), which tends to bite on
      early calls, the ones later work builds on.
    - Convergence hands a topic's remaining calls to Claude's settling,
      and mid-build the threshold rises (above).
  - **Convergence moves the work on.** After 8 agreements in a row in a
    topic, or on the person's word, Claude offers to settle the rest: how
    many points are open, how many it would settle, and which still come
    to the person by the rule ("12 open: I'd settle 9; 3 come to you — 2
    contracts, 1 look"). On yes, Claude settles them in the ledger, asks
    the rest one at a time in the conversation and brings the topic to its decided screen,
    where the person signs off with the ledger in view. Declined, it waits for
    the next run. The run only times the offer: after 5 agreements in a
    row in a session, the person's next answers departed 18% of the time,
    against 19% overall; after 8, 23%. Settling is safe because real loss
    is rare (3%) and the rule still sends the risky kinds to the person.
    A yes is stated intent, recorded in the trust log.
  - **A raise reaches the person product first**, drawn by an engine
    command paired with the written rule — never a prose rule alone;
    uptake follows design, not availability. It reads cold: what is being
    decided, Claude's lean, what the person would notice either way, and
    why it asks (the kind, or the rule's reason). The mechanism sits
    behind a toggle. "I don't follow" is a button, counted as no answer.
    Questions come one at a time, ruled by the person (2026-10-14: "drop
    things to me one at a time"; 2026-10-18: "the decision process isn't a
    conveyor belt of decisions"): in discussion each is slotted into the
    conversation at a natural pause; where several wait at once they come
    back to back, each answered before the next shows. The person could not follow
    31% of the questions about internals, 20% on danger and 16% on
    contracts — questions written in mechanism, as Switchboard's
    non-answers were; the verdict page (R29) used this shape.

  The vocabulary is the existing ask-or-decide reference's: it already
  asks for expensive-to-reverse calls; it gains "the person cares" as a
  reason to ask, the ledger as the durable landing for decided calls, and
  reach into the build, where the builder's block rules are separate
  today. Door type is one reason to ask, not the name of the split.
- **R25 — Kinds, evidence and the trust log.**
  - **Kinds of question** key every count. A labeller answers twelve
    narrow yes/no questions about the question Claude put, from Claude's
    words alone: is it about the session rather than the product; could
    Claude find the answer out; would a user see the difference; is it
    about how something looks; the words a user reads or types; the steps
    a user goes through; whether something is in the work at all; does
    other code or saved data come to rely on it; could an option lose
    data or weaken security; would a later change reach beyond the piece;
    would one option be a mistake on its merits; does answering need the
    code's insides. The engine composes the kind in code: process,
    danger, contract, scope; then, for what a user sees, look, words or
    behaviour; else internals. Every label stores all twelve answers, not
    only the composed kind, ruled by the person 2026-10-19 ("store the 12
    answers because it's good data"); splitting a kind along them is
    parked by the person to come back to. Two models agree on the composed kind
    85–89% of the time, against 50% picking from a list (R29); the steps
    a user goes through split them, so flow is part of behaviour. "Would
    a later change reach beyond the piece" also halves the threshold, and
    "could Claude find out" routes a question to checking (R24). The
    labeller is never the Claude that wants to proceed — a separate
    Claude call (R28) — since a self-labelled question can drift into
    a trusted kind. Gate answers are keyed by the gate's name. Claude's
    own stated confidence never gates: in REFLEX, wrong calls averaged
    0.78; in the Fumi replay right and wrong calls overlapped (R29).
  - **Evidence is weighted by what it proves:**
    - a blind question (R26) answered cold — full weight;
    - an answer to a recommendation the person was shown — full weight,
      ruled by the person 2026-10-18.
      A shown answer can steer agreement (shown 82%, blind 51%, R29), but
      the rule counts real loss, and the blind replay's misses cost the
      product one questionable call in 37, the same 3% as shown answers;
    - a later reversal — a full disagreement, recorded as a new event
      pointing back at the call it reverses and cancelling the earlier
      agreement; nothing is rewritten, so an "I agree" given in fatigue
      and overturned later counts as an overturn;
    - "didn't follow" — no weight, and a first-class answer: a yes to a
      question the person could not follow is not agreement.

    Two starting values, ruled as such by the person 2026-10-18, with no
    evidence yet — six weeks of one model — retuned by replay once the log holds it: an answer counts half once
    it is six months old, so a change of taste shows; a new model starts
    from its predecessor's counts at half weight and earns the rest. The
    procedure stays fixed across model generations; only the numbers
    move.
  - **The matrix is kept at two levels**, ruled by the person 2026-10-14:
    the project's and the person's, so a call can follow the project's
    taste where it differs from the person's overall; both are
    projections of decisions across work units, apart from the ledgers.
    They combine as the trust log's merge below: the person's counts the
    prior, the project's own answers moving it.
  - **The trust log** is append-only, at user level in the person's
    workflows config directory (which already holds the system config and
    each conversation's state), across all their projects, reached through
    the engine. Only the engine writes it; Claude cannot edit it or the
    settings. It holds what the matrix needs and no decision's content,
    which stays in the project's ledger (R23): the engine writes both in
    the same command. Events: each raise with Claude's sealed answer and
    the person's answer, by kind; each verdict on a departure; each gate answer by the
    gate's name with the option the engine recommended and the one picked
    (the gate mod already sees the click and the engine's payload already
    marks the recommended row, but nothing records answers durably, nor
    answers typed at the prompt); each ledger call; each blind question;
    each reversal; each switch of a phase's position (R40) and each
    convergence accepted. Keys carry scope (project, kind). **The person's
    level and the project's level merge** for every decision: the
    person's counts across all projects are each project's starting
    point, and the project's own answers move it as they accumulate — a
    new project starts from the person's general taste; a project where
    they care about the UI soon shows it. In the arithmetic, the
    person's counts from their other projects, capped at 10 answers'
    weight — ruled by the person 2026-10-18: a new project starts at a 24%
    bound, just over the line, so each kind asks there about three times
    before going quiet and one bad call reopens it; at 20 it started
    quiet and needed three bad calls — are the prior the project's
    counts update; the pessimistic
    rate of R24 is read from the merged range. The same merge lets gates
    of one kind share evidence (the long tail, R29) and lets a new model
    inherit its predecessor's counts at a discount. Counts are derived
    from the log, never stored.
  - **The matrix** is an engine-drawn screen the person can read and
    correct; trust stays their decision. **Tuning is by replay:** the
    engine replays the log against a proposed setting ("last month this
    would have skipped 40 questions; you'd have overruled 2 of them"), so
    the threshold is set from evidence, not feel.
  - **What ships is the procedure, never anyone's counts:** the kinds and
    their questions, the arithmetic and the defaults the person set from
    their own replay (R24, R29). Each person's counts are learned from
    their own answers; what transfers between people is the method, not
    decisions. A new user starts with an empty log, so every question of
    taste or intent asks — where today's workflows are: the calls they
    settle themselves, today's apply and decide lanes (22%, R24), have one
    defensible answer and stay Claude's — and each kind loosens on that person's evidence (about 13 clean answers,
    28 where a change would be hard to undo; danger never). A user of
    today's workflows starts empty too: importing their transcripts
    (labelling, two checks, a verdict page — about $10–20 of model calls
    and an hour) stays out of the release, added only if the first weeks
    of asking prove heavy. So does the person who designed this, ruled by
    the person 2026-10-18 over their 2026-10-12 call to seed their own log
    from R29's history: "simpler I think to start clean and lets me
    experience the trust matrix system cleanly", and "newer models make
    different decisions and better ones at that". The author meets the
    first weeks every user meets; R29's history stays the replay set the
    defaults are tuned against.
- **R26 — Blind questions.** The person's idea (2026-10-12), replacing
  after-the-fact spot checks, which anchor the person on Claude's answer
  and ask them to judge later without the context they had. Now and then
  the engine holds back a call Claude would have made silently, keeps
  Claude's answer sealed, and asks the person the question cold — in the
  moment, in context. Afterwards it shows what Claude would have picked.
  - The engine draws them by a fixed share, ruled by the person
    2026-10-18 — one in ten of the calls
    Claude would make alone to start, more where a kind's range is wide
    (little history, a new model); Claude never chooses which. Each call
    draws on its own, ruled by the person 2026-10-18: the engine turns the
    call's id into a number, so blind questions fall at random across
    projects at the same rate, with no tally kept per project or per
    person, and the same call always draws the same way. Every draw is
    logged. In the replay a twentieth or a fifth moved the outcome by
    one or two questions.
  - Mid-build, for a call cheap to undo, Claude proceeds on its own answer
    while the question waits; a disagreement undoes it.
  - The comparison is how the person comes to trust Claude, not only how
    the system does: "Claude would have picked the same, 14 of the last 15
    on error handling".
  - Reading the ledger as a whole, at the final review, still looks for
    calls that are fine alone and wrong in combination.
- **R27 — The record of the person**, in the release, ruled by the person
  2026-10-06 ("where you've said a record of you across projects, I'd
  build it") and 2026-10-19. The person's preferences, each with its
  reason and examples — not a decision tree, which breaks on the first
  case it did not anticipate. Claude proposes an entry when it sees a
  pattern or the person states a preference outright; it steers nothing
  until the person says yes on the screen where Claude proposes it. It
  shapes what Claude picks, whether Claude decides or gives its lean as
  it asks, never whether Claude asks; its one effect on asking is a care
  entry (R24). It lives at user level, ships empty for a new user, and
  fills from that person's raises and overturns. Claude Code's memory
  cannot do this job: it is keyed to the project directory, so what one
  project learns never reaches another. Searching the person's decisions
  in other projects is dropped, ruled by the person 2026-10-19: it would
  put other projects' text into a session, and projects differ by what
  they are for ("I do care about different things in different
  projects").
- **R28 — No decision model in the release.** Ruled by the person
  2026-10-18, after measuring. A separate Claude call — never the Claude
  that wants to proceed — does the three jobs a decision model was
  proposed for: labelling a question's kind from the twelve questions of
  R25, judging whether a ledger entry holds one decision (R23), and
  reading a typed gate answer (R29). A decision model was never to decide
  whether to ask; they are weakest exactly there (REFLEX: 68.8% right on
  clarification decisions, 51.2% on risk).
  - **The call is raw, made by the engine itself**, ruled by the person
    2026-10-19 ("It should be as raw as possible"): never a subagent, so
    nothing the session writes reaches it but the question. The engine
    runs `claude -p --system-prompt <fixed> --tools "" --strict-mcp-config
    --setting-sources "" --settings
    '{"disableAllHooks":true,"autoMemoryEnabled":false}'
    --disable-slash-commands --no-session-persistence --json-schema …`
    with `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, started from an empty
    folder. `--bare` cannot be used: it reads only an API key, never a
    subscription or setup-token login. Measured 2026-10-19: the 12 Oct
    labelling runs carried about 58k tokens of the person's context in
    each call (their CLAUDE.md, sitrep's hook text, this repository's
    CLAUDE.md); the raw form carries about 830, Claude Code's own email
    and environment lines; a call takes about 4 seconds, almost all of it
    the model.
  - **Rerun in the raw form** 2026-10-19, on the same 150 exchanges and
    wording: against the Opus–Sonnet consensus, raw Opus 97% (kappa
    0.96) and raw Sonnet 96% (0.95), where the 12 Oct fresh runs scored
    91% (0.89); a run sharing a model with the consensus reads high, so
    the cleaner figure is the pair: raw Opus against raw Sonnet 87%
    (0.85), against 88.7% (0.86) on 12 Oct. Nothing was lost by taking the
    person's context out. Sonnet cost 55% of Opus for the same labels.
    Records `workflows-reshaped-measure/trust/label_raw.py` and
    `raw_compare.py`.
  - **Sonnet runs the labeller** (Claude's call, on that rerun);
    builders and reviewers stay Opus at medium, and every other job runs
    Opus until a measurement says otherwise.
  - **Jev measured** 2026-10-18 (jev-1.13.0) (jev-1.13.0) on the 150 exchanges Opus and
    Sonnet labelled (R29), three runs: the composed kind agrees with their
    consensus 75% (kappa 0.70) on the record's wording and 72% on one
    rewording in the dex lab's style, measured on 100 held out, against
    91% (kappa 0.89) for a fresh Opus or Sonnet run carrying the person's
    context, and 96–97% for a raw one (above). At 0.5 it says yes
    far too often (hard to undo 97 against 25, words 44 against 10, danger
    29 against 15) and reads literally ("deletes every fumi they own" read
    as danger); its probabilities rank well (AUC mostly 0.9 or more), but
    the cut differs by question, and even cuts fitted on the held-out
    answers themselves stop at 83%. Not deterministic: identical requests
    gave identical probabilities on 12–23% of answers, and its kinds held
    across runs 90–93% of the time, as Opus's did. $0.00007 an exchange,
    a quarter of a second, about 130 times cheaper than Opus. Records in
    `workflows-reshaped-measure/trust/labeller/`.
  - **Clef not run**, skipped by the person: it would have had to rise
    from Jev's 75% to the 91–97% a Claude call reaches, where every report had it level with Jev
    or below on accuracy (Better Stack: 83% against 86%).
  - **Offered later only once one labels as well as a Claude call.** The
    same scripts rerun on a new Jev or Clef version; if it matches, setup
    offers it as the person's choice ("we can very much let the user
    decide", 2026-10-18): each label names the labeller that wrote it,
    and a switch relabels the log from the questions' text, so the counts
    follow. Kept for that day: neutral wording; a threshold per question
    from the person's labels by the lower-bound rule, checked on held-out
    items; a per-question signal refining the per-kind counts last; the
    loop adjusting only on evidence larger than noise.
- **R29 — Starting numbers.** Measured 2026-10-12, once the shape review
  settled, over the person's transcripts for Fumi, Portal, Tick, agntc and
  Mint (298 sessions; 28 headless ones dropped) from 2026-08-31 unless
  stated. Read-only throughout; the raw material and scripts sat in the
  session's scratch space.
  - **Transcript mining.** 615 points where Claude asked the person
    something or offered a choice, and the reply. A first pass by Sonnet
    labelled what the reply did, the kind of question, its door and
    whether it could have been checked instead of asked; Opus labelled 60
    of them independently: what the reply did 80% agreement (kappa 0.75),
    door 75% (0.51), kind of question 50% (0.43).
    - **What the reply did, re-checked.** The person saw the first pass
      count agreements as departures (an "agree" that also answered a
      separate point read as an amendment). Opus and Sonnet re-checked
      every exchange where Claude stated a lean (437) separately, asking
      whether the reply changes what Claude would have built; they agree
      93% (kappa 0.88), and a row counts only where both agree (407). Of
      the first pass's 73 amendments and overrules, both checks found 26
      not departures and split on 7; of its 51 challenges to the
      question's premise, 12 were departures.
    - Where Claude stated a lean and the person decided (315): agree 82%,
      amend 6%, overrule 12% (upper bound 15%). Fumi 83 / 7 / 10 — the top
      of the person's 60–80% estimate; Portal 70 / 5 / 24; Tick and agntc
      98 / 2 / 0 (44).
    - **Kinds as narrow questions.** Twelve yes/no questions about the
      question Claude put, answered from Claude's turn alone, never the
      reply: is it about the session rather than the product; could Claude
      find the answer out; would a user see the difference; is it about
      how something looks; the words a user reads or types; the steps a
      user goes through; whether something is in the work at all; does
      other code or saved data come to rely on it; could an option lose
      data or weaken security; would a later change reach beyond the
      piece; would one option be a mistake on its merits; does answering
      need the code's insides. A kind is composed from the answers in
      code: process, danger, contract, scope, then for what a user sees
      look, words or behaviour, else internals. Opus and Sonnet agree on
      the composed kind 85–89% (kappa 0.81–0.86) over 150 exchanges in
      two rounds of wording; Opus agrees with itself across runs 93%. The
      steps a user goes through split the labellers (kappa 0.61–0.66), so
      flow is part of behaviour. Splitting one pick-one into narrow
      questions is what dex's lab found for Jev (E39).
    - Overrule by kind (Opus's kinds, re-checked replies): danger 7 of 28,
      contract 14 of 75, process 9 of 81, look 2 of 22, words 1 of 7,
      behaviour 4 of 69, scope 1 of 28, internals 0 of 5. Contracts by
      project: Portal 6 of 15, Fumi 8 of 34, Tick and agntc 0 of 26. By
      door (first pass): one-way 19% (26), two-way 11%, process 11%. A
      later change reaching beyond the piece: 21% overruled against 9%;
      one option a mistake on its merits: 8% against 14%.
    - **What a departure cost.** The person judged the 60 departures both
      checks confirmed (2026-10-12): had Claude built its own lean without
      asking, what would the product have lost? Nothing 14, a fix later
      31, a real loss 8, can't tell 7. Over the 315 decided questions,
      Claude's lean would have cost a real loss 8 times (3%, upper bound
      5%); with the fixable ones, 42 (13%). Real losses by kind: contract
      3 of 75 decided, danger 2 of 28, look 1 of 22, words 1 of 7,
      behaviour 1 of 69; process 0 of 81, scope 0 of 28. Four were
      Portal's (74 decided), four Fumi's (197). Where a later change would
      reach beyond the piece, 4 of 16 departures were losses, against 4 of
      44. Twice the person noted the work later went Claude's way; on one
      loss, that Claude's way would have been backtracked rather than
      lost. Judged with both answers in view, so direction, like the
      replay.
    - **The rule replayed** (R24) over the person's history in time
      order: 410 questions with a lean and a reply both checks read the
      same way. At each, the engine reads the kind's counts — the
      project's own plus the person's other projects, capped at 20
      answers' weight — and asks when the pessimistic rate of real loss
      passes the threshold; it learns only from what it asked, plus blind
      draws on a tenth of the rest; danger always asks. Not asked, and
      what went through to the ledger instead:
      - 15%: 28% not asked (Fumi 31%, Portal 33%, Tick and agntc about a
        tenth); process and behaviour 55% quiet, scope 42%, no other kind.
        No real loss through; 4 the person could not call, 8 fixes later,
        6 nothing.
      - 20%, halved where hard to undo: 38% (Fumi 36%, Portal 46%);
        process 77%, behaviour 64%, scope 53%, contract 6%. No real loss
        through; 6 could not call, 8 fixes later, 6 nothing.
      - 20% alone: 54%, and two real losses through, both Fumi's
        agent-write contracts — the halving's catch.
      - Half weight on shown agreements kept nearly everything asked (3%
        not asked at 15%); capping the other projects at 5 answers'
        weight, 18%. The six weeks start from nothing, so these are the
        first weeks of a person's history, not its steady state.
    - Not an answer (first pass, all 615): 17% (did not follow 13%,
      answered something else 4%); with challenges to the question's
      premise, 29%. Did-not-follow gathers on technical questions —
      internal mechanism 33%, architecture 26%, testing 25%, external
      contracts 20%; under the composed kinds, internals 31%, danger 20%,
      contract 16%. Only 5% of replies said the question should not have
      been asked; 7% of questions were facts Claude could have checked.
  - **The Fumi decision replay.** 37 decisions across all 12 decided
    topics (17 one-way, 20 two-way), posed blind to a fresh Opus at xhigh
    effort with no tools at all — a headless session whose tool list was
    confirmed empty — given a builder's brief: product overview, topic
    briefs and the one-way decisions outside the sample, about 60 settled
    facts held back for leakage, options shuffled so the recorded answer
    sat in no favoured place. An Opus grader compared each call with the
    record.
    - Same 15, equivalent 4, partial 5, different 13: the person's call
      19 of 37 (51%). Different 35% on both doors (6 of 17 one-way, 7 of
      20 two-way). Shown, the person agreed 82%; blind, the match is 51% —
      shown agreement overstates agreement, though not real loss (R25).
    - Claude's "would check with the person" caught 6 of its 13 wrong
      calls and fired on 2 of its 19 right ones: Claude cannot be the
      judge of when to ask (R24). Asking on every one-way question would
      have caught all six one-way misses, if labelled right.
    - Confidence did not separate: right calls 55–85 (mean 75), wrong
      60–80 (mean 68) — confidence never gates.
    - Of 11 decisions that had been reopened, 5 came out different: the
      builder lands on the person's first position.
    - Several misses are the product's character rather than facts: the
      user chooses when to install, first run is a proper wizard,
      everyone is asked for notifications up front, a rejected note never
      marks the menu-bar icon — evidence for the product record (R10).
    - Weaker than intended: thinner context than a real session; seven
      questions whose record does not show who decided (two graded
      different); grader and builder are one model family; 37 is small.
      The person judged the 13 different calls (2026-10-12): 12 would
      have been fine — wouldn't have mattered to the product, or could
      have been improved later (first run is the example: "that could
      have been a fast follow") — and some made them think their own call
      was the wrong one. One was questionable: the placement write through
      SkyLight rather than AppKit's state restoration, which would have
      been found the hard way and changed, and which is a call evidence
      settles rather than taste (R24). So the builder's calls were
      acceptable on at least 31 of 37; the 5 partials were not judged. The
      count that matters is whether the person would have changed the
      call, not whether it differs from what they said. The judgement was
      made after seeing both answers, the anchoring R26 discounts, so it
      is strong direction rather than a count.
  - **The process gates (R40).** 1,744 gate answers since June: 953
    at process gates, 482 at review-loop gates, 309 at navigation menus.
    The rule: a gate goes automatic once the one-sided 95% upper bound on
    leaving its usual answer falls below a threshold, with blind asks at
    5%. Replayed in time order: at 20%, 216 of 953 process-gate answers
    skipped (23%) and 5 would have gone against the person — all five
    challenges to the premise (three reroute pushbacks, two conclude
    challenges), not another option picked; at 10%, 10% skipped, 2 wrong.
    Automatic at 20% in the replay: resume (63, none different), conclude (99,
    3), revisit, wrap-up, reroute, next phase, the project-skills and
    linters confirmations, correction, plan format, dependency approval.
    No gate ships automatic: each asks until the person's own answers
    loosen it, the author's included (R25). Spec sign-off qualifies by count and stays an authority gate. Where a
    gate offers auto, auto is the person's usual pick (task approval 32 of
    36, task gate 20 of 24, fix gate 15 of 22).
    - **The long tail:** 193 gate names, most answered fewer than ten
      times in three and a half months, so per-gate counts keep most
      gates asking for months; fewer gates, and pooling evidence across
      gates of one kind, are the levers.
    - **Typed answers need a labeller** (R28): 171 typed instead of
      pressed — many plain yeses, some asides, a few real pushbacks.
    - **The transcripts stopped holding the evidence:** since the gate mod
      (2026-09-27) only the gate's name and the press survive, not its
      options or recommended row, so the trust log records gate answers
      itself (R25).
  - **The knowledge base against plain search.** 25 real information needs
    from the sessions, run against copies of four projects: the knowledge
    base's own query (hybrid) against an Opus agent searching the same
    copy with grep and reads; a blind judge marked every result.
    - Recall of relevant passages 0.46 against 0.88; precision 0.47
      against 0.83; plain search found more on 24 of 25. Cost per need:
      one call, half a second, about 2.3k tokens, against about 13 calls,
      106 seconds and 56k tokens.
    - The knowledge base is a good first pointer — a relevant passage in
      its top five for 24 of 25 — and found 30 relevant passages plain
      search missed, mostly other work units' specs.
    - It loses on multi-part needs (ten result slots shared across the
      framings), on the current decision inside a long record (it ranks
      the superseded entry; the record-and-log split ends this), and on
      in-progress records it never indexes.
    - In use since 2026-08-31, mostly on the store before its 2026-09-29
      rebuild (Orama then, and always ten results whatever the query —
      85 of the 98 queries), so these usage figures describe the old
      store; the head-to-head above ran on today's: 44 of 46 conversational sessions queried; of 76 query
      runs, 37 used a result, 17 acknowledged it, 18 ignored it, 4 got
      nothing. Those sessions searched records directly more than they
      queried (116 searches and 155 reads against 84 queries).
    - Not measured: what one to three quick plain searches find, the
      comparison that matters if the call turns on cost. Budgets were not
      matched. The re-made eval measures it (R44).
- **R30 — Every optimising loop has a counter-measure** and R24's
  frozen anchor, danger, so trust cannot drift by optimising its own metric.

## Strand C — verification

- **R31 — Two kinds of trust.** Trust in Claude's calls (strand B) and trust
  in Claude's work are separate ladders. The workflows today never run the
  product: review's task verifiers read code and its change-set verifiers
  run linters and package tests. Verification is what lets the person
  stop reviewing work line by line.
- **R32 — Agents prove their work.** A per-project verify capability, built
  by interviewing the repository — what a user touches, how it runs, how
  to drive it (tmux or a pseudo-terminal for a TUI such as Portal or
  Switchboard, the DevTools protocol for web and Electron; a native macOS
  app such as Fumi is harder), what to observe, whether instances isolate.
  It provides launch, a health check, drive, evidence and cleanup, plus a
  **feature map**: how a user reaches each feature, how an agent drives
  it, what proves it works. It is run once end to end before it counts
  and kept honest against drift. The builder verifies each task through
  the user's real path; review reads the evidence; the mod can show it.
  - **Proven**, Claude's definition agreed by the person 2026-10-12: a
    phase's
    acceptance scenarios were performed on the running product, through
    the path a user — or, for a product with no interface, a caller —
    takes, and a script checked the result (a captured screen compared, a
    response asserted, a recording). Claude's account of what happened
    never counts. A scenario that cannot be driven is reported **not
    proven**, and that is what reaches the person.
  - **The verify setup is per project, like the environment setup.** It
    is built the first time a build needs it: Claude studies the
    repository, then researches the current tools for that kind of
    product — the workflows give examples, never a fixed list, so the
    setup moves with the times. It counts only once it has run end to
    end. It grows as features land, each phase adding the drives for its
    own scenarios (the feature map), and is researched again when it
    breaks or the tools move on. Examples, never prescriptions: a TUI
    (Switchboard) in a throwaway terminal, keys sent, the screen captured
    as text and compared, recordings where the look matters, the
    project's own design generators; a router with no interface, stood up
    with stand-in upstreams and real requests asserted on where they went;
    Portal on a throwaway tmux server, killed and restarted for restore
    scenarios (the kill-all investigation's sandbox trials were exactly
    this); a SaaS (FlowX, Folio) run locally against a test database and
    driven in the browser; a Mac app (Fumi) launched and driven through
    the accessibility layer, some of it possibly staying not proven; iOS
    on the simulator with UI tests.
  - **Evidence is computed, never narrated.** Scripts produce verdicts;
    Claude never types a count. Zero tests is "not proven"; a criterion
    whose tests were skipped is "named, not run".
  - **The feature map groups bugs found after review by area**, for
    Claude: it steers the verify setup's checks for that area and feeds
    the bugfix's "rework the area as a feature" option (R20), which puts
    the design look in front of the person when it matters (Portal: six
    bugfixes around restore, five around resume hooks). No flag the
    person sees.
  - Verification never lowers how often Claude asks: the ask rule (R24)
    matches the person's judgement, and their verdicts already count what
    a mistake cost.
- **R33 — Test adequacy by outcome.** Every acceptance criterion has a test.
  Test quality is checked by machine: mutation testing where the language
  has a tool, otherwise deliberate breaks that must turn the tests red.
  Habit hooks, which catch named smells and inject their fix, are tested
  before they ship, on the person's condition when they agreed this
  (2026-10-07: "let's make sure we run our own tests to validate. Let's
  not just blindly trust what we read"): measured on the replay's slices
  alongside the brief-quality measurement, they ship if they cut review
  findings.
- **R34 — Hard checks over soft rules.** A spec invariant names the check
  that enforces it — an architecture test, a lint, an import-graph rule —
  where one can, so a decision holds even for builders who never read the
  record. A review finding that recurs becomes a project rule rather than
  coming back each cycle. The person's coding rules (for Laravel: thin
  controllers, the action pattern, data objects, never passing primitives)
  split: what can be checked becomes an architecture test (Pest supports
  them); the rest stays guidance handed to the builder. The more
  hard structure a codebase already has, the less up-front decision it
  needs.
  - **Project skills are not configured**, ruled by the person
    2026-10-20.
    - Builders and reviewers are sub-agents. Claude Code lets a
      sub-agent find and invoke the project's skills through the Skill
      tool without being handed them. It also loads the project's
      CLAUDE.md in every custom sub-agent (sub-agents docs, read
      2026-10-20).
    - Today's question at each build arrived on 2026-02-01, when
      building moved into agents. It assumed agents would not use skills
      unless passed them.
    - No list and no mapping of skills to areas of the code.
    - The risk left is a builder passing over a skill whose description
      does not obviously fit its task. The rules that matter most are
      already checks (above). If a build shows a skill ignored,
      preloading it then is a small change.
  - **Linters are asked once per project**, ruled by the person
    2026-10-20.
    - They are found and confirmed at the first ready to build, and
      recorded in the project's environment setup.
    - They are never asked again at a build, and are changed from manage
      on the start menu.
    - Today they are confirmed at every implementation start.

## The deterministic core

- **R35 — Engine and mod.**
  - The verbs are the only doors (R2).
  - A hook refuses writes under `.workflows/` to paths outside the layout:
    no ad hoc directories. Today the mod's guard refuses direct edits only
    to manifests, lets shell writes through, and runs only where the mod
    is announced; it widens to the whole layout.
  - The commit door already confines and serialises what a commit takes;
    it also requires a task for code. The task in flight is already
    recorded per conversation, so the door has one to read.
  - Checklists are engine-held.
  - The workflows' own agents get only briefs the engine issued; a hook
    refuses any other dispatch of them (brief control, Reviews in the
    build).
  - Every surface the person sees is an engine surface — the ledger, the
    matrix, raises, blind questions — under the display lint that already
    fails a templated display in skill prose; a plain line made only of
    values Claude already holds stays in prose.
  - The gate mod draws raises and blind questions, logs gate answers (it
    sees the click; the engine knows what it recommended), shows
    verification evidence, and offers a reading surface for material the
    person may want. It also carries phase words (its spinner) that a
    phase rename changes.
  - After a compaction the engine's recovery note names the skill and each
    document to re-read; the discussion phase's note names the record and
    the log, the build's its log and where the phase stands.
  - Anything that can use the mod to make the system better should.
  - **Tasks go through the engine to a driver**, ruled by the person
    2026-10-17, replacing three plan formats chosen per plan.
    - The engine's `task` verbs — create a phase, create a task with the
      template's fields, link, ready, start, done, close, list a phase,
      show a task — are the only way anything in the workflows touches a
      tracker. A driver is code behind them, loaded by one project
      setting chosen at setup, Tick by default; changing the setting
      changes the tracker with nothing else touched.
    - Every driver provides parents, blocking and a ready answer that
      returns several tasks at once; what a tracker lacks natively its
      driver makes up for in code, once.
    - A conformance suite is the contract. A new driver is a pull request
      to the workflows that passes it, never one loaded from elsewhere.
      Only the Tick driver ships; plain files and Linear's MCP route go.
      A driver for a hosted tracker calls its API with a key kept at user
      level, never an MCP.
    - Nothing relies on task state travelling with a commit, since a
      hosted tracker's does not.
    - **The tracker is named only in its driver**, the user docs and
      design notes — never in a skill, a reference or engine code outside
      the driver. The person's rule, non-negotiable: even their own tool
      sits at the workflows' edge, never woven through them.
    - In the person's 13 projects 97 of 101 plans used Tick, 4 plain
      files (all in completed units of Tick's own repo) and none Linear;
      the migration sets every project to the default driver.
  - **Code lands through the engine to a driver**, ruled by the person
    2026-10-18, by the same rule as the tracker.
    - Pull requests are prescribed. A task is a pull request — the change
      the reviewer pair already reviews — squash-merged, so the default
      branch gets one commit per task with its review behind it.
    - A phase is a stack: its tasks' pull requests chained in the order
      the orchestrator merges them back, parallel tasks included, merged
      whole once its phase review passes (in step, that merge stops like
      any process gate). A phase that relies on the one before waits for
      that merge, so every stack starts from the default branch; one that
      does not runs beside it as its own stack. The review phase's fix
      tasks are the last stack, merged at finish.
    - Not one stack for the unit: Switchboard's build would have been
      about 125 deep, every change landing on the default branch would
      rebase the whole chain, overlapping phases and phase-review fixes
      sit badly in one chain, and nothing usable would land before
      finish.
    - Two drivers ship: GitHub's, holding the stack mechanics in its own
      code so no one needs GitHub's stack skill, its CLI and stack
      extension checked at setup; and a local one for a project with no
      remote — a branch per task merged into the phase's branch, the
      phase merged into the default branch, the same shape without pull
      requests. The rehearsal copies and the prose-test worlds have no
      remote, so the local driver is needed regardless. The code host's
      CLI is named only in its driver.
    - The workflows push across the board, ruled by the person
      2026-10-18: the state branch on every commit (R23), each task's
      branch as its pull request opens, and merging the driver's, after
      the review that clears it.
    - Today the workflows never branch, push or open a pull request:
      Portal's default branch took 4,488 commits since June and 5
      pull-request merges, Tick and Mint none; Switchboard opened 125 pull
      requests in three weeks, 36 of them stacked.

### Layout on disk

Ruled by the person 2026-10-17, in the migration walk. A topic exists
only before the spec; from the spec on, everything is the work unit's.
The hook in R35 refuses writes outside this layout. `.workflows/` is a
worktree of the state's own branch, never part of a code branch (R23).

```
.workflows/
├── manifest.json               registry, defaults, roadmap
├── .ledger.jsonl               the project's stream (R23)
├── .inbox/ .roadmap/ .baseline/ .state/ .knowledge/
├── .cache/{unit}/…             gitignored session state, mirroring the unit's tree
└── {unit}/
    ├── manifest.json           status, the map's topics and order, where the build stands
    ├── discovery/session-NNN.md
    ├── topics/{topic}/
    │   ├── brief.md            discovery's brief for the topic
    │   ├── log.md              the journey, one dated heading per session
    │   └── mail/NNN-*.md       messages waiting for it (R13)
    ├── assets/                 what informs a decision (R12)
    ├── seeds/  .state/
    ├── spec.md                 the areas, then the phase cut (R14)
    ├── build/
    │   ├── log.md              in flight, tried and dropped, left for the next phase
    │   ├── notes.md            notes for later
    │   └── tasks/{task}.md     each task's account
    └── review/                 one report per round; the passing one is the certificate
```

- An epic has many topics; a feature one, named after the unit; a bugfix
  one, whose log is the investigation; a quick-fix none and no spec —
  `build/` and `summary.md`, the short record after the work (R21).
- Never files: a topic's record and its map, the product record, the
  verdict queue, "what have you decided without me" — projections of the
  ledger (R45). The knowledge base's rendered copies of records sit in
  `.knowledge/` (R44), and so does the product record's rendered file,
  for a CLAUDE.md line to point at (R10; Claude's call).
- The person's own stream, the trust log (R25), and the record of the
  person (R27) live at user level, in `~/.config/workflows/`.
- The phase cut lives at the end of `spec.md`.

## Shape review rulings

Ruled by the person on 2026-10-12 after the shape review (Open), on the
evidence recorded there: "pretty much what we already agreed, which I
think is a good sign."

- **R40 — Gates in three kinds.**
  - **Authority gates, fixed:** start this work (discovery's shape gate,
    R10), approve the map, decided (a topic's close, R11), ready to build
    (the spec's outline and phase cut, R14; for a feature one screen with
    decided), finish. Never automatic; acting before
    the person's go is the correction they make most often.
  - **Product questions, computed** by the ask rule (R24).
  - **Process gates, learned.** Every gate answer is recorded by the gate's
    name (R25). A gate the person always answers the same way becomes an
    automatic step with a one-line report, and comes back if their answers
    start to vary. The gates that served the build's and review's loops
    (analysis cycles, per-task approval, their re-review) go with the
    loops; discussion's reviews stay (R11) and their gates are learned like
    any other.
  - **A phase runs auto or step**, ruled by the person 2026-10-15,
    replacing three positions: auto, the default, where process gates are
    learned and the ask rule decides, the person bothered only when it
    judges they would want to be, the way Claude Code's auto mode
    classifies; and step, where every process gate stops (Folio, where the
    person reviews and tests the work as it lands). Today's bounded mode
    and the separate learned position go. The build's is chosen once at
    ready to build, auto by default, then hands off; any phase's is
    switchable at any time. A switch is stated intent, recorded in the
    trust log (R25), and outranks the learned counts. In both positions
    the authority gates and danger questions (R24) stop.
- **R41 — Foundations first.** Discovery orders the map's topics by what
  depends on what, and research whose results other topics rest on comes
  first. The reason is the cone (R24): the topics everything rests on are
  decided while the page is blank and the person is most involved, and
  later topics arrive mostly settled; nothing is built on an undecided
  model (the internal product's skipped core model). Reasoned again 2026-10-13 on the
  discovery walk: ordering does not stop topics bouncing. Fumi's map was
  ordered foundations first at discovery and 73 of 155 messages still
  went to an earlier topic, with about 37 reopens — decisions nobody could
  see at discovery (CloudKit, the macOS 15 floor) and pairs that depend on
  each other both ways (note-model and storage-and-sync, 7 and 6
  messages). What the order would have changed in Fumi is research:
  space-homing's sat seventh while engine-architecture designed around a
  permission restart its research showed did not exist.
- **R42 — What is kept.** The record, the log, the spec, evidence and a
  short review report; the build's log joins them (R15). Tasks live in the project's tracker, behind its driver (R35). Tracking files,
  analysis files and per-task report files go: in every project only the
  spec was read downstream.

## Measures and levers

- **R36 — The system adjusts itself through six measures**, each moving one
  lever:

  | Measure | Lever |
  |---|---|
  | Overturn rate per kind of question | how often Claude asks |
  | How a review's findings split across its lanes | whether the matrix answers what the reviews find |
  | Review findings per phase | where the build is cutting corners |
  | Bugs found after review | where verification has a gap |
  | Contracts slipping in prose tests | which contract needs a verb or a check |
  | Context spent before the first question, per phase | what a phase loads, and when |

  The measures are computed, never added to what the person reads at a
  gate: a topic's decided screen and the finish report keep the contents
  agreed for them, since a list they never asked for is one "I end up
  ignoring" (the person, 2026-10-14). How a review's findings split shows
  on the matrix's screen (R25); review findings per phase is an engine
  query the workflows' authors run.
- **R43 — A context budget.** Ruled by the person on 2026-10-12, in the
  words they approved: "measure what each phase loads before its first
  question, and read records only after the question". The context a
  phase spends before its first question to the person is a measured
  number, per phase, with a budget; the walks record it, so a change that
  grows it shows. What holds it down:
  - **The question comes before the reading.** A gate needs only what the
    engine holds. Records are read after the answer, never before a
    question whose answer may discard them.
  - **Resuming a topic reads its record and its log**, after any question
    whose answer may discard them, ruled by the person 2026-10-19: the log
    is how a session knows the conversation's history ("that's the point
    of the log"; 2026-10-14: "The artifact there is how we get back to
    where we were at"). A "never the log" rule written here earlier was
    Claude's, never agreed.
  - **Prescription lives in code** — R2's principle, not part of the
    approval above. What the person sees and what is
    recorded is held by engine verbs, a few hundred tokens a call; prose
    keeps goals, done-conditions and conversation guidance (R2), and a
    phase loads no shared reference it does not use.

  Evidence — Fumi, resuming status-and-alerts on 2026-10-12: 165k tokens
  at the continue-or-restart question. Claude Code itself took about 68k
  and seven MCP servers the workflows never use about 36k (measured
  headless with and without them: 75.7k against 39.2k); the workflow
  skill, its shared references and engine output about 23k; the
  discussion document, read whole before asking whether to delete it,
  about 35k. Of its 104KB the current decisions are about 35KB, and one
  decision carried four dated revisions. The workflows' share, about
  58k, falls to about 15k before the topic's log is read. The harness's share is
  outside the workflows; which MCP servers load where is the person's
  setup. The person's compaction point is 467k.

- **R44 — The knowledge base stays, as the first look.** Ruled by the
  person on 2026-10-12 on the R29 evidence. The knowledge base is the
  cheap first pointer and the reach across work units, indexing records
  (current decisions), never logs and never the ledger, which holds
  replaced answers. A record is rendered from the ledger when its
  topic's entries change and indexed from a copy in the gitignored
  `.workflows/.knowledge/` (R23, ruled by the person 2026-10-17). Plain
  search, when depth matters, runs in a helper agent so its cost stays
  out of the conversation (R43). The knowledge eval, re-made against the
  new records, gains a third arm: one to three quick plain searches,
  judged blind beside the other two, so the comparison R29 left
  unmeasured settles whether the index earns its place (Claude's call,
  2026-10-19).

## Migration

Walked with the person 2026-10-16 and 2026-10-17 on a read-only survey of
every project that uses the workflows
(`workflows-reshaped-measure/walks/migration/01-survey.md`): 13 projects,
108 units — 91 completed, 12 in progress, 4 cancelled. 95 move by code
alone, 2 need only their records derived (mint token-aware-diff-sizing,
portal tagging-and-filtering), and 11 need judgment beyond that. The
survey's finding that pigeon and evvi, epics older than the discovery map,
need the legacy split is wrong: run forward to 072 on copies, the split's
own detection finds nothing in either.

- **R37 — Every existing project migrates fully, as if it had always had
  this shape.** One canonical path (R8). A project migrates when the
  person updates its skills and next runs `/workflow-start`; a dormant one
  migrates whenever it is brought back. Only the current shape is migrated
  from, ruled by the person 2026-10-16: the existing chain brings an older
  project up first, and the reshape is written against today's shape
  alone. The migration never touches a project's code.
  - **One numbered sequence**, code steps and directives (R38)
    interleaved, each grouped by its job:
    1. **Guard** (code). The migration refuses while another session is
       live in the project — read from the old skills' presence files,
       whose paths only the migration may know — and while `.workflows/`
       has uncommitted changes, which the migration commit would otherwise
       sweep in. A major upgrade under a running session is declined
       outright (the person, 2026-10-17).
    2. **The legacy split** (code, directive, code). Today a skill run on
       opening an epic: it cuts broad research that migration 038 seeded,
       still in progress, into topic-sized files and map items,
       interviewing the person per file. It becomes a directive just
       before the reshape, written against today's shape — the shape it
       already runs on, since today it runs only after every migration up
       to 072 has. Code detection walks every epic; where nothing
       qualifies the step is recorded with nothing done and never reaches
       the session. Where something does, the interview runs per epic and
       code applies the split. The skill folder goes. Proven 2026-10-17:
       codeintel at `ce5323c` and galley at `5d4679e`, each taken from the
       commit before its first split and migrated from 044 and 039 to
       072, detect exactly the sources they split for real (codeintel six,
       galley its exploration), and git holds the person's real choices to
       check the directive against. Every other epic in the 13 projects
       detects nothing.
    3. **The move** (code), into the layout (Layout on disk):
       - a topic's log is its research then its discussion, each verbatim
         under its own heading, the repetition between them kept (a
         discussion's inherited position restates its research); a
         bugfix's investigation is its topic's log;
       - research feeding one topic joins that topic's log; research
         feeding several goes to the unit's discovery log, where epic-wide
         research belongs, until the cut-and-merges directive places it
         by judgment (step 5, ratified by the person 2026-10-17);
       - each topic's mail moves to its own folder as one sequence,
         renumbered where the topic had mail in both its research and its
         discussion box; mail for a cancelled topic goes to the inbox, as
         cancelling does from now on (R17) — Fumi's three such messages
         still bear on the product;
       - briefs move into their topics, `imports/` becomes `assets/`, and
         roadmap items' source paths are rewritten;
       - retired state is dropped: map routing, staging, review-cycle and
         plan-review tracking, scoping state, the Dependencies machinery
         and build order (R15); fields added since this record was first
         written — promoted topics, unstarted messages, where a topic came
         from, a roadmap item's kind — carry over;
       - the old cache is left alone: nothing reads it, and completion
         deletes `.cache/{unit}` whole without knowing what is inside;
       - `.workflows/` leaves the default branch (R23): the new layout
         becomes the first commit of the state's own branch, checked out
         where `.workflows/` was, and the default branch drops the folder
         and ignores it — the migration's commit is these two, on the
         person's yes.
         Anything still pending in it — a review not folded in,
         carry-notes waiting — is folded into its topic's log by the
         records directive; Fumi has none.
    4. **The records** (directive), below.
    5. **The cut and the merges** (directive): phase-cut entries for
       builds under way, research that does not map one-to-one onto a
       topic placed where it bears, cross-cutting units into product-wide entries
       (R22), and the topics that must leave a building unit.
    6. **Finish** (code): the records indexed (R44), then one migration
       commit, on the person's yes, as today.
  - **Every topic gets a record, completed units included**, ruled by the
    person 2026-10-17: everything moves forward in one shape, so
    reopening or revisiting a completed unit meets nothing special, the
    knowledge base reaches shipped decisions, and a mature product's
    ledger is not empty where most of its decisions sit in finished work.
    The stream starts at the migration, ruled by the person 2026-10-17:
    one current answer per question, each citing the log section it came
    from, the earlier answers left in the log — in the ledger test the
    replacements were where detail was lost. Specs are read as well as
    logs: decisions made at the spec stage (review gaps decided in the
    spec, amendments, corrigenda) exist nowhere else, and each becomes an
    entry on the topic it belongs to. An entry says who decided it where
    the log shows it and "carried over" where it does not, so a migrated
    entry never passes as the person's decision. Measured results become
    findings saying how they are known; items still exploring or pending
    become open questions on the topic's map; nothing is invented. The
    entries the directive marks product-wide start the product record.
  - **Specs: the line is whether building has started**, ruled by the
    person 2026-10-17.
    - **Nothing built.** The old specs and any plans become reference in
      `assets/`; the topics keep their states; the unit sits in discussion
      until every topic is decided, and then one spec is written fresh
      from the records, through the new review and the ready-to-build
      gate. Tasks a plan already put in the tracker are closed by the
      directive through the engine's task verbs (R35).
      Evvi v1 is the case: eight unbuilt specs, two discussions reopened
      after their specs, five concluded discussions no spec covers.
    - **Building started.** A spec past its gate is history and never
      corrected (R14), the tasks cite its sections, and a merge is a
      restatement, so the specs are joined verbatim into `spec.md`, one
      part each, in build order, never merged. The plans' phases become
      the phase cut: a built phase gets its name, its goal and "built"; a
      phase not started or partly done gets its full entry — scenarios,
      the sections it draws on, what it relies on — written by the
      directive from the plan's phase and its acceptance criteria, the
      dependencies between the old specs becoming relies-on lines. Tasks
      keep their ids and tracker state; the tracker is left untouched and
      the cut names each phase's existing tracker parent. Banked findings
      become notes for later and approved staging goes; a spec built but
      never reviewed needs nothing, since the review phase reads the whole
      unit. Where the manifest and the tracker disagree, the tracker wins
      and the disagreement is an open note. Folio (one spec built, one at
      167 of 210 tasks, 156 banked findings) and pigeon (three specs, one
      at 100 of 116, its manifest crediting a task the tracker has open)
      are the cases.
    - **Mixed.** A building unit cannot take a topic its spec does not
      cover: topics not started, in progress, or decided but in no spec
      leave it, and the directive asks the person, per unit, where they
      go — a new epic the person names, the topics moving whole and
      starting in discussion, or the roadmap as postponed topics, a later
      pull opening a fresh topic that reads the earlier record. The
      building unit is then whole: every topic decided, its specs joined,
      one build. None of the person's projects has this.
    - **Completed units** stay as history, their specs joined; tick v1's
      two concluded discussions that never reached a spec stay decided
      topics in the finished unit.
  - The trust log is new and starts empty for everyone, the author
    included (R25).
- **R38 — Directives.** A migration kind whose transform is judgment,
  ruled by the person 2026-10-17 over stretching today's verification
  addenda, which check after a code transform, fire once and live in the
  start session's context. The legacy split was one under another name.
  - A directive is one file of instructions, numbered in the same sequence
    as the migrations, written against the shape at its number and frozen
    once released, like any migration. It runs in order because a
    directive written for one shape cannot run on the shape months later.
    Directives are grouped by job — neither one doing everything nor one
    per action — and code steps may sit before and after each: as much as
    can be mechanical is.
  - The runner runs code migrations until it reaches a directive, stops,
    and hands it to the start session, which carries it out — a large
    unit's topics each to their own agent, at Opus medium (the person was
    told 2026-10-17), the session the ledger's only
    writer — and records it once its check passes, then carries on. One
    start may meet several.
  - It names the files it may touch. Its check passes before it is
    recorded: mechanical, through an engine verb (every entry cites a log
    section that exists; every decided map item has its entry), plus an
    independent verifier per topic hunting, against the log, detail the
    record dropped.
  - It may ask the person, ruled by the person 2026-10-17: dex's
    directives run unattended, but here the person started the migration
    and is watching. Each directive's file says what it asks. The split
    keeps its interview; the records directive asks nothing per entry and
    raises what no log settles at the end, one point at a time, each
    answered or left open (R24).
  - Nothing is committed before the one migration commit. Progress
    survives a session that dies: the work is on disk and the check tells
    finished topics from unfinished, so an interrupted topic is redone
    from the start, never resumed from half a judgment. Boot refuses to
    continue past an unfinished directive, so no session works in a
    half-migrated project.
- **R39 — Rehearsal before release**, ruled by the person 2026-10-17. The
  migration runs on copies of all 13 projects in scratch repositories cut
  from their remotes — git remotes removed, pushing made impossible and
  proven to fail before anything runs — the real projects never touched,
  and it is adjusted until every project migrates cleanly. Variants are
  built for the cases no project holds: the codeintel and galley
  pre-split copies for the split, a Fumi variant with a spec started, and
  one mid-build, simulated through tasks since the migration never
  touches code. Moving files is mechanical and easy to check; the focus
  is the ledger's completeness and the logs' shape.
  - **Fumi** is the largest derivation: 430,066 words across 13
    discussions and 4 research files, 173 decided items, roughly 600–900
    answers and 200-odd findings, an estimated hour of the first start
    that the rehearsal measures. Every decision is there with high
    confidence — the manifest lists them all and the check refuses a topic
    missing one; every detail, not fully — the ledger test's blind spec
    covered 118 of 162 builder points and 21 in part, 23 of its 32 losses
    from restating — which is what the verifier hunts.
  - Fumi after migrating, as it stands: six topics decided, six in
    progress (five waiting only on mail, commercialization on one open
    question), three not started with their mail (build-and-release 17,
    licensing-and-trial-integrity 10, support-and-diagnostics), four
    cancelled; then one spec and one build. The person holds Fumi in
    discussion until this release, so it moves forward as one spec and one
    build.

## Sequence

1. **Clear the base.** Done by v0.8.16: the entry layer (one skill per
   phase, one continue skill, a lighter start), the gate-mod compaction
   work, the mailbox and inbox rework and the engine displays landed first.
   The entry-layer design landed rather than folding in; this programme
   builds on it, and merging research and discussion is now one skill and
   one row in each of the engine's phase tables.
2. **Review the shape, measure, design trust.** Done 2026-10-12: the
   shape review (R40–R42), the four measurements and the person's
   verdicts (R29), and the trust layer (R23–R28, R40's positions), each
   call approved by the person on a page; then the walks of review, the
   epic menu, bugfix, quick-fix and the build, and how work is broken up.
   What remains before the plan is in Where things stand. Nothing in the
   workflows changed.
3. **Foundations shared by A and B.** The ledger, raise and gate-answer
   logging, the verdict queue and the user-level store.
4. **Restructure (A)**, the record-and-log split first, with its
   migration and directive, and
   **verification (C)** alongside. All of it ships as one release (the
   person, 2026-10-18); these steps are the build's order.
5. **The ask rule on (B)**, calibrated to ask what is asked today and
   loosening only as evidence supports.

## Where things stand

Consolidated on 2026-10-12 at the person's request, to stop one question
rippling into the next. This is the list the next sessions walk with the
person, one item at a time; the sections above hold the detail.

**Ruled by the person** — decided; changed only on new evidence:
- The direction and the strands (R1–R9), agreed at shape level; the shape
  review's proposals (R40–R42); the context budget (R43); the knowledge
  base as the first look (R44).
- Gates, corridors and fields (R2): whatever Claude does in a field stays
  in it.
- The trust layer, each call approved on a page (R23–R28, R40's
  positions, auto or step since 2026-10-15); the threshold, 20% halved where hard to undo; what ships is
  the procedure, never anyone's counts; everyone starts empty, the
  author included (2026-10-18).
- From the walks: quick-fix in one session, a short record after the
  work, no review step (R21); a specification waits until every topic is
  decided (R17); bugfix validations acted on by Claude, the
  address-or-dismiss gates gone, rework as a fix-direction option with no
  count (R20); one orchestrator across a build's phases, delegating; the
  build keeps a log; six principles and the task template replace
  planning's teaching (R15); what the person sees during a build —
  landed summaries, a question queue, a stop report (R15); proven, and the
  per-project verify setup (R32); the gap-analysis session bug goes with
  the restructure.
- From the discovery walk (2026-10-13): no routing — every topic goes
  through discussion, none straight to the build (R10); a topic opens with
  Claude starting the conversation, its lean given wherever a logical
  one exists (R11, 2026-10-18); the brief feeds that view and approving
  the map stays topics and order (R10); the cone narrows as the product
  takes shape, not phase by phase (R24); foundations first for the cone's
  sake, with research others rest on first (R41); discovery one phase at
  whatever level the conversation reaches, no detail questions in it,
  feature and epic two types with a light call between them (R10, R19);
  the product record — a projection of the ledger with a rendered file a CLAUDE.md line can point at, never CLAUDE.md itself, started
  in discovery, added to from decisions at a topic's decided screen, read by every
  opening view, apart from the feature map (R10); a topic opens with
  Claude starting the conversation, its lean given wherever a logical one
  exists (R11, 2026-10-18); discovery's gates —
  starting work an authority gate, the map's screen holding the parks, no
  confirm on a change the person asked for, cancelling still confirmed
  (R10, R40); the gap analysis at a topic's close and one sweep before
  the spec, a candidate a topic only when it holds the person's call
  (R10, R11). Discovery is walked.
- From the discussion walk (2026-10-13): a discussion log per topic,
  discovery's and the roadmap's per session; the record holds findings
  beside decisions, each saying how it is known (R11); a decision is
  written once, as a ledger entry, and the record drawn from the ledger;
  the ledger holds every decision by either side, each entry with its own
  id, stored as versioned JSON lines in the project, superseding by appending
  with one of four reasons; the trust log keeps only what the matrix
  needs (R11, R23, R25); the map lists the person's questions and
  Claude's calls, done when nothing of the person's is open, Claude's new
  calls shown each time (R11); spikes fitted to the ledger — one assets
  home, a lock as a map question, discovery may spike and is where an
  epic-level spike happens (R12); the reviews stay and the matrix routes
  what they find, the closing pass with two readers and re-reading what
  it changed (R11, R40); the purpose of the workflows stated (What the
  workflows are for). Discussion is walked.
- From the specification walk (2026-10-13): every statement traces to an
  entry; the review hunts gaps and the matrix answers them, written into
  the topics' records; a re-review reads only what changed, unasked;
  "decided" closes a topic and "ready to build" is the spec's gate; a
  concluded spec is never corrected, later changes replacing ledger
  entries (R14, revised 2026-10-14) (R40). The goal stated:
  Claude deciding as the person would have, never asking less for its
  own sake (What the workflows are for).
- From going back over the settled items (2026-10-14): the review phase's
  out-of-scope findings are dropped, grouped or filed to the inbox by
  Claude with no offer, only what was filed listed in its report, each
  call in the ledger, and never flood the inbox;
  its in-scope findings become fix tasks in one more build phase, and the
  review phase reads again only the areas they changed (R16); the report
  is short and product first, the passing one the work's certificate, its calls
  a count by kind; the finish gate takes questions; the build runs
  straight into the review phase, in an epic too (R16). Following from
  rulings already made: the review phase runs the product ("proven");
  its loop gates become learned (R40). Review is walked.
- From the build's measurements (2026-10-15): three reviews, after each
  task, closing each phase and the review phase; every review two
  independent Opus medium reviewers, never high, never another model;
  implementers at Opus medium, and no higher-effort agents (2026-10-19); a finding serious unless the report names
  the edge-list item it needs; the notes for later hold what lies outside
  the task; comments never the standard, a wrong one fixed without a
  finding; the task loop — every finding but a nit back to the same
  implementer, the changed task reviewed whole by the pair until a round
  passes, no count; a nit fixed there and then by the orchestrator with no
  round; a failed review met as a senior engineer would, between keeping
  fixes small and starting again; disagreeing reviewers reconciled by the
  implementer, the orchestrator taking the verdict and the nits; a phase's fixes reviewed by
  the review phase; a build in auto or step (R15, R16, R40, Reviews in
  the build).
- The epic menu (2026-10-15, R17): the phase named at the top; what waits
  on the person first; topics by what they need, with no question count
  (2026-10-14); no spec row until every topic is decided; changing the map
  through discovery; cancelling moves mail to the inbox; "dead end" goes;
  drawn in the existing design system, variants shown in the spec
  (2026-10-19).
- Event-sourced, for engineers (2026-10-15, R45): typed events on
  immutable streams, every view a projection; the spec's sections by
  area, the phase cut naming each phase's scenarios, sections and what it
  relies on (R14).
- The review phase across a unit (2026-10-16, R15, R16): split by the
  spec's areas, each read by a pair; seams between phases read at each
  phase review; after fixes, only the areas they changed read again.
- Bugfix (2026-10-16, R20): before fix options, Claude steps back — was
  the implementation wrong or an edge case found, is there another way —
  never a case-specific step such as looking at comparable tools; its
  spec the spec every type writes, assembled from the investigation (R14);
  the bug proven failing on the unfixed code, a check the commit door holds;
  investigation's plan, check-in and conclude gates following the phase's
  position (R40).
- The build's doors (2026-10-16, R15): no code change without a task, one
  verb per destination, an agent's find landed by the orchestrator, the
  commit door refusing a code commit that names no task.
- Dependencies (2026-10-16, R15): the cut orders the unit and names what
  each phase relies on; the machinery between specs and the plan-wide
  rebuild go; tracker links set per phase; the build reads the cut
  before treating "nothing ready" as finished.
- What the build prints (2026-10-16, R15): a headline as work starts, one
  block per batch, a product summary per landing, review reports kept
  off the screen and reachable through the task's account.
- The start menu (2026-10-16, R17): units with type, phase and progress and
  a count of what waits in each, waiting units first; "Continue epic: …";
  one Start row; the inbox one counted line; verdicts a project row.
- The inbox stays true (2026-10-16, R17): a capture commits its own file
  through one fixed engine line, the skills knowing nothing of the engine; finished work
  closes the items it resolved, each listed in the finish report.
- Triage (2026-10-16, R17): "Triage the inbox" on the start menu; Claude
  names items that fit; w work, r roadmap, a archive, b back; Claude never
  names a horizon.
- The roadmap (2026-10-16, R17): roadmapping one step from anywhere, the
  horizon always the person's; work through discovery, any type; one line
  per item. Menus explicit and keyed alike, every menu with h help.
- Mailboxes (2026-10-16, R13): `/workflow-start {unit} {topic}` opens a
  topic directly, given at the end of every send; waiting mail raised first.
- Feature (2026-10-16, R19): "Continue feature" goes straight to where it
  stands, bugfix and quick-fix alike; revisiting moves to manage.
- Cross-cutting goes as a type (2026-10-16, R22): principles decided where
  they arise, as product-wide entries; the product conversation is
  discovery and decides nothing (2026-10-19).
- Migration (2026-10-16 and 2026-10-17, R37–R39): one sequence of code
  steps and directives in order — guard, the legacy split, the move, the
  records, the cut and the merges, finish; directives may ask the person;
  every topic gets a record, completed units included, the stream
  starting at the migration; specs joined where building has started,
  written fresh from the records where it has not; rehearsal on copies of
  all 13 projects cut from their remotes, with built variants. The layout
  on disk (The deterministic core); the knowledge base indexes rendered
  records, never the ledger (R44).
- The task tracker (2026-10-17, R35): tasks through the engine's `task`
  verbs to a driver set per project, Tick by default and the only one
  shipped; new drivers by pull request against a conformance suite;
  hosted trackers through their API, never an MCP; the tracker named only
  in its driver, the docs and design notes.
- Pull requests (2026-10-18, R35): prescribed; a task a pull request, a
  phase a stack merged whole when its phase review passes, a relying
  phase waiting for that merge; landing behind a driver, GitHub's and a
  local one for projects with no remote.
- Where state lives (2026-10-18, R23): on a branch of its own, checked
  out as a worktree at `.workflows/`, never in a code branch or pull
  request; entries identified by nanoids and shown by short ids; a
  second clone merged by the engine, never a merge driver.
- Pushing (2026-10-18, R23, R35): the workflows push across the board —
  the state branch on every commit, task branches as their pull requests
  open — and merge through the driver after review.
- Brief control (2026-10-18, R35, Reviews in the build): every brief from
  a template the engine fills; additions only onto the task or the
  ledger, recorded and seen by the reviewers; fix rounds carry the
  reports verbatim; a hook refuses a brief the engine did not issue.

**Settled from evidence, shown to the person, never explicitly agreed:**
- Nothing at present.

**Shape only — agreed in outline, never walked in detail:**
- The deterministic core (R35): which verbs, the layout hook, the
  checklists.
- Verification beyond its definition (R31–R34): adequacy by mutation or
  deliberate breaks, habit hooks, hard checks.
- Measures (R36).

**Not touched at all:** the start skill's
setup gates and environment setup, beyond linters being asked once per
project and project skills not configured (R34); the help walkthrough and glossary; the
user-facing docs; the prose-test harness for the new shape (R4); session
handoffs and compaction recovery beyond R35's note.

**Still the person's to decide:** the items under Open.

**Unclear, or engineering for the plan:** the state worktree in
practice (R23) — a session working in a code worktree has no
`.workflows/` beneath it, so the skills stop assuming the folder sits
under the session's own and the engine hands out where it is; git hooks
fire inside it, so every engine git call
skips them and clears inherited git environment; the branch's name
guarded against matching a code branch; where `.workflows/` sits when
the repository is bare with worktrees; a fresh clone's setup adding the
worktree; unit manifests in a second clone's merge, derived from the
ledger or merged field by field by the engine; how the driver shows a
phase not yet written.

**In discussion:** the product's name (Open), explored with the person
2026-10-20 in `design/name-exploration.md`. **Parked:** the workflows board (Open)
— the build's panel ships in the release, spiked with the person before
the specification is written; the other phases' panels follow straight after it; the first sketches
were rushed and are set aside. Uninstalling and reinstalling (Open) —
raised by the person 2026-10-13, parked for a proper conversation.
Splitting kinds of question from the labeller's stored answers (R25) —
parked by the person 2026-10-19 to come back to. A questions page as a
surface in the workflows — a batch of questions worked through at the
person's own pace, commented on and submitted, round after round to
zero — the person's idea, parked 2026-10-19 to discuss. An extra-high
reviewer at prescribed points (Reviews in the build) — parked by the
person 2026-10-19 until data says it adds something.

**Still to come — the path back up**, set with the person 2026-10-14.
Going back over the settled items reached the epic menu, which opened
the epic moving through its phases as a whole (Open: One build across
an epic), which opened what stores what. Resolve each, then climb:
1. ~~What is stored where~~ — walked and ratified 2026-10-14 (R23,
   R14): one project ledger as an uneditable event stream, records as
   folds, the test's fixes, the spec as the build's working document.
2. ~~The epic as a whole~~ — walked and ruled 2026-10-14 to 2026-10-16
   (R14, R15, R16): one spec for the work unit with no grouping; an epic
   too big for one build split on the roadmap; one build across the
   unit, phases overlapping, worktrees and pull requests; the review
   phase split by the spec's areas, seams between phases read at each
   phase review, only changed areas read again. Pull-request stacks stay
   for later (Reviews in the build).
3. ~~The epic menu~~ — walked and ruled 2026-10-15 (R17): its layout,
   mail on cancel, "dead end", map changes through discovery.
4. ~~The remaining settled items~~ — walked and ruled 2026-10-16 (R20,
   R15): bugfix steps back before fix options, writes the common spec,
   proves the bug by a check, its routine gates follow the position; the
   build's doors, dependencies and what it prints.
5. ~~The tracking layer~~ — walked and ruled 2026-10-16 (R17): the start
   menu, the inbox kept true, triage, the roadmap, explicit menus with
   help (research in `walks/tracking/01-tracking-today.md`).
6. ~~Mailboxes, feature and cross-cutting~~ — walked and ruled 2026-10-16
   (R13, R19, R22): a topic opened by `/workflow-start {unit} {topic}`;
   continuing a linear unit goes straight in; cross-cutting goes.
7. ~~Migrating existing projects~~ — walked and ruled 2026-10-16 and
   2026-10-17 (R37–R39), on a survey of all 13 projects: code steps and
   directives in one sequence, records for every topic, specs joined or
   written fresh by whether building has started, rehearsal on copies of
   every project; the layout on disk.
8. **The formal plan** (Sequence steps 3–5). Four calls first, one at a
   time: ~~one task tracker~~ (ruled 2026-10-17, R35); ~~pull-request
   stacks~~ (ruled 2026-10-18, R35); ~~where state lives~~, raised by
   the person after it (ruled 2026-10-18, R23); ~~how strictly the
   orchestrator adds to a subagent's brief~~ (ruled 2026-10-18, Reviews
   in the build); ~~the trust layer's detail~~ — designed from the kinds
   of question and ruled on 2026-10-12 (R23–R29), the parked item left
   open by mistake. Then the whole release as one numbered document:
   written 2026-10-18 as `design/workflows-reshaped-plan.md`. The person
   ruled one release the same day, and asked that the plan be checked
   against the whole conversation and every gap, glossed-over call or
   unagreed ruling be raised with them before it settles.

## Open

- **The shape review.** The person asked on 2026-10-12, before any trust
  detail, to zoom out and confirm the workflows' shape is right and built
  to evolve across model generations without another rewrite: the
  process, the gates, code against prose, the phases, the work types,
  topics splitting at discovery and rejoining at the spec — changed only
  where evidence says so, never for its own sake. The person's gut: what
  exists is good, the process may need thought. Evidence to weigh: the
  workflow projects (Fumi, Portal, Tick, agntc, mint, galley, codeintel,
  nod, pigeon, quiz-biz), the projects run without them (Switchboard,
  FlowX, the internal product), and this repository's own design history. Spikes,
  trust and verification are sanity-checked against the same evidence.
  Output: diagrams of the shape, and this record revised.
- **The workflows board.** The story of the work stays in the
  transcript: a headline when work starts (one block for a batch started
  together), a product summary as each piece lands, the gate the phase's
  position calls for. What is happening now cannot be redrawn there, and
  reprinting it buries the conversation, so the now moves to a live board
  drawn by the mod — on the whole a picture of what the manifest holds,
  driven by engine code, with room for Claude to put things on it that the
  engine does not hold. Wanted by the person 2026-10-12 for every phase,
  not only the build (discussion:
  the map; specification: its sections and review; build: tasks
  building, landed and parked, questions waiting, each phase's proof;
  review: agents and findings). It sits apart from the person's sitrep
  board, which works across projects and sessions a level above and is
  updated by Claude through its own plugin, never by the workflows. Only
  one board shows at a time; the two share Claude Code's pane tab row, one
  tab each, and a click on a tab switches (measured in the build panel's
  spike, 2026-10-19, Claude Code 2.1.303). The person also pictures browsing
  it while Claude works — jumping to other work units, the inbox, the
  roadmap, whatever the workflows hold for the project — without
  interrupting the session. The build's panel and any task's account
  ship in the release, ruled by the person 2026-10-19, the panel spiked
  with the person before the specification is written (R15); the other
  phases' panels follow straight
  after the release, discussed and spiked then.
- **The product's name.** Still open. Explored with the person on
  2026-10-20; every option and the person's reaction to it is recorded in
  `design/name-exploration.md`. Nothing is off the table, and it may stay
  "the workflows".
  - How deep the rename goes is decided with it. The product, repository,
    docs and help are cheap to rename. The `workflow-*` skill names and
    the `.workflows/` folder are a migration.
- **Uninstalling and reinstalling.** Parked by the person 2026-10-13 for
  a proper conversation later; recorded as raised, nothing decided. It is
  raised with the person when the work reaches install.
  - Removing the workflows with agntc leaves the hooks and the rest of
    what the migrations put in place. The workflows need a way to
    uninstall: remove the hooks, then either tell the user how to remove
    the skills or run agntc's remove itself. Removing the skills is
    agntc's job; agntc is being changed so the workflows can call its
    remove, which is why this waits.
  - Install runs through migrations at boot, on a new or an existing
    project. Removal keeps `.workflows/` (the work, and the migrations
    ledger with it), so a later reinstall would find the ledger and not
    rerun the migrations that put the hooks in place. Deleting
    `.workflows/` takes the ledger and everything reinstalls. A better
    install process may be worth a look, or migrations may be fine.
- **One build across an epic.** Raised by the person 2026-10-14 and taken
  into discussion the same day, from the epic menu walk. Once every topic is decided and every
  spec is ready to build, the person says "implement" once: Claude
  orders the work across all the specs, breaks it up however suits the
  whole epic, runs through the review phase, and reports when everything
  is fully reviewed. A question that needs the person parks what depends
  on it, and Claude carries on with everything else. The person's
  evidence is Switchboard, where Claude ran unattended for two days and
  nights after the design was locked, putting what needed the person on
  the board and carrying on: "That's my goal with the workflows: to
  facilitate that autonomous work… It's very much gate after gate after
  gate, topic after topic. Everything has to be started on purpose." It
  rests on rulings already made: a spec waits until every topic is
  decided (R17), one orchestrator runs a build across its phases, and
  questions queue (R15).
  - The epic is in one phase at a time; the menu names it once at the
    top, and its rows carry no phase (the person, 2026-10-14).
  - **A decision that has to change after discussion is over is settled
    where it is found**, in the phase the epic is in, ruled by the person
    2026-10-14: the epic never goes back to discussion; the ledger records
    the change, and whatever was written or built on the old answer is
    reworked by tasks. "If it has to stop and wait for me… that's okay,
    but that should happen less and less."
  - **Topics stay, as the way to split the deciding conversation**, ruled
    by the person 2026-10-14 after the research in
    `walks/topics/`: discovery talks wide, the shaping makes the topics,
    and each topic is decided in its own focused sessions — focused for
    the person, and for Claude's context, which a whole product would
    overrun. **Each topic owns its decisions**: a decision in one topic
    that bears on another's goes to the owner through the mailbox, with
    the sender's reasoning, and the owning topic decides it in its own
    frame, since the same question can come out differently through
    another topic's lens. Seams are caught by reading across: the gap
    check at each topic's close and before the spec also looks for
    conflicts between topics. Evidence: big designs were split with or
    without the workflows — Switchboard V3's interface screen by screen,
    the internal product into numbered topics Claude made unasked; one
    conversation strained (Switchboard's session, 30 compactions; Fumi's
    records, 416k words over 70 sessions); the misses sat at seams
    (Switchboard V3, 8 of 11; Fumi, 157 messages and 41 reopens); and
    seams were caught by reading across (Claude's sweep of Switchboard's
    eight specs, nine conflicts), while Fumi's per-topic reviews found
    340 gaps, 25 of them touching another topic.
  - **One spec and one build per epic**, ruled by the person 2026-10-14:
    no grouping step; the spec is written in sections by area, each
    from its topics' records; the phase cut is made from an outline of
    the sections and the dependency graph the ledger's relies-on links
    give; each phase's tasks are written from the sections it touches;
    the orchestrator plans ahead and pulls work forward as it sees fit,
    through the task tracker (Switchboard's way: its 14 stages came from
    a 581-word outline). **No size limit**: no job needs the whole spec
    read at once. Size costs in two softer ways — the read across for
    seams nobody linked, and the outline the person approves at ready to
    build — so splitting an epic is a judgement raised when either gets
    unwieldy, never a number, with the link graph showing where it splits
    cleanly (groups of topics linked within, little between). The split
    moves topics not yet started, or part of a topic's questions as a new
    topic, to a next epic on the roadmap; the project ledger keeps every
    link working. Discovery shapes an epic by judgement, never a formula
    (Nod: "the first epic here probably should be like the first
    slice"). The roadmap is the level above: its epics are the versions,
    and no new layer is added. Shipped and building epics ran 15–44k
    words of decision documents; Fumi is at 416k.
  - One task tracker, raised by the person 2026-10-14 and ruled
    2026-10-17: tasks go through the engine to a driver, Tick the only
    one shipped (R35).
  - **How one build runs**, ruled by the person 2026-10-14: parallel
    tasks each in their own worktree, merged back by the orchestrator,
    work on a shared file one task at a time; phases overlap where they
    can — a phase that does not rely on the one before starts while that
    one is in its phase review, one that does waits for its merge, the
    tasks' dependencies and the ledger's links saying which; each phase a
    stack of its tasks' pull requests, merged whole once its phase review
    passes (R35, ruled 2026-10-18).
  - **Reviews in the build**, agreed in shape by the person 2026-10-15
    from Switchboard's measured build (`walks/build/review-cadence/deep/
    analysis/report.md`: 997 findings, each labelled twice independently),
    its rules ruled the same day from the effort replay below. Every
    study, its results and these rulings are indexed in
    `walks/build/README.md`:
    - **Three reviews, each with its own job:** one after each task, one
      closing each build phase over the phase's whole diff, and the review
      phase at the end over the whole change against the spec, running the
      product. Each caught serious bugs the others missed; the
      whole-change review found 9 after more than 75 per-PR reviews.
    - **The workflows' own reviewer agent**, fresh, never the agent that
      wrote the code and never the orchestrator's own read of a diff;
      never Claude Code's built-in `/code-review`. It reads the diff, the
      task's criteria, its spec section and the ledger's decided calls,
      and runs the tests. Built from today's task reviewer and what worked
      in Switchboard's reviewer brief.
    - **Two reviewers, Opus at medium**, ruled by the person 2026-10-15:
      every review is two independent reviewer agents run side by side,
      both Opus at medium effort, never high and never max; the same pair
      reviews again after a serious finding. One review is a sample: of 21
      known serious defects in the replay's first builds, one medium
      review of each first build raised 4 of them and, run again, 5, the
      two runs sharing one; together they raised 8, as many as a medium
      and an extra-high review together at 55% of the cost. High raised
      none in either run and put 9 under For later both times. Measured on
      first builds of task-sized slices; the pair's re-reviews are an
      extension of that data.
    - **Implementers at Opus medium**, ruled by the person 2026-10-15.
      Extra-high builds cost twice what medium builds did and carried the
      same known defects; what medium leaves behind is caught by the two
      reviewers.
    - **Everything at medium**, ruled by the person 2026-10-19: no
      higher-effort implementer or reviewer agents for Claude to reach for
      by a slice's complexity, which would have Claude reaching for extra
      high more often than needed ("leaving everything at medium is going
      to make for a better or more efficient system"; "I think there's
      value in keeping it simple"). To be tested again with data. The task
      writer joined them at medium on 2026-10-19, from its own
      measurement (R15).
      An extra-high reviewer at prescribed points (the end, or each
      phase's end) is parked by the person 2026-10-19 until data says it
      adds something — in the replay two medium reviews raised 8 of the 21
      known serious defects, as many as a medium and an extra-high review
      together; if it ever comes in, "it should always be prescribed",
      never Claude's pick.
    - **No other reviewer model**, ruled by the person 2026-10-15. Two
      Sonnet reviews raised 9 of the 21 known serious defects against two
      Opus medium reviews' 8, for a third of the cost, but 19 of the 128
      known defects against 27; they ran code for a quarter of their
      findings against about half, and called a known serious defect
      serious 2 of the 11 times they raised one, so the loop, which runs
      on serious, would rarely turn. Outside models such as DeepSeek are
      not used (the person: "That's just adding complications, isn't
      it?").
    - **The task loop**, ruled by the person 2026-10-15. Every finding
      carries a user scenario and a call. Every finding but a nit goes
      back to the same implementer with both reports, and changed code is
      reviewed again, whole, by the pair, until a round passes with
      nothing serious and no bug; there is no count. A round with only
      nits passes. A nit is mechanical with no ripple — a comment, a
      name, a test's wording — and the orchestrator fixes it there and
      then, reading the nit from the report, with no trip back to the
      implementer and no review round, so the tasks after it build on the
      fixed code; the phase review reads it (the person, 2026-10-15: "the
      reviewer should pick them up, but the orchestrator will fix that";
      "That doesn't need to go back to the implementer; that just gets
      done"). A task stops looping only when a finding it already fixed
      comes back, and then parks with a report while the rest of the build
      runs. A task is reviewed whole; the phase review and the review
      phase split a large change by area, as Switchboard's release review
      did.
    - **A failed review is met as a senior engineer would**, ruled by the
      person 2026-10-15 and placed that evening between two extremes. One
      is Switchboard's: #106 ran 12 rounds where each fix covered only
      the places named and the orchestrator's fix briefs said "keep fixes
      small", leaving ripples unchecked. The other is starting again: a
      sound build reworked breeds variations, the variations raise
      decisions, and the build stops for the person. The starting point
      is that the work stands — the decisions are made, the spec written,
      the plan made — and a finding is often a plain oversight. The
      implementer weighs each finding professionally: its cause, whether
      it is the symptom of a deeper fault, and the right fix, which is
      often the simple one; where its design and its build hold, it
      stands by them. Whatever the fix's size, before it lands the
      implementer checks the edge cases around it and whether it disturbs
      the design, the architecture, the data model, the plan, later
      phases' plans, or the considerations behind any decision. A gap it
      finds beyond the task goes to the notes for later or through the ask
      rule. The reviewer reviews the task as a professional would, never
      one small thing. Every implementer and reviewer brief carries this,
      so each agent is equipped to do the job well and pushed to neither
      extreme. Where the two reviewers disagree, or the implementer rejects
      a finding, the implementer decides against the brief and the design
      and says why; the next round reads the whole task again, so a
      wrongly rejected finding comes back, and a product question in it
      goes through the ask rule. The orchestrator takes the verdict and a
      report's nits, never the rest of the reports. The workflows own both briefs and keep improving
      them: the implementer and reviewer work as a team.
    - **The serious call**, ruled by the person 2026-10-15: a finding is
      serious unless its scenario needs an item from the edge list and the
      report names that item. A scenario built only from ordinary use is
      serious, however many of its parts combine. Reviewers in the replay
      called 17 of 49 serious defects serious and over-called none; the
      usual miss was calling a combination of ordinary-use parts an edge.
    - **The target is product quality against cost and time** (the person,
      2026-10-15): no serious bugs, real bugs that are not serious fixed
      too, nits fixed as they are found. A finding is one of three:
      serious; a real bug that is not serious; a nit. The first two go
      through the task loop; a nit is fixed in the moment and never kept
      for the phase's end, where the code built on it since could make
      the fix wrong or harder (the person, 2026-10-15).
    - **The notes for later hold what lies outside the task** (R15),
      ruled by the person 2026-10-15: improvements, and holes and edge
      cases beyond the task's boundary. A wrong result in what the task's
      work does is always a finding, even when its fix reaches beyond the
      task. In the replay known serious defects went under For later 18
      times and were raised as findings 10 times. At the phase's end a
      separate agent reads the notes against the phase's code, groups and
      de-duplicates them and drops what the code settled; the rest are
      written as tasks, built in the same loop with their reviews, so a gap
      a reviewer saw never falls between scopes (R15).
    - **Comments are never the standard**, ruled by the person 2026-10-15:
      the reviewer judges code against the brief and the design, never
      against its comments. Where a comment and the code disagree and the
      code matches the brief, the comment is adjusted; where the comment
      is right and the code wrong, the brief and the design show it; where
      they don't settle it, it is a decision. A wrong comment is not a
      finding and starts no review: the reviewer points it out as a nit,
      and the orchestrator fixes it in the task in flight. In the
      replay a tenth of all findings were about comments, every one a nit,
      and two reviews took a correct comment for a stale one and the
      defect for the intended behaviour.
    - **Fixes are reviewed by the layer above**, never by a round of their
      own: a task's by its pair (the task loop), a phase's by the review
      phase; the review phase's own fix tasks go through the task loop,
      and each area they changed is read again whole by its pair (R16).
      Ruled by the person 2026-10-15 and 2026-10-16.
    - **The replay**, run 2026-10-15 (`walks/build/replay/`; results page
      https://claude.ai/artifact/97Trj3Wi35bULh3AgEfMNd): six Switchboard
      slices rebuilt from their original briefs at medium, high and extra
      high on an isolated copy (no remote, every push refused), each
      through the loop and a final extra-high audit; every first build
      reviewed blind once at each level, the medium and high reviews run a
      second time, and two Sonnet reviews of each; every review matched
      and labelled blind, twice, against the slice's known bugs. 264
      agents, $606 at API prices.
  - The review phase across the unit, ruled by the person 2026-10-16: split
    by the spec's areas, seams between phases read at each phase review,
    only changed areas read again after fixes (R15, R16).
  - Pull requests, raised by the person 2026-10-14 and ruled 2026-10-18:
    prescribed, a task a pull request, a phase a stack merged when its
    phase review passes, landing behind a driver (R35).
  - **Brief control**, raised by the person 2026-10-15 ("he basically
    poisons the context by telling the review agent what to look for,
    where that's the review job's purpose") and ruled 2026-10-18.
    - Every brief the workflows give their own agents — implementers,
      reviewer pairs, the task writer, discussion's readers, the
      migration's agents and verifiers — comes from a template the
      workflows own, filled by the engine from the records (the task, its
      spec sections, the ledger's decided calls, the diff, earlier reports
      verbatim) and handed over unchanged.
    - Anything else an agent should know goes onto the task through the
      task verbs, or into the ledger when it is a decision, marked as the
      orchestrator's or the person's, before the dispatch: the person's
      instruction, a fact about the code the task was written before, an
      answer to the implementer's question — never approach, focus or
      size. Reviewers read the task, so they see every addition and judge
      the work against it; nothing reaches a reviewer any other way.
      Recording the addition makes it a deliberate act, which gives a bad
      one pause.
    - Fix rounds carry the two reviewers' reports verbatim and nothing of
      the orchestrator's, which takes only the verdict and the nits it
      fixes.
    - **The implementer never edits its task**, ruled by the person
      2026-10-19: "I don't think the implementer should ever edit the
      task." The orchestrator edits tasks in place of ad hoc messages to
      the implementer. The implementer builds to the task; if it hits a
      problem, it stops and reports to the orchestrator, which decides
      what to do — raising it to the person, by the ask rule, or stepping
      back and thinking it through — updates the task and sends the
      implementer back in. "This is all the sort of thing that you would
      do naturally, and that's the whole point of us loosening the
      prescribed flow within the build process." A feasible other way the
      implementer takes on its own is recorded in the ledger as its call,
      and the reviewers pick it up.
    - A hook refuses a dispatch of one of the workflows' agents whose
      brief the engine did not issue; Claude's other subagents are
      untouched. A refusal is recorded, so a template that keeps getting
      in the way is improved rather than worked around.
    - Deterministic here while the restructure loosens elsewhere, the
      person weighing it: the field gives Claude the path, not a way
      around review's independence; a steered review reads like a passing
      one, so the failure is invisible afterwards; and a more capable
      orchestrator steers more persuasively, not less. Switchboard's fix
      briefs ("keep fixes small", #106, 12 rounds) and the person's own
      builds improved once briefs were ruled.
    - **Brief quality** stays proposed as a measurement — the same
      implementer and reviewers on a thin brief against a full one; it
      tunes the templates. Two tests run alongside it on the replay's
      slices: the habit hooks (R33), and task size, the same work cut
      into tasks either side of the 10,000-line guide, which moves where
      the guide sits; when the task-size test runs is Claude's call.
- **The gap analysis counts the person's own session as another** (Fumi,
  2026-09-01: "I don't believe I have another session in progress"). A
  bug in the released epic menu, not fixed on its own: the person ruled
  2026-10-12 that the restructure takes it in. It goes with the
  background run (R10, ruled 2026-10-13): nothing runs at the menu, so
  nothing counts sessions there.
- **Shape review — evidence read 2026-10-12** (six read-only agents;
  picture redrawn at the artifact link above, version 2). On the
  workflows: Fumi, Portal, Tick, agntc, Mint. Without: Switchboard, FlowX,
  the internal product. Plus this repo's hand-run process and the workflows' history
  back to Evvi.
  - **Gates.** Process gates take the default 60–82% of the time (Fumi
    since 08-31: 201 of 246; conclude 25/25, wrap-up 20/20, resume 24/25,
    message offers 30/32 and 21/25, finding batches 30/32; re-review
    declined 18 of 21). The one gate genuinely decided was defer (11 of 16
    typed). In Fumi's decision phases 43% of the person's replies set their
    own direction: decisions happen in conversation. Portal 60% default,
    Tick, agntc and Mint about 70%.
  - **Volume and reads.** Portal's features wrote 2.89M words: discussion
    and spec 11%, plan and tasks 27%, review, analysis and tracking 61%.
    Agent reads since 08-31: spec 871, analysis 243, plan 157, tasks 84,
    discussion 24, review reports 19, tracking 13, investigation 9. In
    Tick, agntc and Mint no later unit referenced v1's planning,
    implementation or review files (about 470k words). Words track the
    workflow version, not the change: a 184-line Tick fix in September
    wrote 70k words; March bugfixes of the same size 5–10k.
  - **Loops.** Portal: analysis added 631 tasks to 847 planned, about
    three checking agents per builder; a feature passed review after 128
    tasks and 8 analysis cycles, then needed 10 bugfixes in 5 weeks, one a
    regression of two earlier fixes; restore 6 bugfixes, resume hooks 5.
    History: four review loops each gained brakes instead of being
    removed; "since the agents began running on Opus 5, no review has
    converged". Review earns its place on large surfaces (Mint's first
    pass found crashes).
  - **Linear types always complete** (Portal bugfix 26/26, quick-fix
    16/16). Epics stall in discussion: Fumi 12 weeks, 361k words, no spec,
    coupled topics concluded and reopened up to 10 times with about 145
    messages between them.
  - **Questions.** About one reply in five to Claude's questions is not an
    answer (Switchboard 15 of 69, the internal product 17%, Tick about 28 of 123
    substantive). Over-asking in every project ("Aren't these just obvious
    decisions?"); five of the internal product's last seven questions cited an earlier
    decision. The person: "What's the product consequence of this? That's
    the only thing that should be surfaced to me, other than complex
    coding architectural stuff." The opposite failure in this repo: acting
    before a go is the largest correction class (31 of 93 feedback
    memories are communication or authority, 13 of them that one fault),
    and memory-by-incident does not generalise.
  - **The internal product** stalled because its core model was handed to the
    builders: an overnight build filled 22 undecided points with defaults
    and questions became sign-offs of built code. **FlowX**: undecided
    things read as decided (documented ahead, undiscussed draft code cited
    as evidence); spike, lock, canonical on its design boards; its record
    split broke where work moved fastest. **This repo**: one go gate after
    the shape, then autonomy; walks (running the product's prose) find the
    most; tracking is its weakest part.
  - **Proposals, ruled 2026-10-12 (R40–R42 and the R12, R29, R32
    additions):** process gates learned
    from the gate-answer log (automatic once answers show ceremony, back
    if answers vary; authority gates never); three authority gates
    (approve the map, ready to build with spec sign-off folded in, and
    finish); discovery orders topics foundations first; what is kept is
    record, log, spec, evidence and a short review report, with tasks in
    the plan's tracker and tracking, analysis and per-task report files
    gone; spikes gain a lock step (spike, lock, canonical) and count as
    evidence only for what the person reviewed; the feature map groups
    bugs by area so tracking can flag a hotspot; the knowledge base's value
    over plain search joins the measurements.
- **How the task driver carries per-phase task writing** (R35). The cut
  itself lives at the end of `spec.md` (Layout on disk).
