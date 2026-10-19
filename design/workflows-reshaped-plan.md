# Workflows reshaped — the plan

The whole release in one numbered document, drawn from the design record
(`design/workflows-reshaped.md`, cited here by its R-numbers).

- **Ruled** sections (2–5) restate what the person has ruled, one item to a
  few lines, and point at the record for the detail and the evidence.
- **Proposed** items (1.4, 1.6, 6–11) are new. Each shows today against what
  is proposed.
- **Open** marks a question still waiting on the person.
- The person comments by number; a line with no comment is agreed.
- Nothing in the workflows changes until the plan is approved.

## 1. The release

1.1 **The aim** (R1). The engine keeps what the person sees and what gets
recorded, the same every time. Claude takes how the work gets done. The
person keeps the product, and the calls the ask rule sends them. Success is
Claude deciding as the person would have; being asked less follows from
that and is never the aim (What the workflows are for).

1.2 **What it covers.** Strand A, the restructure (3, 6); strand B, trust
(4); strand C, verification (7); the measures (8); the migration that
brings every project onto the new shape (5); and the areas the record never
reached (9).

1.3 **One release.** Ruled by the person on 2026-10-18.
- Everything in sections 3 to 9 ships together, with the ask rule on. The
  migration is one sequence (R37), and no project may sit on half a shape
  (R8). What is not integral comes as a fast follow straight after, never a
  partial product (the person, 2026-10-19; listed in 12).
- The ask rule is built last, as Sequence step 5 orders, but it ships in
  the release. Everyone starts with an empty trust log, the person
  included (R25, ruled 2026-10-18), so every call Claude has a lean on
  asks until its kind loosens.
- No decision model ships (R28, ruled 2026-10-18).

1.4 **Proposed — when the release is ready.**
- Today: a change is ready when the gates pass and its review is done; walks
  run on the person's word.
- Proposed: all of the following hold.
  - The gates pass (`npm test`, `test:cli`, `test:migrations`, `typecheck`,
    `test:mod`).
  - The rehearsal migrates all 13 projects and their variants cleanly
    (R39).
  - The rebuilt prose-test cases pass for every phase and work type, on each
    model and effort the prose runs at (R4).
  - Each phase's context before its first question is within its budget
    (R43).
  - **A dress rehearsal:** the person takes one small piece of real work
    through every phase on a rehearsal copy, live, from start to finish
    report.
  - The epic menu no longer shows a topic's own session as still running
    after the session ends (the person asked for this check on 2026-10-12).

1.5 **The size of it, today.** The release rewrites most of the product:
- 280,000 words of skill prose in 327 files, and 43,000 words across 34
  agents;
- 44,000 lines of engine and 72 migrations;
- about 125 verbs and 150 rendered surfaces;
- 208 prose-test cases, and a pipeline simulation of 54 scenarios.

What goes whole: the research, discussion, planning and scoping skills, the
plan formats, the analysis loops, grouping, the dependencies between specs,
the cross-cutting type and, if 9.1 is agreed, the baseline skill.

1.6 **Proposed — the weight check** (Claude's, 2026-10-19).
- Today: each part was ruled on its own; the engine's total was never
  weighed against the person's bar of rope, not walls (R2).
- Proposed: a table in this plan, today against proposed: prose words,
  engine lines, command families and commands, hooks, checklists, agents,
  screens, and gates the person answers. Each new engine piece gets one line
  naming the failure it prevents and how often that failure happened.
  Anything with no failure behind it comes to the person as a cut.

## 2. Ruled — principles

2.1 **Control moves up a level** (R1). Standard operating procedures for
capable staff, not supervision of incapable ones.

2.2 **Walls and rope** (R2). Every rule in the prose is sorted into
contract (held by an engine verb or a hard check), required procedure (an
engine-held checklist) or how-to (deleted, leaving a goal and a
done-condition). The sort is strand A's work plan. Gates, corridors and
fields: whatever Claude does in a field stays in it. In the build a question
for the person goes out only through the engine's doors, and one asked in
plain prose is a slip the walks catch; in decision questions are asked in
conversation, and the walks check that every answer was recorded (ruled
2026-10-19).

2.3 **Explicitness, not length** (R3). Control flow lives in the engine,
never in prose.

2.4 **Drift is caught by outcomes** (R4). Prose tests assert outcomes. A
contract that keeps slipping gets a verb or a check, never more prose. The
prose is walked on each model it runs on, at the effort it is dispatched
at. When the workflows adopt a new model, the prose is walked on it and
what that model no longer needs is cut (ruled 2026-10-19).

2.5 **About 90%** (R5). One closing pass replaces every loop that runs
until nothing is found.

2.6 **What the person must read reaches them** (R6). Nothing requires
opening a file.

2.7 **Our measurements decide** (R7).

2.8 **One canonical path** (R8). Every change ships with a migration;
runtime code never recognises an older shape.

2.9 **Event-sourced, for engineers** (R45). Everything that happens is an
event on an immutable stream; everything read is a projection.

2.10 **A context budget** (R43). Questions before reading; resuming a topic
reads its record and its log; prescription lives in code (R2).

2.11 **The knowledge base stays, as the first look** (R44). It indexes
records rendered from the ledger, never logs and never the ledger.

2.12 **Every optimising loop has a counter-measure** (R30), with danger as
the frozen anchor.

## 3. Ruled — the shape of the work

3.1 **Stages and phases** (R9).
- Discovery stage: discovery, decision, experiment, investigation.
- Definition stage: specification.
- Delivery stage: implementation, review.
- Research folds into decision. Planning splits: the phase cut moves into
  specification, and tasks are written as each build phase starts. Scoping
  goes. The implementer is called the builder.

3.2 **Gates** (R40).
- Authority gates, never automatic: start this work, approve the map,
  decided, ready to build, finish.
- Product questions are computed by the ask rule.
- Process gates are learned from the gate-answer log.
- A phase runs auto or step. The build's position is chosen at ready to
  build, and any phase's can be switched at any time.

3.3 **Discovery** (R10, R41).
- One phase, at whatever level the conversation reaches. No detail
  questions.
- Nothing in discovery is a decision (the person, 2026-10-19). The brief
  carries leans, rejected paths, open questions and what a spike showed, as
  input that the decision phase decides.
- An inbox item that already pins the work is confirmed in one line, never
  shaped again; a known cause with a mechanical fix is a quick-fix (ruled
  2026-10-19).
- Feature and epic stay two types, with a light call between them.
- The product record is a projection of product-wide entries. Discovery
  starts it, decided screens add to it, and every opening view reads it.
  The engine keeps a rendered copy of it, so a line the person adds to
  CLAUDE.md can point there (ruled 2026-10-19; where it sits is Claude's).
  The workflows never write CLAUDE.md.
- Its gates: start this work; one screen to approve the map with its parks;
  no confirm on a change the person asked for; cancelling still confirmed.
- The gap analysis runs at a topic's close and in one sweep before the
  spec, never in the background. No routing: every topic goes to decision.
- The brief feeds the opening view. The map is ordered foundations first,
  research others rest on first.

3.4 **Decision** (R11, R12, R13).
- **Record and log.** Every decision and finding is a ledger entry written
  through the engine; the topic's record is the engine's view of its
  current entries. The log keeps the journey, one dated heading per
  session, per topic. Every entry says who decided it.
- **A topic opens with Claude starting the conversation** once it has read
  the brief and the records: in its own words, with its lean wherever a
  logical one exists. A conversation, never a conveyor belt of questions:
  the map tracks what is open, never the order, and the prose prescribes
  the steps around the conversation, never the conversation.
- **The map is the definition of done.** The person's questions sit beside
  Claude's calls, and only the person's hold the topic open. Each showing
  lists Claude's calls since the person last looked.
- **The decided screen** is the authority gate: what the person decided, a
  count of Claude's calls by kind, the product-record lines, any new-topic
  candidates.
- **The reviews stay, and the matrix routes what they find.** The closing
  pass has two readers and re-reads what it changed. A finding a later
  decision made moot is dropped with a one-line note; one coming to the
  person is first rechecked against earlier answers and the record; a route
  names another topic, never a subtopic (R24).
- **Spikes are evidence.** They live in `assets/` as canonical or
  reference; a lock is a question on the map; discovery may spike. A
  spike's source is kept in `assets/` as it is written; its dependencies,
  builds and run output go in the gitignored cache (Claude's, 2026-10-19).
- **Each topic owns its decisions.** Every change to another topic's
  decision goes to its owner through the mailbox; only a duplicate giving
  the same answer is merged where it is found (the person, 2026-10-14).
- **Mailboxes:** `/workflow-start {unit} {topic}` opens a topic directly,
  waiting mail raised first; every send ends with that command.

3.5 **Specification** (R14, R17).
- It waits until every topic is decided, cancelled or postponed.
- One spec per work unit, in sections by area, assembled from the records.
- Every statement cites its entry or is marked the builder's.
- It ends with the phase cut: phases in build order, each with scenarios,
  the sections it draws on, and what it relies on.
- Invariants name their hard checks, and canonical assets are linked.
- The review hunts gaps and the matrix answers them, written into the
  topics' records. A re-review reads only what changed, unasked.
- Ready to build is its gate (for a feature, one screen with decided). A
  concluded spec is never corrected.

3.6 **The build** (R15).
- One orchestrator runs the build across its phases and delegates: a task
  writer, builders, reviewer pairs. The build keeps a log.
- Six principles and the task template replace planning's teaching. The
  task rule carries an upper size guide: a task likely to run past about
  10,000 changed lines is probably two. There is no lower bound (the person,
  2026-10-15).
- Tasks are written as a phase starts, through the task verbs, with their
  links. The cut orders the unit and names what each phase relies on; the
  machinery between specs and the plan-wide rebuild go.
- Claude schedules: order, parallel worktrees, merging back. There is no
  prescribed red-green loop.
- **The doors:** no code change without a task, and one verb per
  destination. A find by an agent is landed by the orchestrator. The
  commit door refuses a code commit that names no task.
- The builder's calls go to the ledger. A question for the person parks
  what depends on it, and everything else carries on.
- One independent phase review closes each phase, including where it meets
  earlier phases.
- **What the person sees:** a headline as work starts (one block per batch),
  a product summary as each task lands, a question queue, and a stop report
  when nothing can proceed.
- **The build's live panel and any task's account** ship in the release
  (ruled 2026-10-19). The panel shows the build only: tasks building, in
  review, landed and parked; questions waiting; phases not yet written. It
  is spiked with the person first. Any task's account is printed into the
  conversation from the mod menu.

3.7 **Reviews in the build** (R15, R16, Reviews in the build).
- Three reviews: after each task, closing each phase, and the review phase.
- Each is the workflows' own reviewer agent, run as a pair at Opus medium.
  Builders also run at Opus medium.
- **Everything at medium** (ruled 2026-10-19): no higher-effort builders or
  reviewers for Claude to reach for. The medium defaults were measured on
  one project and are re-tested with data later.
  - **Open:** whether an extra-high reviewer runs at prescribed points, such
    as a phase's end. If it does, it is always prescribed, never Claude's
    pick.
- **Models:** builders and reviewers run Opus. The labeller runs Sonnet
  (4.8), and every other job runs Opus until a measurement says otherwise
  (Claude's, 2026-10-19).
- **The task loop:** every finding but a nit goes back to the same builder
  with both reports; the changed task is reviewed whole by the pair until
  a round passes, with no count. A nit is fixed there and then by the
  orchestrator, reading it from the report (the person, 2026-10-15).
- A failed review is met as a senior engineer would.
- A finding is serious unless the report names the edge-list item it
  needs.
- **Banking stays as it works today** (the person, 2026-10-15). Notes for
  later hold what lies outside the task. At a phase's end a separate agent
  reads them against the finished code, groups and de-duplicates them, and
  drops what the code settled with a reason; the rest become tasks in the
  same phase, built through the same loop.
- Comments are never the standard.
- Fixes are reviewed by the layer above.
- **Brief control:** every brief comes from a template the engine fills.
  Additions go only onto the task or into the ledger, recorded. Fix rounds
  carry the reports verbatim. A hook refuses a brief the engine did not
  issue.
  - **Open:** whether the implementer may write onto its own task. As
    recorded, only the orchestrator writes onto a task, and the
    implementer's own variations go to the ledger as its calls, which the
    reviewers read.

3.8 **Code lands as pull requests** (R35).
- A task is a pull request, squash-merged. A phase is a stack, merged whole
  once its phase review passes; a phase that relies on it waits for that
  merge. The review phase's fix tasks are the last stack, merged at finish.
- Landing goes through a driver: GitHub's, and a local one for a project
  with no remote.
- The workflows push across the board: the state branch on every commit,
  task branches as their pull requests open. Merging is the driver's,
  after review.

3.9 **Tasks go through the engine to a driver** (R35).
- The engine's `task` verbs are the only way to a tracker. The driver is
  set per project; Tick is the default and the only one shipped.
- New drivers come by pull request against a conformance suite. A hosted
  tracker is reached through its API, never an MCP.
- The tracker is named only in its driver, the user docs and design notes.

3.10 **The review phase** (R16).
- The build runs straight into it.
- It is split by the spec's areas, each read by a pair, running the product
  wherever the project has a way to.
- Today's test-surface agent stays: one reader over all the change's tests,
  held against everything the spec asks them to guard (ruled 2026-10-19).
- In-scope findings become fix tasks in one more build phase; only the
  areas they changed are read again. Out-of-scope findings are dropped,
  grouped or filed to the inbox by Claude, with no offer. A drop is neither
  raised nor listed; each call is recorded, one engine call away (the
  person, 2026-10-14).
- The report is short and product first, and the passing one is the
  work's certificate. Finish takes questions.

3.11 **The tracking layer** (R17).
- **The start menu:** units with type, phase, progress and a count of what
  waits, waiting units first; one Start row; the inbox as one counted line;
  verdicts as a project row.
- **The epic menu:** the phase heads it, what waits first, topics by what
  they need, with no count of a topic's questions (the person, 2026-10-14);
  no spec row until every topic is decided; map changes through discovery,
  reopening a decided topic and bringing back a cancelled one included. A
  feature, bugfix or quick-fix does both through manage (the person,
  2026-10-15 and 2026-10-16).
- **The inbox stays true:** a capture ends with one fixed engine line that
  writes the item into the inbox, commits under the lock and pushes, so the
  capture skill needs no engine knowledge (the person, 2026-10-16); finished
  work closes the items it resolved.
- **Triage** is w, r, a, c, b; Claude never names a horizon.
- **The roadmap:** one step from anywhere; work starts through discovery;
  explicit rows. A product-wide talk starts from Start or the roadmap's
  "plan the product" (the person, 2026-10-16).
- **Menus** are explicit and keyed alike, and every menu has h help.
- **Open:** when the new design system the person wants (2026-10-15) is
  made: inside the release, or as its own piece of work straight after it,
  which is Claude's lean.

3.12 **Work types** (R18–R22).
- **Epic.**
- **Feature:** "Continue feature" goes straight to where it stands;
  revisiting moves to manage.
- **Bugfix:**
  - Claude steps back before setting out fix options.
  - Both validations always run, and Claude acts on them.
  - Earlier fixes are part of the analysis.
  - It writes the common spec.
  - The bug is proven failing on the unfixed code by a check the commit
    door holds.
  - Its routine gates follow the phase's position.
- **Quick-fix:** one session, a short record after the work, no review
  step; it moves to feature or bugfix through a verb.
- **Cross-cutting goes as a type:** principles become product-wide entries.

3.13 **What is kept, and where** (R42, Layout on disk).
- Kept: the record, the log, the spec, evidence, a short review report and
  the build's log. Tasks live in the tracker.
- Tracking, analysis and per-task report files go.
- The layout is the record's tree. Never files: a topic's record and map,
  the product record (beyond its rendered copy, 3.3), the verdict queue,
  "what have you decided without me".

## 4. Ruled — trust

4.1 **The ledger** (R23).
- One per project: an event stream of asked, found, decided, replaced,
  still holds and moved.
- Entries are identified by nanoids and shown by short ids, and tagged with
  unit, topic, phase and session.
- Written only by the engine, by appending. On every read and at every
  commit the ledger must start, byte for byte, with the last committed one;
  no fingerprint chain. One thing per entry, judged by a separate Claude
  call.
- Replacing appends, with one of four reasons; a later unit replaces an
  older decision, and the entries relying on it are flagged.
- Stored as versioned JSON lines. An added field is optional with a
  default and needs nothing; a real break is a migration writing a
  converted copy, every event through in order.

4.2 **State on its own branch** (R23).
- `.workflows/` is a worktree of an orphan branch inside the main checkout,
  never in a code branch or pull request.
- There is one copy, found through the common git directory, with a lock
  per verb.
- The state branch is pushed on every commit; a failed push is a warning.
- The branch is protected: the engine locks the worktree; the hook before
  Bash refuses unlocking or removing it, deleting the branch locally or
  remotely, and force-pushing it; boot checks both every time and restores
  a lost local branch from the remote; on GitHub, setup offers a rule
  against deleting or force-pushing it, on the person's yes.
- The engine merges a second clone itself, never git, with ids derived from
  facts two clones could both record.

4.3 **Verdicts** (R23). The topic's decided screen asks a verdict on each
call the person changed in that topic: nothing, a fix later, a real loss,
or skip. The finish gate asks the same for calls changed in the build and
the review phase, and a quick-fix's close for its own. A skipped one waits
in the verdict queue. A departure counts as a real loss until judged.

4.4 **The ask rule** (R24).
- One decision point, reached from everywhere Claude makes a call.
- Facts are checked, intent is asked. Where there is more than one way and
  no obvious choice, Claude finds out before it leans.
- Ask when the pessimistic rate of real loss for the question's kind
  exceeds the threshold:
  - 20%, halved where a change would be hard to undo;
  - danger always asks;
  - so does a kind the person cares about, while a care entry stands. An
    entry names one project and one kind, never every project; a "don't
    care" answer settles that one question, and Claude proposes dropping an
    entry the answers keep saying the person does not mind (ruled
    2026-10-19).
- A kind goes quiet below the threshold and asks again only a quarter above
  it (25% at 20%), so one loss reopens it only while its evidence is thin.
- The cone narrows as the product takes shape. Convergence offers to settle
  the rest.
- A raise reaches the person product first, with "I don't follow" as a
  button. Questions come one at a time; in decision they are slotted into
  the conversation (the person, 2026-10-14 and 2026-10-18).

4.5 **Kinds, evidence and the trust log** (R25).
- Twelve narrow questions compose the kind in code. The labeller is never
  the Claude that wants to proceed. Every label keeps all twelve answers,
  not only the kind (ruled 2026-10-19).
- Evidence is weighted by what it proves. Two starting values, retuned by
  replay: answers count half at six months old, and a new model inherits
  counts at half weight.
- The matrix is kept at the person's level and the project's, merged as
  prior and update, the person's other projects capped at 10 answers'
  weight.
- The trust log is append-only at user level.
- The matrix screen is tuned by replay.
- What ships is the procedure, never anyone's counts. Everyone starts
  empty, the author included.

4.6 **Blind questions** (R26), drawn by the engine at a fixed share: each
call draws on its own from its id, at random across projects, with no tally.

4.7 **The record of the person** (R27), at user level, ships in the release
(ruled 2026-10-19).
- The person's preferences in words, each with its reason and examples.
  Claude proposes an entry when it sees a pattern or the person states one;
  it steers nothing until the person says yes on the screen where it is
  proposed.
- It shapes what Claude picks. Its one effect on whether Claude asks is
  its care entries (4.4), which live in it.
- Search across other projects' decisions is dropped: projects differ by
  purpose, and it would bring another project's text into a session.

4.8 **No decision model in the release** (R28, ruled 2026-10-18). A
separate Claude call labels kinds, checks one decision per entry and reads
typed gate answers.
- It is a raw call the engine makes itself, never a subagent (ruled
  2026-10-19): `claude -p` with no tools, MCP servers, settings sources,
  hooks, skills or auto-memory, started from an empty folder, so nothing of
  the person's reaches it. `--bare` cannot serve: it reads no subscription
  or setup-token login.
- It runs on Sonnet (Claude's, 2026-10-19). Rerun on 2026-10-19 in the raw
  form: against the Opus–Sonnet consensus, raw Opus 97% and raw Sonnet 96%,
  where the 12 Oct runs, with about 58,000 tokens of the person's context
  in each call, scored 91%. Raw Opus and raw Sonnet agree 87%, and Sonnet
  costs 55% of Opus.
- Jev measured 75% against the same consensus; Clef was not run. A decision
  model is offered later, as the person's choice, only once a rerun shows
  it labels as well.

4.9 **Starting numbers** (R29), measured 2026-10-12 and the source of
every default above.

## 5. Ruled — migration

5.1 **Every project migrates fully** (R37). Each migrates from the current
shape only, at its next `/workflow-start`, and the migration never touches
a project's code.

5.2 **One sequence.** Code steps and directives run interleaved:
1. Guard.
2. The legacy split, as a directive.
3. The move into the layout, `.workflows/` leaving the default branch for
   its own.
4. The records.
5. The cut and the merges.
6. Finish: the records indexed, then the migration's commit on the
   person's yes, now two (6.3).

5.3 **Every topic gets a record,** completed units included. The stream
starts at the migration, with one current answer per question, each citing
its log section. An entry is "carried over" where the log does not show who
decided it.

5.4 **Specs.**
- Nothing built: the old specs become reference, and one spec is written
  fresh from the records.
- Building started: the specs are joined verbatim, and the plans' phases
  become the cut.
- Mixed: the uncovered topics leave the unit, and the person says where
  they go.
- Completed units stay as history.

5.5 **Directives** (R38).
- A migration kind whose transform is judgment, frozen once released.
- Each is run by the start session, may ask the person, and is recorded
  only once its check passes.
- An interrupted one is redone from the start.

5.6 **Rehearsal before release** (R39). It runs on copies of all 13
projects cut from their remotes, with variants for the cases no project
holds. The focus is the ledger's completeness and the logs' shape.

## 6. Proposed — the deterministic core

Ruled in shape (R35, R2):
- The verbs are the only doors.
- A hook refuses writes outside the layout, and the commit door refuses a
  code commit that names no task.
- Checklists are engine-held, and only engine-issued briefs reach the
  workflows' own agents.
- Every surface the person sees is an engine surface, and the mod draws
  raises, logs gate answers and shows evidence.
- Tasks and landing go through drivers (3.8, 3.9).

6.1 **The verbs, by door.**
- Today:
  - 26 command families with about 125 verbs, plus about 150 rendered
    surfaces.
  - The prose makes 1,091 engine calls, 359 of them manifest reads and
    writes.
  - A find outside a task has two verb doors (topic send, roadmap add); the
    rest is prose and direct manifest writes.
  - About a third of the verbs serve what goes: research threads, the
    discussion map, routing, build order, analysis cycles, plan formats,
    grouping, staleness, promotion to cross-cutting.
- Proposed, new families marked new:
  - `ledger` (new): ask, find, decide, replace, hold, move; reads the
    record, the map, the product record, "since you last looked", and what
    a replacement affects.
  - `raise` (new): puts a call through the decision point and returns ask,
    proceed or ask blind; records the person's answer,
    "I don't follow" included.
  - `verdict` (new): the queue, and giving a verdict.
  - `task`, rebuilt as the driver's verbs (ruled), plus a note for later.
  - `land` (new): open a task's pull request, chain it into its phase's
    stack, merge a phase, merge at finish.
  - `brief` (new): fill a template and issue it (6.5).
  - `checklist` (new): show, done, skip with a reason (6.4).
  - `asset` (new): add with its status, change the status.
  - `verify` (new): run and record a proof, and the bug-proven run (7.2,
    7.3).
  - `gate` (new): takes the person's answer at any gate, logs it, and
    returns what happens next (6.6).
  - `state` (new): sync (fetch, merge, push) and status.
  - `inbox` gains close, naming the unit that resolved the item, and file,
    for the review phase.
  - Trimmed and kept: `topic`, `workunit`, `roadmap`, `discovery-session`,
    `experiment`, `agent`, `knowledge`, `commit`, `render`, `handoff`,
    `conversation`, `presence`, `session`, `boot`.
  - The prose writes no manifest field. Each write it makes today becomes
    the effect of a door verb, so the prose names verbs, never fields (R2,
    R3). Reads stay only where a verb's response does not already carry
    the value.

6.2 **The layout hook.**
- Today: the mod refuses Write and Edit to manifest files only. Shell
  writes go through, and it acts only where the mod is announced (Claude
  Code 2.1.287 or newer, in the CLI or desktop).
- Proposed:
  - A Claude Code hook before Write, Edit and NotebookEdit, installed by
    boot into the project's settings as the session hooks are today, so it
    holds with or without the mod. It refuses any path under `.workflows/`
    outside the layout, every manifest, and the ledger.
  - A hook cannot reliably police the shell, so the state commit is the
    backstop: every state commit is the engine's, and it refuses a path
    outside the layout, naming it.
  - The mod's manifest guard folds into the hook.

6.3 **The commit door.**
- Today:
  - Commits are literal pathspecs under a lock.
  - A code commit names a unit and a phase and checks only that both exist;
    the task id appears only in the message the prose writes.
  - The prose makes 150 commit calls across 84 files, 142 of them state
    commits.
- Proposed:
  - **State commits leave the prose.** Every verb commits its own writes in
    the state worktree, together with any log file in the layout changed
    since, then pushes (R23).
  - **A code commit names its task.** The engine checks the task is in
    flight in this conversation and writes the message with the task's id.
    It runs the project's checks first (7.6), and for a bugfix it refuses
    the fix until the bug-proven run is recorded (7.3).
  - A raw `git commit` in a code worktree during a build is refused by a
    hook before Bash (ruled). The same hook guards the state branch (4.2).
  - The migration commit stays on the person's yes, now two commits: the
    default branch dropping `.workflows/`, and the state branch's first
    (R37).

6.4 **The checklists.**
- Today: none is held by the engine. Conclude and closing steps are prose
  (eleven conclude files and the closing gates), sequenced by gate
  variants, with progress in manifest subtrees.
- Proposed: the engine holds one checklist per closing point. Each item ends
  done or skipped with a reason, checked by the engine where it can be (a
  fold, a recorded run, a count) and marked by Claude where it cannot. The
  closing verb refuses while an item is open, and the authority gate's
  screen shows any skip.
  - **Decided:**
    - every question of the person's closed;
    - the closing pass run, and its last re-read changing nothing;
    - every decision in the conversation has an entry;
    - each replacement checked against what it replaced (R23);
    - the read for conflicting answers run within the topic (R23);
    - the product-record lines and any candidates are on the screen.
  - **Ready to build:**
    - every topic decided, cancelled or postponed;
    - the sweep between topics run;
    - the spec has checked each replacement against what it replaced (R23);
    - every statement traced;
    - the review's last pass changed nothing;
    - each phase in the cut has its scenarios, sections and relies-on;
    - every invariant names a check or says none can;
    - canonical assets linked.
  - **A phase starts:** tasks written with their links; shared design
    settled; what the phase relies on is done.
  - **A phase closes:**
    - every task passed its pair;
    - the phase review passed and its fixes landed;
    - each scenario proven or reported not proven;
    - the notes for later read by the consolidation agent, then made into tasks
      or dropped with a reason;
    - the stack merged, or waiting at its gate in step.
  - **Finish:**
    - the review phase passed and its report is written;
    - resolved inbox items closed;
    - the build log closed;
    - the records indexed.
  - **A directive:** its check (R38).

6.5 **Briefs** (ruled; the mechanics proposed).
- Today:
  - The orchestrator builds each brief in prose from numbered item lists in
    13 invoke files (184–999 words each) and about 30 references.
  - Later rounds go to the stored executor by message.
  - The engine supplies only background agents' output paths.
- Proposed:
  - One template per agent role, kept in the engine's content beside its
    displays.
  - `brief` fills it from the records and stores the filled brief with an
    id. The records it draws on: the task, its spec sections, the ledger's
    decided calls, the diff, earlier reports verbatim, and the rules that
    apply (7.7).
  - A hook before Agent and SendMessage refuses a dispatch or message to
    one of the workflows' agents unless it carries an issued brief,
    matched by id and content. A refusal is recorded with its reason.
  - A fix round is issued the same way: the two reports verbatim, nothing
    added.
  - **The roster shrinks with the loops,** from 34 agents to about 15:
    - builder;
    - reviewer, one agent run as a pair at all three reviews, with a
      template for each;
    - the consolidation agent, today's, which reads a phase's notes for later (3.7);
    - the review phase's test-surface agent (3.10);
    - task writer;
    - deep dive;
    - decision's perspective and review agents;
    - synthesis;
    - the closing-pass reader;
    - the spec reviewer;
    - investigation's two validators;
    - the product researcher (9.1);
    - the migration's verifier.

    Analysis, planning and the review phase's finding agents go.

6.6 **Gate answers and the mod.**
- Today: the mod sees a click but nothing records gate answers durably,
  and nothing records answers typed at the prompt (R25). The prose reads
  each answer and branches on it.
- Proposed:
  - Every gate's answer goes to `gate`, which logs it to the trust log (the
    gate's name, the row the engine recommended, the row picked, any typed
    text) and returns what happens next. Control flow at a gate moves into
    the engine (R3), and logging works with or without the mod.
  - The mod adds what only it sees: whether the answer was a click.
  - The mod's other jobs are as ruled: raises, blind questions, evidence,
    a reading surface, phase words.

6.7 **The drivers, tested** (ruled shape; the testing proposed).
- One conformance suite per kind of driver, run in the hermetic
  environment:
  - **task:** a phase; links across phases; ready returning several; done
    unblocking; close; list; show;
  - **landing:** a task's pull request, a stack, a phase merged, finish.
- The Tick driver runs against a real Tick at its declared floor.
- The local landing driver runs fully in the suite. GitHub's runs against a
  stubbed CLI, plus one live run on a scratch GitHub repository the person
  creates for it, on their word.

## 7. Proposed — verification

Ruled in shape (R31–R34):
- Trust in Claude's work is its own ladder, apart from trust in its calls.
- A per-project verify setup and feature map, built the first time a build
  needs it, counting only once it has run end to end.
- "Proven" means a phase's scenarios were performed on the running product
  through a user's path and checked by a script. Evidence is computed,
  never narrated.
- Every criterion has a test; adequacy is checked by machine; invariants
  name their checks.

Today the workflows never run the product. Review's verifiers read code and
run linters and package tests.

7.1 **The verify setup lives in the product's code, built by
tasks.**
- The first phase's tasks build it, as principle 2 of R15 already says.
  Each later phase adds the drives for its own scenarios.
- It drives the product and changes with it, so it rides the same pull
  requests and reviews as the code.
- The project's environment setup records where it is and how to call its
  five parts (launch, health check, drive, evidence, cleanup). The feature
  map sits beside it.
- Rejected: keeping it on the state branch, where a phase's drives would
  land outside the phase's stack.

7.2 **The engine runs the proof and records it.**
- A `verify` verb takes a scenario from the cut, runs the setup's drive for
  it, and records the verdict the script writes against the scenario.
- Claude never types a verdict. The phase review reads the recorded runs,
  and a scenario with no passing run reads "not proven" in every report.
- Text evidence (a captured screen, a response) is kept with the run.
  Recordings and images stay in the gitignored cache with their hash
  recorded, since the state branch is pushed on every commit.

7.3 **The bug-proven check** (ruled in R20).
- The verb runs the reproducing test on the unfixed code five times and
  records each failure.
- The commit door refuses the fix commit until all five are recorded
  failing. After the fix, the test is one of the build's own gates.

7.4 **Adequacy at the phase review** (R33).
- Where the project's language has a mutation tool, which the verify setup
  names after researching the current tools rather than from a fixed list,
  the engine runs it over the lines the phase changed. A surviving mutant in
  code a criterion covers is a finding for the pair.
- Where no tool exists, each reviewer breaks the riskiest line of a
  criterion's code in a scratch worktree. A break the tests do not catch is
  a finding.
- Either way the cost is bounded by the phase's diff.

7.5 **Habit hooks are measured before they ship** (R33, ruled 2026-10-19).
- The person agreed them on 2026-10-07 on a condition: "let's make sure we
  run our own tests to validate. Let's not just blindly trust what we
  read."
- A habit hook runs over the replay's slices alongside the brief-quality
  measurement (8.4), and ships if it cuts review findings.
- Either way, a smell the reviews keep naming becomes a hard check where one
  can catch it (7.6), and otherwise a project rule handed to the builder
  (7.7).

7.6 **Hard checks in the cut and at the door** (R34).
- The task that adds an invariant's check goes in the phase that introduces
  the invariant.
- The project's checks run through the commit door before every code
  commit: tests, linters, architecture tests. Today linters are confirmed
  per topic as implementation starts; proposed, they are set once per
  project in the environment setup (9.2).
- A finding the pairs raise in two tasks becomes a note for later
  proposing a check, and the phase's end turns it into a task.

7.7 **How project skills and rules reach the builder** (R34,
open in the record).
- The environment setup lists the project's skills and rules, each with the
  areas of the code it applies to.
- The engine fills the builder's and the reviewers' briefs with the ones
  that apply to the task's files, as paths the agent reads.
- Rules that can be checked become checks (7.6). The rest stay guidance in
  the brief.

7.8 **Verification does not adjust the ask rule** (R32, ruled 2026-10-19).
The rule the person approved has no reversal-cost term, and a mistake
verification catches early already earns a "fix later" verdict.

## 8. Proposed — measures

Ruled (R36): six measures, each moving one lever, and a counter-measure for
every optimising loop (R30). Today none is measured by the product; the
record measured them by hand from transcripts.

8.1 **Where each measure comes from and where it shows.** All
are computed from what is already recorded, never kept by hand (R45).

| Measure | Computed from | Shown | Moves |
|---|---|---|---|
| Overturn rate per kind | the trust log | the matrix screen | the ask rule, by its own arithmetic |
| How a review's findings split | the ledger: each finding, and who answered it | the matrix screen, beside the overturn rate | the person's threshold; this repo's review briefs |
| Review findings per phase | the pairs' recorded verdicts and rounds | a query this repo's authors run over their own projects | this repo's builder briefs and principles |
| Bugs found after review | bugfix units, each relying on the unit whose code it fixes, grouped by the feature map's areas | no flag of its own; the grouping is Claude's (ruled 2026-10-19) | the verify setup's drives for that area; the bugfix's "rework the area as a feature" option |
| Contracts slipping in walks | the walks' invariant failures, by contract | the harness's run summary | a verb or a check for that contract (R4) |
| Context before the first question | the walks, per phase | the harness's run summary, against the budget | what a phase loads (R43) |

8.2 **Two audiences.** The overturn rate, the findings split and bugs after
review are the product's. Findings per phase, contracts slipping and the
context before the first question are this repo's, seen in queries and the
prose harness. No measure adds a line to the decided screen or the finish
report; each is computed, and shown on the matrix screen or one question
away (ruled 2026-10-19).

8.3 **The counter-measures.**
- The ask rule is checked by blind questions and verdicts.
- Learned process gates are checked by blind asks at 5% and by answers that
  start to vary (R29).
- Review findings are checked by bugs found after review: findings falling
  while bugs after review rise means the reviews are weakening, not the
  code improving.

8.4 **The brief-quality measurement runs before the release.**
- The same builder and reviewers run on a thin brief and on the full
  template, over the replay's Switchboard slices (`walks/build/replay/`).
- It runs once the templates exist and is used to tune them. Its cost is
  bounded by the replay's: $606 for 264 agents at API prices, of which this
  needs a fraction.
- Two more run alongside it on the same slices: a habit hook (7.5), and the
  task-size test, a large task against the same work split in two (the
  person, 2026-10-15: "the more data we can get on our decisions, the
  better"; running it here is Claude's).

## 9. Proposed — the areas not yet touched

9.1 **The brownfield assessment.**
- Today:
  - A skill of its own. It scopes areas (overview, glossary, boundaries and
    3–8 concerns), researches each with a background agent, writes an
    agenda of questions, interviews the person, and writes
    `.baseline/{area}.md` with observed, stated and open sections.
  - It is offered at start when the code predates the workflows.
  - About 4,700 words of prose and 626 lines of engine.
  - None of the 13 projects has run it: 6 native, 1 skipped, 6 nothing
    recorded.
- Proposed: it becomes product-level discovery on an existing codebase.
  - The roadmap's "plan the product" (R17) opens with the baseline's
    research when the code predates the workflows.
  - What the person states lands as product-wide entries, the product
    record's start (R10). What is observed in the code lands as findings
    saying how they are known. What stays open goes on the map.
  - The skill, its files and its status fields go. The start menu's offer
    stays, pointing at "plan the product".
  - A project holding `.baseline/` docs has them moved to assets as
    reference by the migration. None of the person's projects has any.
  - The reason: R10 makes discovery one phase at whatever level the
    conversation reaches, and this is that conversation started from code.
  - A v1 built fast outside the workflows is the person's call: "It'll be
    me" (2026-10-12). Installing the workflows on it later comes in here.

9.2 **The setup gates and environment setup.**
- Today:
  - Boot runs the migrations, the knowledge sync, the hooks and the
    worktree include.
  - Start then runs the migration review, the Claude Code floor, the
    walkthrough offer, session labels, the knowledge gate and the baseline
    offer.
  - Elsewhere, first use asks the plan format (planning and scoping), the
    environment setup (implementation, written in 7 of 13 projects), and
    project skills and linters (per topic, at each implementation start).
- Proposed:
  - The plan-format gate goes. The drivers need no question when the
    defaults fit: the tracker is Tick; landing is GitHub's driver when the
    remote is GitHub and the local driver when there is no remote. Manage
    changes either.
  - Both drivers check their needs at ready to build, the last stop before
    a build that runs unattended, so a missing tool never stops a build the
    person has walked away from. A missing tool stops with what is missing,
    never an install command.
  - The environment setup becomes per project and holds everything a build
    needs: how to run the product, what cannot run concurrently (R15), the
    verify setup's location (7.1), and the skills, rules and linters with
    the areas they apply to (7.7). It is asked once, at the first ready to
    build, and its confirmations are learned process gates, asking until the
    person's own answers loosen them (R25).
  - Boot also adds the state worktree on a fresh clone (10.5), locked, and
    checks it and the state branch on every run (4.2).
  - The floor, walkthrough offer, session labels, knowledge gate and
    migration review stay as they are.

9.3 **Help and the glossary.**
- Today:
  - Help is a walkthrough of 8 screens and 9 reference cards (about 5,900
    words), with sample surfaces rendered from fixtures through the real
    projections.
  - The glossary holds 56 terms. About 20 of them are tied to retired
    things: research and discussion as phases, scoping, planning,
    cross-cutting, build order, dead end, document.
- Proposed:
  - Rewritten in the release, after the phases. The samples keep rendering
    through the real projections, from new fixtures: the decision map, the
    new start and epic menus, the build's progress.
  - The glossary drops the retired terms and gains, in the engineer's terms
    R45 asks for: decision, record, log, ledger, entry, map, product
    record, phase cut, builder, task loop, reviewer pair, notes for later,
    stack, the ask rule, kind, verdict, blind question, auto and step,
    proven and not proven, verify setup, feature map, driver, state branch.
  - "Review" names three things today (the review phase, a phase's review in
    the build, a document's closing review); each gets its own term.
  - h help on every menu (R17): each menu's help is an engine content file
    beside the screen's projection, so a menu and its help change together.

9.4 **The user docs.**
- Today: 23 files and 37,000 words, plus a 2,000-word README whose pipeline
  table shows cross-cutting, research, planning and scoping. Three docs
  centre on retired things (research and discussion, planning, work types)
  and five more lean on them.
- Proposed:
  - Rewritten in the release from the shipped skills, last, since the skills
    are the source of truth.
  - The new book: work types; discovery; decision (replacing research and
    discussion); experiments; investigation; specification; the build
    (tasks, reviews, pull requests, the drivers); review; trust (new: the
    ledger, the ask rule, verdicts, the matrix); verification (new); state
    and git (new: the state branch, pushing, a second machine); tracking;
    the knowledge base; the engine; reliability; configuration; lifecycle;
    agents; contributing.
  - history.md gains the reshape. planning.md goes, and the tracker moves
    to configuration and the build.
  - The docs are one of the three places a driver's tool may be named
    (R35).
  - The person's internal products are never named, only described.

9.5 **The prose-test harness and the test suites.**
- Today:
  - 208 cases, 106 stubs and 6 mainlines. 41% of cases enter a phase being
    merged or retired, and 62% scope files from one.
  - The harness code knows phase-skill names, manifest paths keyed by unit,
    phase and topic, and single-branch worlds on `main`. The mainlines
    write discussion and planning documents.
  - Walkers and orchestrators run Sonnet; asserters run Opus.
  - The pipeline simulation is 6,163 lines and 54 scenarios. The knowledge
    eval indexes frozen snapshots of today's documents.
- Proposed:
  - **The harness stays, adapted.** Worlds gain the state branch as a
    worktree, and code worktrees for the build. They use the local landing
    driver, since they have no remote (R35). Invariants gain the ledger:
    events appended, their kinds and links, the append-only check passing.
  - **The corpus is rebuilt, not ported.** Today's cases assert today's
    steps. Every phase's rewrite lands with its cases, each door and each
    checklist item asserted at least once. The mainlines are rebuilt for
    epic, feature, bugfix, quick-fix and roadmap; cross-cutting goes.
  - **Walks run on the product's models** (R4). The walker's model and
    effort are set per run, and the release's walks run at each model
    and effort the prose runs at. Every walk records the context spent before
    its first question (R43).
  - **The pipeline simulation is rebuilt** for the new verbs and phases, as
    CLAUDE.md requires of any change to the workflows.
  - **The knowledge eval is re-made** by migrating its three frozen
    projects and re-judging its queries against the rendered records. The
    old baseline stays as the comparison: R29 found the knowledge base
    ranking replaced answers inside long documents, and the records should
    end that. It gains a third arm: one to three quick searches, judged
    blind beside the other two (Claude's, 2026-10-19).

9.6 **Handoffs and compaction recovery.**
- Today:
  - Every move into work hands off. The engine names the move, and the mod
    clears the conversation and sends the continuation; without the mod,
    the skill is invoked inline. 17 files load the handoff reference.
  - After a compaction, the engine's note gives the place, the task and its
    executor's id, and the skill and documents to re-read; the mod appends
    it.
  - Twelve skills carry their own section on resuming after a refresh.
- Ruled:
  - One orchestrator across a build, with no handoff at phase boundaries
    (R15). A quick-fix is one session with no handoffs (R21).
  - The note names the skill and each document to re-read (R35).
  - Resuming a topic reads its record and its log (R43, 2026-10-19).
- Proposed:
  - The mechanism stays. Its table of moves follows the new phases: start
    this work into the first topic, decided into the next topic or the
    spec, ready to build into the build, finish back to the menus. Nothing
    hands off inside a build, a quick-fix or a topic.
  - After a compaction, a crash or a new session alike, the note names the
    topic's record and log, so the conversation carries on where it was.
  - The position holds every task in flight with its builder's id, not
    one, so after a compaction a fix round still goes back to the same
    builder.
  - The twelve resuming sections go: the note carries the recovery whole.

## 10. Proposed — engineering the build settles

The record's list of what is unclear, each with a proposed default.

10.1 **Finding the state.** The engine resolves `.workflows/` through the
common git directory and hands out absolute paths in its responses. The
skills never assume the folder sits under the session's own, so a session
in a code worktree works the same as one in the main checkout.

10.2 **Git inside the state worktree.**
- Every engine git call there runs with hooks off and the inherited git
  environment cleared (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`).
- So a hook in the person's code repository never fires on a state commit,
  and a git call made from inside a hook never writes the wrong tree. Both
  were among Beads' failures.

10.3 **The branch's name.**
- `workflows-state`, fixed.
- Setup refuses where a branch of that name already holds code history. The
  commit door refuses a code commit on it, and the landing driver never
  targets it.

10.4 **A bare repository with worktrees.**
- There is no main checkout to sit in, so the state worktree is added
  beside the code worktrees.
- Its path is held in the repository's own git config, which every
  worktree shares, and the engine reads it from there in every layout.

10.5 **A fresh clone.** Boot finds the remote's state branch with no
worktree and adds one. Finding neither, on a project being set up, it
creates the orphan branch.

10.6 **Manifests in a second clone's merge.**
- Proposed: the engine merges them field by field against their common
  ancestor. A field changed on both sides stops the merge with both values
  shown.
- Two machines on different units touch different manifests, so a stop
  should be rare.
- Rejected for cost: deriving every manifest from events, which would
  rewrite every manifest write in the engine for a case the solo-developer
  scope rarely meets.

10.7 **A phase not yet written.** The tracker holds only written phases.
The progress view and the menus draw the rest from the cut ("phase 3 of 5,
not yet written"), and the build reads the cut before treating "nothing
ready" as finished (ruled, R15).

10.8 **The tracker's state on the state branch** (R23). Tick's store has to
live in the state worktree. Whether Tick takes a store path today is to be
checked; if it needs a change, that is the person's call on their own
project.

10.9 **Two mods' panes in one tab row.** This is untested, and it matters
to the build's live panel (3.6). It is tested when that panel is spiked.

## 11. Proposed — the build order

11.1 **Where the work lands.**
- Today: one pull request per change into `main`; stacks driven with the
  stack tooling; the person releases from `main`.
- Proposed:
  - The reshape is built on one long-lived branch cut from `main`. Each step
    lands on it as a stack, reviewed as usual, and the design record and
    this plan stay on PR #1480 until the end.
  - `main` takes fixes only while the reshape is built. Each fix is merged
    into the reshape branch as it lands. A new migration on `main` moves
    the shape the reshape migrates from, so the reshape's migration is
    rebased onto it.
  - The branch merges into `main` once 1.4 holds, and the person releases.

11.2 **Step 1 — foundations.** Engine and mod only; no skill prose. Each
part lands with its tests. Before it starts, the merged phase's name is
settled with the person in one conversation, since the engine's phase
tables carry it from the first step (ruled 2026-10-19).
1. **State on its own branch:** the worktree, the lock, commit and push,
   the second-clone merge, and section 10's defaults.
2. **The ledger:** events and their schemas, ids, the append-only check, the write
   hook, the projections (record, map, product record, "since you last
   looked", entries affected by a replacement), and the one-thing-per-entry
   check.
3. **The trust log and logging:** raises, calls, departures, gate answers
   (from the mod) and position switches.
4. **The decision point:** the raise verb and its three answers (ask,
   proceed, ask blind). Until the rule is built (11.4) it asks every call
   Claude has a lean on, so the phases can be built and walked against it.
5. **The drivers:** the task verbs, the Tick driver and their conformance
   suite; the landing verbs, the GitHub and local drivers and theirs.
6. **Briefs:** the templates, the fill verb and the dispatch hook.
7. **The doors:** the layout hook, the commit door's task check, the
   checklists, and the remaining door verbs (section 6).

11.3 **Step 2 — the restructure, with verification alongside.** Prose and
engine surfaces, phase by phase. Each phase lands with its prose-test
cases, its walks and its share of the pipeline simulation.
1. **The model check** (Claude's, promised 2026-10-12): a one-time table of
   every part of this plan with its layer and what changes when the next
   model lands. Anything whose answer is an engine or structure change is
   moved, or brought to the person.
2. **CONVENTIONS.md** rewritten for the new shape: what a phase skill holds
   (goal, done-condition, guidance, the verbs it names, its checklist).
   The sort (R2) is then done skill by skill as each is rewritten.
3. **Decision, first,** with the record-and-log split and its migration
   steps (the move and the records directive), as Sequence step 4 orders.
4. Discovery, with the baseline folded in (9.1).
5. Specification and the phase cut.
6. The build and the review phase, with verification inside them (7), and
   the build's live panel and task accounts, spiked with the person first
   (3.6).
7. The work types: feature, bugfix, quick-fix; cross-cutting removed.
8. The tracking layer: the start menu, the epic menu, the inbox, triage,
   the roadmap, help on every menu.
9. The rest of the migration: the guard, the legacy split, the cut and the
   merges, the finish.
10. Setup (9.2), help and the glossary (9.3), the brief-quality measurement
    with the habit hook and the task-size test (8.4), then the docs (9.4)
    and the CLAUDE.md map.

11.4 **Step 3 — the ask rule.** The arithmetic, the labeller as a raw call
(4.8), the verdict page, blind questions, convergence, the matrix screen,
replay tuning, and the record of the person with its care entries (4.7).

11.5 **Step 4 — rehearsal and the release.** The rehearsal on all 13
projects and their variants (R39), adjusted until clean. Then the dress
rehearsal (1.4), the merge into `main`, and the person's release.

11.6 **Later:** importing an existing user's transcripts, only if the first
weeks of asking prove heavy (R25).

## 12. Parked and fast follows

12.1 **The rest of the workflows board,** a fast follow (ruled 2026-10-19):
any panels the other phases need, discussed and spiked with the person.
The build's panel ships in the release (3.6).

12.2 **Splitting kinds from the stored twelve answers** (4.5), a fast
follow. How it works and when it triggers is parked by the person
(2026-10-19), to come back to.

12.3 **Uninstalling and reinstalling,** parked by the person (2026-10-13)
for a proper conversation, raised when the work reaches install.

12.4 **The mailbox fallback:** a subagent that answers a message in the
target's terms, only if the one-command open still feels clunky (R13).

12.5 **A folder for product conversations,** only if one is ever wanted
(R22).

12.6 **A questions page as a workflows surface:** the person's idea of
2026-10-19, a batch of questions worked through at their own pace and
submitted, parked for discussion.
