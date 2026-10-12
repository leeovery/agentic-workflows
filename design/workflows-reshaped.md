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
rope. The goal is the person asked about what they need to decide and never
interrupted for what Claude knows how they would answer, with the product
coming out the way they want it rather than the way a model's priors would
make it.

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
  outline, then a build by the person's `orchestrate` skill (481 agent
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
  Goosemates, also vibed (229 commits, 27 Sep – 1 Oct), has stalled on
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
  time; how a plan gets made, or how Claude reasons, does not. The
  person's own skills (`pr`, `orchestrate`) already have this shape: house
  rules fixed, the work left to Claude.
- **R3 — Explicitness, not length.** Obedience comes from explicit rules and
  single doors, not from volume; length dilutes. A one-line rule naming a
  verb is more explicit than pages of steps around it. Control flow lives
  in the engine, never in prose.
- **R4 — Drift is caught by outcomes.** Prose tests assert outcomes (calls
  made, write order, the world afterwards), never steps. A contract that
  keeps slipping in walks gets a verb or a check, never more prose. The
  prose is evaluated on each model it runs on, at the effort levels it
  runs at, and re-audited after each model release.
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

## Stages and phases

- **R9 — Stages stay; phases change.** The stages remain Discovery,
  Definition and Delivery. The phases:
  - **Discovery stage:** discovery, decision, experiment, investigation.
  - **Definition stage:** specification.
  - **Delivery stage:** implementation, review.

  Research folds into **decision**, as one of its tools. Planning splits:
  the phase cut moves into specification, and tasks are written at the
  start of each build phase. Scoping goes with the quick-fix ceremony
  (R21). The phase names `implementation` and `review` stay; the
  implementer's role is called **the builder**. The merged phase is never
  called "discussion".

## Strand A — restructure

### Discovery

- **R10 — Discovery keeps its shaping.** The high-level shaping
  conversation is the strongest part of the workflows: the person talks
  the product through once and the conversation becomes the record the
  topics come out of. The product-level conversation on the roadmap, the
  work-type commit, the discovery map, the briefs and the gap analysis all
  stay. Two things change:
  - **Routing by what needs the person.** Each topic is routed
    **discuss** (it holds questions that need the person) or **build**
    (it holds none; the builder makes its calls against the brief and the
    shape). This replaces routing to research or discussion everywhere
    that routing reaches today: the map, where a message sent to a topic
    lands, and the epic menu's new-topic doors. Claude proposes the
    routing with the map and the person corrects it; when unsure, a topic
    is routed discuss.
  - **Each brief lists its topic's agenda**: the questions that need the
    person. The agenda is the decision phase's definition of done (R11).

  Whether a door is one-way is set by what depends on the decision —
  persisted data, external contracts, decisions stacked on it — not by
  the size of the change; a public command surface is two-way until
  something depends on it. Fumi, read by topic name only:
  engine-architecture, note-model, storage-and-sync, platform-support and
  licensing would route discuss; note-window, management-window and
  status-and-alerts, 38% of its discussion volume, would route build —
  except where the person cares (R24), which in Fumi includes its visual
  design.

### Decision

- **R11 — One conversational phase.** Research and discussion merge.
  Research is done to give a decision its data and belongs in the same log
  as the decision. The phase:
  - **Record and log.** Each topic keeps a **record** — current decisions
    only, rewritten in place, each with its why and what it rules out —
    and a **log** — the journey, options, false paths and reversals,
    appended and never rewritten. The record is what downstream phases and
    the knowledge base read first; the log keeps the person's thinking and
    why minds changed. This absorbs the record-and-log programme (folded
    in by the person 2026-10-12, built first in strand A) and ends the
    problem specifications were partly invented for: telling a false path
    from a final decision. FlowX kept exactly this split by hand; without
    it Switchboard's reasons ended up outside git.
  - **Every record entry says who decided it:** the person, Claude, or
    the person handing it over ("your call"). A Claude suggestion can
    never sit in the record as the person's decision — the spec review
    catches an unowned decision in the golden record. Whether the record
    also holds findings ("what we now know") beside decisions is open.
  - **The map is the definition of done.** The Discussion Map is seeded
    from the brief's agenda, and the phase is done when it settles. Only
    questions that need the person go on it; a new one-way question met
    mid-conversation joins it.
  - **Calls Claude can make** go to the ledger (R23), not the map. "Don't
    care" hands a call to the builder and is recorded as the builder's.
  - **Tools:** deep dives to learn, spikes to see and feel (R12),
    experiments to measure (unchanged: a rigid laboratory for questions
    neither side can answer).
  - **One closing review pass**, aimed at unsettled questions that need
    the person and contradictions with other topics' records — not a
    background reviewer generating detail throughout the session.
- **R12 — Spikes are encouraged, and their artifacts are evidence.** **A
  spike is code or design that is never wired into the product**; size
  does not decide it (FlowX's drafts are 323 files and still a spike;
  Switchboard v1 was wired and shipped, so it was a product built fast,
  not a spike). A spike is anything that can be looked at or pressed: a
  design board, a constrained design generator (Switchboard's
  terminal-cell generators are the example), draft code, a format trial,
  a working prototype to scroll and feel. Spikes live inside decision
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
  drift.** No design tool is named in the workflows.

  Whether a product gets the workflows at all is the person's decision,
  made by installing them; the workflows never ask it. Building a v1 fast
  is done outside them, and a later install starts from the existing
  brownfield assessment, which reads what was built.

### Between topics

- **R13 — Topics talk through mailboxes.** A topic never writes into another
  topic's record: a call that looks obvious through one topic's lens can
  read differently with the other topic's context in view, and in Fumi
  the back-and-forth between topics produced better decisions. The mailbox
  stays a queue of files, one message each (it was once a section of the
  discussion document; moving it out was right). With research and
  discussion merged, a topic has one mailbox, so the choice of which
  phase a message lands in goes. What changes is the ceremony of
  answering:
  - the report after a send ends with one command that opens the target
    topic directly on that message, to run in another pane or later. None
    exists today: the report says only where the message landed. The
    engine already composes a continuation for its handoff, but phase
    skills cannot be typed as commands and the start skill takes no
    arguments, so the open needs either a command-line form that starts a
    session with the continuation or arguments on the start skill;
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

- **R14 — Specification stays the golden record.** The spec is the document
  the build reads and the knowledge base serves for later decisions.
  - Topics are grouped into buildable units, as today (the grouping now
    runs in the epic menu), and the spec is assembled from their records
    and the build topics' briefs — assembly, not archaeology.
  - It marks what it leaves to the builder.
  - It ends with the **phase cut**: phases in build order, each an
    independently verifiable slice with acceptance criteria written as
    scenarios. Those criteria are the test list (R33).
  - Each invariant names the hard check that enforces it where one can
    (R34).
  - Canonical assets are linked from it: the builder cannot build a design
    it has not seen.
  - One review pass: fidelity to the records, contradictions between
    topics, unsettled questions that needed the person. The pass that
    hunts undecided detail goes — the builder decides that detail.
  - Correcting a concluded spec stays the corrigendum route, made one verb
    that applies the edit, writes the entry and re-indexes.

### Implementation

- **R15 — The builder runs the build.** Its shape is the person's
  `orchestrate` skill, proven on Switchboard: Claude orchestrates, agents
  at a chosen model and effort write each slice, review sits between
  every slice and its merge, and the one gate before building is the
  person approving the phase cut as a short outline — Switchboard's
  14-stage plan was approved from 600 words, and the person never read
  the 41k it became. The workflows carry the shape in their own prose,
  self-contained; they never depend on a personal skill. What planning's
  set-up writes today (the plan's context and its cross-cutting
  references) moves to the spec or the phase start. Per phase:
  - **Tasks are written when the phase starts**, against the code the
    previous phase left, and recorded in the plan's task tracker with
    their dependencies — and which can run in parallel — before anything
    runs. Tasks written months ahead describe code that turned out
    differently.
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
  - **No code change without a task.** When something outside the plan
    turns up — a bug the person reports, a gap the builder finds — Claude
    judges where it goes (this phase, a later one, the inbox, the roadmap)
    and it lands through a verb. Fixing it off the books is impossible:
    the commit door refuses a code commit that names no task.
  - **Notes for later** (today's banking) are written by a verb and read by
    the phase review. The machinery around banking (the flag, the deposit
    reference, the separate judge) goes.
  - **One independent phase review** closes each phase: each task's
    criteria, the phase's coherence, what should be consolidated. Its
    fixes land before the phase closes.

### Review

- **R16 — Review layers go from five to two.** The phase review (R15) and a
  final review: the whole change-set against the spec's intent by
  independent agents, with the ledger read as a whole for calls that
  looked fine one phase at a time and are wrong in combination. The
  per-task reviewer goes only after a measured comparison on a real phase:
  one phase run with the phase review alone, and what it catches compared.
  Switchboard is the evidence against rounds: a reviewer reading code
  returns a full list every time, and the bugs that mattered were found by
  running the product. Extra assurance goes into verification (strand C)
  and, for slices where a subtle bug passes the tests (time, concurrency),
  tests aimed at that risk — never another reading round.

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

### Work types

- **R18 — Epic.** discovery → decision (discuss topics) → specification →
  implementation → review.
- **R19 — Feature.** An epic with one topic; decision is skipped when the
  brief holds nothing for the person. Pivot and absorb stay.
- **R20 — Bugfix.** discovery → investigation → specification →
  implementation → review. Investigation's rigour stays — symptoms, code
  analysis, root cause before fix — with its procedure loosened like every
  phase's. Investigation is the log of finding the cause, dead ends
  included; the specification is what the builder works from and the
  golden record the knowledge base keeps. The fix's test fails on the
  unfixed code. A root cause that is really a design problem raises, and
  may become a feature; a bug folded into a feature skips investigation,
  as the mailbox rework ruled. Investigation is not itself split into
  record and log: it is the log, the specification is the record.
- **R21 — Quick-fix.** Quick must be quick: no scoping document and no plan.
  Claude does the work, runs the tests and linters, commits, and writes a
  ledger line if it made a call. It stays a tracked work unit on the start
  menu that closes. Review runs only if behaviour changed. Work that needs
  a design conversation is not a quick-fix; Claude says so and it moves to
  feature or bugfix. Every way in that hands a quick-fix to scoping today
  (the roadmap pull, the inbox's start-now path) is re-aimed. (Detail
  still to walk.)
- **R22 — Cross-cutting.** discovery → decision → specification, ending
  there: a project-level record later topics read. Kept for mature
  projects; unused so far. A unit promoted from an epic's specification
  has no discovery log and its moved topics read promoted; the decision
  phase meets them as they are.

## Strand B — trust

Reworked 2026-10-12 into a layer the engine computes: whether Claude asks
is arithmetic over the person's own answers, never Claude's judgement. Its
detailed design is pinned by the person until the shape review (Open)
settles, and starts from the list of kinds of question (R25).

- **R23 — The ledger.** Every call Claude makes without asking is
  recorded: what it decided, the kind of question, what else it could
  have done. Written by a verb, never edited by hand. The person reads it
  only when they choose; blind questions bring samples to them (R26).
- **R24 — Whether to ask is computed.**
  - **Facts are checked, intent is asked.** A question that reading the
    code, the record or running something can answer never reaches the
    person: Claude checks it. FlowX ranks the person last as a source of
    facts and first as a source of intent; poteto-mode prototypes instead
    of asking "which approach" when running something could answer it.
    Only questions of intent and taste enter the trust layer.
  - **Three parties.** Claude supplies the question and its own answer,
    sealed where the person cannot see it. The engine decides whether to
    ask, from stored counts; the same inputs always give the same
    decision. The person supplies answers, and each becomes evidence.
  - **The rule:** ask when the pessimistic overrule rate × the cost of a
    wrong call exceeds the cost of asking.
    - **Pessimistic overrule rate** — per kind of question, per person,
      per model: the upper end of a 95% range on how often the person's
      answer differs from Claude's sealed answer (a beta distribution over
      the weighted counts of R25). Few answers leave the range wide, so
      the system keeps asking: 3 agreements give 53%; 10 give 24%; 30
      agreements and 1 overrule, 14%; 45 and 7 (Switchboard's rough mix),
      23%; 100 agreements, 3%.
    - **Cost of a wrong call** — per kind, on a 1–10 scale the person
      sets; where door type lives. **The person cares about it** raises
      it: wrong there costs them more than its reversal (visual design in
      Fumi is the example — the person had a picture of it and wanted it
      their way).
    - **Cost of asking** — by context: cheap in a conversation, dearer
      mid-build where a question blocks work.
    - **Frozen always-ask kinds** — data model, external contracts,
      destructive operations, security. No count loosens them.
    - Worked: error handling at cost 3, asking at 1 — three agreements
      still ask (0.53 × 3); thirty agreements and one overrule go quiet
      (0.14 × 3).
  - **Raising is an engine command paired with the written rule** — never
    a prose rule alone; uptake follows design, not availability. A raise
    is drawn by the engine and readable cold: what is being decided, why
    it matters, Claude's lean, what changes either way — Switchboard's
    non-answers came from questions the person could not follow.

  The vocabulary is the existing ask-or-decide reference's: it already
  asks for expensive-to-reverse calls; it gains "the person cares" as a
  reason to ask, the ledger as the durable landing for decided calls, and
  reach into the build, where the builder's block rules are separate
  today. Door type is one reason to ask, not the name of the split.
- **R25 — Kinds, evidence and the trust log.**
  - **Kinds of question** key every count, so the list is the foundation
    and where the person's taste shows most (UI look and feel and UX flow
    are probably separate kinds; naming may be its own). Gate answers are
    keyed by the gate's name, which is fixed. Raises are labelled from the
    fixed list by something other than the Claude that wants to proceed —
    a decision model with neutral option names, or a separate agent — since
    a self-labelled question can drift into a trusted kind. Claude's own
    stated confidence never gates: in REFLEX, wrong calls averaged 0.78.
  - **Evidence is weighted by what it proves:**
    - a blind question (R26) answered cold — full weight;
    - "agree" to a recommendation the person was shown — half, since the
      shown answer may have steered them;
    - a later reversal — a full disagreement, recorded as a new event
      pointing back at the call it reverses and cancelling the earlier
      agreement; nothing is rewritten, so an "I agree" given in fatigue
      and overturned later counts as an overturn;
    - "didn't follow" — no weight, and a first-class answer: a yes to a
      question the person could not follow is not agreement.

    Older answers fade, so a change of taste shows. A new model inherits
    its predecessor's counts at a discount and earns its way back. The
    procedure stays fixed across model generations; only the numbers move.
  - **The trust log** is append-only, at user level in the person's
    workflows config directory (which already holds the system config and
    each conversation's state), across all their projects, reached through
    the engine. Only the engine writes it; Claude cannot edit it or the
    costs. Events: each raise with Claude's sealed answer and the person's
    answer; each gate answer by the gate's name with the option the engine
    recommended and the one picked (the gate mod already sees the click
    and the engine's payload already marks the recommended row, but
    nothing records answers durably, nor answers typed at the prompt);
    each ledger call; each blind question; each reversal. Keys carry scope
    (project, kind), and a project's own rows override the person's
    general numbers where it has its own taste. Counts are derived from
    the log, never stored.
  - **The matrix** is an engine-drawn screen the person can read and
    correct; trust stays their decision. **Tuning is by replay:** the
    engine replays the log against a proposed setting ("last month this
    would have skipped 40 questions; you'd have overruled 2 of them"), so
    costs are set from evidence, not feel. A new user has no history, so
    anything with real cost asks: the system starts where today's
    workflows are and loosens only on evidence.
- **R26 — Blind questions.** The person's idea (2026-10-12), replacing
  after-the-fact spot checks, which anchor the person on Claude's answer
  and ask them to judge later without the context they had. Now and then
  the engine holds back a call Claude would have made silently, keeps
  Claude's answer sealed, and asks the person the question cold — in the
  moment, in context. Afterwards it shows what Claude would have picked.
  - The engine draws them at random, more often where a kind's range is
    wide (little history, a new model), never below a small floor; Claude
    never chooses which. Every draw is logged.
  - Mid-build, for a call cheap to undo, Claude proceeds on its own answer
    while the question waits; a disagreement undoes it.
  - The comparison is how the person comes to trust Claude, not only how
    the system does: "Claude would have picked the same, 14 of the last 15
    on error handling".
  - Reading the ledger as a whole, at the final review, still looks for
    calls that are fine alone and wrong in combination.
- **R27 — The record of the person.** The person's preferences, each with
  its reason and examples — not a decision tree, which breaks on the
  first case it did not anticipate. Claude proposes an entry when it sees
  a pattern or the person states a preference outright; it steers nothing
  until confirmed at a gate. It lives at user level, ships empty for a new
  user, and fills from that person's raises and overturns. Claude Code's
  memory cannot do this job: it is keyed to the project directory, so
  what one project learns never reaches another. What transfers between
  projects is taste and principle, not specific decisions.
- **R28 — Decision models come later, as labellers.** The bare loop ships
  first: the log, the ledger, the counts, the arithmetic in the engine. A
  decision model joins later, first to label kinds (R25), never as the
  ask oracle — decision models are weakest at exactly "should I ask"
  (REFLEX: 68.8% right on clarification decisions, 51.2% on risk):
  - one provider interface written to Jev's API, Jev the default as the
    cheapest, Clef behind the same interface (open weights, self-hostable);
    the engine's knowledge-base providers are the precedent;
  - which model labels which kind is chosen by running both on the
    person's labelled history, never from vendor tables;
  - neutral option names; a threshold per kind set from about 100 of the
    person's labels by the lower-bound rule and checked on held-out items;
  - probabilities recalibrated on the person's labels before they steer
    anything; fine-tuning a model on the trust log is the last rung;
  - a decision model does not sample, so the same question gets the same
    number every time — the determinism a probability asked of Claude
    cannot give;
  - a per-question signal — how likely the person is to agree with this
    particular answer — refines the per-kind counts last; counts come
    first because they explain themselves;
  - the loop adjusts only on evidence larger than noise, checked against
    held-out data.
- **R29 — Starting numbers.** Two measurements before any workflow change,
  on hold since 2026-10-12 by the person's word until the shape review
  settles, since it may change what they count. Both also count
  non-answers. Switchboard's 69 hand-classified replies (Motivation) are a
  first sample.
  - **Transcript mining.** As of 2026-10-06 the person's transcripts
    numbered 103 for Fumi (from mid-July), 152 for Portal, 36 for Tick
    and 1 for Goosemates. Every point where Claude offered a choice with a
    lean and the person answered is classified (agree, pick another,
    amend, defer, didn't follow), within a recent window the person
    chooses, since the workflows changed over time. At Jev's price 100
    million input tokens costs about $4. This tests the person's estimate
    that 60–80% of Fumi's decisions matched what Claude would have said,
    and doubles as the trust log's first labels. pstack's `/automate-me`
    and `/recall` are prior art to read first.
  - **The Fumi decision replay.** 30–40 decisions sampled across topics,
    each pre-classified one-way or two-way. Each becomes a question with
    its answer removed; the context is the topic's brief plus the record's
    one-way decisions — what a build session would have under this
    design — with no decision the sample asks about leaking in. A fresh
    agent answers from the packet alone, with no file access (the answers
    sit in the Fumi checkout), framed as real builder work and never told
    it is being evaluated. For each question it gives its answer, its
    confidence and whether it would have asked. Answers are sorted same,
    equivalent or different against the record; the person judges only
    the different ones. The numbers that matter are the overturn rate by
    door type and how well Claude's "would ask" matches the classification.
- **R30 — Every optimising loop has a counter-measure** and the frozen
  anchors of R24, so trust cannot drift by optimising its own metric.

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
  - **Evidence is computed, never narrated.** Scripts produce verdicts;
    Claude never types a count. Zero tests is "not proven"; a criterion
    whose tests were skipped is "named, not run".
  - **Verified work is cheaper to get wrong**, so verification lowers
    reversal cost in the ask rule: history is one lever on how often
    Claude asks, verification the other.
- **R33 — Test adequacy by outcome.** Every acceptance criterion has a test.
  Test quality is checked by machine: mutation testing where the language
  has a tool, otherwise deliberate breaks that must turn the tests red.
  Habit hooks catch named smells and inject their fix.
- **R34 — Hard checks over soft rules.** A spec invariant names the check
  that enforces it — an architecture test, a lint, an import-graph rule —
  where one can, so a decision holds even for builders who never read the
  record. A review finding that recurs becomes a project rule rather than
  coming back each cycle. The person's coding rules (for Laravel: thin
  controllers, the action pattern, data objects, never passing primitives)
  split: what can be checked becomes an architecture test (Pest supports
  them); the rest stays guidance handed to the builder. How project skills
  and rules reach the builder is redesigned within this strand. The more
  hard structure a codebase already has, the less up-front decision it
  needs.

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
    document to re-read; the decision phase's note names the record and
    the log.
  - Anything that can use the mod to make the system better should.

## Measures and levers

- **R36 — The system adjusts itself through four measures**, each moving one
  lever:

  | Measure | Lever |
  |---|---|
  | Overturn rate per kind of question | how often Claude asks |
  | Review findings per phase | where the build is cutting corners |
  | Bugs found after review | where verification has a gap |
  | Contracts slipping in prose tests | which contract needs a verb or a check |

## Migration

- **R37 — Every existing project migrates fully.** One canonical path (R8).
  Two kinds of change:
  - **Mechanical, as code migrations:**
    - research and discussion items become decision items, and their
      directories move; map routing of research or discussion becomes
      discuss (build is never assigned by migration — a topic already
      talked through is a discuss topic);
    - a plan's phases become the specification's phase cut; tasks already
      written stay as tasks, which the builder revises at phase start like
      any other;
    - state the design drops is deleted: banking, staging, review-cycle
      tracking, scoping state;
    - session machinery in the cache is cleared, and sessions resume from
      the artifacts, as they already do after compaction;
    - a review or spec-review cycle in flight is closed out, and the next
      entry runs the single pass;
    - a topic's research and discussion mailboxes merge into one,
      messages renumbered (an earlier migration's collision rule is the
      precedent); fields added since this record was first written —
      promoted topics, unstarted messages, what a specification
      incorporates, where a topic came from, a roadmap item's kind — carry
      over unchanged;
    - the ledger and the trust log are new and start empty.
  - **Judgment, as one directive (R38): every decision topic gets a
    record.** Today's discussion file interleaves decisions with the
    journey, so code cannot split it. The existing discussion file is the
    log — it is the journey — and moves verbatim, with the topic's
    research file joining it; that part is mechanical. Only the record
    needs judgment: Claude derives the current decisions from the log,
    every entry citing the log section it came from, inventing nothing; a
    point the log leaves unsettled is recorded open. Every topic gets a
    record, concluded ones included, so the new design never meets a
    topic without one. The knowledge base re-indexes, records ranked
    ahead of logs.
- **R38 — Directives.** A new migration kind whose transform is judgment,
  extending today's verification addenda (judgment checks workflow-start
  runs before the migration commit) from a check after a transform to the
  transform itself. Its shape, from the dex product:
  - it is the engine's decision, written, reviewed and rehearsed before
    release;
  - it names the files it may touch;
  - its check must pass before it is recorded done, through an engine
    verb: mechanical (every record entry cites a log anchor that exists;
    every decided map item appears) plus an independent verifier agent
    for coverage;
  - its unit is the topic: each record is committed once it passes; an
    interrupted topic is discarded and redone from the start, never
    resumed from half a judgment;
  - it never asks; uncertainty lands as open;
  - the migration is recorded only when every topic has passed, and boot
    refuses to continue past an unfinished migration, so no session ever
    works in a half-migrated project;
  - a large epic's topics may each go to their own agent.
- **R39 — Rehearsal before release.** The migration runs first against
  copies of Fumi, Portal and Tick in throwaway worlds built the way the
  prose-test harness builds them. Fumi is the hardest real case: 9
  concluded discussions and 2 in progress get their logs moved and records
  derived, and the two in progress resume in decision with both; its 2
  unstarted messages stay in their mailboxes; its 3 completed research
  files join their topics' logs.

## Sequence

1. **Clear the base.** Done by v0.8.16: the entry layer (one skill per
   phase, one continue skill, a lighter start), the gate-mod compaction
   work, the mailbox and inbox rework and the engine displays landed first.
   The entry-layer design landed rather than folding in; this programme
   builds on it, and merging research and discussion is now one skill and
   one row in each of the engine's phase tables.
2. **Review the shape, then measure.** The shape review (Open) first; then
   transcript mining and the Fumi replay (R29). Nothing in the workflows
   changes; it tests the premise and names the kinds of question the
   ledger needs.
3. **Foundations shared by A and B.** The ledger, raise and gate-answer
   logging, the user-level store. Logging collects from the day it ships,
   before anything depends on it.
4. **Restructure (A)**, the record-and-log split first, with its
   migration and directive, and
   **verification (C)** alongside — C stands on its own and is useful
   under today's workflows.
5. **The ask rule on (B)**, calibrated to ask what is asked today and
   loosening only as evidence supports; the decision model last.

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
  FlowX, Goosemates), and this repository's own design history. Spikes,
  trust and verification are sanity-checked against the same evidence.
  Output: diagrams of the shape, and this record revised.
- **The trust design** — pinned by the person on 2026-10-12 until the
  shape review settles; starts from the list of kinds of question (R25).
- **Still to walk:** the review stage in detail; the epic menu once phase
  gating thins; bugfix in detail, with Portal's live bugfix ("killing all
  sessions wipes restore data") as the test case; quick-fix in detail.
- **The product record.** A current view of the product's character at
  project level beside the roadmap — record-and-log one level up — so
  every two-way call is made against the product's stated character
  rather than the model's priors. The roadmap's sessions are a log and its
  map lists capabilities, not character. It would reverse the roadmap's
  ruling that nothing is distilled at product level. The feature map (R32)
  is a candidate form: a current view kept honest by being run. The
  person's call.
- **Shape review — evidence read 2026-10-12** (six read-only agents;
  picture redrawn at the artifact link above, version 2). On the
  workflows: Fumi, Portal, Tick, agntc, Mint. Without: Switchboard, FlowX,
  Goosemates. Plus this repo's hand-run process and the workflows' history
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
    16/16). Epics stall in decision: Fumi 12 weeks, 361k words, no spec,
    coupled topics concluded and reopened up to 10 times with about 145
    messages between them.
  - **Questions.** About one reply in five to Claude's questions is not an
    answer (Switchboard 15 of 69, Goosemates 17%, Tick about 28 of 123
    substantive). Over-asking in every project ("Aren't these just obvious
    decisions?"); five of Goosemates' last seven questions cited an earlier
    decision. The person: "What's the product consequence of this? That's
    the only thing that should be surfaced to me, other than complex
    coding architectural stuff." The opposite failure in this repo: acting
    before a go is the largest correction class (31 of 93 feedback
    memories are communication or authority, 13 of them that one fault),
    and memory-by-incident does not generalise.
  - **Goosemates** stalled because its core model was handed to the
    builders: an overnight build filled 22 undecided points with defaults
    and questions became sign-offs of built code. **FlowX**: undecided
    things read as decided (documented ahead, undiscussed draft code cited
    as evidence); spike, lock, canonical on its design boards; its record
    split broke where work moved fastest. **This repo**: one go gate after
    the shape, then autonomy; walks (running the product's prose) find the
    most; tracking is its weakest part.
  - **Proposals put to the person, not yet ruled:** process gates learned
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
- **Logs by session or by topic.** Proposed and not ruled: a session's log
  records the whole conversation wherever it went, while each decision
  lands in its own topic's record (subject to R13). The alternative keeps
  a log per topic.
- **The trust store's shape:** the kinds of question, the cost scale, the
  cost of asking, the weights, how fast old answers fade, the discount on
  a model change, the floor for blind questions. The user-level store
  lives in the workflows config directory, which the engine already
  reaches.
- **Whether a decision record holds findings** ("what we now know")
  beside decisions — carried in from the record-and-log session the
  person closed.
- **Where the phase cut lives on disk,** and how today's plan formats carry
  per-phase task writing.
- **How project skills reach the builder** (R34).
- **The per-task reviewer measurement** (R16).
- **Starting the measurements** (R29) — on hold by the person's word until
  the shape review settles.
