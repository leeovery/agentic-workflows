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
  cannot refuse — a question asked in plain prose, an extra review round —
  prose walks catch, since they assert outcomes (R4).
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
  drift.** A design spike runs in rounds and ends in a **lock**: the
  locked design becomes canonical and the spike goes, a rejected spike's
  rejection is kept, and a later spike may challenge a locked design with
  a stated hypothesis (FlowX's design boards). A spike is evidence only
  for what the person reviewed in it: scaffolding nobody discussed is
  never cited as decided. No design tool is named in the workflows.

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
  references) moves to the spec or the phase start.

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
     not a single test cycle, not a grab-bag of unrelated changes.
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
    Goosemates left its screens late and the person found a dashboard of
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
    against the code the previous phase left, and recorded in the plan's
    task tracker with their dependencies — and which can run in parallel —
    before anything runs. Each uses the task template (problem, solution,
    outcome, acceptance criteria as scenarios, spec reference) and names
    no mechanism the record did not decide. What went stale in tasks
    written ahead was exactly the mechanism and the `file:line` anchors
    into code earlier phases changed; the template's fields never needed
    amending, and 46% of all delivered tasks were already written mid-build
    against the code with only the template, the tracker's adapter and a
    short writer agent. Dependencies are recorded within the phase as its
    tasks are written: the plan-wide pass that clears and rebuilds every
    dependency goes, and the tracker's readers tell "every task is done"
    from "the next phase is not written yet".
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
    judges where it goes and it lands through a verb, one per door: a task
    in this phase or a later one, a note for the phase review, a spec
    correction, a message to another topic, the inbox, the roadmap. An
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
  - **Notes for later** (today's banking) are written by a verb and read by
    the phase review. The machinery around banking (the flag, the deposit
    reference, the separate judge) goes.
  - **One independent phase review** closes each phase: each task's
    criteria, the phase's coherence, what should be consolidated. Its
    fixes land before the phase closes.
  - **What the person sees during the build**, agreed 2026-10-12. The
    person's aim: wide collaboration early in the cone, fewer touches as
    the work moves on, and a build that runs start to finish unattended,
    stopping only where the shape says it must — a stop for good reason is
    a good outcome, not a failure. Engine-drawn, whatever order Claude
    works in:
    - when a task lands, its summary: what changed, which criteria its
      tests prove, the review's verdict, how many calls went to the
      ledger. Whether it then stops at a gate follows the phase's position
      (R40): learned by default, every task in step, none in auto;
    - **questions queue.** A task that needs the person parks, with
      whatever depends on it, and everything else carries on. The question
      waits in a queue the engine holds — a count on the progress view and
      first on the epic menu — and is drawn one at a time, product first,
      when nothing left can proceed without an answer or a phase ends. An
      open question would stall the whole build; a parked task stalls only
      what depends on it;
    - when nothing can proceed, the build stops with a report: what was
      built, what waits on the person and why, what runs after the answer.
      Danger and the authority gates stop what depends on them in every
      position.

    How the live progress (each task building, landed, parked) is shown is
    open (Open): the transcript cannot redraw it.

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
  - **Every finding lands somewhere.** Below the floor: dropped. Above it
    and in scope: tasks in a closing phase, which that phase's review
    checks; there is no second final review. Out of scope: the inbox,
    through a verb, with no keep-or-drop offer — out-of-scope routing lost
    a real agntc defect that never reached the inbox and is still in its
    code.
  - **The report is short and product first**: what the person can now do
    that they could not, what was proven by running it and what was not,
    what was fixed, what went to the inbox, Claude's calls worth a look.
    Then finish, the authority gate. 8 of the person's 21 answers at
    today's review gate were typed, mostly asking what a finding meant or
    cost ("Can I now just safely reboot my computer…").
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
  - **What waits on the person first** — an authority gate (approve the
    map, ready to build, finish), a builder's question raised mid-phase,
    verdicts waiting (R23) — each with its door.
  - **Topics by what they need.** A discuss topic shows its progress
    through its agenda; a build topic shows it goes to specification from
    its brief; decided, in session, mail waiting and experiments waiting
    stay. A build unit shows specification, phase N of M, final review, in
    place of the plan rows.
  - The recommended row first, in the foundations-first order (R41); a
    topic in session elsewhere stays struck, so several open at once.
  - Grouping, discovery and back on the face; cancel, postpone,
    reactivate, pull forward, resume a completed topic and a new topic
    behind one door.
  - Gone: everything that kept research apart from discussion and
    everything about planning; the soft gates that remain become learned;
    decision named throughout. Cancelling a topic moves its waiting mail to
    the inbox; "dead end" goes — a topic that ends in not doing it is
    decided with that as its decision, or cancelled.
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

  Walked on 2026-10-12 on Portal's `killing-all-sessions-wipes-restore-state`.
  The person likes today's bugfix — prove the bug, investigate, document —
  and every product correction they made on the case landed in discovery
  or investigation, while specification and planning drew 14 presses and
  nothing typed and restated the fix twice (6.6k and 14.9k words, plus
  10.7k of spec review tracking). Ruled by the person:
  - **Both validations always run, and Claude acts on what they find,**
    recording it in the investigation. The address-or-dismiss gates after
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

  Settled with them: before leaning on a fix direction, Claude finds out
  how comparable tools handle the problem (the person had to ask how other
  tmux plugins save state); the specification is assembled from the
  investigation — root cause, the fix, the rules it keeps with their
  checks, the phase cut — with one review pass and ready to build from an
  outline; the first task runs a test on the unfixed code and records it
  failing before any fix (on the case the reproducing test was task 8 of
  phase 1, and only the final review checked it against the old code,
  where it failed in 1 of 11 trials); the plan, check-in and conclude
  gates become learned. The ask rule asked the case's kill-versus-detach
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
    proven; the person can ask for a review. Reviewing whenever behaviour
    changed would have reviewed about 11 of 20; the person chose review on
    2, and neither found anything that had to change.
  - Work that needs a decision from the person beyond a quick call moves to
    feature or bugfix through a verb; today that is a line of prose with
    no route. The size check before the work goes: it never stopped one,
    though about half changed behaviour and two made a design call inside
    scoping.
  - A set from the inbox runs in one sitting, each fix keeping its own
    unit, record and commit. It stays a tracked work unit on the start menu
    that closes.

  Walked and ruled by the person on 2026-10-12, replacing the earlier "no
  document" and "review only if behaviour changed". Evidence: 20
  quick-fixes (Portal 16, Tick 3, Mint 1), none since July; median change
  100 lines; the two with surviving sessions took about 3h20m each over
  three sessions and two handoffs, more than an hour of each build session
  spent waiting at gates that always got the same answer.
- **R22 — Cross-cutting.** discovery → decision → specification, ending
  there: a project-level record later topics read. Kept for mature
  projects; unused so far. A unit promoted from an epic's specification
  has no discovery log and its moved topics read promoted; the decision
  phase meets them as they are.

## Strand B — trust

Whether Claude asks is arithmetic the engine computes over the person's
own answers, never Claude's judgement. Designed on 2026-10-12 from the
person's history and their verdicts on it (R29); the person approved
each call on a page that day.

- **R23 — The ledger and the verdict queue.** Every call Claude makes
  without asking is recorded: what it decided, the kind of question, what
  else it could have done, and the evidence where it found out first
  (R24). Written by a verb, never edited by hand. The person reads it when
  they choose, and at the ready-to-build sign-off of a topic Claude
  settled (R24). Every departure — an answer that amends or overrules
  Claude's lean — joins a verdict queue: a page like the one the person
  used for R29, where they say, when they choose, what the product would
  have lost had Claude built its own answer: nothing, a fix later, or a
  real loss. Until then the departure counts as a real loss, so a backlog
  only makes Claude ask more. A verdict asked in the moment would cost a
  press just after a disagreement; asked later, it is one batch.
- **R24 — Whether to ask is computed.**
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
    ask, from stored counts; the same inputs always give the same
    decision. The person supplies answers, and each becomes evidence.
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
      puts it back at 21%.
    - **The threshold** — one number the person picks from a replay of
      their own history (R29): 20%, the person's pick. Set higher
      mid-build, where a question blocks work, once the build's own
      answers show by how much; until then the same. **Hard to undo** — a
      later change that would reach beyond the piece — halves it: a
      quarter of such departures were real losses, against a tenth of the
      rest, and in the replay the halving alone kept two real losses from
      going through. **The person cares about it** lowers it for a kind
      (visual design in Fumi: the person had a picture of it and wanted
      it their way).
    - **Danger always asks:** an option that could destroy, overwrite or
      expose the person's data or secrets, or weaken permissions or
      security. No count loosens it — 2 real losses in 28 decided, the
      highest rate of any kind. Data model and external contracts ask on
      evidence instead: a contract that would be hard to undo needs about
      28 answers without a loss, and in the replay the evidence alone kept
      94% of contract questions coming to the person. Fumi's tags were
      hard to reverse and, by the person's account, did not matter.
    - Worked, at 20%: behaviour goes quiet after 13 answers without a
      loss; one loss among its next answers puts it back over the line,
      and it asks again until the count outweighs it. A contract question
      that would be hard to undo needs the bound under 10%.
  - **The cone of collaboration** enters in three places, never as a key
    in the counts, which would split the evidence into cells too small to
    learn from. Discovery and research stay conversation: the person
    brings the idea, it is shaped together, and Claude never decides
    there alone — research questions departed 35% of the time (6 of 17),
    decision questions 17% (42 of 242). The rule runs from the decision
    phase on. Convergence hands a topic to Claude's settling, and
    mid-build the threshold rises (above).
  - **Convergence moves the work on.** After 8 agreements in a row in a
    topic, or on the person's word, Claude offers to settle the rest: how
    many points are open, how many it would settle, and which still come
    to the person by the rule ("12 open: I'd settle 9; 3 come to you — 2
    contracts, 1 look"). On yes, Claude settles them in the ledger, asks
    the rest in one batch and brings the topic to ready to build, where
    the person signs off with the ledger in view. Declined, it waits for
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
    Raises ready at once arrive as one batch. The person could not follow
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
    behaviour; else internals. Two models agree on the composed kind
    85–89% of the time, against 50% picking from a list (R29); the steps
    a user goes through split them, so flow is part of behaviour. "Would
    a later change reach beyond the piece" also halves the threshold, and
    "could Claude find out" routes a question to checking (R24). The
    labeller is never the Claude that wants to proceed — a separate model
    call, Jev later (R28) — since a self-labelled question can drift into
    a trusted kind. Gate answers are keyed by the gate's name. Claude's
    own stated confidence never gates: in REFLEX, wrong calls averaged
    0.78; in the Fumi replay right and wrong calls overlapped (R29).
  - **Evidence is weighted by what it proves:**
    - a blind question (R26) answered cold — full weight;
    - an answer to a recommendation the person was shown — full weight.
      A shown answer can steer agreement (shown 82%, blind 51%, R29), but
      the rule counts real loss, and the blind replay's misses cost the
      product one questionable call in 37, the same 3% as shown answers;
    - a later reversal — a full disagreement, recorded as a new event
      pointing back at the call it reverses and cancelling the earlier
      agreement; nothing is rewritten, so an "I agree" given in fatigue
      and overturned later counts as an overturn;
    - "didn't follow" — no weight, and a first-class answer: a yes to a
      question the person could not follow is not agreement.

    Two starting values with no evidence yet — six weeks of one model —
    retuned by replay once the log holds it: an answer counts half once
    it is six months old, so a change of taste shows; a new model starts
    from its predecessor's counts at half weight and earns the rest. The
    procedure stays fixed across model generations; only the numbers
    move.
  - **The trust log** is append-only, at user level in the person's
    workflows config directory (which already holds the system config and
    each conversation's state), across all their projects, reached through
    the engine. Only the engine writes it; Claude cannot edit it or the
    settings. Events: each raise with Claude's sealed answer and the
    person's answer; each verdict on a departure; each gate answer by the
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
    person's counts from their other projects, capped at 20 answers'
    weight, are the prior the project's counts update; the pessimistic
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
    decisions. A new user starts with an empty log, so every question
    Claude has a lean on asks — where today's workflows are — and each
    kind loosens on that person's evidence (about 13 clean answers, 28
    where a change would be hard to undo; danger never). A user of
    today's workflows starts empty too: importing their transcripts
    (labelling, two checks, a verdict page — about $10–20 of model calls
    and an hour) stays out of the first release, added only if the first
    weeks of asking prove heavy. The person who designed this seeds their
    own log at build from the measured history (R29: the 410 questions
    both checks read alike, the 60 verdicts, the 1,744 gate answers), so
    it starts where the replay ended (the person's call, 2026-10-12).
- **R26 — Blind questions.** The person's idea (2026-10-12), replacing
  after-the-fact spot checks, which anchor the person on Claude's answer
  and ask them to judge later without the context they had. Now and then
  the engine holds back a call Claude would have made silently, keeps
  Claude's answer sealed, and asks the person the question cold — in the
  moment, in context. Afterwards it shows what Claude would have picked.
  - The engine draws them by a fixed share — one in ten of the calls
    Claude would make alone to start, more where a kind's range is wide
    (little history, a new model); Claude never chooses which. Every draw
    is logged. In the replay a twentieth or a fifth moved the outcome by
    one or two questions.
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
  first: the log, the ledger, the counts, the arithmetic in the engine,
  and the twelve questions of R25 answered by a separate Claude call. A
  decision model joins later as that labeller — Jev reads narrow yes/no
  questions, the shape the kinds now take — never as the ask oracle — decision models are weakest at exactly "should I ask"
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
      shown agreement overstates, as R25's half weight assumes.
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
      marks the menu-bar icon — evidence for the product record (Open).
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
  - **Seeding the process gates (R40).** 1,744 gate answers since June: 953
    at process gates, 482 at review-loop gates, 309 at navigation menus.
    The rule: a gate goes automatic once the one-sided 95% upper bound on
    leaving its usual answer falls below a threshold, with blind asks at
    5%. Replayed in time order: at 20%, 216 of 953 process-gate answers
    skipped (23%) and 5 would have gone against the person — all five
    challenges to the premise (three reroute pushbacks, two conclude
    challenges), not another option picked; at 10%, 10% skipped, 2 wrong.
    Seeded automatic at 20%: resume (63, none different), conclude (99,
    3), revisit, wrap-up, reroute, next phase, the project-skills and
    linters confirmations, correction, plan format, dependency approval.
    Spec sign-off qualifies by count and stays an authority gate. Where a
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
      matched.
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
  - **Proven**, defined by the person's ruling 2026-10-12: a phase's
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
  - **The feature map groups bugs by area,** so the tracking layer can
    flag an area that keeps breaking for a design look (Portal: six
    bugfixes around restore, five around resume hooks).
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
    the log, the build's its log and where the phase stands.
  - Anything that can use the mod to make the system better should.

## Shape review rulings

Ruled by the person on 2026-10-12 after the shape review (Open), on the
evidence recorded there: "pretty much what we already agreed, which I
think is a good sign."

- **R40 — Gates in three kinds.**
  - **Authority gates, fixed:** approve the map, ready to build (signing
    off the spec folds in here), finish. Never automatic; acting before
    the person's go is the correction they make most often.
  - **Product questions, computed** by the ask rule (R24).
  - **Process gates, learned.** Every gate answer is recorded by the gate's
    name (R25). A gate the person always answers the same way becomes an
    automatic step with a one-line report, and comes back if their answers
    start to vary. The gates that served review loops (finding batches,
    re-review, analysis cycles, per-task approval) go with the loops.
  - **A phase runs in one of three positions**, set once and switchable
    at any time — the person's idea, approved 2026-10-12: learned, the
    default (above); auto, where every process gate passes for the rest
    of the phase; step, where every process gate stops (Folio, where the
    person reviews and tests the work as it lands). A switch is stated
    intent, recorded in the trust log (R25), and outranks the learned
    counts; Folio shows one gate answered differently by purpose, which
    counts alone would blur. In every position the authority gates and
    danger questions (R24) stop. Where a gate offers auto, the person
    takes it at the first chance (task approval 32 of 36, task gate 20 of
    24, fix gate 15 of 22).
- **R41 — Foundations first.** Discovery orders the map's topics by what
  depends on what; the topics others depend on are decided first, so
  fewer messages bounce back and nothing is built on an undecided model
  (Fumi's coupled topics, Goosemates' skipped core model).
- **R42 — What is kept.** The record, the log, the spec, evidence and a
  short review report; the build's log joins them (R15). Tasks live in the plan's tracker. Tracking files,
  analysis files and per-task report files go: in every project only the
  spec was read downstream.

## Measures and levers

- **R36 — The system adjusts itself through five measures**, each moving one
  lever:

  | Measure | Lever |
  |---|---|
  | Overturn rate per kind of question | how often Claude asks |
  | Review findings per phase | where the build is cutting corners |
  | Bugs found after review | where verification has a gap |
  | Contracts slipping in prose tests | which contract needs a verb or a check |
  | Context spent before the first question, per phase | what a phase loads, and when |
- **R43 — A context budget.** Ruled by the person on 2026-10-12. The
  context a phase spends before its first question to the person is a
  measured number, per phase, with a budget; the walks record it, so a
  change that grows it shows. Three rules hold it down:
  - **The question comes before the reading.** A gate needs only what the
    engine holds. Records are read after the answer, never before a
    question whose answer may discard them.
  - **Resuming reads the record, never the log** (R11).
  - **Prescription lives in code.** What the person sees and what is
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
  58k, falls to about 15k under these rules. The harness's share is
  outside the workflows; which MCP servers load where is the person's
  setup. The person's compaction point is 467k.

- **R44 — The knowledge base stays, as the first look.** Ruled by the
  person on 2026-10-12 on the R29 evidence. The knowledge base is the
  cheap first pointer and the reach across work units, indexing records
  (current decisions), never logs. Plain search, when depth matters, runs
  in a helper agent so its cost stays out of the conversation (R43).

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
2. **Review the shape, measure, design trust.** Done 2026-10-12: the
   shape review (R40–R42), the four measurements and the person's
   verdicts (R29), and the trust layer (R23–R28, R40's positions), each
   call approved by the person on a page; then the walks of review, the
   epic menu, bugfix, quick-fix and the build, and how work is broken up.
   What remains before the plan is in Where things stand. Nothing in the
   workflows changed.
3. **Foundations shared by A and B.** The ledger, raise and gate-answer
   logging, the verdict queue, the user-level store, and the author's log
   seeded from R29's history. Logging collects from the day it ships,
   before anything depends on it.
4. **Restructure (A)**, the record-and-log split first, with its
   migration and directive, and
   **verification (C)** alongside — C stands on its own and is useful
   under today's workflows.
5. **The ask rule on (B)**, calibrated to ask what is asked today and
   loosening only as evidence supports; the decision model last.

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
- The trust layer, each call approved on a page (R23–R28, R40's three
  positions); the threshold, 20% halved where hard to undo; what ships is
  the procedure, never anyone's counts, with the author's log seeded.
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

**Settled from evidence, shown to the person, never explicitly agreed:**
- Review (R16): every finding lands somewhere, out of scope to the inbox
  by verb with no keep-or-drop offer; the short product-first report; the
  final review runs the product; the loop gates learned.
- The epic menu (R17): what waits on the person first; topics by what they
  need; build units by phase; the rarer doors behind one; research and
  planning items gone; cancelling moves mail to the inbox; "dead end"
  goes.
- Bugfix (R20): find out how comparable tools handle it before leaning;
  the spec assembled from the investigation; the first task proves the bug
  failing; the plan, check-in and conclude gates learned.
- The build (R15): one verb per door, a door for the agent writing a task;
  the commit door checks for a task and refuses a raw commit; dependencies
  per phase; the tracker telling done from not yet written; the transcript
  keeping the story (a headline per start, one block per batch, a product
  summary per landing).

**Shape only — agreed in outline, never walked in detail:**
- Discovery (R10, R41): routing discuss or build, the brief's agenda,
  foundations first.
- Decision (R11, R12): record and log, the map as done, spikes and their
  assets, the closing pass; the cone (R24) in practice.
- Mailboxes (R13): the one-command open needs a command-line form or
  arguments on the start skill.
- Specification (R14): assembly from the records, the phase-cut corridor,
  the one review pass, the corrigendum verb.
- Feature (R19) and cross-cutting (R22).
- The tracking layer beyond the epic menu (R17): the start menu, the
  inbox, the roadmap.
- The deterministic core (R35): which verbs, the layout hook, the
  checklists.
- Verification beyond its definition (R31–R34): adequacy by mutation or
  deliberate breaks, habit hooks, hard checks, how project skills reach
  the builder.
- Measures (R36); migration, directives and rehearsal (R37–R39).

**Not touched at all:** the brownfield assessment; the start skill's
setup gates and environment setup; the help walkthrough and glossary; the
user-facing docs; the prose-test harness for the new shape (R4); session
handoffs and compaction recovery beyond R35's note.

**Still the person's to decide:** the product record; logs by session or
by topic; whether a decision record holds findings (all in Open).

**Unclear, or engineering for the plan:** where the phase cut lives on
disk and how a tracker shows a phase not yet written; how project skills
reach the builder (R34); the per-task reviewer measurement (R16); whether
two mods' panes share Claude Code's tab row (untested); Jev as the
labeller (unreachable here).

**Parked:** the workflows board (Open) — low priority by the person's
ruling, a visual tool rather than something that builds better products;
mod panels are spiked with the person later; the first sketches were
rushed and are set aside.

**Still to come:** walk what is shape only, in the order the work
depends on it — discovery and decision first, then specification, the
tracking layer, mailboxes, feature and cross-cutting — and confirm the
settled-from-evidence items with the person; then the formal plan
(Sequence steps 3–5).

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
- **The workflows board.** The story of the work stays in the
  transcript: a headline when work starts (one block for a batch started
  together), a product summary as each piece lands, the gate the phase's
  position calls for. What is happening now cannot be redrawn there, and
  reprinting it buries the conversation, so the now moves to a live board
  drawn by the mod — on the whole a picture of what the manifest holds,
  driven by engine code, with room for Claude to put things on it that the
  engine does not hold. Wanted by the person 2026-10-12 for every phase,
  not only the build (decision:
  the agenda; specification: its sections and review; build: tasks
  building, landed and parked, questions waiting, each phase's proof;
  review: agents and findings). It sits apart from the person's sitrep
  board, which works across projects and sessions a level above and is
  updated by Claude through its own plugin, never by the workflows. Only
  one board shows at a time, so the two need a way to switch; how is open,
  pending what the mod surface allows. The person also pictures browsing
  it while Claude works — jumping to other work units, the inbox, the
  roadmap, whatever the workflows hold for the project — without
  interrupting the session. Sketches per phase come next.
- **The gap analysis counts the person's own session as another** (Fumi,
  2026-09-01: "I don't believe I have another session in progress"). A
  bug in the released epic menu, not fixed on its own: the person ruled
  2026-10-12 that the restructure takes it in, and the reworked menu (R17)
  is checked not to carry it.
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
- **Logs by session or by topic.** Proposed and not ruled: a session's log
  records the whole conversation wherever it went, while each decision
  lands in its own topic's record (subject to R13). The alternative keeps
  a log per topic.
- **Whether a decision record holds findings** ("what we now know")
  beside decisions — carried in from the record-and-log session the
  person closed.
- **Where the phase cut lives on disk,** and how today's plan formats carry
  per-phase task writing.
- **How project skills reach the builder** (R34).
- **The per-task reviewer measurement** (R16).
