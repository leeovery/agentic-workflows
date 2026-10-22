# The workflows, reshaped — the specification

The release's specification: the document the build works from, complete and
unabridged (R14). It is woven from the design record
(`design/workflows-reshaped.md`), the plan (`design/workflows-reshaped-plan.md`)
and the conversations behind them, and checked against all three, against the
product as an idea and against the product as it is today.

How to read it:
- Every numbered statement ends with its source in brackets: an R-number or a
  named passage of the design record ("record NNNN" is a line of the record as
  it stood at commit 58bcd47e6); a plan item; "ruled by the person {date}"
  or "the person {date}" for what the person decided or agreed in the
  conversation; "today's product" for something that works as it does today;
  "Claude's derivation" for a call with one defensible answer, which Claude made
  and marks for the person to see; "Claude's sort" for a line left to the
  builder.
- "Left to the builder:" marks what is open on purpose: engineering with no
  consequence the person would see.
- "Screen, drawn by Claude" marks a screen whose rows and words the sources left
  open, drawn in the existing design system for the person to tick.
- Each section's scenarios (N.S1, N.S2, …) follow it, each naming the
  statements it proves. §29, the phase cut, is the order the release is built
  in: each phase with what it draws on, what it relies on and the scenarios
  that prove it.

## Contents

- §1 The release
- §2 Principles
- §3 Stages, phases, gates and positions
- §4 State and the layout on disk
- §5 The ledger
- §6 The engine's doors
- §7 Tasks, landing and their drivers
- §8 Discovery
- §9 Discussion
- §10 Between topics
- §11 Specification
- §12 The build
- §13 Reviews in the build
- §14 The review phase
- §15 Verification
- §16 Trust
- §17 Measures
- §18 The tracking layer
- §19 Work types
- §20 The workflows board
- §21 Migration
- §22 Setup, environment and the knowledge base
- §23 Help, the glossary and the user docs
- §24 Handoffs and compaction recovery
- §25 Prose tests and the test suites
- §26 Agents, models and effort
- §27 Out of the release
- §28 Open
- §29 The phase cut

## 1. The release

### 1.1 The aim

1.1.1 The release moves control up a level. The engine keeps what the person sees and what gets recorded, the same every time. Claude takes how the work gets done. The person keeps the product, and the calls the ask rule sends them (§16). [record: the aim; R1; plan 1.1]

1.1.2 The goal is Claude making the calls the person would have made had they been asked, so the product comes out the way the person wants it rather than the way a model's priors would make it. Success is Claude deciding as the person would have. [record: the aim; plan 1.1]

1.1.3 Being asked less follows from that and is never the aim: the workflows never trade a question the person should see for a quieter session. [record: What the workflows are for, the person 2026-10-13; plan 1.1]

1.1.4 The workflows exist to bring out early the gaps — questions about what the product should do that nobody has answered yet — while the person is in the zone of talking the product through, so the design is challenged, the gaps found and the decisions recorded upfront, the build runs in one go, and the few gaps left are mostly answered by what is already decided. [record: What the workflows are for, the person 2026-10-13]

1.1.5 The workflows want more findings, not fewer: reviews that challenge the design, look for gaps and enrich the record are the point. [record: What the workflows are for]

1.1.6 Claude answers most findings as the person would have, learned from the person's own answers and recorded so every call can be traced, overruled and learned from; the system backs off where its calls start proving wrong and relearns, following the person's taste as it changes. The few findings that need the person reach them, with periodic checks that the work is still heading the right way (§16). [record: What the workflows are for]

1.1.7 When Claude's calls match the person's, about one finding in ten reaches the person, most are answered by Claude and a couple go where they belong. That split is an indicator of the matrix working, never a target. [record: What the workflows are for; R24]

1.1.8 The reviews and the trust layer are two halves that need each other: a trust layer with the reviews cut has little left to decide and leaves the gaps for the build, and reviews without the trust layer bury the person. [record: What the workflows are for]

1.1.9 Three strands carry the release: A, restructure — loosen procedure, keep contracts; B, trust — learn when to ask, from the person's own record; C, verification — agents prove their work by running the product. [record: the aim]

### 1.2 What it covers

1.2.1 The release covers strand A, the restructure; strand B, trust; strand C, verification; the measures; the migration that brings every project onto the new shape; and the areas the design record never reached: the brownfield assessment, the setup gates and environment setup, help and the glossary, the user docs, the prose-test harness and the test suites, and handoffs and compaction recovery. [plan 1.2, plan 9; Claude's proposal]

### 1.3 One release

1.3.1 Everything the release covers ships together, as one release, with the ask rule on. [plan 1.3; ruled by the person 2026-10-18; record: Sequence step 4]

1.3.2 No project may sit on half a shape: the migration is one sequence (§21). [plan 1.3; R8, R37]

1.3.3 What is not integral to the release comes as a fast follow straight after it, never as a partial product; the fast follows are listed under Out of the release. [plan 1.3; the person 2026-10-19]

1.3.4 The ask rule is built last, but ships in the release. It is calibrated to ask what is asked today and loosens only as evidence supports (§16). [plan 1.3; record: Sequence step 5]

1.3.5 Everyone starts with an empty trust log, the person included, so every call Claude has a lean on asks until its kind loosens (§16). [plan 1.3; R25, ruled by the person 2026-10-18]

1.3.6 No decision model ships in the release (§16). [plan 1.3; R28, ruled by the person 2026-10-18]

1.3.7 The release builds on the base landed by v0.8.16: the entry layer (one skill per phase, one continue skill, a lighter start), the gate-mod compaction work, the mailbox and inbox rework, and the engine displays. [record: Sequence step 1]

1.3.8 The build's order is: first the foundations strands A and B share — the ledger, raise and gate-answer logging, the verdict queue and the user-level store; then the restructure (A), the record-and-log split first, with its migration and directive, and verification (C) alongside; then the ask rule on (B). The release's phase cut gives each step (§29). [record: Sequence steps 3–5]

### 1.4 When the release is ready

1.4.1 The release is ready only when every condition in 1.4.2 to 1.4.7 holds. [plan 1.4; Claude's]

1.4.2 The gates pass: `npm test`, `test:cli`, `test:migrations`, `typecheck` and `test:mod`. [plan 1.4; Claude's]

1.4.3 The rehearsal migrates all 13 projects and their variants cleanly (§21). [plan 1.4; Claude's; R39]

1.4.4 The rebuilt prose-test cases pass for every phase and work type, each agent's prose walked at the effort its definition fixes and the main session's prose at the walker's effort set per run (§25). No condition requires the main session's prose walked at medium: the person runs medium live from the release (26.2.8). [plan 1.4; Claude's; R4; Claude's derivation, O3]

1.4.5 Each phase's context before its first question is within its budget (2.10). [plan 1.4; Claude's; R43]

1.4.6 A test project has been taken through the parts of the process that run without a real conversation — the engine's commands, the migration, the gates and the screens — beside the prose tests. No whole run with a live conversation is required before the release: the first full runs are live, on the person's real projects, after it. [plan 1.4; ruled by the person 2026-10-22]

1.4.7 The epic menu no longer shows a topic's own session as still running after the session ends; the person asked for this check on 2026-10-12. [plan 1.4; Claude's]

1.4.8 The fix behind 1.4.7 is the gap analysis's background run going: nothing runs at the epic menu, so nothing counts sessions there; it is not fixed on its own (8.10.7). [plan 1.4; record, the gap analysis bug; R10; ruled by the person 2026-10-12]

### 1.5 The size of it

1.5.1 The release rewrites most of the product, which at the plan's writing holds 280,000 words of skill prose in 327 files and 43,000 words across 34 agents; 44,000 lines of engine and 72 migrations; about 125 verbs and 150 rendered surfaces; and 208 prose-test cases and a pipeline simulation of 54 scenarios. [plan 1.5; Claude's proposal]

1.5.2 These go whole: today's research, discussion, planning and scoping skills; the plan formats; the analysis loops; grouping; the dependencies between specs; the cross-cutting type; and the baseline skill (§8 for the brownfield assessment). [plan 1.5, plan 9.1; the baseline ruled by the person 2026-10-22]

### 1.6 The weight check

1.6.1 The release is weighed against the person's bar of rope, not walls (2.2), in a table of today against proposed: prose words, engine lines, command families and commands, hooks, checklists, agents, screens, and gates the person answers. [plan 1.6; Claude's, 2026-10-19]

1.6.2 Each new engine piece gets one line in the weight check naming the failure it prevents and how often that failure happened. [plan 1.6; Claude's, 2026-10-19]

1.6.3 Claude brings anything with no failure behind it to the person as a cut. [plan 1.6; Claude's, 2026-10-19; Claude's derivation, O7]

1.6.4 The weight check runs against the assembled spec, before the build. [plan 1.6; Claude's derivation, O7]

### 1.7 Where the work lands

1.7.1 The reshape is built on one long-lived branch cut from `main`. [plan 11.1; Claude's]

1.7.2 Each build step lands on the reshape branch as a stack, reviewed as usual. [plan 11.1; Claude's]

1.7.3 The design record and the plan stay on PR #1480 until the end. [plan 11.1; Claude's]

1.7.4 `main` takes fixes only while the reshape is built, and each fix is merged into the reshape branch as it lands. [plan 11.1; Claude's]

1.7.5 A new migration on `main` moves the shape the reshape migrates from, so the reshape's migration is rebased onto it. [plan 11.1; Claude's]

1.7.6 The reshape branch merges into `main` once every condition of 1.4 holds, and the person releases. [plan 11.1; Claude's]

## 1-S. Scenarios for §1

1.S1 Given the release installed in a project, when the person starts work, then the restructure, trust, verification, the measures and the migration are all present, and the ask rule is on. (1.2.1, 1.3.1, 1.3.4)

1.S2 Given a person with an empty trust log, when Claude meets a call it has a lean on, then it asks the person. (1.3.5)

1.S3 Given the release's setup, when the trust layer is configured, then no decision model is offered. (1.3.6)

1.S4 Given the reshape branch with every step landed and the gates passing, when the rehearsal fails to migrate one of the 13 projects or a variant cleanly, then the branch does not merge into `main`. (1.4.1, 1.4.3, 1.7.6)

1.S5 Given every other condition holding, when one phase's context before its first question is over its budget, then the release is not ready. (1.4.1, 1.4.5)

1.S6 Given every other condition holding, when a rebuilt prose-test case fails for one work type, its agents' prose walked at the efforts their definitions fix and the main session's prose at the walker's effort set for the run, then the release is not ready. (1.4.1, 1.4.4)

1.S7 Given the test project, when the parts of the process that run without a real conversation are taken through it, then each behaves as the spec says before the release is ready; and nothing waits on a whole live run. (1.4.6)

1.S8 Given an epic whose topic session has ended, when the epic menu renders, then it does not show that topic's session as still running. (1.4.7)

1.S9 Given the release installed, when the product's skills, types and formats are listed, then none of today's research, discussion, planning or scoping skills, no plan format, no analysis loop, no grouping, no dependency between specs, no cross-cutting type and no baseline skill remain. (1.5.2)

1.S10 Given the weight check's table, when a new engine piece names no failure it prevents, then Claude brings it to the person as a cut. (1.6.1, 1.6.2, 1.6.3)

1.S11 Given the reshape under way, when a build step is ready, then it lands on the long-lived reshape branch as a stack, reviewed as usual, while the design record and plan stay on PR #1480. (1.7.1, 1.7.2, 1.7.3)

1.S12 Given the reshape under way, when a fix lands on `main`, then it is merged into the reshape branch; and when that fix carries a new migration, the reshape's migration is rebased onto it. (1.7.4, 1.7.5)

1.S13 Given every condition of 1.4 holding, when the reshape is complete, then the branch merges into `main` and the person releases. (1.7.6)

1.S14 Given the spec assembled, when the build has not yet started, then the weight check's table of today against proposed has been made against the assembled spec, and Claude has brought each cut it found to the person. (1.6.1, 1.6.3, 1.6.4)

1.S15 Given every other condition of 1.4 holding, when the main session's prose has never been walked at medium, then the release is still ready. (1.4.1, 1.4.4, 26.2.8)

## 2. Principles

### 2.1 Control moves up a level

2.1.1 The engine owns what the person sees — stages, gates, menus, screens — and what gets recorded — artifacts, their shape and location, state, events. [R1]

2.1.2 Claude owns how the work gets done. [R1]

2.1.3 The person owns the product and the calls the ask rule sends them (§16). [R1, R24]

2.1.4 The workflows are standard operating procedures for capable staff, not supervision of incapable ones. [R1; plan 2.1]

### 2.2 Walls and rope

2.2.1 Every rule in the prose is sorted into one of three kinds — contract, required procedure, or how-to — and the sort is strand A's work plan. [R2; plan 2.2]

2.2.2 A contract — where something lands, what shape it takes, what gets recorded, which door a change goes through, what the person sees — stays a wall, held by the engine rather than prose: a verb that is the only door (it picks the path, writes the shape, records the event, refuses what is wrong), and hard checks behind the verbs (§15). The prose shrinks to one line naming the verb. [R2, R34; plan 2.2]

2.2.3 A required procedure — steps that must all happen, such as closing a phase or concluding a topic — is held by the engine as a checklist. Every item ends done or skipped with a recorded reason, and Claude orders and performs the items as it likes. [R2; plan 2.2]

2.2.4 How-to — everything else — is deleted, leaving a goal and a done-condition. [R2; plan 2.2]

2.2.5 The documents' structure, where imports go, the logging, the outputs and the process the person sees are the same every time; how a plan gets made, or how Claude reasons, is not. [R2]

2.2.6 A phase is entered and left through gates. [R2, the person 2026-10-12]

2.2.7 Some stretches are corridors, short and linear because what they produce has a fixed shape: cutting the work into phases at the end of specification, writing a phase's tasks as it starts, and the final review. [R2, the person 2026-10-12]

2.2.8 Between the corridors lie fields: inside the build Claude works the task list as it judges best — order, parallel worktrees, agents, how tests get written. A field has a suggested path (the phase's goal, its done-condition and its guidance) and no fence. [R2, the person 2026-10-12]

2.2.9 Whatever Claude does in a field stays in the field: what reaches the person, what gets recorded and every question to the person go out only through the engine's verbs and gates. The layout hook, the commit door and the engine's checklists refuse anything else (§6). [R2; plan 2.2]

2.2.10 What the engine's doors cannot refuse — a question asked in plain prose in the build, an extra review round — the prose walks catch, since they assert outcomes. A question for the person asked in plain prose in the build is a slip. [R2, R4; plan 2.2, ruled 2026-10-19]

2.2.11 In discussion, questions are asked in conversation, and the walks check that every answer was recorded (§9). [R2, R11; the person 2026-10-18; plan 2.2, ruled 2026-10-19]

### 2.3 Explicitness, not length

2.3.1 Obedience comes from explicit rules and single doors, not from volume; length dilutes. A one-line rule naming a verb is more explicit than pages of steps around it. [R3]

2.3.2 Control flow lives in the engine, never in prose. [R3; plan 2.3]

2.3.3 A rule carries what was measured behind it only as today's authoring rule allows: one line, where it changes what Claude does at the rule's edge. [R3; Claude's call 2026-10-19]

### 2.4 Drift is caught by outcomes

2.4.1 Prose tests assert outcomes — calls made, write order, the world afterwards — never steps. [R4; plan 2.4]

2.4.2 A contract that keeps slipping in walks gets a verb or a check, never more prose. [R4; plan 2.4]

2.4.3 Each agent's prose is walked at the effort its definition fixes, and the main session's prose, which is not dispatched, at the walker's effort set per run; the prose is walked again on each model the workflows adopt (2.4.4). [plan 2.4, ruled 2026-10-19; Claude's derivation, O3]

2.4.4 When the workflows move to a new model, the prose is walked on it at the efforts the workflows dispatch, and one pass cuts what that model no longer needs. [R4; agreed 2026-10-19; plan 2.4]

2.4.5 Among the rebuilt prose-test cases is this one: the task writer meets a gap partway through a phase's tasks, and only the tasks the gap touches change. It guards against a whole-phase rewrite (§12). [R4, R15; agreed by the person 2026-10-20; plan 2.4]

### 2.5 About 90%

2.5.1 The target is 90–95%, and then iteration; a product is never perfect. [R5]

2.5.2 One closing pass replaces every loop that runs until nothing is found, since a keen reviewer always finds something and much of it is a different opinion, not a defect. [R5; plan 2.5]

2.5.3 Findings clear the existing consequence floor. [R5]

### 2.6 What the person must read reaches them

2.6.1 Anything the person has to see or answer arrives in the flow: a gate, or a mod surface (a pane, a slide-over, a rendered document in the terminal). [R6]

2.6.2 Nothing requires the person to open a file. [R6; plan 2.6]

2.6.3 Material the person may want but need not read is one keystroke away on a mod surface. [R6]

2.6.4 Records, logs, ledgers and design docs are written for Claude and for provenance. [R6]

2.6.5 The release never trades questions for long documents the person is expected to read. [R6]

### 2.7 Our measurements decide

2.7.1 Published results lead the experiments; this project's own measurements, on its own projects and models, decide. [R7; plan 2.7]

2.7.2 Every source is weighed with its date and the models it measured. [R7]

### 2.8 One canonical path

2.8.1 Every change ships with a migration that brings every existing project fully onto the new shape (§21). [R8; plan 2.8]

2.8.2 There is no second set of skills, and no old units on old prose. [R8]

2.8.3 No runtime code recognises what an earlier version left. [R8; plan 2.8]

### 2.9 Event-sourced, for engineers

2.9.1 The workflows are built by an engineer for engineers: their state is event-sourced, named as an engineer would name it, and the product presents itself in these terms. [R45; ruled by the person 2026-10-15]

2.9.2 Everything that happens is an event on an immutable stream, appended and never edited: a question asked, a fact found, a decision made, a decision replaced, a decision confirmed after what it relied on changed. [R45; plan 2.9]

2.9.3 Each kind of event has its own schema, and the engine holds every write to it. [R45]

2.9.4 Everything anyone reads — a topic's record, the map, the product record, "what have you decided without me?", the matrix — is a projection of the streams, worked out from them and never kept by hand. [R45; plan 2.9]

2.9.5 The project's stream is the ledger (§5); the person's own stream, across all their projects, is the trust log (§16). Projections give the current view at every level: topic, work unit, session, project and the person. [R45, R23, R25]

### 2.10 A context budget

2.10.1 What each phase loads before its first question is measured, and records are read only after the question: the context a phase spends before its first question to the person is a measured number, per phase, with a budget. [R43; ruled by the person 2026-10-12]

2.10.2 The walks record that number, so a change that grows it shows (§25; §17). [R43, R36]

2.10.3 The question comes before the reading. A gate needs only what the engine holds; records are read after the answer, never before a question whose answer may discard them. [R43; plan 2.10]

2.10.4 Resuming a topic reads its record and its log, after any question whose answer may discard them; the log is how a session knows the conversation's history. [R43; ruled by the person 2026-10-19; plan 2.10]

2.10.5 Prescription lives in code: what the person sees and what is recorded is held by engine verbs, a few hundred tokens a call, and prose keeps goals, done-conditions and conversation guidance. This is R2's principle, not part of the 2026-10-12 approval. [R43, R2; plan 2.10]

2.10.6 A phase loads no shared reference it does not use. [R43]

2.10.7 The harness's share of the context — Claude Code itself and the MCP servers loaded — is outside the workflows; which MCP servers load where is the person's setup. [R43]

2.10.8 A phase's budget counts only what the workflows load before its first question, never Claude Code's own share or the person's MCP servers. Claude sets each phase's figure once the rebuilt phase is first walked, holding discussion's against the record's estimate of about 15k before the log is read. [R43; plan 1.4, 8.2; Claude's derivation, O5]

2.10.9 Conversation guidance includes today's voice and altitude: how a turn sounds, and product first with code as evidence beneath it. Every phase that talks with the person loads them once per conversation, within its budget (2.10.8). [today's product (`framework.md`, `voice.md`, `altitude.md`); R43; Claude's sort, T27]

### 2.11 Every optimising loop has a counter-measure

2.11.1 Every optimising loop has a counter-measure and R24's frozen anchor, danger, so trust cannot drift by optimising its own metric (§16; §17). [R30; plan 2.12]

### 2.12 Agents write what the workflows prescribe; the person sets the session

2.12.1 Every prescribed artifact is written by a named agent whose model and effort are fixed in its own definition, and the conversation stays in the main session at the person's effort, which the workflows recommend and never set; §26 specifies it. [R46; agreed by the person 2026-10-19; plan 2.13]

### 2.13 The knowledge base

2.13.1 The knowledge base stays, as the first look: it indexes records rendered from the ledger, never logs and never the ledger (§22). [R44; plan 2.11]

## 2-S. Scenarios for §2

2.S1 Given a contract held by an engine verb, when Claude tries to land the thing the contract covers by any other route, then the engine refuses it. (2.2.2, 2.2.9)

2.S2 Given a phase closing, when Claude works the engine's checklist in its own order and skips one item, then that item ends skipped with a recorded reason and every other item ends done. (2.2.3)

2.S3 Given a build, when Claude orders the tasks, runs them in parallel worktrees and chooses how tests get written, then what reaches the person and what gets recorded goes out only through the engine's verbs and gates. (2.2.8, 2.2.9)

2.S4 Given a prose walk of a build, when Claude asks the person a question in plain prose, then the walk catches it as a failed outcome. (2.2.10, 2.4.1)

2.S5 Given a prose walk of a discussion, when the person answers a question in conversation, then the walk checks that the answer was recorded. (2.2.11)

2.S6 Given the rebuilt prose-test case where the task writer meets a gap partway through a phase's tasks, when it runs, then only the tasks the gap touches change. (2.4.5)

2.S7 Given the workflows adopting a new model, when the prose is walked on it at the efforts the workflows dispatch, then one pass cuts what that model no longer needs. (2.4.3, 2.4.4)

2.S8 Given something the person must see or answer, when it is due, then it arrives in a gate or a mod surface, and the person opens no file. (2.6.1, 2.6.2)

2.S9 Given material the person may want but need not read, when they want it, then it is one keystroke away on a mod surface. (2.6.3)

2.S10 Given a project left by an earlier version, when it upgrades, then a migration brings every unit fully onto the new shape, and no runtime code handles the old shape. (2.8.1, 2.8.2, 2.8.3)

2.S11 Given a recorded decision, when it is replaced, then a new event is appended to the stream, the earlier event is unchanged, and the topic's record shows the current decision as a projection of the stream. (2.9.2, 2.9.3, 2.9.4)

2.S12 Given any phase's walk, when it reaches the phase's first question to the person, then the walk has recorded the context spent before it, and a change that grows that number shows. (2.10.1, 2.10.2)

2.S13 Given a topic being resumed with a question whose answer may discard its record, when the question is asked, then neither the record nor the log has been read; after the answer, the session reads the topic's record and its log. (2.10.3, 2.10.4)

2.S14 Given the release's walks, when an agent's prose is walked, then it runs at the effort the agent's definition fixes; and when the main session's prose is walked, it runs at the walker's effort set for that run. (2.4.3)

2.S15 Given a session whose person loads MCP servers of their own, when a phase's context before its first question is measured against its budget, then only what the workflows loaded counts, and neither Claude Code's own share nor the MCP servers do. (2.10.7, 2.10.8)

2.S16 Given a rebuilt phase walked for the first time, when its context before the first question is recorded, then Claude sets the phase's budget from it; for discussion, the figure is held against the record's estimate of about 15k before the log is read. (2.10.8)

2.S17 Given a phase that talks with the person, when its conversation opens, then it loads today's voice and altitude guidance once, counted within the phase's budget, and its turns put the product first with code as evidence beneath it. (2.10.9)

## 3. Stages, phases, gates and positions

### 3.1 Stages and phases

3.1.1 The stages remain Discovery, Definition and Delivery. [R9; plan 3.1]

3.1.2 The Discovery stage's phases are discovery, discussion, experiment and investigation. [R9; plan 3.1]

3.1.3 The Definition stage's phase is specification. [R9; plan 3.1]

3.1.4 The Delivery stage's phases are implementation and review. [R9; plan 3.1]

3.1.5 Research folds into discussion, as one of its tools; it is no longer a phase. [R9; plan 3.1]

3.1.6 The merged phase is named discussion: research is one of its tools, and experiment is invoked from it, its results coming back to be discussed (§9). [R9; ruled by the person 2026-10-20; plan 3.1]

3.1.7 Merging research and discussion is one skill and one row in each of the engine's phase tables. [record: Sequence step 1; R9]

3.1.8 Planning splits and is no longer a phase: the phase cut moves into specification, and tasks are written at the start of each build phase (§11; §12). [R9; plan 3.1]

3.1.9 Scoping goes, with the quick-fix ceremony (§19). [R9, R21; plan 3.1]

3.1.10 The phase names `implementation` and `review` stay. [R9]

3.1.11 The implementer's role is called the builder. [R9; plan 3.1]

### 3.2 Gates in three kinds

3.2.1 Gates are of three kinds: authority gates, fixed; product questions, computed by the ask rule; and process gates, learned. [R40; ruled by the person 2026-10-12; plan 3.2]

3.2.2 The authority gates are: start this work (discovery's shape gate; see §8); approve the map (§8); decided, a topic's close (§9); ready to build, the spec's outline and phase cut (§11); and finish (§14). [R40, R10, R11, R14; ruled by the person 2026-10-12; plan 3.2]

3.2.3 Authority gates are never automatic, since acting before the person's go is the correction they make most often. They stop in both positions (3.3), and a gate that qualifies by count, such as spec sign-off, stays an authority gate. [R40, R29; plan 3.2]

3.2.4 For a feature, decided and ready to build are one screen (§11; §19). [R40, R14, R19]

3.2.5 Product questions are computed by the ask rule (§16). [R40, R24; plan 3.2]

3.2.6 Every gate answer is recorded by the gate's name, in the trust log (§16). [R40, R25; plan 3.2]

3.2.7 A process gate the person always answers the same way becomes an automatic step with a one-line report, and comes back if their answers start to vary. When a gate's answers count as always the same, and when they count as varying, is computed by the trust layer (§16). [R40, R29; plan 3.2]

3.2.8 No gate ships automatic: each process gate asks until the person's own answers loosen it, the author's included (§16). [R29, R25]

3.2.9 Screen: a learned process gate that runs as an automatic step shows a one-line report in its place. Claude draws the line in the existing design system, marked as Claude's, for the person to tick or comment on in the spec. [R40; Claude's derivation, O94]

Screen, drawn by Claude: a learned process gate's one-line report in its place, here an investigation's conclude gate. [Claude's derivation, O94]

```text
Investigation concluded [auto]. Moving to the specification.
```

3.2.10 The gates that served the build's and review's loops — analysis cycles, per-task approval, the fix gate, and their re-review — go with the loops. [R40; Claude's derivation, O52]

3.2.11 Discussion's reviews stay, and their gates are learned like any other process gate (§9). [R40, R11]

### 3.3 Positions: auto and step

3.3.1 A phase runs in one of two positions, auto or step, which replace today's three positions; today's bounded mode and the separate learned position go. [R40; ruled by the person 2026-10-15; plan 3.2]

3.3.2 Auto is the default. In auto, process gates are learned and the ask rule decides, the person being bothered only when the ask rule judges they would want to be, the way Claude Code's auto mode classifies. [R40; ruled by the person 2026-10-15]

3.3.3 In step, every process gate stops — the position for work the person reviews and tests as it lands, as on Folio. [R40; ruled by the person 2026-10-15]

3.3.4 In both positions the authority gates and danger questions stop (§16 for danger). [R40, R24]

3.3.5 The build's position is chosen once, at ready to build, auto by default; then the work hands off to the build (§11; §12). [R40; plan 3.2]

3.3.6 Any phase's position can be switched at any time: the person asks in their own words, and Claude records the switch through its door verb. No row is added for it. [R40; plan 3.2; Claude's derivation, O6]

3.3.7 A switch of position is stated intent: it is recorded in the trust log and outranks the learned counts (§16). [R40, R25]

3.3.8 In step, the gate after each task in the build stops, carrying the task's account and diagrams as today. In auto there is none: only danger, the authority gates and the questions the ask rule parks reach the person (§12). [R15, R40; Claude's derivation, O52]

3.3.9 Screen: ready to build offers the build's position, auto first. Claude draws the rest of the offer in the existing design system, marked as Claude's, for the person to tick or comment on in the spec (§11). [R40; Claude's derivation, O94]

Screen, drawn by Claude: ready to build's position offer, the gate that closes its screen (the outline and the phase cut above it: see §11). [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
Your pick approves the outline and the phase cut, and the build
starts in that position.

◆ Build it, and in which position?

a/auto  → Auto — runs on its own; danger stops what it touches, a
          question for you parks only what depends on it, and
          finish waits for you (recommended)
s/step  → Step — it also stops after each task, for you to review
          and test it
Comment → Ask for a change to the outline or the phase cut
```

3.3.10 Screen: where a phase's current position shows is drawn by Claude in the existing design system, marked as Claude's, for the person to tick or comment on in the spec. [R40; Claude's derivation, O6, O94]

Screen, drawn by Claude: the build's position, shown on its step marker. [Claude's derivation, O94]

```text
□ Build (phase 6 of 8) · auto
```

Screen, drawn by Claude: another phase's position, shown the same way, here an investigation. [Claude's derivation, O94]

```text
□ Investigation · step
```

## 3-S. Scenarios for §3

3.S1 Given the engine's phase tables, when they are read, then discovery, discussion, experiment and investigation sit in Discovery, specification in Definition, and implementation and review in Delivery, with no research, planning or scoping phase. (3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.5, 3.1.7, 3.1.8, 3.1.9, 3.1.10)

3.S2 Given a discussion, when research is needed, then it runs as a tool inside the discussion; and when an experiment is needed, it is invoked from the discussion and its results come back to be discussed. (3.1.5, 3.1.6)

3.S3 Given a specification reaching ready to build, when it is approved, then it carries the phase cut, and each build phase's tasks are written as that phase starts. (3.1.8)

3.S4 Given a person who has answered ready to build the same way every time, when ready to build comes again with the phase in auto, then it stops for the person. (3.2.2, 3.2.3, 3.3.4)

3.S5 Given a feature, when its topic is decided, then decided and ready to build come as one screen. (3.2.4)

3.S6 Given any gate, when the person answers it, then the answer is recorded by the gate's name in the trust log. (3.2.6)

3.S7 Given a process gate in auto whose answers the trust layer counts as always the same, when the gate comes again, then it runs as an automatic step with a one-line report. (3.2.7, 3.2.9)

3.S8 Given that automatic gate, when the person's answers start to vary, then the gate stops and asks again. (3.2.7)

3.S9 Given a new user, when any process gate comes for the first time, then it asks. (3.2.8)

3.S10 Given a build, when it runs, then no analysis-cycle gate, per-task approval gate, fix gate or re-review gate appears. (3.2.10)

3.S11 Given a discussion's review, when its gate comes, then it is learned like any other process gate. (3.2.11)

3.S12 Given ready to build, when the person approves without changing the position, then the build runs in auto, and no bounded mode is offered. (3.3.1, 3.3.2, 3.3.5)

3.S13 Given a phase in step, when any process gate comes, then it stops for the person whatever the learned counts. (3.3.3)

3.S14 Given a phase in auto, when the person asks in their own words to switch it to step, then Claude records the switch through its door verb, the switch is recorded in the trust log, and the phase's process gates stop even where the learned counts would run them automatically; no screen carries a row for the switch. (3.3.6, 3.3.7)

3.S15 Given a phase in auto, when a danger question arises, then it stops for the person. (3.3.4)

3.S16 Given a build in step, when a task finishes, then the gate after it stops, carrying the task's account and diagrams. (3.3.8)

3.S17 Given a build in auto, when a task finishes, then no gate stops; only danger, an authority gate or a question the ask rule parks reaches the person. (3.3.8)

3.S18 Given ready to build, when its screen shows, then it offers the build's position with auto first. (3.3.5, 3.3.9)

3.S19 Given a phase the person has switched to step, when its screens show, then its current position shows as step where Claude's drawing places it. (3.3.6, 3.3.10)

## 4. State and the layout on disk

### 4.1 The state branch

4.1.1 The workflows' state lives on a branch of its own. [R23; ruled by the person 2026-10-18 and confirmed the same day; plan 4.2]

4.1.2 `.workflows/` is a worktree of an orphan branch, checked out inside the main checkout and ignored by code branches. [R23, plan 4.2, Layout on disk]

4.1.3 Code branches and pull requests never carry state, and GitHub never merges it. [R23, plan 4.2]

4.1.4 There is one copy of the state. Every session, whichever worktree it runs in, writes that one copy, and nothing ever creates a `.workflows/` inside a code worktree. [R23, plan 4.2]

4.1.5 The layout on disk (4.11) is the content of the state branch's worktree, never part of a code branch. [Layout on disk, R23]

4.1.6 The tracker's driver keeps the tracker's state on the state branch too (7.5). [R23]

4.1.7 Anything local to a machine stays off the state branch. [R23]

4.1.8 State is never kept on code branches made mergeable, never in a hidden ref written by plumbing, and never written by the engine in the main checkout on the default branch. [R23, rejected there]

### 4.2 Finding the state

4.2.1 The engine resolves `.workflows/` through the common git directory and hands out absolute paths in its responses. [R23, plan 4.2, plan 10.1; Claude's]

4.2.2 The skills never assume `.workflows/` sits under the session's own folder, so a session working in a code worktree works the same as one in the main checkout. [plan 10.1; Claude's; record, engineering still unclear]

4.2.3 The state worktree's path is held in the repository's own git config, which every worktree shares, and the engine reads it from there in every layout of the repository. [plan 10.4; Claude's]

4.2.4 Left to the builder: the name of the git config key that holds the state worktree's path. [plan 10, engineering the build settles; Claude's proposal]

### 4.3 Locks and pushing

4.3.1 The engine serialises writes to the state with a lock held for each verb, never a daemon, so the ledger stays one line of appends on one linear branch that nothing merges into. [R23, plan 4.2]

4.3.2 The engine pushes the state branch after every commit wherever the project has a remote. [R23; the person, 2026-10-18; plan 4.2, plan 3.8]

4.3.3 A failed push of the state branch is a warning, never a stop. [R23, plan 4.2]

### 4.4 Protection

4.4.1 The engine locks the state worktree when it creates it, with the reason "workflows state, do not remove". [R23; ruled by the person 2026-10-18]

4.4.2 The hook before Bash refuses each of: unlocking `.workflows/`; removing `.workflows/`; deleting the state branch locally; deleting the state branch on the remote; force-pushing the state branch. [R23; ruled by the person 2026-10-18; plan 4.2, plan 6.3]

4.4.3 Boot checks the state worktree and the state branch every time it runs. [R23, plan 4.2, plan 9.2]

4.4.4 Boot restores a lost local state branch from the remote. [R23, plan 4.2]

4.4.5 Screen: where the state branch is gone both locally and on the remote, boot stops and says so. The sources give no further content for this stop. [R23; Claude's derivation, O10]

Screen, drawn by Claude: boot's stop, the state branch gone here and on the remote. [Claude's derivation, O94]

```text
⚑ Boot stopped: the workflows' state branch is gone
> Portal keeps its workflows state on a branch of its own,
> workflows-state. Boot found it neither in this clone nor on
> the remote, so there is no state to open.
```

4.4.6 On GitHub, setup offers a rule against deleting or force-pushing the state branch, for anything run outside Claude Code, and sets it only on the person's yes. [R23; ruled by the person 2026-10-18; plan 4.2]

4.4.7 Screen: setup's offer of the GitHub rule in 4.4.6, which acts only on the person's yes. The sources give no rows or wording beyond the offer and the yes. [R23, plan 4.2]

Screen, drawn by Claude: setup's offer of the GitHub rule, with its no (4.4.11). [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
Portal's remote is on GitHub. A rule there can refuse deleting
or force-pushing workflows-state for anything run outside Claude
Code; inside it, the workflows already refuse both.

◆ Set that rule on GitHub?

y/yes → Set it on Portal's repository
n/no  → Leave it unset — setup carries on without it
```

4.4.8 Without a remote, the worktree's lock and the hook before Bash are the protection. [R23]

4.4.9 Boot, finding the state branch with no worktree, re-adds the worktree, locked; finding the worktree unlocked, locks it. [R23, plan 9.2, plan 10.5; Claude's derivation, O10, B13]

4.4.10 Left to the builder: how boot re-adds and re-locks the worktree. [Claude's sort, B13]

4.4.11 A no to setup's offer of the GitHub rule (4.4.7) sets no rule, and setup carries on without it. [R23, plan 4.2; Claude's derivation, O94]

### 4.5 A fresh clone

4.5.1 Boot finds the remote's state branch with no worktree and adds the worktree, locked. [plan 10.5, plan 9.2; Claude's]

4.5.2 Finding neither a state worktree nor a state branch on the remote, on a project being set up, boot creates the orphan branch. [plan 10.5; Claude's]

### 4.6 A bare repository with worktrees

4.6.1 Where the repository is bare with worktrees, there is no main checkout to sit in, so the state worktree is added beside the code worktrees, its path held in the repository's git config (4.2.3). [plan 10.4; Claude's]

4.6.2 Left to the builder: where exactly beside the code worktrees the state worktree is added, and its folder's name. [plan 10.4, engineering the build settles; Claude's proposal]

### 4.7 A second clone

4.7.1 A second clone, on another machine, diverges only on the state branch, and the engine merges it, never git. [R23; ruled by the person 2026-10-18; plan 4.2]

4.7.2 The engine's merge fetches, unions the ledger by id, appends this clone's unpushed entries after the remote's in a commit whose parent is the remote's tip, pushes with lease, and retries if the remote moved, so the append-only check (5.4) holds and nothing pushed is ever rewritten. [R23]

4.7.3 No merge driver is used, so nothing is installed per clone. [R23]

4.7.4 A fact two clones could record independently — a migration applied, a phase concluded — takes an id derived from the fact, so both clones record the one entry. [R23, plan 4.2]

4.7.5 The engine merges manifests field by field against their common ancestor. [plan 10.6; Claude's]

4.7.6 Screen: a manifest field changed on both sides stops the merge, showing both values. [plan 10.6; Claude's]

Screen, drawn by Claude: the merge stopped by one field changed on both machines. [Claude's derivation, O94]

```text
⚑ The state merge stopped: one field changed on both machines
> In Fumi's project manifest, the roadmap item "A lifetime tier"
> was moved on each machine since they last agreed:
>   this machine:  next
>   the remote:    someday
> The engine takes a field from one side only where the other
> left it alone, so it stops here for you to pick.

◆ Which horizon does "A lifetime tier" keep?

1 → next — this machine's
2 → someday — the remote's
```

4.7.7 Manifests are never derived from events. [plan 10.6; Claude's, rejected for cost]

4.7.8 The `state` verbs carry the merge: sync (fetch, merge, push) and status (6.1.14). [plan 6.1; Claude's]

4.7.9 Left to the builder: when the second-clone merge runs. [Claude's sort, B11]

4.7.10 Left to the builder: how files other than the ledger and the manifests are merged between two clones; anything local to a machine stays off the branch (4.1.7). [Claude's sort, B12]

4.7.11 At that stop (4.7.6) each side's value is a row: the person's pick is written into the merged manifest and the merge finishes. [plan 10.6; Claude's derivation]

### 4.8 Git inside the state worktree

4.8.1 Every engine git call in the state worktree runs with hooks off and the inherited git environment cleared (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`), so a hook in the person's code repository never fires on a state commit, and a git call made from inside a hook never writes the wrong tree. [plan 10.2; Claude's; record, engineering still unclear]

4.8.2 Left to the builder: how the engine turns hooks off for its git calls in the state worktree. [plan 10.2, engineering the build settles; Claude's proposal]

### 4.9 The branch's name

4.9.1 The state branch is named `workflows-state`, fixed. [plan 10.3; Claude's]

4.9.2 Setup refuses where a branch named `workflows-state` already holds code history. [plan 10.3; Claude's]

4.9.3 The commit door refuses a code commit on the state branch. [plan 10.3; Claude's]

4.9.4 The landing driver never targets the state branch. [plan 10.3; Claude's]

### 4.10 What is kept

4.10.1 What is kept is the record (a projection of the ledger, 4.11.9), the log, the spec, evidence and a short review report, and the build's log and each task's account with its review rounds' reports (12.14) join them. [R42; ruled by the person 2026-10-12; plan 3.13; the person 2026-10-16; Claude's derivation, O20]

4.10.2 Tasks live in the project's tracker, behind its driver (§7). [R42, plan 3.13]

4.10.3 Tracking files and analysis files go. [R42, plan 3.13; the person 2026-10-16]

### 4.11 The layout on disk

4.11.1 The layout on disk is as this subsection sets it out, and the layout hook refuses writes under `.workflows/` outside it (6.2). [Layout on disk; ruled by the person 2026-10-17; R35; plan 3.13]

4.11.2 A topic exists only before the spec; from the spec on, everything is the work unit's. [Layout on disk]

4.11.3 `.workflows/` holds:
- `manifest.json`: the registry, defaults and the roadmap;
- `.ledger.jsonl`: the project's stream (§5);
- `.inbox/`, `.roadmap/`, `.state/` and `.knowledge/`;
- `.cache/{unit}/…`: gitignored session state, mirroring the unit's tree;
- one folder per work unit, `{unit}/`.

[Layout on disk; plan 9.1; ruled by the person 2026-10-22]

4.11.4 The layout has no `.baseline/`: a project holding `.baseline/` docs has them moved to assets as reference by the migration (§8, §21). [plan 9.1; ruled by the person 2026-10-22; Claude's derivation]

4.11.5 A work unit's folder, `{unit}/`, holds:
- `manifest.json`: status, the map's topics and order, and where the build stands;
- `discovery/session-NNN.md`: discovery's log, one file per session;
- `topics/{topic}/brief.md`: discovery's brief for the topic;
- `topics/{topic}/log.md`: the journey, one dated heading per session;
- `topics/{topic}/mail/NNN-*.md`: messages waiting for the topic (§10);
- `assets/`: what informs a decision (§9);
- `seeds/` and `.state/`;
- `spec.md`: the areas, then the phase cut (§11);
- `spec-review.md`: the record of the person's review of the spec, when they took one (11.11.9);
- `build/log.md`: what is in flight, what was tried and dropped, what is left for the next phase;
- `build/notes.md`: notes for later;
- `build/tasks/{task}.md`: each task's account;
- `review/`: one report per round, the passing one being the certificate.

[Layout on disk, R11, R13, R12, R14, R15, R16]

4.11.6 By work type: an epic has many topics; a feature one, named after the unit; a bugfix one, whose log is the investigation; a quick-fix none and no spec, holding `build/` and `summary.md`, the short record after the work (§19). [Layout on disk, R21]

4.11.7 The phase cut lives at the end of `spec.md`. [Layout on disk; Open, how the task driver carries per-phase task writing]

4.11.8 Discovery and the roadmap keep their logs per session; a topic keeps one log. [R11; ruled by the person 2026-10-13]

4.11.9 Never files: a topic's record and its map, the product record, the verdict queue, the questions waiting on the person, and "what have you decided without me" are projections of the ledger (5.8). [Layout on disk, R45, plan 3.13]

4.11.10 The knowledge base's rendered copies of records sit in `.knowledge/`, and so does the product record's rendered file, for a CLAUDE.md line to point at. [Layout on disk, R44, R10; where the product record's file sits is Claude's call]

4.11.11 `.knowledge/` and `.cache/` are gitignored. [Layout on disk, R23, R44]

4.11.12 A product-level spike's files go in `.roadmap/assets/`, which replaces `.roadmap/imports/` as a unit's `assets/` replaces `imports/`. [R12; Claude's call, 2026-10-19]

4.11.13 A spike's dependencies, builds and run output go in the gitignored cache. [R12; Claude's call, 2026-10-19; plan 3.4]

4.11.14 The person's own stream, the trust log, and the record of the person live at user level, in `~/.config/workflows/` (§16). [Layout on disk, R25, R27]

4.11.15 The layout has a home for each topic's experiment records, and for each verification run's record and its text evidence; recordings and images stay in the gitignored cache, their hash recorded with the run. The paths are the builder's. [R11, R9, plan 7.2, Layout on disk; Claude's derivation, O12]

4.11.16 Left to the builder: the inner layout of `.inbox/`, `.roadmap/` and `.state/`, and of a unit's `seeds/` and `.state/`. [Claude's sort, B20]

## 4-S. Scenarios for §4

4.S1 Given a project with a remote and its state worktree at `.workflows/` on `workflows-state`, when a session working in a code worktree runs a verb that writes state, then the write lands in the one `.workflows/` found through the common git directory, no `.workflows/` appears in the code worktree, the engine's response carries absolute paths, the state branch gains a commit that is pushed, and the default branch gains no commit. (4.1.1, 4.1.2, 4.1.4, 4.1.8, 4.2.1, 4.2.2, 4.3.2)

4.S2 Given a code branch with work on it, when its pull request is opened, then the pull request carries no file under `.workflows/`. (4.1.2, 4.1.3, 4.1.5)

4.S3 Given two sessions running state-writing verbs at the same moment, when both finish, then their writes were made one after the other under the lock, and the state branch's history is linear with no merge commit. (4.3.1)

4.S4 Given a remote that refuses the state branch's push, when a verb commits state, then the commit stands, the engine's response carries a warning, and the session carries on. (4.3.3)

4.S5 Given a project with no remote, when a verb commits state, then the engine makes no push. (4.3.2)

4.S6 Given a state worktree the engine created, when `git worktree list --porcelain` is read, then the worktree shows as locked with the reason "workflows state, do not remove". (4.4.1)

4.S7 Given a session, in a project with a remote or without one, when Claude runs a command that unlocks `.workflows/`, removes it, deletes `workflows-state` locally, deletes it on the remote, or force-pushes it, then the hook before Bash refuses each one. (4.4.2, 4.4.8, 6.3.8)

4.S8 Given the local `workflows-state` deleted outside Claude Code while the remote holds it, when boot runs, then the local branch is restored from the remote. (4.4.3, 4.4.4)

4.S9 Given `workflows-state` gone locally and on the remote, when boot runs, then boot stops and says so. (4.4.5)

4.S10 Given a project whose remote is on GitHub, when setup runs, then it offers the rule against deleting or force-pushing the state branch, and the rule exists on the repository only after the person's yes. (4.4.6, 4.4.7)

4.S11 Given a fresh clone whose remote holds `workflows-state` and which has no state worktree, when boot runs, then the state worktree is added and locked. (4.5.1)

4.S12 Given a project being set up with no state worktree and no state branch on the remote, when boot runs, then an orphan `workflows-state` branch exists afterwards. (4.5.2, 4.9.1)

4.S13 Given a bare repository with worktrees, when the state worktree is created, then it sits beside the code worktrees, its path is in the repository's git config, and the engine run from any of the code worktrees resolves the same state. (4.2.3, 4.6.1)

4.S14 Given two clones that each appended ledger entries since their last push, when the clone that is behind runs `state sync`, then its ledger holds the remote's entries first and its own unpushed entries after them in their order, the new commit's parent is the remote's tip, the push is made with lease, the append-only check passes on both clones afterwards, and neither clone's config holds a merge driver for the state. (4.7.1, 4.7.2, 4.7.3, 4.7.8)

4.S15 Given the remote moved between the fetch and the push of a sync, when the push with lease fails, then the sync retries. (4.7.2)

4.S16 Given both clones recorded the same fact independently (the same migration applied), when they sync, then the ledger holds one entry for it. (4.7.4)

4.S17 Given two clones that changed different fields of one manifest, when they sync, then the merged manifest holds both changes; given both changed the same field, then the merge stops and shows both values, and once the person picks one the merged manifest holds it and the sync finishes. (4.7.5, 4.7.6, 4.7.11)

4.S18 Given the person's code repository has a commit hook and the session's environment carries `GIT_DIR`, when the engine makes a state commit, then the hook does not run and the commit lands on `workflows-state` in the state worktree. (4.8.1)

4.S19 Given an existing branch named `workflows-state` that holds code history, when setup runs, then setup refuses. (4.9.2)

4.S20 Given a code commit made through the commit door on `workflows-state`, then the door refuses it; and given any `land` call, it never opens or merges a pull request into `workflows-state`. (4.9.3, 4.9.4)

4.S21 Given a unit that has finished its build, when its folder is listed, then it holds the topics' logs, the spec, the build's log, each task's account with its review rounds' reports, and the review's reports, no tracking files or analysis files, and its tasks are found in the tracker. (4.10.1, 4.10.2, 4.10.3)

4.S22 Given an epic past its spec, when its folder is listed, then it matches 4.11.5: `manifest.json`, `discovery/session-NNN.md` files, `topics/{topic}/` each with `brief.md`, `log.md` and `mail/`, `assets/`, `seeds/`, `.state/`, `spec.md` ending with the phase cut, `build/` with `log.md`, `notes.md` and `tasks/`, and `review/`; with discovery's log one file per session, each topic one log, and nothing of the build or review under `topics/`; and `.workflows/` holds no `.baseline/`. (4.11.1, 4.11.2, 4.11.3, 4.11.4, 4.11.5, 4.11.7, 4.11.8)

4.S23 Given a quick-fix unit after its work, when its folder is listed, then it holds `build/` and `summary.md`, and no `topics/` and no `spec.md`; given a feature, then it holds one topic named after the unit. (4.11.6)

4.S24 Given any project, when the state branch's files are listed, then none holds a topic's record, a map, the product record, the verdict queue, the questions waiting on the person or "what have you decided without me". (4.11.9)

4.S25 Given a topic whose entries just changed, when `.workflows/.knowledge/` is listed, then it holds the topic's rendered record, and `git status` in the state worktree shows nothing under `.knowledge/` or `.cache/`, and neither is on the state branch. (4.1.7, 4.11.10, 4.11.11)

4.S26 Given a product-level spike, when its source is kept, then it sits in `.roadmap/assets/`, and its dependencies, builds and run output sit in the gitignored cache. (4.11.12, 4.11.13)

4.S27 Given a project in use, when the trust log and the record of the person are written, then they are written under `~/.config/workflows/`, never under `.workflows/`. (4.11.14, 5.1.7)

4.S28 Given a topic that ran an experiment and a build that recorded a verification run, when their files are written, then the layout hook lets the experiment's records and the run's record and text evidence through to their homes in the layout, and the run's recordings and images sit in the cache, their hash in the run's record. (4.11.15)

4.S29 Given the state branch present locally with its worktree removed, or with the worktree found unlocked, when boot runs, then the worktree is in place and locked. (4.4.9)

4.S30 Given setup's offer of the GitHub rule, when the person declines it, then no rule is set and setup carries on. (4.4.6, 4.4.11)

## 5. The ledger

### 5.1 What the ledger is

5.1.1 The ledger is the history of every decision and finding in the project, by either side: who made it, what the other side would have said (Claude's sealed answer beside the person's; Claude's alternatives and evidence beside its own call), who moved whom, the kind of question, and what happened to it later. [R23; designed with the person 2026-10-13]

5.1.2 The ledger never feeds the work directly; the records drawn from it do. [R23, R11]

5.1.3 The ledger's jobs are to answer "what have you decided without me?" as one engine query, with nothing for Claude to collect; to give the matrix its evidence (§16); and to keep both sides' mistakes to learn from later, the person's included. [R23]

5.1.4 There is one ledger for the project. [R23; ruled 2026-10-13, ratified by the person 2026-10-14; plan 4.1]

5.1.5 A unit's ledger is its tagged entries, written only by its own sessions; a later unit reads earlier decisions directly. [R23]

5.1.6 The build's calls are ledger entries too: they draw no record, and the same query shows them. [R23]

5.1.7 The ledger is the project's stream; the person's own stream, across all their projects, is the trust log (§16). [R45]

5.1.8 Every decision and finding is a ledger entry written through an engine command. The engine constrains only an entry's identity, links and supersession, never its content: it stores an entry's why without constraint, so the why can run to paragraphs, Claude writes it freely, and the structure stays out of its way. Each kind of event's schema is 5.3.2's. [R11; ruled by the person 2026-10-13; R23; Claude's derivation]

5.1.9 The ledger is written by engine commands only, never by hand. [R23, plan 4.1]

5.1.10 The person reads the ledger when they choose; the count of calls on a topic's decided screen is §9's, and verdicts are §16's. [R23]

### 5.2 Ids and tags

5.2.1 Each entry is identified by a nanoid and shown by a short form of it, the way git shows a short hash. [R23; ruled by the person 2026-10-18; plan 4.1]

5.2.2 Entries never take sequential numbers, which collide wherever two writers append. [R23; ruled by the person 2026-10-18]

5.2.3 Each entry is tagged with its work unit, topic, phase and session. [R23, plan 4.1]

5.2.4 Every event carries the time the engine wrote it. [R23; ruled by the person 2026-10-14]

5.2.5 An entry can be marked product-wide; the product record is the entries so marked (5.8.6). [R23, R10]

5.2.6 Left to the builder: the short id's length, and the nanoid's size and alphabet. [Claude's sort, B5]

### 5.3 Events

5.3.1 The ledger is an event stream, and everything read from it is a projection. [R23; agreed by the person 2026-10-14; made a principle 2026-10-15, R45]

5.3.2 There are five kinds of event, each with its own schema:
- asked: a question goes on a topic's map;
- found: a fact, and how it is known;
- decided: an answer to a question, with who, why, what it rules out and what it relies on;
- replaced: a new answer, naming the old one and one of the four reasons (5.6.2);
- still holds: a topic confirms an answer after something it relied on changed.

[R23, R45, plan 4.1; Claude's derivation, O16]

5.3.3 A question can also be moved to another topic, which is written as an event of its own (moved); its schema is the builder's. [R23, plan 4.1, plan 6.1; Claude's derivation, O16]

5.3.4 Nothing is updated: every change is a new event. [R23, R45]

5.3.5 The links — which question an answer closes, what it replaces, what it relies on — are fields the engine assigns, never prose. [R23]

5.3.6 Every kind of entry links the same way: a question, a finding and a decision can each name what it relies on, and each can be replaced, always by a new event. [R23; ruled by the person 2026-10-14]

5.3.7 A finding shown wrong is replaced with the reason "it was wrong". [R23]

5.3.8 A change names what caused it, by short id: the other topic's decision, the new fact, or the message. [R23]

5.3.9 A review finding goes on the stream as a question the review asked, so its answer is linked to it like any other. [R23]

5.3.10 Who moved whom is on every entry. [R23]

5.3.11 An answer that settles part of a question puts the unsettled part on the map as its own question, linked to the first, so nothing open hides behind an answer. [R23]

5.3.12 Left to the builder: each event's field names and shapes beyond decided's who, why, what it rules out and what it relies on. [Claude's sort, B4]

5.3.13 Several entries can answer one question; they are its siblings, with no sub-decision layer. A question's current answer is every entry naming it that no replacement names, so replacing one sibling never touches the others. The parts of a split entry (5.5.3) each name the question the whole answered. [R23; the person 2026-10-14]

### 5.4 Append-only, and its check

5.4.1 The stream can never be edited, mechanically: no verb edits an event, and only the engine writes the file, by appending. [R23; ruled by the person 2026-10-18; plan 4.1]

5.4.2 A hook refuses any other edit of the ledger (6.2.3). [R23, plan 6.2]

5.4.3 The engine checks append-only on every read: the ledger on disk must start, byte for byte, with the ledger the state branch last committed. [R23, plan 4.1]

5.4.4 Screen: anything changed, removed or reordered in the ledger stops the engine, showing the line it found. [R23]

Screen, drawn by Claude: the engine stopped by a ledger line that isn't as committed. [Claude's derivation, O94]

```text
⚑ The engine stopped: a ledger line isn't as it was committed
> Mint's ledger only grows at its end, and line 1,204 isn't the
> line the state branch last committed there. The line it found:
>   {"v":1,"id":"Xk3vQ9…","event":"decided","topic":"token-a…
> Something outside the engine changed, removed or reordered the
> ledger, so the engine stops here.
```

5.4.5 The engine runs the same check against the parent at every commit. [R23, plan 4.1]

5.4.6 Each append replaces the file whole under the lock, so a read never meets half a line. [R23]

5.4.7 There is no fingerprint chain over the ledger. [R23; dropped 2026-10-18; plan 4.1]

5.4.8 The one commit the append-only check lets differ is a migration's converted copy (5.7.3). [R23]

### 5.5 One thing per entry

5.5.1 The engine refuses a decision that names no question. [R23]

5.5.2 Whether an entry holds one rule is judged when it is written, by a separate Claude call, never the Claude writing it (§16, the raw call). [R23, R28, plan 4.1, plan 4.8]

5.5.3 An entry holding several rules is split before it lands. [R23]

5.5.4 A decision is one entry: the same decision reached from another topic is that entry, never a second. [R23; ruled by the person 2026-10-14]

5.5.5 A duplicate that gives the same answer is merged where it is found, leaving the owner's entry as it stands. [R23; ruled by the person 2026-10-14; plan 3.4]

5.5.6 Left to the builder: which event records a duplicate merged where it is found, the ledger staying append-only. [Claude's sort, B7]

5.5.7 Left to the builder: who splits an entry the separate call judges to hold several rules, and how, before it lands. [Claude's sort, B8]

### 5.6 Replacing

5.6.1 A later work unit replaces an older decision; it never records one beside it. [R23; ruled by the person 2026-10-14; plan 4.1]

5.6.2 Superseding appends: the replacing entry names the one it supersedes and one of four reasons — a new fact, another topic's decision, a changed mind, or the earlier one was wrong. [R23, plan 4.1]

5.6.3 The reason "the earlier one was wrong" applies to the person's decisions as to Claude's. [R23]

5.6.4 The superseded entry stays in the ledger and folds beneath the current one in the record. [R23]

5.6.5 The chain is shown, never merged: a record shows each current answer with the answers it replaced folded beneath it, together with any question moved away to another topic and any "still holds" confirmation, so every entry a log names can be found from a record. [R23; ruled by the person 2026-10-14]

5.6.6 A replacement is written beside the old answer and names what it drops. [R23]

5.6.7 The closing pass and the spec each check every replacement against what it replaced (§9, §11; 6.4.6, 6.4.7). [R23]

5.6.8 Finding the older decision is a judgement, made as mechanical as it can be: every opening view reads the whole product record; a topic's opening view searches earlier units' current entries in its area through the knowledge base; and the read for conflicts before the spec covers the whole project's current entries in the areas the work touches (§9, §11). [R23]

5.6.9 Every change to a decision another topic owns goes to the owner through the mailbox, and the owner's session writes the replacing entry, so a decision is only ever changed through the lens of the topic that owns it (§10). [R23; stated 2026-10-14 in answer to the person; plan 3.4]

5.6.10 When an answer is replaced, every entry relying on it is affected. Affected is a fold: an entry relying on a replaced one, with no "still holds" or replacement written since. [R23]

5.6.11 A change flags the questions and findings that rely on it, as well as the decisions. [R23]

5.6.12 Within a unit still under way, the topic owning an affected entry shows among what waits on the person until it answers, even when the topic was closed. [R23; Claude's derivation, O9]

5.6.13 An affected entry in a finished unit is flagged in the work that made the change, which confirms or replaces it; the finished unit is never reopened. [R23, plan 4.1; Claude's derivation, O9]

5.6.14 Two current answers that contradict each other are no fold's to see: the read for conflicts finds them, within a topic as well as across topics (§9, §11; 6.4.6). [R23]

5.6.15 Where an entry's text and the design it points at disagree, one standing rule holds: on what exists and how it behaves, the record wins and the design is out of date; on how it looks, the design wins. [R23]

### 5.7 Storage

5.7.1 The ledger is stored as JSON lines in `.workflows/.ledger.jsonl`, under git on the state branch: one line per event, appended, each line carrying its schema version. [R23; ruled by the person 2026-10-18; plan 4.1]

5.7.2 A field a later release adds is optional in the schema with a stated default, so older lines are already valid lines of the current shape and need nothing. [R23; ruled by the person 2026-10-18; plan 4.1]

5.7.3 A real break — a rename, a split, a change of meaning — is a migration writing a converted copy of the whole stream: one reviewed migration with its tests, whose check refuses unless every event comes through, with the same ids in the same order. Its commit is the one the append-only check lets differ, and git keeps the original file byte for byte. [R23; ruled by the person 2026-10-18; plan 4.1]

5.7.4 Projections read one shape only; runtime code never reads an older shape of the ledger. [R23; Migrations]

5.7.5 The ledger is never a database. An index rebuilt from the lines is added only if queries slow. [R23]

5.7.6 Nothing reads the whole stream. A saved copy of the current state is kept beside the ledger only if reads slow, and the stream is never trimmed. [R23]

5.7.7 The ledger itself is never indexed by the knowledge base, since it holds replaced answers that search would return as current. [R23, R44]

5.7.8 Left to the builder: how the folds and the byte-for-byte check read the file; "nothing reads the whole stream" (5.7.6) governs what sessions read. [Claude's sort, B9]

### 5.8 Projections

5.8.1 Everything anyone reads from the ledger is a projection, worked out from the stream and never kept by hand; projections give the current view at every level: topic, work unit, session, project and the person. [R45, R23]

5.8.2 The map, a topic's record and the product record are folds of the stream, worked out when read, with no saved projection in the work unit; an index comes only if reads slow. [R23]

5.8.3 The `ledger` verbs read: the record, the map, the product record, "since you last looked", and what a replacement affects (6.1.4). [plan 6.1, plan 11.2; Claude's proposal]

5.8.4 A topic's record shows each current answer with the answers it replaced folded beneath it (5.6.5), and shows other topics' current answers rather than restating them, so a change leaves no stale copy to correct. What else a record holds is §9's. [R23, R11]

5.8.5 The map is a topic's list of what is being decided and where each stands, drawn from the ledger; what it shows is §9's. [R11]

5.8.6 The product record is the entries marked product-wide. [R23, R10]

5.8.7 "What have you decided without me?" is one engine query, and the map's "since you last looked" is the same query. [R23]

5.8.8 What a replacement affects is the fold in 5.6.10. [R23, plan 6.1]

5.8.9 The questions waiting on the person are held in the ledger, each question and its answer as lines of their own, so what waits survives a compaction or a new session, and every surface that shows them reads them from there (§12). [plan 3.6, Layout on disk]

5.8.10 The verdict queue is a projection of the ledger, never a file; its behaviour is §16's. [Layout on disk]

5.8.11 Every session can read every entry, by unit, topic or area, and current entries only. [R23]

5.8.12 The knowledge base's copy is the one rendering kept: when a topic's entries change, the engine renders its record and the knowledge base indexes it. The copy lives in the gitignored `.workflows/.knowledge/` and is rebuilt from the ledger, so a replaced answer drops out of search the moment it is replaced (§22). [R23; ruled by the person 2026-10-17; R44]

5.8.13 The engine renders the product record to a file in `.knowledge/` whenever a product-wide entry changes, so a CLAUDE.md line can point at it. [R10, Layout on disk, plan 3.3]

5.8.14 "Since you last looked" counts from the last time the map showed in the conversation: the person has looked when the map shows there, and opening the board is not looking. When the map shows is §9's. [R11, R23; Claude's derivation, O8]

5.8.15 Left to the builder: where the last-looked mark is kept. [Claude's sort, B6]

5.8.16 Left to the builder: how a read by area works; it goes through the knowledge base's search (record 2044–2048, R23), never a tag on the entry. [Claude's sort, B10]

5.8.17 An entry is current only while nothing has replaced it and its topic and unit are live. The entries of a cancelled topic or unit, and of a postponed topic while it waits, are not current. They are not indexed, not shown in other topics' records or opening views, and not read for conflicts. They become current again when the topic or unit is reactivated, or the postponed topic is pulled back into its own epic. The ledger keeps them either way. [R23, R44, R17; Claude's derivation, T4]

### 5.9 The log stays out of the ledger

5.9.1 The journey stays out of the ledger: a topic's log, one dated heading per session, free prose written as the conversation goes, enough for a fresh session to carry on alone, pointing at entries by short id rather than restating them (§9). [R23, R11]

## 5-S. Scenarios for §5

5.S1 Given a topic with an open question, when Claude records an answer through `ledger decide` naming the question, then one line is appended to `.workflows/.ledger.jsonl` carrying a nanoid id, its schema version, the unit, topic, phase and session, the time written, who decided, why, what it rules out and what it relies on, the engine-assigned link to the question it closes, and the engine's response shows the entry's short id; the project has this one ledger file and no other, per unit or elsewhere. (5.1.4, 5.2.1, 5.2.3, 5.2.4, 5.3.2, 5.3.5, 5.7.1, 5.7.5)

5.S2 Given two sessions appending entries at once, when both land, then their ids differ, neither is a sequential number, and a read made meanwhile meets the ledger before or after each append, never half a line. (5.2.2, 5.4.6)

5.S3 Given `ledger decide` called naming no question, then the engine refuses it. (5.5.1)

5.S4 Given an entry Claude writes that holds two rules, when it is written, then the separate Claude call judges it holds several, and it lands as two entries. (5.5.2, 5.5.3)

5.S5 Given a line of `.ledger.jsonl` changed by a shell command, when any verb next reads the ledger, then the engine stops and shows the line it found; the same for a line removed or two lines swapped. (5.4.1, 5.4.3, 5.4.4)

5.S6 Given a ledger that does not start, byte for byte, with the parent commit's ledger, when a state commit is made, then it is refused. (5.4.5)

5.S7 Given Claude uses Write or Edit on `.workflows/.ledger.jsonl`, then the hook refuses it, and the ledger changes only through engine commands. (5.1.9, 5.4.2)

5.S8 Given a decision D1, when Claude replaces it through `ledger replace` with the reason "a changed mind", then a replaced event naming D1 and the reason is appended, D1's line is byte for byte unchanged, and the record shows the new answer with D1 folded beneath it. (5.3.4, 5.6.2, 5.6.4, 5.6.5, 5.6.6)

5.S9 Given, in a unit still under way, decision D2, question Q and finding F, each relying on D1, when D1 is replaced, then "what a replacement affects" lists D2, Q and F, and their owning topic shows among what waits on the person even though it was closed; when that topic writes "still holds" for each, they leave the list. (5.3.6, 5.6.10, 5.6.11, 5.6.12, 5.8.8)

5.S10 Given a finished unit holding an entry that relies on an older decision, when a later unit replaces the older decision, then the relying entry is flagged in the later unit's work, which confirms or replaces it, and the finished unit is not reopened: its status stays finished. (5.6.1, 5.6.13)

5.S11 Given topic A owns decision D, when topic B's session finds D must change, then a message goes to A's mailbox and the replacing entry is written by A's session, never B's. (5.6.9)

5.S12 Given a finding shown wrong, when it is replaced, then the replaced event carries the reason "it was wrong"; given the person's own decision shown wrong, the same reason is accepted. (5.3.7, 5.6.3)

5.S13 Given a change caused by another topic's decision, when it is written, then it names that decision by short id. (5.3.8)

5.S14 Given a review raising a finding, when it is recorded, then it is an asked event from the review, and the later answer is linked to it. (5.3.9)

5.S15 Given an answer that settles part of a question, when it is written, then the unsettled part appears on the map as its own question, linked to the first. (5.3.11)

5.S16 Given a question on topic A, when it is moved to topic B, then a moved event is appended, the question shows on B's map, and A's record shows the move in the chain. (5.3.3, 5.6.5)

5.S17 Given topic B reaches the same decision topic A already holds, when it is recorded, then the ledger holds one entry, A's, unchanged. (5.5.4, 5.5.5)

5.S18 Given an epic with decided topics, when the unit's folder is listed, then no record or map file exists in it, and the `ledger` read verbs return each topic's record, its map, the product record, "since you last looked" and what a replacement affects, and the verdict queue is read the same way, from no file. (5.8.2, 5.8.3, 5.8.5, 5.8.10)

5.S19 Given Claude made calls in a discussion and in the build, when "what have you decided without me?" is queried, then both appear, the build's calls included though they draw no record. (5.1.3, 5.1.6, 5.8.7)

5.S20 Given topic B's record and a current answer of topic A it rests on, when the record is read, then A's answer is shown from A's current entry, and after A's answer is replaced B's record shows the new one. (5.8.4)

5.S21 Given a product-wide entry is written, when the product record is read, then it includes the entry, and the rendered file in `.knowledge/` is rewritten. (5.2.5, 5.8.6, 5.8.13)

5.S22 Given an answer is replaced, when the knowledge base is queried for it, then the replaced answer no longer comes back, the topic's rendered record in `.knowledge/` shows the new one, and the knowledge base's indexed files include no `.ledger.jsonl`. (5.7.7, 5.8.12)

5.S23 Given a build question waiting on the person, when the session compacts or a new session starts, then the question still shows on every surface that lists waiting questions, read from the ledger. (5.8.9)

5.S24 Given a line written before a later release added an optional field, when the current engine reads it, then it is valid and the field takes its stated default. (5.7.2)

5.S25 Given a migration that converts the stream, when one event fails to come through or an id or the order differs, then its check refuses; when all come through, its commit passes the append-only check, and git keeps the original file. (5.4.8, 5.7.3)

5.S26 Given a topic's log, when a fresh session reads it, then it refers to entries by short id rather than restating them. (5.9.1)

5.S27 Given the person answered a call Claude raised, when its entry is read, then it holds Claude's sealed answer beside the person's, who moved whom, and the kind of question; given a call Claude made itself, its entry holds Claude's alternatives and evidence. (5.1.1, 5.3.10)

5.S28 Given two units in one project, when a session in unit U writes an entry, then the entry is tagged with U, and a session in a later unit reads U's entries directly. (5.1.5)

5.S29 Given entries across units and topics, some replaced, when a session reads by unit, by topic or by area, then it gets that slice's current entries only, the replaced ones left out. (5.8.11)

5.S30 Given the map showed in the conversation after Claude's calls C1 and C2, and Claude then made C3, when the person opens the board and the map later shows in the conversation again, then "since you last looked" lists C3 only: opening the board did not count as looking. (5.8.7, 5.8.14)

5.S31 Given a question answered by three entries, one rule each, when one of them is replaced, then the question's current answer is the replacing entry and the two untouched siblings, and the record shows all three; given an entry split before it lands, then each part names the question the whole answered. (5.3.13, 5.5.3)

5.S32 Given an epic with a cancelled topic and a postponed topic, when another topic's opening view is drawn, the knowledge base is searched or the read for conflicts runs, then neither topic's entries appear; when the postponed topic is pulled back into its own epic, its entries are current again, and the ledger held them throughout. (5.8.17)

## 6. The engine's doors

### 6.1 The verbs, by door

6.1.1 The verbs are the only doors. [R35, R2; plan 6]

6.1.2 The prose writes no manifest field: each write the prose makes today becomes the effect of a door verb, so the prose names verbs, never fields. [plan 6.1; Claude's; R2, R3]

6.1.3 The prose reads a manifest value only where a verb's response does not already carry it. [plan 6.1; Claude's]

6.1.4 `ledger` (new): ask, find, decide, replace, hold, move; and reads of the record, the map, the product record, "since you last looked", and what a replacement affects (§5). [plan 6.1; Claude's]

6.1.5 `raise` (new): puts a call through the decision point and returns ask, proceed or ask blind; records the person's answer, "I don't follow" included (§16). [plan 6.1; Claude's]

6.1.6 `verdict` (new): the queue, and giving a verdict (§16). [plan 6.1; Claude's]

6.1.7 `task`, rebuilt as the driver's verbs (7.1.2), plus a note for later (§12). [plan 6.1; R35, ruled by the person 2026-10-17]

6.1.8 `land` (new): open a task's pull request, chain it into its phase's stack, merge a phase, merge at finish (7.2). [plan 6.1; Claude's]

6.1.9 `brief` (new): fill a template and issue it (6.5). [plan 6.1; Claude's]

6.1.10 `checklist` (new): show, done, skip with a reason (6.4). [plan 6.1; Claude's]

6.1.11 `asset` (new): add with its status, change the status (§9). [plan 6.1; Claude's]

6.1.12 `verify` (new): run and record a proof, and the bug-proven run (§15). [plan 6.1; Claude's]

6.1.13 `gate` (new): takes the person's answer at any gate, logs it, and returns what happens next (6.6). [plan 6.1; Claude's]

6.1.14 `state` (new): sync (fetch, merge, push) and status (4.7). [plan 6.1; Claude's]

6.1.15 `inbox` keeps restore and delete, for the archived store's view (18.7.11), and gains close, naming the unit that resolved the item, and file, for the review phase (§14, §18). [plan 6.1; Claude's; today's product]

6.1.16 These families are kept, trimmed: `topic`, `workunit`, `roadmap`, `discovery-session`, `experiment`, `agent`, `knowledge`, `commit`, `render`, `handoff`, `conversation`, `presence`, `session`, `boot`. [plan 6.1; Claude's]

6.1.17 The verbs that serve what the release removes — research threads, the discussion map, routing, build order, analysis cycles, plan formats, grouping, staleness, promotion to cross-cutting — go with it. [plan 6.1; Claude's]

6.1.18 Left to the builder: what `state status` reports. [Claude's sort, B18]

6.1.19 Left to the builder: which verbs the kept families lose, and which of today's families, named neither kept nor new, go; those serving what the release removes go (6.1.17). [Claude's sort, B19]

### 6.2 The layout hook

6.2.1 A hook refuses writes under `.workflows/` to paths outside the layout (4.11): no ad hoc directories. [R35, R2]

6.2.2 It is a Claude Code hook before Write, Edit and NotebookEdit, installed by boot into the project's settings as the session hooks are, so it holds with or without the mod. [plan 6.2; Claude's; Claude's derivation, O17]

6.2.3 It refuses any path under `.workflows/` outside the layout, every manifest, and the ledger. [plan 6.2; Claude's; R23]

6.2.4 The mod's manifest guard folds into the hook. [plan 6.2; Claude's; R35; Claude's derivation, O17]

6.2.5 A hook cannot reliably police the shell, so the state commit is the backstop: every state commit is the engine's, and it refuses a path outside the layout, naming the path. [plan 6.2; Claude's]

### 6.3 The commit door

6.3.1 The commit door confines and serialises what a commit takes, as it does today, and also requires a task for code. [R35]

6.3.2 State commits leave the prose: every verb commits its own writes in the state worktree, together with any log file in the layout changed since, then pushes (4.3.2). [plan 6.3; Claude's; R23]

6.3.3 A code commit names its task. The engine checks the task is in flight in this conversation, read from the task in flight the engine records per conversation, and writes the commit message with the task's id. [plan 6.3; Claude's; R35]

6.3.4 The commit door refuses a code commit that names no task. [R15; ruled by the person 2026-10-16; R35, plan 3.6, plan 6]

6.3.5 The commit door runs the project's checks before every code commit (§15). [plan 6.3, plan 7.6; Claude's; R34]

6.3.6 For a bugfix, the commit door refuses the fix commit until the bug-proven run is recorded (§15). [plan 6.3, plan 7.3; Claude's; R20]

6.3.7 A raw `git commit` in a code worktree during a build is refused by a hook before Bash. [R15, R35; plan 6.3 (ruled)]

6.3.8 The same hook before Bash guards the state branch (4.4.2). [plan 6.3; Claude's]

6.3.9 The migration's commit is §21's (two commits, on the person's yes). [plan 6.3, R37]

6.3.10 The hook before Bash, and the hook before Agent and SendMessage (6.5.7), are installed so they hold with or without the mod, as the layout hook does (6.2.2). [plan 6.2, R23; Claude's derivation, O11]

6.3.11 Left to the builder: where the hooks before Bash, Agent and SendMessage are installed. [Claude's sort, B22]

6.3.12 Left to the builder: how the hook before Bash knows a build is in progress; it reads the task in flight the engine records per conversation (record 2956–2957, R35). [Claude's sort, B14]

6.3.13 Left to the builder: how files in the layout other than logs — `spec.md`, task accounts, review reports, `summary.md`, assets, build notes — reach a state commit. [Claude's sort, B15]

6.3.14 Left to the builder: the code commit's message beyond the task's id. [Claude's sort, B17]

6.3.15 The files the workflows own outside `.workflows/` are not code: the project's `.claude/settings.json`, `.worktreeinclude` and `.gitignore`. Boot commits its own changes to them on the branch checked out, as today. A migration's changes to them go through the migration review, whose one yes makes one commit on the code branch and one on the state branch where it changed both (21.9.2). [today's product (`engine-commands.md:26`, `:436`); R15, R35, plan 6.3; Claude's derivation, T9]

### 6.4 The checklists

6.4.1 Checklists are engine-held: the engine holds one checklist per closing point. [R35, R2, plan 6.4; Claude's]

6.4.2 Every item ends done, or skipped with a recorded reason, and Claude orders and performs the items as it likes. [R2, plan 6.4]

6.4.3 The engine checks an item where it can (a fold, a recorded run, a count), and Claude marks it where the engine cannot. [plan 6.4; Claude's]

6.4.4 The closing verb refuses while any item is open. [plan 6.4; Claude's]

6.4.5 Screen: a skipped item shows, with its reason, on the screen of the next authority gate covering that work: a closing point that is an authority gate shows its skips on its own screen, and a build phase's skips, at its start or its close, show on finish's screen. A directive's check cannot be skipped: it must pass (§21). [plan 6.4; Claude's; Claude's derivation, O13]

6.4.6 Decided (a topic's close):
- every question of the person's closed;
- the closing pass run, and its last re-read changing nothing;
- every decision in the conversation has an entry;
- each replacement checked against what it replaced (5.6.7);
- the read for conflicting answers run within the topic (5.6.14);
- each measured finding the topic's decisions rest on re-run (9.9.7);
- the topic's mailbox empty: every message raised and answered (10.2.7);
- the product-record lines and any candidates are on the screen.

[plan 6.4; Claude's; R23; today's product; Claude's sort, T28, T30]

6.4.7 Ready to build:
- every topic decided, cancelled or postponed;
- the sweep between topics run;
- the spec has checked each replacement against what it replaced (5.6.7);
- every statement traced;
- the review's last pass changed nothing;
- each phase in the cut has its scenarios, sections and relies-on;
- every invariant names a check or says none can;
- every section of the spec drawn on by at least one phase in the cut;
- canonical assets linked.

[plan 6.4; Claude's; R23; Claude's derivation, T10]

6.4.8 A phase starts:
- tasks written with their links;
- shared design settled;
- what the phase relies on is done.

[plan 6.4; Claude's]

6.4.9 A phase closes:
- every task passed its pair;
- the phase review passed and its fixes landed;
- each scenario proven or reported not proven;
- the notes for later read by the consolidation agent, then made into tasks or dropped with a reason;
- the stack merged, or waiting at its gate in step.

[plan 6.4; Claude's]

6.4.10 Finish:
- the review phase passed and its report is written;
- resolved inbox items closed;
- the build log closed;
- the records indexed.

[plan 6.4; Claude's]

6.4.11 A directive: its check (§21). [plan 6.4; Claude's; R38]

6.4.12 Left to the builder: where checklist progress is held. [Claude's sort, B21]

### 6.5 Briefs

6.5.1 Every brief the workflows give their own agents comes from a template the workflows own, filled by the engine from the records and handed over unchanged. [Open, Reviews in the build, Brief control; ruled by the person 2026-10-18; R35, plan 3.7]

6.5.2 There is one template per agent role, kept in the engine's content beside its displays. [plan 6.5; Claude's]

6.5.3 `brief` fills the template from the records and stores the filled brief with an id. [plan 6.5; Claude's]

6.5.4 The records a brief draws on are the task, its spec sections, the ledger's decided calls, the diff, earlier reports verbatim, and the project's linters (§22). [plan 6.5; Claude's; Brief control]

6.5.5 Project skills and CLAUDE.md reach the agent without the brief (§15). [plan 6.5, plan 7.7; Claude's proposal]

6.5.6 Anything else an agent should know goes onto the task or into the ledger, never into the brief (§13). [Brief control; plan 3.7]

6.5.7 A hook before Agent and SendMessage refuses a dispatch of, or a message to, one of the workflows' agents unless it carries an issued brief, matched by id and content. [plan 6.5; Claude's; R35, Brief control]

6.5.8 Claude's other subagents are untouched by that hook. [Brief control]

6.5.9 A refusal is recorded with its reason, so a template that keeps getting in the way is improved rather than worked around. [plan 6.5, Brief control; Claude's proposal]

6.5.10 A fix round is issued the same way: its brief carries the two reviewers' reports verbatim and nothing added — nothing of the orchestrator's, which takes from the reports only the verdict and the nits it fixes. [plan 6.5; Brief control; Claude's proposal]

6.5.11 Which agents the workflows own is §26's. [plan 6.5; Claude's proposal]

6.5.12 Left to the builder: where filled briefs and the brief hook's refusals are stored. [Claude's sort, B16]

### 6.6 Gate answers and the mod

6.6.1 Every gate's answer goes to `gate`, which logs it to the trust log — the gate's name, the row the engine recommended, the row picked, any typed text — and returns what happens next (§16). [plan 6.6; Claude's; R25; Claude's derivation, O18]

6.6.2 Control flow at a gate lives in the engine: the prose follows what `gate` returns rather than branching on the answer itself. [plan 6.6; Claude's; R3; Claude's derivation, O18]

6.6.3 Gate-answer logging works with or without the mod. [plan 6.6; Claude's; Claude's derivation, O18]

6.6.4 The mod adds what only it sees: whether the answer was a click. [plan 6.6; Claude's; R35; Claude's derivation, O18]

6.6.5 The gate mod draws raises and blind questions, shows verification evidence, and offers a reading surface for material the person may want. [R35, plan 6.6]

6.6.6 The mod carries phase words (its spinner), which a phase rename changes. [R35, plan 6.6]

6.6.7 Anything that can use the mod to make the system better should. [R35]

6.6.8 Every surface the person sees is an engine surface — the ledger, the matrix, raises, blind questions — under the display lint that fails a templated display in skill prose; a plain line made only of values Claude already holds stays in prose. [R35, plan 6]

6.6.9 Every surface the mod draws is also printed by the engine as text: a gate's rows, a raise, and a blind question with its toggle and "I don't follow". Where the mod does not run, the person answers by typing, and asks in words for material that is one keystroke away on a mod surface (2.6.3). The mod is the upgrade and the engine's text the floor. [today's product (`skills/workflow-gates/README.md:82–98`); R35, plan 6.6, 9.6; Claude's derivation, T7]

6.6.10 Background work arriving at a waiting gate is said in a line, and the gate is shown again, fetched fresh. One gate shows at a time. A gate is never put through a tool prompt, and never written from memory. [today's product; Claude's sort, T48]

6.6.11 The mod keeps setting Claude Code's harness as today. `SendUserMessage` is on. In a workflow conversation, thinking summaries and the silent-turn reminder are off, and the person's own values are put back as it ends. Anything shown mid-turn and then carried past with another tool call reaches the person through `SendUserMessage`, and a turn ends on text. [today's product; Claude's sort, T32]

6.6.12 The second plugin, `workflow-gates-rows`, stays. It redraws the transcript row of an answer the mod sent as the question and the answer, and a handoff's continuation as its line. [today's product; Claude's sort, T33]

6.6.13 The mod runs where it runs today: Claude Code's terminal app and the Desktop app's Code tab, from the floor version (22.2.5). The board runs wherever Claude Code draws a mod's pane. The mod draws nothing while another screen, such as Remote Control, is attached. Elsewhere the workflows run on the engine's text (6.6.9), softly supported. [today's product; Claude's sort, T37]

## 6-S. Scenarios for §6

6.S1 Given a rewritten phase skill walked in a prose test, when it reaches a point where today's prose writes a manifest field, then it calls a door verb and the walk records no manifest write from the prose. (6.1.1, 6.1.2)

6.S2 Given a verb whose response carries a value, when the prose needs that value, then the walk records no separate manifest read for it. (6.1.3)

6.S3 Given the engine, when its command catalogue is read, then it has the families `ledger`, `raise`, `verdict`, `task`, `land`, `brief`, `checklist`, `asset`, `verify`, `gate`, `state` and `inbox` with the verbs 6.1.4 to 6.1.15 name, and the kept families of 6.1.16, and no verb serving research threads, the discussion map, routing, build order, analysis cycles, plan formats, grouping, staleness or promotion to cross-cutting. (6.1.4, 6.1.5, 6.1.6, 6.1.7, 6.1.8, 6.1.9, 6.1.10, 6.1.11, 6.1.12, 6.1.13, 6.1.14, 6.1.15, 6.1.16, 6.1.17)

6.S4 Given a session with the mod not running, when Claude uses Write to create `.workflows/{unit}/scratch/notes.md`, then the hook refuses; when it writes `.workflows/{unit}/topics/{topic}/log.md`, the write goes through. (6.2.1, 6.2.2, 6.2.3)

6.S5 Given a session, when Claude uses Edit on `.workflows/manifest.json`, `.workflows/{unit}/manifest.json` or `.workflows/.ledger.jsonl`, then the hook refuses each, with or without the mod. (6.2.3, 6.2.4)

6.S6 Given a shell command created `.workflows/{unit}/tmp/x.md`, when a verb next makes its state commit, then the commit is refused and the refusal names `tmp/x.md`. (6.2.5)

6.S7 Given a project with a remote and a topic's log edited since the last state commit, when a verb writes state, then one state commit holds the verb's writes and the log, and the state branch is pushed. (6.3.2)

6.S8 Given task T in flight in this conversation, when a code commit names T, then it lands with T's id in its message; when it names no task, or a task not in flight in this conversation, then the door refuses. (6.3.1, 6.3.3, 6.3.4)

6.S9 Given a project whose checks are set, when a code commit is made through the door, then the checks run before the commit is written. (6.3.5)

6.S10 Given a bugfix whose bug-proven run is not recorded, when the fix commit is attempted, then the door refuses it; once the run is recorded, the commit is accepted. (6.3.6)

6.S11 Given a build in progress, when Claude runs a raw `git commit` in a code worktree, then the hook before Bash refuses it. (6.3.7)

6.S12 Given a topic with an item of its Decided checklist open, when the closing verb runs, then it refuses; when Claude skips the item with a reason, the closing verb proceeds and the decided screen shows the skip with its reason. (6.4.1, 6.4.2, 6.4.4, 6.4.5, 6.4.6)

6.S13 Given a question of the person's still open in a topic, when the Decided checklist is shown, then "every question of the person's closed" reads open without Claude marking anything; once the question is closed, it reads done. (6.4.3, 6.4.6)

6.S14 Given each closing point, when its checklist is shown, then it lists exactly the items of 6.4.6, 6.4.7, 6.4.8, 6.4.9, 6.4.10 or 6.4.11 for that point. (6.4.6, 6.4.7, 6.4.8, 6.4.9, 6.4.10, 6.4.11)

6.S15 Given a task ready for its builder, when `brief` is called, then it returns an id and a brief filled from the builder's template with the task, its spec sections, the ledger's decided calls and the project's linters, and stores it under that id; the brief carries no list of project skills and no copy of CLAUDE.md. (6.5.1, 6.5.2, 6.5.3, 6.5.4, 6.5.5)

6.S16 Given an issued brief, when Claude dispatches the builder with it unchanged, then the dispatch goes through; when the brief is altered, missing, or has an id that was never issued, then the hook refuses and the refusal is recorded with its reason; when Claude dispatches a subagent that is not one of the workflows' agents, the hook does not act. (6.5.7, 6.5.8, 6.5.9)

6.S17 Given a task's pair returned two reports with findings, when a fix round is issued, then its brief holds the two reports verbatim and nothing else, and a SendMessage to the builder carrying it goes through. (6.5.10)

6.S18 Given a gate whose recommended row is "a", when the person picks "b" with typed text, then the trust log gains the gate's name, "a", "b" and the text, and the engine returns what happens next; with the mod running the entry also records that it was a click, and with the mod off the entry is still written. (6.6.1, 6.6.2, 6.6.3, 6.6.4)

6.S19 Given a raise or a blind question, when it reaches the person with the mod running, then the mod draws it. (6.6.5)

6.S20 Given a session in the discussion phase with the mod running, when the mod's spinner shows, then its words name the phase as the engine names it. (6.6.6)

6.S21 Given a skill whose prose holds a templated display, when the display lint runs, then it fails. (6.6.8)

6.S22 Given a session with the mod not running, when Claude runs a raw `git commit` in a code worktree during a build, or dispatches one of the workflows' agents without an issued brief, then the hook refuses each. (6.3.7, 6.3.10, 6.5.7)

6.S23 Given a build phase that closed with a checklist item skipped and its reason recorded, when the finish gate shows, then its screen lists the skip with its reason; given a directive whose check has not passed, then nothing skips it and the directive is not recorded. (6.4.5, 6.4.11, 21.10.7)

6.S24 Given a session where the mod does not run, when a gate, a raise or a blind question shows, then the engine prints it as text and the person answers by typing; material one keystroke away on a mod surface is had by asking in words. (6.6.9)

6.S25 Given boot changes the project's `.claude/settings.json`, then boot commits the change on the branch checked out, naming no task; given a migration that changes `.gitignore` and the state, then the migration review's one yes makes one commit on the code branch and one on the state branch. (6.3.15, 21.9.2)

6.S26 Given a topic with a message in its mailbox not yet raised, or a measured finding its decisions rest on not yet re-run, when it is closed as decided, then the closing verb refuses while that item is open; given a cut in which no phase draws on one of the spec's sections, then ready to build's verb refuses while that item is open. (6.4.4, 6.4.6, 6.4.7)

6.S27 Given a gate waiting on the person, when a background agent's report lands, then the session says so in a line and shows the gate again, fetched fresh, and no second gate shows beside it. (6.6.10)

6.S28 Given a workflow conversation where the mod runs, then `SendUserMessage` is on and thinking summaries and the silent-turn reminder are off, and once it ends the person's own values are back; given text shown mid-turn and then carried past with another tool call, it reaches the person through `SendUserMessage`. (6.6.11)

6.S29 Given the mod sent the answer to a gate, when the transcript draws that row, then it shows the question and the answer; given a handoff's continuation, the row shows its line. (6.6.12)

6.S30 Given a session on Claude Code's web app, then the mod draws nothing and the workflows run on the engine's text; given Remote Control attached to a terminal session, the mod draws nothing while it is attached. (6.6.13, 6.6.9)

## 7. Tasks, landing and their drivers

### 7.1 Tasks go through the engine to a driver

7.1.1 Tasks go through the engine to a driver, replacing the three plan formats chosen per plan. [R35; ruled by the person 2026-10-17; plan 3.9]

7.1.2 The engine's `task` verbs — create a phase, create a task with the task template's fields (§12), link, ready, start, done, close, list a phase, show a task — are the only way anything in the workflows touches a tracker. [R35, plan 3.9]

7.1.3 The verb that creates a task takes the task's text from a file, one call per task. [R15; agreed by the person 2026-10-19; plan 3.6]

7.1.4 A driver is code behind the `task` verbs, loaded by one project setting chosen at setup, Tick by default; changing the setting changes the tracker with nothing else touched (§22). [R35, plan 3.9]

7.1.5 Every driver provides parents, blocking, and a ready answer that returns several tasks at once; what a tracker lacks natively its driver makes up for in code, once. [R35]

7.1.6 Only the Tick driver ships; plain files and Linear's MCP route go. [R35, plan 3.9]

7.1.7 A new driver is a pull request to the workflows that passes the conformance suite (7.3), never one loaded from elsewhere. [R35, plan 3.9]

7.1.8 A driver for a hosted tracker calls its API with a key kept at user level, never an MCP. [R35, plan 3.9]

7.1.9 Nothing relies on task state travelling with a commit, since a hosted tracker's does not. [R35]

7.1.10 The tracker is named only in its driver, the user docs and design notes — never in a skill, a reference or engine code outside the driver. The person's rule, non-negotiable: even their own tool sits at the workflows' edge. [R35; ruled by the person 2026-10-17; plan 3.9]

7.1.11 The migration sets every project to the default driver (§21). [R35]

### 7.2 Code lands as pull requests

7.2.1 Code lands through the engine to a driver, by the same rule as the tracker. [R35; ruled by the person 2026-10-18; plan 3.8]

7.2.2 Pull requests are prescribed. A task is a pull request — the change the reviewer pair already reviews — squash-merged, so the default branch gets one commit per task with its review behind it. [R35, plan 3.8]

7.2.3 A phase is a stack: its tasks' pull requests chained in the order the orchestrator merges them back, parallel tasks included. [R35, plan 3.8]

7.2.4 A phase's stack is merged whole once its phase review passes; in step, that merge stops like any process gate (§3). [R35, plan 3.8]

7.2.5 A phase that relies on the one before waits for that merge, so every stack starts from the default branch; a phase that does not rely on it runs beside it as its own stack. [R35, plan 3.8]

7.2.6 The review phase's fix tasks land last, at finish: each failing round's fix tasks are one more build phase (14.3.2), and every fix phase lands at finish; how the driver chains them is the builder's. [R35, plan 3.8, R16; Claude's derivation, O46]

7.2.7 A unit's build is never one stack: each phase is its own. [R35]

7.2.8 The `land` verbs open a task's pull request, chain it into its phase's stack, merge a phase, and merge at finish. [plan 6.1; Claude's]

7.2.9 Two landing drivers ship: GitHub's, and a local one for a project with no remote. [R35, plan 3.8]

7.2.10 GitHub's driver holds the stack mechanics in its own code, so no one needs GitHub's stack skill. The drivers check their tools, its CLI and stack extension among them, at ready to build, the last stop before a build that runs unattended (§22). [R35, plan 9.2; Claude's derivation, O19]

7.2.11 The local driver lands the same shape without pull requests: a branch per task merged into the phase's branch, and the phase's branch merged into the default branch. [R35]

7.2.12 The local driver serves the rehearsal copies and the prose-test worlds, which have no remote. [R35, plan 9.5]

7.2.13 The code host's CLI is named only in its driver, the user docs and design notes, by the tracker's rule (7.1.10). [R35; Claude's derivation, O92]

7.2.14 The workflows push across the board: the state branch on every commit (4.3.2), and each task's branch as its pull request opens. [R35; ruled by the person 2026-10-18; plan 3.8]

7.2.15 Merging is the driver's, after the review that clears it. [R35, plan 3.8]

7.2.16 Where the remote is not GitHub, landing defaults to the local driver; manage changes it (§22); a driver for another host comes by pull request against the conformance suite (7.3). [R35, plan 9.2; Claude's derivation, O14]

7.2.17 Code can live in nested repositories, a clone or a submodule inside the project's folder, as today. A task's change lands in every repo it touches, a submodule's moved pointer recorded in the repo that holds it. The commit door, the project's checks and the review phase read every repo. A project that is a folder inside a larger repository reads only its own folder. Left to the builder: how the landing driver opens and chains a task's pull requests across repos, and where the state branch sits for a project inside a larger repository. [today's product; record 3316; R37; Claude's derivation, T5]

### 7.3 The drivers' conformance suites

7.3.1 A conformance suite is the contract a driver meets. [R35]

7.3.2 There is one conformance suite per kind of driver, run in the hermetic environment. [plan 6.7; Claude's]

7.3.3 The task suite covers: a phase; links across phases; ready returning several; done unblocking; close; list; show. [plan 6.7; Claude's]

7.3.4 The landing suite covers: a task's pull request, a stack, a phase merged, finish, and a task whose change touches nested repositories (7.2.17). [plan 6.7; Claude's; Claude's derivation, T5]

7.3.5 The Tick driver runs against a real Tick at its declared floor. [plan 6.7; Claude's]

7.3.6 The local landing driver runs fully in the suite. [plan 6.7; Claude's]

7.3.7 GitHub's driver runs against a stubbed CLI, plus one live run on a scratch GitHub repository the person creates for it, on their word. [plan 6.7; Claude's]

### 7.4 A phase not yet written

7.4.1 The tracker holds only written phases. [plan 10.7; Claude's]

7.4.2 Screen: the progress view and the menus draw the phases not yet written from the cut, as "phase 3 of 5, not yet written" (§18, §20). [plan 10.7; Claude's]

7.4.3 The build reads the cut before treating "nothing ready" as finished, so a phase not yet written is never taken for a finished one. [R15; ruled by the person 2026-10-16; plan 10.7]

### 7.5 The tracker's state on the state branch

7.5.1 The tracker's driver keeps the tracker's state on the state branch. [R23]

7.5.2 Tick's store lives in the state worktree. [plan 10.8; Claude's]

7.5.3 Claude checks whether Tick takes a store path before anything is asked; only if Tick needs a change for it does it go to the person, as their call on their own project. [plan 10.8; Claude's; Claude's derivation, O15]

## 7-S. Scenarios for §7

7.S1 Given a project set up with the defaults, when its settings are read, then the task driver is Tick; when a task is created through `task`, it appears in Tick. (7.1.1, 7.1.2, 7.1.4)

7.S2 Given the workflows' source, when it is searched for the tracker's name and the code host's CLI, then they appear only in their drivers, the user docs and design notes. (7.1.10, 7.2.13)

7.S3 Given the task writer writing a phase, when it records a task, then it makes one `task` call per task with the task's text taken from a file, and the tracker's task holds that text. (7.1.3)

7.S4 Given a phase with two tasks that share no blocker, when `task ready` is called, then it returns both at once; when a blocking task is done, the task it blocked comes back as ready. (7.1.5, 7.3.3)

7.S5 Given the shipped workflows, when the drivers are listed, then the only task driver is Tick's, and no plain-files or Linear driver exists. (7.1.6)

7.S6 Given an existing project migrated, when its settings are read, then its task driver is the default. (7.1.11)

7.S7 Given a phase's two tasks, each passed by its pair, when they land through GitHub's driver, then each is a pull request, chained into one stack in the order the orchestrator merged them back; when the phase review passes, the stack is merged whole, each pull request squash-merged, and the default branch gains one commit per task. (7.2.1, 7.2.2, 7.2.3, 7.2.4, 7.2.8)

7.S8 Given a build in step, when a phase's review passes, then merging its stack stops at a process gate. (7.2.4)

7.S9 Given phase 2 relies on phase 1 and phase 3 does not, when phase 1's review has not passed, then phase 2's stack does not start, and phase 3 runs as its own stack from the default branch; once phase 1's stack merges, phase 2's stack starts from the default branch. (7.2.5, 7.2.7)

7.S10 Given a review phase that failed two rounds, when their fix phases land, then both land after every other phase of the build, merged at finish. (7.2.6)

7.S11 Given a project with no remote, when a phase lands through the local driver, then each task is a branch merged into the phase's branch, the phase's branch is merged into the default branch, and no pull request or push is made. (7.2.9, 7.2.11)

7.S12 Given a prose-test world with no remote, when its build lands a task, then the local driver lands it. (7.2.12)

7.S13 Given a project with a GitHub remote, when a task's pull request opens, then the task's branch is pushed; and nothing is merged until the review that clears it. (7.2.14, 7.2.15)

7.S14 Given a project on GitHub without the code host's CLI or its stack extension, when the build reaches ready to build, then the driver's check of them fails there (what follows is §22's). (7.2.10)

7.S15 Given the task and landing conformance suites, when they run in the hermetic environment, then the task suite exercises a phase, links across phases, ready returning several, done unblocking, close, list and show against a real Tick at its declared floor; the landing suite runs the local driver fully and GitHub's against a stubbed CLI; and no live GitHub run happens without the person's word. (7.1.7, 7.3.1, 7.3.2, 7.3.3, 7.3.4, 7.3.5, 7.3.6, 7.3.7)

7.S16 Given a cut of five phases of which two are written, when the progress view or a menu shows the build, then phases 3 to 5 read "not yet written"; when every task of phase 2 is done and the tracker has nothing ready, then the build reads the cut and does not treat the unit as finished. (7.4.1, 7.4.2, 7.4.3)

7.S17 Given a task created through the Tick driver, when the state worktree is inspected, then Tick's store changed there and the change is committed on the state branch, never on a code branch. (4.1.6, 7.5.1, 7.5.2)

7.S18 Given a project whose remote is not on GitHub, when its settings are read, then the landing driver is the local one; when the person changes it through manage, the setting changes. (7.2.16)

7.S19 Given a task whose change touches the project's repository and a clone nested inside it, when the task lands, then the change lands in both repos, and the commit door, the project's checks and the review phase read both; given a change to a submodule, its moved pointer is recorded in the repo that holds it. (7.2.17, 7.3.4)

## 8. Discovery

### 8.1 What stays

8.1.1 Discovery keeps its shaping: the person talks the product through once,
and the conversation becomes the record the topics come out of. [R10]

8.1.2 The product-level conversation on the roadmap, the work-type commit,
the discovery map and the briefs stay. [R10]

8.1.3 Start, triage's w (work them now, as one unit) and work started from the
roadmap, the picked items its seeds, each go through discovery (§18). [R17; ruled by the person 2026-10-16]

8.1.4 Discovery keeps its logs per session, at `discovery/session-NNN.md` in
the work unit, since its conversations are about the whole epic or product;
the roadmap keeps its logs per session too. [R11, Layout on disk; ruled by the
person 2026-10-13 and 2026-10-17]

8.1.5 Research that bears on the whole epic belongs in the unit's discovery
log (§21 §21 for research moved there). [R37; ratified by the person
2026-10-17]

8.1.6 As new work takes shape, Claude matches it against waiting roadmap items
and inbox items. A match earns one question offering to take the item in as a
seed, and a miss earns silence. A topic the map proposes that matches a waiting
roadmap item takes that item in, never a twin beside it, and the item leaves
the roadmap (18.8.20). [today's product; Claude's sort, T40; ruled by the
person 2026-10-21]

### 8.2 One phase, at whatever level the conversation reaches

8.2.1 Discovery is one phase at whatever level the conversation reaches. The
person starts and talks; the conversation finds its level and moves between
levels as it goes, the pivots running both ways. [R10, plan 3.3; ruled by the
person 2026-10-13]

8.2.2 There is no separate product-level phase: the person never has to name
the level before they start. [R10; ruled by the person 2026-10-13]

8.2.3 The type call comes down to four:
- the product across time: the roadmap, where nothing is created until an
  item is pulled, and the pull goes through discovery to whatever type the
  work is (§18 The tracking layer); principles are talked through here
  (8.2.5);
- building something: a feature for one topic, an epic for several;
- fixing something broken: a bugfix;
- a small known change: a quick-fix.
[R10, R17, R22; ruled by the person 2026-10-13]

8.2.4 Cross-cutting goes as a type (§19 §19); discovery never calls
work cross-cutting. [R22; ruled by the person 2026-10-16]

8.2.5 A principle the person wants to talk through on purpose is a
product-level conversation, reached through Start, where discovery meets it
at the level it reaches, or through the roadmap's plan the product. It is
logged per session in the roadmap's session logs, whether reached through
Start or through plan the product. [R22, plan 3.11; ruled by the person
2026-10-16; Claude's derivation, O33]

8.2.6 Discovery stays conversation: the person brings the idea, it is shaped
together, and Claude never decides there alone. [R24; the person's framing
2026-10-13]

### 8.3 No detail, and nothing decided

8.3.1 Claude asks no detail questions in discovery. It shapes scope and what
the work touches; detail is discussion's. [R10, plan 3.3]

8.3.2 Discovery's guidance no longer invites decisions, in an epic's second
discovery conversation as anywhere else. [R10]

8.3.3 The shaping conversation's length stays. [R10]

8.3.4 Nothing in discovery is a decision. [R10, plan 3.3; ruled by the person
2026-10-19]

8.3.5 The brief carries what was said in discovery — the person's leans,
rejected paths, open questions, and what a spike showed about the direction —
as input, which the discussion phase decides. [R10, plan 3.3; ruled by the
person 2026-10-19]

### 8.4 The type call

8.4.1 Feature and epic stay two types, and the call between them is light. A
feature is linear by definition and its menus are simpler. [R10, plan 3.3;
ruled by the person 2026-10-13]

8.4.2 Discovery leans one topic: the work becomes an epic only when the
conversation shows parts that each need their own decisions. [R10, R19]

8.4.3 The boundary between feature and epic needs no more confidence than the
rest of the type call, since a feature that grows pivots. Today's detection
asks for more there, holding that the boundary has no safety net; that demand
goes. [R10; ruled by the person 2026-10-13]

8.4.4 Pivot and absorb stay (§19 §19). [R19]

8.4.5 An inbox item that already pins the work, cause and fix known, is
confirmed in one line, not shaped again. [R10, plan 3.3; Claude's, covered by
the person's yes 2026-10-13; the plan dates it ruled 2026-10-19; Claude's
derivation]

8.4.6 A known cause with a mechanical fix is a quick-fix, not a bugfix.
[R10, plan 3.3; Claude's, covered by the person's yes 2026-10-13; the plan
dates it ruled 2026-10-19; Claude's derivation]

8.4.7 Topics stay as the way to split the deciding conversation: discovery
talks wide, the shaping makes the topics, and each topic is decided in its own
focused sessions. [Open: one build across an epic; ruled by the person
2026-10-14]

8.4.8 Discovery shapes an epic by judgement, never a formula. [Open: one build
across an epic; ruled by the person 2026-10-14]

### 8.5 No routing

8.5.1 Every topic of an epic or feature goes to discussion; none goes
straight to the build. [R10, plan 3.3; ruled by the person 2026-10-13]

8.5.2 How much of the person a topic takes is set inside discussion — by how
much the product already settles and by the ask rule (§16 §16) — never
by a label fixed at the map. [R10]

8.5.3 No label routes a topic to discuss or to build: a label set from the
brief is too coarse and too early, and a build label would send undecided
calls to the builder. [R10; ruled by the person 2026-10-13, replacing a
proposed label routing]

8.5.4 Today's routing of a topic to research or discussion goes everywhere it
reaches: the map, the first-phase gate, where a message sent to a topic
lands, and the epic menu's new-topic doors. Starting a topic is "Start", with
no routing. [R10, R17]

8.5.5 Quick-fix and bugfix keep their own paths (§19 §19). [R10]

### 8.6 The map and its order

8.6.1 The discovery map stays. The work unit's manifest holds the map's topics
and their order. [R10, Layout on disk]

8.6.2 Discovery orders the map's topics by what depends on what, foundations
first, and a topic whose research results other topics rest on comes first.
[R41, plan 3.3]

8.6.3 The order serves the cone (§16 §16): the topics everything rests
on are decided while the page is blank and the person is most involved, later
topics arrive mostly settled, and nothing is built on an undecided model. The
order does not stop topics bouncing: decisions nobody could see at discovery,
and pairs of topics that depend on each other both ways, still send messages
to earlier topics and reopen them. [R41; reasoned again 2026-10-13]

8.6.4 The epic menu puts its recommended row first in the foundations-first
order (§18 §18). [R17, R41]

8.6.5 Changing an epic's map is discovery's: a new topic, cancelling, postponing
to the roadmap, pulling forward, reactivating and reopening a decided topic all
go through the epic menu's discovery row (key d), which says what it is for (see
§18 The tracking layer). From the spec on, the map is closed and the discovery
row leaves the menu (18.4.19). A feature, bugfix or quick-fix has no menu of its
own, so reopening its decision goes through manage on the start menu. [R17, R12;
ruled by the person 2026-10-15; key d agreed with the person 2026-10-14;
Claude's derivation, T2]

8.6.6 "Dead end" goes: a topic that ends in not doing it is decided with that
as its decision, or cancelled (and see 8.8.10). [R17, R10]

8.6.7 A return to an epic's discovery reads its two most recent discovery logs
in full and the older ones by their closing line, after any question whose
answer may discard them (2.10.4). It opens with a short account of where the
conversation had got to. [today's product; Claude's sort, T41]

### 8.7 The brief

8.7.1 Each topic's brief is discovery's brief for the topic, kept at
`topics/{topic}/brief.md` in the work unit. [Layout on disk; ruled by the
person 2026-10-17]

8.7.2 Nothing in a brief is a decision: it carries the person's leans,
rejected paths, open questions and what a spike showed about the direction,
as input. [R10; ruled by the person 2026-10-19]

8.7.3 The brief feeds the topic's opening view (9.3): the topic opens with
Claude bringing up what discovery found, and it is decided there, in
discussion. [R10, plan 3.3]

8.7.4 The brief is not the list of what the person will be asked. [R10]

8.7.5 Approving the map stays the topics and their order (8.8.3). [R10]

8.7.6 Discovery writes a topic's brief when the topic lands on the map. Once
the topic has started, later discovery input reaches it as a message (§10),
never a rewritten brief; today's brief regeneration and its reconcile flag go.
[R10, R12, Layout on disk; Claude's derivation, O25]

8.7.7 A feature's or bugfix's one topic lands at start this work and gets its
brief then. Its first session reads the brief and the unit's seeds in full
before it opens: the feature's discussion opening (9.3.2), or the bugfix's
investigation. [R10, R19, R20, plan 9.6; Claude's derivation, T3]

### 8.8 Discovery's gates

8.8.1 Discovery's shape gate becomes **start this work**, an authority gate
(§3 §3): never automatic, so Claude never
creates work on its own reading. It is the gate at the work-type commit: its
yes creates the unit. [R10, R40, plan 3.2; ruled by the person 2026-10-13;
Claude's derivation, O21]

8.8.2 Screen: start this work, the yes that creates the unit (8.8.1). The
sources give its name and its kind (an authority gate); what it shows and its
rows are drawn by Claude in the spec in the existing design system, marked as
Claude's. [R10, R40; Claude's derivation, O21, O94]

Screen, drawn by Claude: start this work, over Fumi. [Claude's derivation, O94]

```text
Fumi (epic)
A smarter macOS Stickies alternative: notes assigned to specific
macOS Spaces (returning to their Space on relaunch), remembering
exact screen position, with titles and a full fumi CLI/MCP
scripting surface.
↳ An epic: the note model, Spaces, the note window, the agent
  surface and selling it each need decisions of their own.

· · · · · · · · · · · ·
Your yes creates the epic. We shape its topics next, and you
approve the map.

◆ Start this work?

y/yes        → Start it — create the epic
Keep shaping → Tell me what I'm missing
```

8.8.3 Approving the map is one screen and an authority gate. Today's park gate
folds into it. The horizon pick folds in where the person has named the park's
horizon, and is asked before the screen where they have not (8.8.4). [R10, R17,
R40, plan 3.3; ruled by the person 2026-10-13 and 2026-10-16; Claude's
derivation, O23]

8.8.4 Screen: approve the map. It shows the topics, their order, each park
on the roadmap with the horizon the person gave it, and, after the sweep
before the spec, any candidate the sweep found holding the person's call,
with its reason, to be taken or struck (8.10.9). The horizon is always the
person's, and Claude never names one (§18 §18): for each
park the person has not given a horizon, Claude asks which before the screen,
the ask listing the person's existing horizons and a new one. Its rows are
drawn by Claude in the spec in the existing design system, marked as
Claude's. [R10, R17; Claude's derivation, O23, O27, O94]

Screen, drawn by Claude: the horizon ask before approve the map, for a park the person gave no horizon. [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
Parking "A Lifetime Tier" on the roadmap, with the map.

◆ Which horizon?

1     → next — 1 waiting
2     → later — 2 waiting
n/new → A new horizon — name it
```

Screen, drawn by Claude: approve the map, at the close of Fumi's first discovery session. [Claude's derivation, O94]

```text
THE MAP (12 topics, foundations first)
  ├─ 1. Note Model
  ├─ 2. Storage And Sync
  ├─ 3. Note Window
  ├─ 4. Engine Architecture
  ├─ 5. Space Homing
  ├─ 6. Positioning And Audience
  ├─ 7. Agent Surface
  ├─ 8. Management Window
  ├─ 9. Onboarding And Permissions
  ├─ 10. Commercialization
  ├─ 11. Licensing And Trial Integrity
  └─ 12. Build And Release

TO THE ROADMAP (4, with the map)
  ├─ Fumi Sync, a hosted sync service                   [later]
  ├─ Storage over a network: SFTP and a hosted API      [later]
  ├─ A fumi's colour drawn from its tags                [later]
  └─ A lifetime tier                                    [later]

· · · · · · · · · · · ·
Your yes puts the topics on Fumi in this order and the parks on
the roadmap.

◆ Approve the map?

y/yes        → Approve it
Keep shaping → Tell me what to change — a topic, the order or a
               park
```

Screen, drawn by Claude: approve the map after the sweep before the spec, with a candidate to take or strike. [Claude's derivation, O94]

```text
THE MAP (15 topics, every one decided)
  ├─ ✓ 1. Note Model
  ├─ ✓ 2. Storage And Sync
  ├─ ✓ 3. Note Window
  ├─ ✓ 4. Engine Architecture
  ├─ ✓ 5. Space Homing
  ├─ ✓ 6. Platform Support
  ├─ ✓ 7. Search And Retrieval
  ├─ ✓ 8. Status And Alerts
  ├─ ✓ 9. Agent Surface
  ├─ ✓ 10. Management Window
  ├─ ✓ 11. Onboarding And Permissions
  ├─ ✓ 12. Commercialization
  ├─ ✓ 13. Licensing And Trial Integrity
  ├─ ✓ 14. Support And Diagnostics
  └─ ✓ 15. Build And Release

FOUND BY THE SWEEP (1 candidate, yours to take or strike)
  └─ ○ Backing Up And Restoring Notes
        Storage and sync keeps every fumi as a file in a folder
        you choose, and no topic decides what happens when that
        folder is lost, moved or restored from a backup.

· · · · · · · · · · · ·
Your yes puts the candidate on the map as a topic, and the
specification waits until it is decided.

◆ Approve the map?

y/yes        → Approve it — the candidate becomes a topic
s/strike     → Strike the candidate — it doesn't become a topic
Keep shaping → Tell me what to change
```

8.8.5 A feature stops for the person at start this work, decided and ready to
build (one screen), finish, and what the ask rule sends (§19 §19).
[R19; ruled by the person 2026-10-16]

8.8.6 A change the person asked for in their own words is done and reported in
one line, with no confirm: a rename, a summary or description edit, removing
an unstarted topic, postponing, and likewise a new topic, pulling forward,
reactivating and reopening a decided topic. Only cancelling confirms (8.8.8).
[R10, R17, plan 3.3; ruled by the person 2026-10-13; Claude's derivation,
O24]

8.8.7 Screen: the one-line report of a change made at the person's word (8.8.6):
one line saying what was done. [R10]

8.8.8 Cancelling keeps its confirm: it is picked by number from a menu, and a
slip ends a topic. [R10, plan 3.3; ruled by the person 2026-10-13]

8.8.9 Screen: the cancel confirm stays (§18 for what
cancelling moves). [R10]

8.8.10 The name gate goes. The first-phase gate goes, and with it the change
routing and dead-end map operations. [R10; ruled by the person 2026-10-13]

8.8.11 The candidate gate goes with the gap analysis's background run (8.10).
[R10; ruled by the person 2026-10-13]

8.8.12 Resume and the import prompt are process gates, learned like any other
(§3 §3). [R10, R40]

8.8.13 For an epic, start this work creates the unit, the conversation shapes
the topics, approve the map follows, and the work hands off into the first
topic. A feature has no map gate and hands off from start this work into its
discussion; a bugfix hands off from start this work into its investigation.
[R10, R19, R20, R40, plan 9.6; Claude's derivation, O22]

8.8.14 Re-shaping an existing epic's map: a change the person asked for in
their own words needs no confirm (8.8.6), and a session in which Claude
changes the topics or their order beyond that ends on approve the map again.
[R10, R17; Claude's derivation, O22]

8.8.15 Before approve the map, Claude re-reads the session's discovery log
against the conversation and adds what is missing. [today's product; Claude's
sort, T43]

8.8.16 Removing an unstarted topic moves any mail waiting for it to the inbox,
as cancelling does (18.4.14), and the one-line report says so. A roadmap item
the topic was made from goes back on its horizon (18.8.20). [R17; Claude's
derivation, T20; ruled by the person 2026-10-21]

8.8.17 Left to the builder: how a started topic's entries, folder and mail
follow a rename, which 8.8.6 already allows. [Claude's sort, T66]

8.8.18 The unit's name is derived, never asked: a name the person offered, else
a single seed's name, else the description. A name already taken is re-derived
more specifically, never numbered. [today's product; Claude's sort, T57]

8.8.19 Claude names no topics while an epic is explored, and proposes the map
when the person calls for it. Convergence earns one passing nudge, never a
forced harvest. [today's product; Claude's sort, T49]

### 8.9 The product record

8.9.1 The product record is the project's product-wide ledger entries, read as
one view and owned by the workflows: what the product is, who it is for, what
it values, and the standing rules that cut across topics. [R10, R23; adopted
with its forks by the person 2026-10-13]

8.9.2 The product record is a projection of ledger entries (§5): an entry is replaced, never edited, and each says who decided it and
where. [R10, R23, R45]

8.9.3 Discussion writes the product record and every opening view reads it.
Product-level discovery feeds it and decides nothing (8.9.6). [R10; ruled by
the person 2026-10-19; Claude's derivation]

8.9.4 The engine renders the product record to a file whenever a product-wide
entry changes, so a line the person adds to CLAUDE.md can point at it. The
file is gitignored and sits in `.workflows/.knowledge/`, beside the knowledge
base's rendered records. [R10, Layout on disk, plan 3.3; a file the workflows
own agreed by the person 2026-10-13 (the plan dates it ruled 2026-10-19);
where it sits is Claude's call; Claude's derivation]

8.9.5 The product record is not CLAUDE.md, which loads into every session and
subagent and is the person's to write. The workflows never write CLAUDE.md; a
pointer there is the person's line. [R10, plan 3.3]

8.9.6 A conversation about the product as a whole feeds the product record and
decides nothing: it is discovery at the product level, so a principle said
there is the person's stated view, carried as input. The principle is decided
in the first topic it bears on, where Claude opens with it as the position,
and goes in as a product-wide entry; a principle no topic touches yet waits
until one does. [R10, R22, plan 3.3; ruled by the person 2026-10-19; Claude's
derivation]

8.9.7 Decisions add to the product record: a topic that settles something
bigger than itself lists the product-wide entries on its decided screen
(9.7), and the person's yes there covers them, with no gate of their own,
while the person still sees Claude widen a topic's call into a rule for the
product. [R10; agreed by the person 2026-10-13]

8.9.8 Every topic's opening view reads the whole product record, and the
settled part of the opening cites it, so a new epic's first topic starts
narrower. [R10, R23, R24]

8.9.9 A project with no product conversation starts with an empty product
record, which fills from its decisions. [R10]

8.9.10 The product record is never a phase, and Claude never asks to fill it.
[R10]

8.9.11 The product record sums up the product's character, not roadmap items:
the roadmap keeps capabilities in horizons, an item's substance left in its
session logs until a pull creates its topic. [R10]

8.9.12 The product record stays apart from the feature map (§15): the build writes the feature map and proving the work reads
it; discussion writes the product record and the opening view reads it. [R10,
R32; agreed by the person 2026-10-13]

8.9.13 Left to the builder: the product record's rendered file's name and
format (8.9.4). [Claude's sort, B23]

### 8.10 The gap analysis

8.10.1 The gap analysis moves out of the background: nothing runs at the epic
menu, and no candidate gate stays there. [R10, plan 3.3; ruled by the person
2026-10-13]

8.10.2 When a topic finishes, its closing pass (9.9) also asks whether the
decision creates work no topic owns. A candidate shows on the decided screen
with its reason, beside the product record's lines; the person's yes covers
it, or they strike it. [R10, R11; ruled by the person 2026-10-13]

8.10.3 Once every topic is decided, before the spec, one sweep reads across
all the records for what falls between topics. [R10, plan 3.3; ruled by the
person 2026-10-13]

8.10.4 The check at each topic's close and the sweep before the spec also look
for conflicts between topics. [Open: one build across an epic; ruled by the
person 2026-10-14]

8.10.5 A candidate becomes a topic only when it holds a call the person would
make. Work that only carries a decision into other documents goes to those
topics as messages (§10), and calls the person would leave go to the builder.
[R10; ruled by the person 2026-10-13]

8.10.6 A gap visible from the map alone waits for a topic's close or the
sweep. [R10]

8.10.7 The gap analysis's bug of counting the person's own session as another
goes with the background run: nothing runs at the menu, so nothing counts
sessions there. The restructure takes it in; it is not fixed on its own.
[record, the gap analysis bug (lines 3957–3962); ruled by the person
2026-10-12 and 2026-10-13]

8.10.8 The gap analysis is written by named agents whose model and effort
are fixed in their definitions (§26 §26): at a
topic's close the closing-pass reader carries it (9.9.2), and the sweep before
the spec has a named agent of its own, its name the builder's. [R46; agreed
by the person 2026-10-19; Claude's derivation, O1]

8.10.9 A candidate the sweep finds that holds the person's call comes to them
on approve the map (8.8.4), with its reason, to be taken or struck; the
messages the sweep sends and the calls it leaves to the builder need no
screen. [R10, plan 6.4; Claude's derivation, O27]

8.10.10 A candidate taken as a topic gets its brief as it lands (8.7.6), shaped
from the gap: what it is, where it was read, why it matters, and its open
questions. [today's product; Claude's sort, T50]

8.10.11 A struck candidate and a removed topic are recorded as the person's
answer, and neither the closing pass nor the sweep proposes them again. The
person adds one back by asking for a new topic (8.8.6). The migration carries
today's dismissed topics the same way. [R10, R24; Claude's derivation, T21]

### 8.11 Spikes in discovery

8.11.1 Discovery may spike to see the shape. A discovery spike settles shape,
not detail, so the no-detail rule stands. What it shows about the direction
is input the brief carries, its files land as reference assets (9.10), and the
first topics' opening views read them. [R12, R10; ruled by the person
2026-10-13 and 2026-10-19; Claude's derivation]

8.11.2 A spike for the whole epic happens in discovery, reached through the
epic menu's discovery row (key d), with no surface of its own. [R12; key d
agreed with the person 2026-10-14]

8.11.3 An epic spike's result lands as a new topic (its brief pointing at the
spike), messages to the topics it affects (a decided one reopens through its
mailbox), or a direction not taken, kept in discovery's log with its reason.
A line it suggests for the product record is input, decided in the first
topic it bears on (8.9.6). [R12, R10; ruled by the person 2026-10-13 and
2026-10-19; Claude's derivation]

### 8.12 An existing codebase

8.12.1 Whether a product gets the workflows at all is the person's decision,
made by installing them; the workflows never ask it. [R12; the person
2026-10-12]

8.12.2 Building a v1 fast is done outside the workflows; a later install comes
in through the roadmap's plan the product (§18 §18). [R12,
plan 9.1; ruled by the person 2026-10-22]

8.12.3 Today's brownfield assessment folds into discovery: on an existing
codebase it becomes product-level discovery, the conversation started from
code. [R12, plan 9.1; ruled by the person 2026-10-22]

8.12.4 The roadmap's plan the product opens with the baseline's research when
the code predates the workflows. The product researcher, one of the
workflows' named agents, does that research (§26). [plan 9.1, plan 6.5; ruled by the person 2026-10-22]

8.12.5 In that conversation, what the person states is input, decided in the
first topic it bears on; what is observed in the code lands as findings saying
how they are known; what stays open goes on the roadmap. [plan 9.1, R10;
ruled by the person 2026-10-22; Claude's derivation, O32]

8.12.6 The baseline skill, its files and its status fields go, and with them
its agendas, its interview procedure and its area scoping, since discovery's
conversation is a field; the baseline's research survives as the product
researcher's (8.12.4). [plan 9.1, plan 1.5; ruled by the person 2026-10-22; Claude's
derivation, O32]

8.12.7 The start menu's offer stays, pointing at plan the product. [plan 9.1;
ruled by the person 2026-10-22]

8.12.8 A project holding `.baseline/` docs has them moved to
`.roadmap/assets/` as reference by the migration, the move dropping the
baseline's status fields (§21 §21). [plan 9.1; ruled by the person 2026-10-22;
Claude's derivation, O32]

8.12.9 Left to the builder: how a finding observed in the code is tagged in the
ledger when no work unit exists (8.12.5). [Claude's sort, B25]

8.12.10 Left to the builder: how the start menu's offer (8.12.7) knows the
code predates the workflows once the baseline's status fields go. [Claude's
sort, B26]

8.12.11 The offer is made once per project, as today. A decline, or the judgment
that the project grew up on the workflows, is remembered and never asked again.
Where it is remembered is the builder's (8.12.10). [today's product; Claude's
sort, T26]

### 8.13 One-way doors

8.13.1 Whether a door is one-way is set by what depends on the decision —
persisted data, external contracts, decisions stacked on it — not by the size
of the change; a public command surface is two-way until something depends on
it. [R10]

## 8-S. Scenarios for §8

8.S1 Given the person picks Start and talks about the product as a whole, when
the conversation narrows to one piece of work to build, then discovery carries
on in the same phase and never asks the person to name a level. (8.2.1, 8.2.2)

8.S2 Given a discovery conversation, when Claude makes the type call, then it
is one of roadmap, feature, epic, bugfix or quick-fix, and never
cross-cutting. (8.2.3, 8.2.4)

8.S3 Given the person wants to talk through a principle that spans the
product, when they pick Start or the roadmap's plan the product, then
discovery meets it at the product level and logs it per session in the
roadmap's session logs. (8.2.5)

8.S4 Given an epic's discovery conversation, when the person's talk turns to
detail, then Claude asks no detail question and what the person said goes into
the brief as input, not as a decision. (8.2.6, 8.3.1, 8.3.2, 8.3.4, 8.3.5,
8.7.2)

8.S5 Given a conversation showing one piece of work, when Claude makes the
type call, then it leans feature; given one showing parts that each need their
own decisions, then it calls an epic, with no further confidence check at that
boundary. (8.4.1, 8.4.2, 8.4.3)

8.S6 Given an inbox item naming the cause and the fix, when the person works it
through discovery, then Claude confirms it in one line and does not shape it
again. (8.4.5)

8.S7 Given a known cause with a mechanical fix, when discovery makes the type
call, then the work is a quick-fix. (8.4.6)

8.S8 Given an approved epic map, when a topic is started, then it goes to
discussion: no topic is routed to research or to the build, no first-phase
gate shows, and the menu's row reads "Start". (8.5.1, 8.5.3, 8.5.4, 8.8.10)

8.S9 Given a bugfix or quick-fix, when discovery confirms the type, then the
work takes that type's own path, not discussion. (8.5.5)

8.S10 Given an epic whose topics include one whose research results others rest
on, when discovery orders the map, then that topic sits ahead of the topics
resting on it, and the order is stored on the unit's manifest. (8.6.1, 8.6.2)

8.S11 Given an epic in discussion, when the person wants a new topic, to cancel,
postpone, pull forward, reactivate or reopen a decided topic, then the epic
menu's discovery row (d) is the way in. (8.6.5)

8.S12 Given a feature whose decision the person wants to reopen, when they look
for the way, then it is manage on the start menu. (8.6.5)

8.S13 Given a topic that ends in not doing the thing, when it closes, then it is
decided with that as its decision or cancelled, and no dead-end state or
dead-end map operation exists. (8.6.6)

8.S14 Given an epic's shaped topics, when discovery writes their briefs, then
each topic's brief is at `topics/{topic}/brief.md` and holds leans, rejected
paths, open questions and what a spike showed, with no decision among them.
(8.7.1, 8.7.2)

8.S15 Given a topic opening in discussion, then Claude brings up what the brief
found and the brief's open questions are not put to the person as a list to
answer in turn. (8.7.3, 8.7.4)

8.S16 Given discovery ready to create work, in auto or in step, then start this
work stops for the person's yes, Claude creates no work before it, and the yes
creates the unit. (8.8.1, 8.8.2)

8.S17 Given an epic shaped with one capability parked on a horizon the person
named, when the map goes for approval, then one screen shows the topics, their order, and the park with its
horizon, and no separate park gate or horizon pick shows. (8.8.3, 8.8.4, 8.7.5)

8.S18 Given a feature, when it runs from discovery to the build, then it stops
for the person at start this work, decided and ready to build as one screen,
and finish, and at no approve-the-map screen. (8.8.5)

8.S19 Given the person says in their own words to rename a topic, edit its
summary, remove an unstarted topic, postpone a topic, add a new topic, pull
one forward, reactivate one or reopen a decided one, then it is done and
reported in one line, with no confirm. (8.8.6, 8.8.7)

8.S20 Given the person picks cancel on a topic by number from the menu, then a
confirm shows before the topic is cancelled. (8.8.8, 8.8.9)

8.S21 Given discovery creates a work unit, then no name gate shows. (8.8.10)

8.S22 Given a phase running in auto, where the person always answers discovery's
resume prompt the same way, when they next resume, then the prompt runs as a
learned process gate (an automatic step with a one-line report). (8.8.12)

8.S23 Given a product-level conversation in which the person says a principle,
when it ends, then no product-wide entry exists for the principle; when the
first topic it bears on opens, Claude opens with it as the position, and once
decided there it is a product-wide entry. (8.3.4, 8.9.3, 8.9.6, 9.3.8)

8.S24 Given a principle no topic yet touches, when topics are decided, then it
waits as input and enters no record. (8.9.6)

8.S25 Given a topic whose decision settles something bigger than itself, when
its decided screen shows, then it lists the proposed product-wide entries, and
the person's yes adds them to the product record with no gate of their own.
(8.9.1, 8.9.7, 9.7.3)

8.S26 Given a product-wide entry is added or replaced, then the engine renders
the product record to its file in `.workflows/.knowledge/`, the file is
gitignored, and it shows the current entry. (8.9.2, 8.9.4)

8.S27 Given any session of the workflows, then no change is written to the
project's CLAUDE.md. (8.9.5)

8.S28 Given a project with no product conversation, when its first topic is
decided with a product-wide entry, then the product record holds that entry
and nothing else. (8.9.9)

8.S29 Given a new epic in a project with a product record, when its first topic
opens, then the opening reads the whole product record and the settled part
cites it. (8.9.8, 9.3.3)

8.S30 Given an epic with topics in discussion, when the person returns to the
epic menu after a topic's work changes, then no gap analysis runs, no candidate
gate shows, and the person's own session is never reported as another. (8.10.1,
8.10.7, 8.8.11)

8.S31 Given a topic's closing pass finds work no topic owns that holds a call
the person would make, then the decided screen shows it as a candidate with its
reason; the person's yes makes it a topic, and striking it drops it. (8.10.2,
8.10.5)

8.S32 Given a closing pass finds work that only carries a decision into another
topic, then a message goes to that topic's mailbox and no candidate shows; a
call the person would leave goes to the builder. (8.10.5)

8.S33 Given every topic of an epic decided, when the spec is next, then one
sweep reads across all the records, for what falls between topics and for
conflicts between them, before the spec is written. (8.10.3, 8.10.4)

8.S34 Given a gap visible from the map alone, when the person is at the epic
menu, then nothing raises it there; it surfaces at the next topic's close or
the sweep. (8.10.6)

8.S35 Given discovery spikes to see the shape, then the spike's files land as
reference assets, the brief carries what it showed as input, and the first
topics' opening views read them. (8.11.1, 9.3.6)

8.S36 Given an epic in discussion, when the person picks d and spikes across the
epic, then the result lands as a new topic whose brief points at the spike,
messages to affected topics, or a direction not taken in discovery's log with
its reason. (8.11.2, 8.11.3)

8.S37 Given a codebase that predates the workflows, when the person picks plan
the product, then it opens with the product researcher's research; what the
code shows lands as findings saying how they are known, what the person states
is carried as input, and what stays open goes on the roadmap. (8.12.2, 8.12.3,
8.12.4, 8.12.5)

8.S38 Given the release installed, then no baseline skill, no baseline status
fields and no baseline agendas, interview procedure or area scoping exist, and
the start menu's offer points at plan the product. (8.12.6, 8.12.7)

8.S39 Given the person picks Start, works inbox items with triage's w, or works
a roadmap item, then each goes through discovery, the picked items as the
unit's seeds. (8.1.3)

8.S40 Given an epic's discovery session ends, then its log is a
`discovery/session-NNN.md` of its own in the unit, and research bearing on the
whole epic sits in that log. (8.1.4, 8.1.5)

8.S41 Given an epic's map ordered foundations first, when the person views the
epic menu, then its recommended row comes first in that order. (8.6.4)

8.S42 Given any discovery or discussion session, then Claude never asks to fill
the product record and no phase of that name exists; the product record sums
up the product's character, never roadmap items, and holds nothing of the
feature map. (8.9.10, 8.9.11, 8.9.12)

8.S43 Given a topic's close, then the closing-pass reader carries the gap
analysis; given the sweep before the spec, then the sweep's own named agent
writes it. (8.10.8)

8.S44 Given a project with the workflows installed, then nothing in them asks
whether the product should use the workflows. (8.12.1)

8.S45 Given a call on a public command surface nothing yet depends on, then it
is treated as two-way; once persisted data, an external contract or another
decision depends on it, it is one-way. (8.13.1)

8.S46 Given a topic lands on the map, then its brief is written then; given a
later discovery session finds input bearing on a topic that has started, then
the input reaches the topic as a message, its brief is not rewritten, and no
reconcile flag is set. (8.7.6)

8.S47 Given an epic, when discovery runs, then start this work creates the
unit, the conversation shapes the topics, approve the map shows, and on its
yes the work hands off into the first topic; given a feature, the work hands
off from start this work with no approve-the-map screen. (8.8.13)

8.S48 Given an existing epic re-shaped through the discovery row, when the
person asks for a change in their own words, then no confirm shows; when
Claude changes the topics or their order beyond what was asked, then the
session ends on approve the map. (8.8.14)

8.S49 Given a park the person gave no horizon, when the map goes for approval,
then Claude first asks which horizon, listing the person's existing horizons
and a new one and naming none itself, and the screen shows the park with the
horizon the person picked. (8.8.4)

8.S50 Given the sweep before the spec finds work holding a call the person
would make, then approve the map shows it with its reason, to be taken or
struck; work the sweep only sends as messages, or leaves to the builder, shows
on no screen. (8.8.4, 8.10.9)

8.S51 Given a project holding `.baseline/` docs, when it migrates, then the
docs sit in `.roadmap/assets/` as reference and no baseline status field
remains. (8.12.8)

8.S52 Given new work taking shape that matches a waiting roadmap item, then
Claude asks once whether to take the item in as a seed; given no match, it says
nothing of it; given the map proposes a topic matching a waiting roadmap item,
the topic takes that item in and no twin stands beside it. (8.1.6)

8.S53 Given an epic with four discovery logs, when the person returns to its
discovery, then after any question whose answer may discard them, the two most
recent logs are read in full and the older two by their closing line, and the
session opens with a short account of where the conversation had got to. (8.6.7,
2.10.4)

8.S54 Given a feature created at start this work from two seeds, when its
discussion first opens, then the session has read the topic's brief and both
seeds in full; given a bugfix, its investigation's first session has read them
the same way. (8.7.7)

8.S55 Given a discovery session whose log misses a point the conversation
settled, when approve the map is about to show, then Claude first re-reads the
log against the conversation and adds the point. (8.8.15)

8.S56 Given an unstarted topic with a message waiting, when the person asks to
remove it, then the message moves to the inbox and the one-line report says so.
(8.8.16)

8.S57 Given new work from a single seed and no name offered, when start this
work creates the unit, then the unit is named from the seed with no question;
given that name is taken, a more specific name is derived, never a number
appended. (8.8.18)

8.S58 Given an epic being explored, when the conversation converges, then Claude
names no topics, nudges once in passing, and proposes the map only when the
person calls for it. (8.8.19)

8.S59 Given a sweep candidate the person takes as a topic, when it lands on the
map, then it has a brief shaped from the gap: what it is, where it was read, why
it matters and its open questions. (8.10.10)

8.S60 Given a candidate the person struck and a topic they removed, when later
closing passes and the sweep run, then neither is proposed again; when the
person asks for one as a new topic, it is added. (8.10.11)

8.S61 Given a project where the person declined the brownfield offer, when start
runs again, then the offer is not made. (8.12.11)

## 9. Discussion

### 9.1 One conversational phase

9.1.1 Today's research and discussion merge into one phase, called
discussion. [R11, R9, plan 3.1; named by the person 2026-10-20]

9.1.2 Research is done to give a decision its data and belongs in the same log
as the decision; research is one of discussion's tools. [R11, R9]

9.1.3 Discussion's tools are deep dives to learn, spikes to see and feel
(9.10), and experiments to measure. [R11]

9.1.4 Experiment is invoked from discussion, its results coming back to be
discussed. Experiment itself is unchanged: a rigid laboratory for questions
neither side can answer. When the discussion reads an experiment's report, it
writes the result as a found entry, saying it was measured. [R11, R9; ruled by
the person 2026-10-20; Claude's derivation, O30]

9.1.5 Deep dives and gap analysis are written by named agents, and the closing
pass's fresh reader is one; the conversation itself — research included — stays in the main
session, at the person's effort (§26 §26). [R46, plan
6.5; agreed by the person 2026-10-19]

9.1.6 Today's research and discussion skills go whole. The verbs that served
research threads and today's discussion map go (§6 §6).
[plan 1.5, plan 6.1; Claude's proposal]

9.1.7 A feature in discussion is an epic with one topic: its decision can be
the opening view and one answer. [R19]

9.1.8 A discussion session works on one topic. [R11, R13]

9.1.9 The merged phase is named discussion throughout (§18). [R17]

9.1.10 When a deep dive lands, the person hears what came back at the next
natural pause. A question brief gets its answers in full; any other brief gets a
short digest of what was asked, what came back and what it opened. [today's
product; Claude's sort, T47]

9.1.11 The point an experiment measures stays open on the topic's map, marked as
waiting on it, until the discussion reads the report and writes the result. So a
topic is never decided while its experiment runs (9.5.3). An abandoned
experiment leaves its point open. A report that lands after its point was closed
reaches the topic as a message does, reopening it if decided (10.2.7). [R11,
record 872–874, 1530; Claude's derivation, T6]

### 9.2 Record and log

9.2.1 Each topic keeps a **record** — current decisions only, each with its
why and what it rules out — and a **log** — the journey, options, false paths
and reversals, appended and never rewritten. [R11; the record-and-log
programme folded in by the person 2026-10-12]

9.2.2 The record is what downstream phases and the knowledge base read first.
The knowledge base indexes records, never logs, assets, seeds, inbox items or
the product record's rendered file; an asset is reached through the entry that
links it (§22 §22). [R11, R44;
Claude's derivation, O29]

9.2.3 The log keeps the person's thinking and why minds changed. The spec's
session reads it where it needs to know why; a why missing from it is a gap.
[R11]

9.2.4 A decision is written once: every decision and finding is a ledger entry
written through an engine command, and the record is the engine's view of the
topic's current entries, each shown with its short id, as menus are drawn from
the manifest. [R11, R23, plan 3.4; ruled by the person 2026-10-13]

9.2.5 Nothing in the record is edited in place: linking comes free and
superseding stays append-only. A changed mind is a new entry replacing the
earlier one; the record shows each current entry with the answers it replaced
folded beneath it, and the change and its why are appended to the log. [R11,
R23; the person 2026-10-14]

9.2.6 Claude writes an entry's content freely — an entry's why can run to
paragraphs — and the structure stays out of its way; the engine assigns and
holds identity, links and supersession (§5 for each kind's
schema). [R11, R23; Claude's derivation]

9.2.7 One thing goes to an entry (§5 §5). A scope call agreed
after the opening view — what the topic covers — is an entry like any other.
[R11, R23]

9.2.8 Spikes and their assets are files an entry points at (9.10). [R11, R12]

9.2.9 The split moves from by phase to outcome against journey: a topic no
longer has a research document and a discussion document, each mixing journey
and outcome. [R11]

9.2.10 A discussion log is kept per topic, at `topics/{topic}/log.md`, one
dated heading per session, so the topic's whole journey sits in one file
beside its record, for its next session and for the person asking why. [R11,
Layout on disk, plan 3.4; ruled by the person 2026-10-13]

9.2.11 The log is free prose written as the conversation goes, enough for a
fresh session to carry on alone, and points at entries by short id rather than
restating them. [R23]

9.2.12 The record holds findings beside decisions, in their own section, each
saying how it is known (measured, documented, seen in a spike) and when, and
replaced by a new entry when superseded, as decisions are. A measurement taken
in the conversation without an experiment is recorded as exploratory. [R11;
ruled by the person 2026-10-13; today's product; Claude's sort, T56]

9.2.13 A topic's record and its map are never files: they are projections of
the ledger (§5; §22
for the knowledge base's rendered copy). [Layout on disk, R23]

9.2.14 Every record entry says who decided it: the person, Claude, or the
person handing it over ("your call"). A finding says how it is known instead.
[R11, plan 3.4]

9.2.15 A Claude suggestion can never sit in the record as the person's
decision; the spec review catches an unowned decision in the spec (§11). [R11]

9.2.16 "Don't care" hands a call to the builder and is recorded as the
builder's. [R11]

9.2.17 Discussion writes to the ledger: questions asked (put on a topic's map),
findings (a fact and how it is known), decisions (who, why, what it rules out,
what it relies on), replacements, "still holds" confirmations, and questions
moved to another topic (§5 §5). [R23]

9.2.18 A change names what caused it, by short id: the other topic's decision,
the new fact, or the message. [R23]

### 9.3 A topic opens with Claude starting the conversation

9.3.1 Nothing is written ahead of a topic's opening. [R11; ruled by the person
2026-10-18]

9.3.2 The prose prescribes the steps before the opening: reading the brief and
the record of every topic decided so far, checking what can be checked (see
§16 Trust), and the engine's commands. Then Claude opens the conversation
itself, never stopping in silence once it has read. [R11, plan 3.4; ruled by
the person 2026-10-18]

9.3.3 The opening view reads the whole product record, and the settled part
of the opening cites it. [R10, R23]

9.3.4 The opening view reads other topics' records, not their logs; a topic
opening with a log of its own reads that log. [R11, R43; put to the person
2026-10-13]

9.3.5 A topic's opening view searches earlier work units' current entries in
its area through the knowledge base. [R23]

9.3.6 The first topics' opening views read what a discovery spike showed
(8.11.1). [R12]

9.3.7 What Claude says in the opening is its own and fits the topic: the shape
of what has been said, a perspective from the brief or beyond it, what earlier
decisions already settle and where from, the open questions with its lean on
any where a logical one exists, and perhaps a steer towards where to start.
[R11, plan 3.4; ruled by the person 2026-10-18]

9.3.8 Claude opens with a principle the person stated in a product-level
conversation as the position, in the first topic it bears on (8.9.6). [R10]

9.3.9 Opening decides nothing: the conversation is about the shape, and what
the person decides enters the record as theirs. [R11]

9.3.10 The part of the opening that earlier decisions settle grows with every
topic decided, so the forks shrink on their own (the cone, §16 Trust). [R24]

9.3.11 Resuming a topic reads its record and its log, after any question whose
answer may discard them (§2 §2: a context budget). [R43; ruled by
the person 2026-10-19]

### 9.4 A conversation, never a conveyor belt

9.4.1 Discussion is a conversation, never a conveyor belt of decisions:
decisions are collaborated on and answered through conversation —
challenging ideas, playing devil's advocate, throwing thoughts around. [R11,
plan 3.4; the person 2026-10-18]

9.4.2 The map tracks what is open and never sets the conversation's order.
[R11, plan 3.4]

9.4.3 The prose prescribes the steps around the conversation, never the
conversation itself, which is a field (§2 §2: walls and rope).
[R11, R2, plan 3.4]

9.4.4 In discussion, questions are asked in conversation, and the walks check
that every answer was recorded. [plan 2.2; ruled 2026-10-19]

9.4.5 The least a topic takes is Claude's opening and one answer. [R11]

9.4.6 Early topics are mostly conversation; as the product fills out there is
less to discuss and more to bolt on, and one piece can open the discussion
wide again. [R11]

### 9.5 The map is the definition of done

9.5.1 The map stores nothing: it is the topic's list of what is being decided
and where each stands, drawn from the ledger. [R11, R23; agreed by the person
2026-10-13]

9.5.2 The person's questions sit beside Claude's calls on the map, one line
each. The person's questions are seeded from the open questions in Claude's
opening, and joined by any met mid-conversation, any arriving as a message or
a finding, and any the person adds. [R11, plan 3.4]

9.5.3 Only the person's questions hold the topic open: Claude's calls are
decided when made, and the topic is done when nothing of the person's is open.
[R11, plan 3.4]

9.5.4 A question of the person's closes by their decision; by "your call"
(Claude's, marked handed over); by "don't care" (the builder's); or by moving
to another topic as a message, or to the roadmap as later. Nothing waits
half-decided as deferred. [R11]

9.5.5 Each time the map shows, it lists Claude's calls since the person last
looked, so a call is overruled when made rather than at the topic's close.
"Since you last looked" is the same engine query as "what have you decided
without me?" (§5 §5). [R11, R23, plan 3.4]

9.5.6 Screen: the topic's map. It shows the person's questions and Claude's
calls, one line each, with where each stands, and lists Claude's calls since
the person last looked. It shows in the conversation as 9.5.11 says (§20 The
workflows board for the board's view). Its rows are drawn by Claude in the
spec in the existing design system, marked as Claude's. [R11; Claude's
derivation, O8, O94]

Screen, drawn by Claude: the topic's map, shown in the conversation. [Claude's derivation, O94]

```text
Map — Onboarding And Permissions
12 of yours: 11 decided, 1 open · 6 calls by Claude

SINCE YOU LAST LOOKED (1 call by Claude)
  └─ ◇ Pricing mention
        No price line in the walkthrough or anywhere else in
        first run.

OPEN (1 of yours)
  └─ ○ An unlicensed Fumi opens on a licence w…   [yours]
        ↳ From Commercialization's message

DECIDED (11 of yours · 6 calls by Claude)
  ├─ ✓ Enabling sync later                        [yours]
  ├─ ✓ First run shape                            [yours]
  ├─ ✓ Launch at login offer                      [yours]
  ├─ ✓ No iCloud account state                    [yours]
  ├─ ✓ First run landing                          [yours]
  ├─ ◇ First launch definition                    [Claude's call]
  ├─ ✓ Sample notes and sync                      [yours]
  ├─ ◇ Login item banner                          [Claude's call]
  ├─ ✓ Sync toggle default                        [yours]
  ├─ ◇ Who performs the restart after the Acce…   [Claude's call]
  ├─ ◇ The engine needs Files-and-Folders acce…   [Claude's call]
  ├─ ✓ Sync offer copy                            [yours]
  ├─ ✓ Notification permission ask                [yours]
  ├─ ◇ Screen title                               [Claude's call]
  ├─ ◇ Pricing mention                            [Claude's call]
  ├─ ✓ Wizard step content                        [yours]
  └─ ✓ Personalisation step                       [yours]
```

9.5.7 An answer that settles part of a question puts the unsettled part on the
map as its own question, linked to the first, so nothing open hides behind an
answer. [R23]

9.5.8 Today's map, which lists every subtopic Claude names in five states of
its own bookkeeping, goes. [R11, plan 6.1]

9.5.9 The epic menu shows no count of a topic's questions (§18). [R17, plan 3.11; the person 2026-10-14; Claude's
derivation]

9.5.10 A lock on a design is a question on the map (9.10.12). [R12]

9.5.11 The person has looked when the map shows in the conversation; opening
the board is not looking. The map shows in the conversation at natural
pauses, at Claude's judgement, and whenever the person asks. Where the
last-looked mark is kept is the builder's. [R11, R23, record 1481–1482;
Claude's derivation, O8]

### 9.6 Once the shape is agreed

9.6.3 Until a topic's shape is agreed, Claude makes no call of intent or taste
on it alone; it works them through with the person in the conversation. How
depends on the topic and where it stands: where several ways are open, Claude
puts ideas forward and asks what the person thinks; where one way is clear,
Claude sets out how it sees the thing working and invites the person to pull it
apart and pressure-test it — never in set phrases. [R11, R24; the person
2026-10-12; ruled by the person 2026-10-21]

9.6.1 Once the shape is agreed, Claude fills in the rest. The ask rule sends
the person the few calls that need them, one at a time in the conversation;
the rest are Claude's, on the map and in the ledger; the topic goes to its
decided screen through convergence (§16 §16). [R11, R24]

9.6.2 Every call Claude makes in discussion — casually in conversation, from a
review finding, in the closing pass, from a message — goes through the one
decision point (§16 §16). [R24; ruled by the person 2026-10-13]

### 9.7 Decided

9.7.1 When nothing of the person's is open, the closing pass runs (9.9) and the
decided screen shows. [R11]

9.7.2 Decided is an authority gate: never automatic, and it stops in auto and
step alike (§3 §3). [R11, R40, plan 3.4]

9.7.3 Screen: decided. It shows:
- what the person decided;
- a count of the calls Claude made, by kind, which the person can open to see
  them — never a list picked out as "worth a look";
- a verdict asked on each call the person changed in the topic, one press
  each, with skip beside them (§16 §16 for the verdict and its queue);
- the proposed product-record lines;
- any new-topic candidates, each with its reason, which the person can strike;
- any checklist item skipped (§6 §6).

The person's yes is the authority gate, and covers the product-record lines
and every candidate not struck. A product-record line has no strike of its
own: one the person disagrees with is changed through a comment at the gate,
as at any gate. Its other rows are drawn by Claude in the spec in the existing
design system, marked as Claude's. [R11, R10, R23, plan 3.4, plan 6.4;
verdicts ruled by the person 2026-10-18; the count ruled 2026-10-14; Claude's
derivation, O26, O94]

Screen, drawn by Claude: decided, with the first verdict asked. [Claude's derivation, O94]

```text
Onboarding And Permissions — decided

WHAT YOU DECIDED (12)
  ├─ Enabling sync later
  ├─ First run shape
  ├─ Launch at login offer
  ├─ No iCloud account state
  ├─ First run landing
  ├─ Sample notes and sync
  ├─ Sync toggle default
  ├─ Sync offer copy
  ├─ Notification permission ask
  ├─ Wizard step content
  ├─ Personalisation step
  └─ An unlicensed Fumi opens on a licence w…

CLAUDE'S CALLS (6)
  2 behaviour · 2 words · 1 look · 1 internals

FOR THE PRODUCT RECORD (2 lines)
  · First run shows the product before it asks for anything: the
    tour first, then the licence as a wizard step.
  · Sync stays off until you turn it on.

NEW-TOPIC CANDIDATES (1)
  └─ ○ Removing Fumi
        First run asks for Accessibility and a login item, and no
        topic decides what removing Fumi takes back.

  ⚑ Skipped: the closing pass's last re-read changing nothing —
    its third re-read reworded one line, and nothing else moved.

YOUR VERDICT (1 of 2 calls you changed)
  └─ Sync toggle default
        Decides: whether sync is on when Fumi first runs
        My answer: on, once you pick a folder to sync
        Yours: off until you turn it on

· · · · · · · · · · · ·
◆ What would my answer have cost the product?

n/nothing → Nothing — mine would have served as well
f/fix     → A fix later
l/loss    → A real loss
s/skip    → Skip — I can't call it yet; it waits in the verdict
            queue
```

Screen, drawn by Claude: decided's gate, once the verdicts are given. [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
Your yes marks Onboarding And Permissions decided, with the two
product-record lines and the candidate.

◆ Mark it decided?

y/yes    → Mark it decided
c/calls  → See Claude's 6 calls
s/strike → Strike the candidate — it doesn't become a topic
Comment  → Tell me what to change — a product-record line
           included
```

9.7.4 The decided screen keeps the contents agreed for it: the measures are
never added to it. [R36; the person 2026-10-14]

9.7.5 The decided screen replaces today's closing sequence: the calls flush,
the landed-input check, the wait gate, the map gate and the closing gates, the
conclude gate among them. [R11]

9.7.6 For a feature, decided and ready to build are one screen (§11). [R14, R40]

9.7.7 The engine holds decided's checklist (§6 §6). [plan
6.4]

9.7.8 Before decided, or when the session leaves the topic, Claude asks whether
to wait for any of the topic's deep dives or review agents still running; this
is a process gate. A report that lands after the session left is taken in when
the topic next opens. [today's product; Claude's sort, T35]

### 9.8 The reviews

9.8.1 The reviews stay, and the matrix routes what they find. [R11, plan 3.4;
ruled by the person 2026-10-13]

9.8.2 Today's review machinery keeps running: the background review once the
conversation has got going, with its back-off; the perspective agents; the
final review; findings slotted in at a natural pause while the conversation
carries on, never jumped to; and the lanes. [R11]

9.8.3 What changes is who answers. A finding takes the path of any question:
a fact is checked; intent goes to the matrix and becomes either Claude's call
(in the ledger, and on the map under "since you last looked") or a question on
the person's map; another topic's goes there as a message (§10); a gap is a
candidate on the decided screen (8.10.2). [R11]

9.8.4 The lanes are the matrix's output: apply is what the record or a fact
settles, decide is Claude's call, the walked lane is the person's question,
and route belongs elsewhere. [R24]

9.8.5 The reviewer's tie-break ("When a finding could read either way, it is
`ask`") gives way to the matrix, and the matrix has a sanctioned way to move a
finding away from the person, where today findings only move toward them.
[R24; folded into the restructure by the person 2026-10-14]

9.8.6 A finding a later decision has made moot is dropped with a one-line
note. [R24, plan 3.4; ruled by the person 2026-10-14]

9.8.7 Screen: the one-line note for a dropped finding (9.8.6). [R24]

9.8.8 A finding coming to the person is first rechecked against answers given
earlier in the same walk and against the record, before it is raised. [R24,
plan 3.4; Claude's addition, ruled by the person 2026-10-14]

9.8.9 A route names another topic, never a subtopic. [R24, plan 3.4; ruled by
the person 2026-10-14]

9.8.10 There is no cap on findings per report: more findings is the point.
[R24; ruled by the person 2026-10-14]

9.8.11 A review finding goes on the stream as a question the review asked, so
its answer is linked to it like any other. [R23]

9.8.12 The gates inside the reviews are process gates, learned like any other
(§3 §3). [R11, R40]

9.8.13 Discussion's perspective and review agents and the closing-pass reader
are among the workflows' named agents, and receive only briefs the engine
issued (§26; §6). [plan 6.5; Claude's, agreed]

9.8.14 Left to the builder: what arms the background review's back-off, now that
today's map is gone (9.5.8). The nearest measure is the new map's moves since
the last review: the person's questions opened or closed, and Claude's calls.
[Claude's sort, T65]

### 9.9 The closing pass

9.9.1 The closing pass is the final review, run once nothing of the person's
is open. [R11, plan 3.4]

9.9.2 The closing pass has two readers:
- a fresh agent, unanchored by the conversation, reading this topic's entries
  and log, the other topics' current records and the product record;
- the Claude that was in the conversation, checking every decision made in it
  has an entry.
[R11, plan 3.4]

9.9.3 The closing pass looks for a question the log raised that has no entry
or map line, a contradiction with another record, work the decision creates
that no topic owns (8.10.2), product-record lines, and an entry whose why is
written nowhere. [R11]

9.9.4 The closing pass checks each replacement against what it replaced, and
looks for conflicts with other topics (8.10.4). [R23; Open: one build across an
epic, ruled by the person 2026-10-14]

9.9.5 If the closing pass changed decisions, another pass reads what changed,
unasked, until one changes nothing. [R11, plan 3.4]

9.9.6 Where no gap review has run since the topic's last decision — a quick
topic whose background review never started among them — the closing pass's
fresh reader also runs today's final gap review, looking for what the topic's
decisions leave unanswered; its findings take a finding's path (9.8.3). [R11;
the person 2026-10-13; Claude's derivation]

9.9.7 A found entry measured by running something records the command and its
result. The closing pass re-runs each one the topic's decisions rest on. A value
that has changed is replaced with the reason "it was wrong" (5.3.7), and the
decisions relying on it are then affected as by any replacement (5.6). [today's
product; Claude's sort, T28]

### 9.10 Spikes and assets

9.10.1 Spikes are encouraged, and their artifacts are evidence. [R12]

9.10.2 A spike is code or design that is never wired into the product; size
does not decide it. A spike is anything that can be looked at or pressed: a
design board, a constrained design generator, draft code, a format trial, a
working prototype to scroll and feel. [R12]

9.10.3 Spikes live inside discussion conversations and may come early, in the
first ones. [R12]

9.10.4 What informs a decision — an exported image with its live source link,
draft code, the generator that drew a design, pulled data — lands in the work
unit as a tracked asset linked from the record, whoever made it. [R12]

9.10.5 A work unit's `assets/` is the one home for what informs a decision,
replacing `imports/`, whoever made the file. Each asset is linked from the
ledger entry it informs: canonical from a decision, reference from a finding
or the log. [R12, Layout on disk, plan 3.4; ruled by the person 2026-10-13]

9.10.6 Each asset is one of two:
- **canonical** — the spec carries it, the builder builds to it, and it is
  replaced when the design changes; it belongs to the record;
- **reference** — the builder consults it before re-solving anything it
  covers; draft code is reference by default; it belongs to the log.
[R12, plan 3.4]

9.10.7 Claude proposes an asset's status when it lands; the person can change
it at any time by saying so in their own words, and Claude records the change
through the asset verb (§6 §6); no row is added for it.
[R12, plan 6.1; Claude's derivation, O6]

9.10.8 The record states what a spike settled and points at the asset; it
never re-describes it. [R12]

9.10.9 An image is what was decided and its live source link is where work
continues; both are recorded. Something living in an outside tool is kept as
its live link and an exported image. [R12]

9.10.10 A spike's source — draft code, a generator, a design export and its
live link — is kept in `assets/` as it is written, so nothing is left in a
session folder; its dependencies, builds and run output go in the gitignored
cache. [R12, plan 3.4; Claude's call 2026-10-19]

9.10.11 A product-level spike's files go in `.roadmap/assets/`, which replaces
`.roadmap/imports/` as a unit's `assets/` replaces `imports/`, each linked from
the product-wide decision it informs. [R12; Claude's call 2026-10-19]

9.10.12 A design spike runs in rounds and ends in a lock. A lock is a question
on the map ("which design?"), closed by the person's choice: a ledger entry
with the design as its canonical asset, with no gate of its own. The locked
design becomes canonical and the spike ends as live work: nothing tracked is
deleted, and only its cache output may be removed. [R12, plan 3.4; ruled by
the person 2026-10-13; Claude's derivation, O28]

9.10.13 Rejected designs stay reference, the reason they lost in the log; a
rejected spike's rejection is kept. [R12]

9.10.14 A later spike may challenge a locked design with a stated hypothesis;
a later spike that challenges a lock supersedes it like any decision, with its
reason. [R12]

9.10.15 A spike is evidence only for what the person reviewed in it:
scaffolding nobody discussed is never cited as decided. [R12]

9.10.16 Lifting a piece of spike code into the product is an explicit,
recorded act, never drift. [R12]

9.10.17 Claude's own spikes back its calls: the reference assets attach to
Claude's ledger entry as its evidence, so "what have you decided without me"
shows how Claude found out. [R12, R24; ruled by the person 2026-10-13]

9.10.18 Where an entry's text and the design it points at disagree: for what
exists and how it behaves, the record wins and the design is out of date; for
how it looks, the design wins. [R23]

9.10.19 No design tool is named in the workflows. [R12]

9.10.20 The spec links canonical assets (§11 §11). [R14]

9.10.21 Left to the builder: the verb or entry that records lifting spike code
into the product (9.10.16). [Claude's sort, B24]

9.10.22 A shared path that names no file is asked about again, to be corrected
or skipped, before anything lands. An image pasted with no file behind it is
asked for as a saved file. [today's product; Claude's sort, T58]

## 9-S. Scenarios for §9

9.S1 Given a topic in discussion, when a question needs data, then Claude runs
a deep dive inside the same phase; its result lands in the topic's log and as a
finding in its record; no research phase item and no separate research
document exists. (9.1.1, 9.1.2, 9.1.3, 9.2.9, 9.2.12)

9.S2 Given a question neither side can answer, when an experiment is run from
the topic, then it runs as today and its results come back to the topic to be
discussed; when the discussion reads the report, it writes the result as a
found entry saying it was measured. (9.1.4)

9.S3 Given a feature in discussion whose decision follows from what is settled,
when Claude opens, then one answer from the person can bring the topic to
decided. (9.1.7, 9.4.5)

9.S4 Given the person decides something in conversation, then a decided entry
is on the ledger through an engine command, the record shows it with its short
id and "who decided" as the person, and the log holds the session under a dated
heading. (9.2.1, 9.2.4, 9.2.10, 9.2.14, 9.2.17)

9.S5 Given a decided entry, when the person changes their mind, then a new entry
replaces it naming its cause, the record shows the new answer with the old one
folded beneath it, the log records the change and its why, and no entry is
edited. (9.2.5, 9.2.18)

9.S6 Given a fact measured in the topic, then the record shows it in its
findings section saying how it is known and when. (9.2.12)

9.S7 Given the person says "your call" on a question, then Claude's answer is
recorded as handed over; given "don't care", the call is recorded as the
builder's; neither shows as the person's decision. (9.2.14, 9.2.15, 9.2.16,
9.5.4)

9.S8 Given a topic and its log, then neither its record nor its map is a file
in the work unit, and the log points at entries by short id. (9.2.11, 9.2.13,
9.5.1)

9.S9 Given a topic about to open, then no file is written ahead; Claude reads
the brief, the record of every topic decided so far and the product record,
checks what can be checked, and then speaks first, its opening giving the shape,
what earlier decisions settle and where from, and the open questions with its
lean where a logical one exists. (9.3.1, 9.3.2, 9.3.3, 9.3.7)

9.S10 Given other topics with long logs, when a topic opens, then the opening
reads their records and not their logs. (9.3.4)

9.S11 Given an earlier work unit decided something in the topic's area, when the
topic opens, then the opening view finds that current entry through the
knowledge base. (9.3.5)

9.S12 Given Claude's opening, when the person has said nothing yet, then no
decision is in the ledger from it. (9.3.9)

9.S13 Given a topic resumed in a new session, then it reads the topic's record
and log after any question whose answer may discard them. (9.3.11)

9.S14 Given a discussion walk, when it ends, then every answer the person gave
in conversation is recorded. (9.4.4)

9.S15 Given open questions in Claude's opening, then each is on the map as the
person's question; a question met mid-conversation, one arriving as a message,
one from a finding, and one the person adds join it. (9.5.2, 10.4.4)

9.S16 Given all the person's questions closed while Claude's calls stand, then
the topic is done and the closing pass runs. (9.5.3, 9.7.1)

9.S17 Given the person moves a question to another topic, then it closes on this
map as moved and arrives in that topic's mailbox; given "later", it goes to the
roadmap; nothing on the map reads deferred. (9.5.4, 10.2.5)

9.S18 Given Claude made calls since the person last saw the map, when the map
next shows, then it lists those calls. (9.5.5, 9.5.6)

9.S19 Given an answer that settles part of a question, then the unsettled part
is on the map as its own question linked to the first. (9.5.7)

9.S20 Given an epic menu with topics in discussion, then no topic's row shows a
count of its questions. (9.5.9)

9.S21 Given every question of the person's closed, then the decided screen shows
what the person decided, the count of Claude's calls by kind (openable), a
verdict press with skip for each call the person changed, the proposed
product-record lines and any candidates; it stops for the person's yes in auto
and step alike. (9.7.2, 9.7.3, 9.7.4)

9.S22 Given a topic reaching its close, then none of today's calls flush,
landed-input check, wait gate, map gate or conclude gate shows. (9.7.5)

9.S23 Given a feature whose topic is done, then decided and ready to build show
as one screen. (9.7.6)

9.S24 Given the background review returns a finding of intent the matrix makes
Claude's, then it is in the ledger and on the map under "since you last
looked", and not raised. (9.8.3, 9.8.4)

9.S25 Given a review finding that belongs to another topic, then it goes to that
topic as a message, naming the topic and never a subtopic. (9.8.3, 9.8.9)

9.S26 Given a finding a later decision has made moot, then it is dropped with a
one-line note. (9.8.6, 9.8.7)

9.S27 Given a finding headed for the person that an earlier answer in the same
walk or the record already settles, then it is rechecked against them before
any raise. (9.8.8)

9.S28 Given a review returns more findings than before, then none is cut for
count. (9.8.10)

9.S29 Given a review finding, then the ledger holds it as a question the review
asked, and its answer links to it. (9.8.11)

9.S30 Given a topic's closing pass, then a fresh agent reads the topic's entries
and log, the other topics' current records and the product record, and the
conversation's Claude checks each decision has an entry; a question the log
raised with no entry or map line is found and takes a finding's path. (9.9.1,
9.9.2, 9.9.3, 9.8.3)

9.S31 Given a closing pass that changed a decision, then another pass reads what
changed, unasked, and the passes end at one that changes nothing. (9.9.5)

9.S32 Given Claude builds a prototype in a discussion, then its source is in the
unit's `assets/` as it is written, its dependencies and build output are in the
gitignored cache, and nothing is left in a session folder. (9.10.3, 9.10.10)

9.S33 Given the person shares a file in a discussion, then it lands in the unit's
`assets/`, linked from the entry it informs, with a status Claude proposes and
the person can change; no `imports/` folder is written. (9.10.4, 9.10.5,
9.10.7)

9.S34 Given draft code lands as an asset, then its status is reference unless
changed. (9.10.6)

9.S35 Given a design spike over rounds, when the person picks a design, then the
"which design?" question on the map closes with a ledger entry naming the
design as its canonical asset, with no gate; the rejected designs stay
reference and the reason they lost is in the log; the spike ends as live work,
nothing tracked is deleted, and only its cache output may be removed. (9.5.10,
9.10.12, 9.10.13)

9.S36 Given a later spike challenges a locked design with a stated hypothesis,
then a new entry supersedes the lock with its reason. (9.10.14)

9.S37 Given Claude spiked to settle one of its own calls, when the person asks
what Claude decided without them, then the call shows with its reference assets
as evidence. (9.10.17)

9.S38 Given a spike carried scaffolding nobody discussed, then no entry or spec
statement cites it as decided. (9.10.15)

9.S39 Given a product-level spike, then its files are in `.roadmap/assets/`,
linked from the product-wide decision they inform. (9.10.11)

9.S40 Given a topic in discussion, when a deep dive or the closing pass's fresh
reader runs, then a named agent does it, and the conversation stays in the main
session. (9.1.5)

9.S41 Given the release installed, then no research skill or research phase
exists, no research-thread or subtopic-map verbs remain, the map has no
subtopic states, and the screens name the merged phase discussion. (9.1.6,
9.1.9, 9.5.8)

9.S42 Given a discussion session, then it works on one topic. (9.1.8)

9.S43 Given a topic's entries change, then the knowledge base indexes the
topic's record and never its log. (9.2.2)

9.S44 Given the person agrees what the topic covers after the opening, then
that scope call is an entry on the ledger. (9.2.7)

9.S45 Given several calls the ask rule sends the person, then they come one at a
time in the conversation, and the rest stand as Claude's on the map and in the
ledger. (9.6.1, 9.6.2)

9.S46 Given a conversation that has got going, then the background review runs
with its back-off, its findings slotted in at a natural pause and never jumped
to, and the reviewer's brief carries no "it is `ask`" tie-break. (9.8.1,
9.8.2, 9.8.5)

9.S47 Given a phase running in auto, where the person always answers a review's
gate the same way, then that gate becomes an automatic step with a one-line
report. (9.8.12)

9.S48 Given a dispatch of discussion's review agent without a brief the engine
issued, then it is refused. (9.8.13)

9.S49 Given a closing pass over a topic that replaced an answer, then the pass
checks the replacement against what it replaced and looks for conflicts with
other topics' records. (9.9.4)

9.S50 Given a spike settled a question, then the record states what it settled
and points at the asset without re-describing it; a design living in an outside
tool is kept as its live link and an exported image, both recorded. (9.2.8,
9.10.8, 9.10.9)

9.S51 Given spike code lifted into the product, then the lift is recorded.
(9.10.16)

9.S52 Given an entry's text and the design it points at disagree, then on what
exists and how it behaves the record wins, and on how it looks the design wins.
(9.10.18)

9.S53 Given the workflows' prose, then no design tool is named in it. (9.10.19)

9.S54 Given an asset, a seed, an inbox item or the product record's rendered
file, then the knowledge base indexes none of them, and a search reaches an
asset through the entry that links it. (9.2.2)

9.S55 Given the decided screen lists a product-record line the person
disagrees with, then the screen offers no strike for that line; the person
comments on it at the gate and the line is changed. (9.7.3)

9.S56 Given an asset whose status Claude proposed, when the person says in
their own words that it should be the other status, then Claude records the
change through the asset verb, and no menu row exists for it. (9.10.7)

9.S57 Given the person has opened the board and seen the map there, when the
map next shows in the conversation, then it still lists every call Claude made
since the map last showed in the conversation; the map shows at a natural
pause at Claude's judgement, or when the person asks. (9.5.5, 9.5.11)

9.S58 Given a topic that reaches its close with no gap review run since its
last decision, its background review never having started, when the closing
pass runs, then its fresh reader also runs the final gap review over what the
topic decided, and each gap it finds takes a finding's path; given a gap
review ran after the topic's last decision, then the closing pass runs no
second one. (9.9.6, 9.8.2, 9.8.3)

9.S59 Given a topic whose shape is not yet agreed, when a call of intent or
taste on it comes up, then Claude does not make it alone, whatever the counts:
where several ways are open it puts ideas forward and asks what the person
thinks, and where one way is clear it sets out how it sees the thing working and
invites the person to pull it apart. (9.6.3, 16.7.3)

9.S60 Given a deep dive on a question brief, when it lands mid-exchange, then at
the next natural pause the person hears its answers in full; given any other
brief, they hear a short digest of what was asked, what came back and what it
opened. (9.1.10)

9.S61 Given a topic with an experiment running on one of its points, when every
other question of the person's is closed, then the topic is not decided and the
point shows as waiting on the experiment; given the experiment is abandoned, the
point stays open; given a report lands after its point was closed, it reaches
the topic as a message, reopening it if decided. (9.1.11, 9.5.3, 10.2.7)

9.S62 Given a measurement taken in the conversation without an experiment, when
it is recorded, then its found entry says it is exploratory. (9.2.12)

9.S63 Given a topic with a deep dive still running, when the session reaches
decided or leaves the topic, then Claude asks whether to wait for it; given the
session left, the report is taken in when the topic next opens. (9.7.8)

9.S64 Given a topic whose decision rests on a found entry measured by a command,
when the closing pass runs, then it re-runs the command; given the value has
changed, the entry is replaced with the reason "it was wrong", and the decisions
relying on it are affected as by any replacement. (9.9.7, 6.4.6)

9.S65 Given the person shares a path that names no file, then Claude asks for it
to be corrected or skipped before anything lands; given an image pasted with no
file behind it, Claude asks for it as a saved file. (9.10.22)

## 10. Between topics

### 10.1 Mailboxes

10.1.1 A topic never writes into another topic's record: a call that looks
obvious through one topic's lens can read differently with the other topic's
context in view. [R13]

10.1.2 The mailbox stays a queue of files, one message each. [R13]

10.1.3 A topic has one mailbox, in the topic's own folder beside its brief and
log, at `topics/{topic}/mail/NNN-*.md`. The choice of which phase a message
lands in goes, and a topic's path names no phase. [R13, Layout on disk]

10.1.4 The mailbox's names are mailbox, message and send. [R13]

10.1.5 A target topic already in session raises the message from its loop, as
today. [R13]

10.1.6 Cancelling a topic moves its waiting mail to the inbox (§18). [R17]

10.1.7 "Triage waiting" on the epic menu's rows becomes mail waiting (§18). [R17; ruled by the person 2026-10-16]

10.1.8 A postponed topic's waiting mail, and any message sent to it while it
waits, stays in its mailbox and is raised first when it returns (10.4.1). A
message sent to a cancelled topic goes to the inbox, as a cancelled topic's
waiting mail does, and the sending session says so in one line. [R13, R17;
Claude's derivation, T12]

### 10.2 Each topic owns its decisions

10.2.1 A decision in one topic that bears on another's goes to the owner
through the mailbox, with the sender's reasoning, and the owning topic decides
it in its own frame. [Open: one build across an epic, plan 3.4; ruled by the
person 2026-10-14]

10.2.2 Every change to a decision another topic owns goes to the owner through
the mailbox, and the owner's session writes the replacing entry, so a decision
is only ever changed through the lens of the topic that owns it. [R23, plan
3.4; stated 2026-10-14 in answer to the person]

10.2.3 A decision is one entry: the same decision reached from another topic
is that entry, never a second. Only a duplicate giving the same answer is
merged where it is found, leaving the owner's entry as it stands. [R23, plan
3.4; ruled by the person 2026-10-14]

10.2.4 A topic's record shows other topics' current answers rather than
restating them, so a change leaves no stale copy to correct. [R23, R13]

10.2.5 A question can be moved to another topic as a message, and the chain
beneath an answer shows a question moved away. [R11, R23]

10.2.6 When an answer is replaced, a topic whose entries relied on it confirms
each with a "still holds" or replaces it; until it does, the topic shows among
what waits on the person, even when it was closed (§5 §5). [R23]

10.2.7 A message to a decided topic reopens it through its mailbox: the topic
shows with mail waiting and is no longer decided until its session raises and
answers the message. Reopening through the epic menu's discovery row (8.6.5)
is the person's other way in. [R12, R17; Claude's derivation, O31]

### 10.3 Opening a topic directly

10.3.1 The start skill takes an optional work unit and topic:
`/workflow-start {work unit} {topic}` opens that topic directly, as picking it
through the menus would. [R13, plan 3.4; ruled by the person 2026-10-16]

10.3.2 The command opens any topic by name, not only for mail. [R13]

10.3.3 Every send's report ends with that command for the target, to paste in
another pane now or use later. [R13, plan 3.4]

10.3.4 Screen: the send report. It says where the message landed and ends with
`/workflow-start {work unit} {topic}` for the target. The rest of what it
shows is drawn by Claude in the spec in the existing design system, marked as
Claude's. [R13; Claude's derivation, O94]

Screen, drawn by Claude: the send report. [Claude's derivation, O94]

```text
Sent to Commercialization, on Fumi
  First run shows the product before the licence: the licence is
  a wizard step after the tour
  ↳ Waiting in its mailbox, with my reasoning

/workflow-start fumi commercialization
```

### 10.4 Waiting mail

10.4.1 A topic that opens with mail waiting raises the mail first. [R13, plan
3.4]

10.4.2 Screen: the waiting mail, raised at the topic's opening before anything
else. Its contents are drawn by Claude in the spec in the existing design
system, marked as Claude's. [R13; Claude's derivation, O94]

Screen, drawn by Claude: the waiting mail, raised at the topic's opening. [Claude's derivation, O94]

```text
1 message waiting — raised before anything else

From Commercialization · 16 Oct
The licence window carries a "Lost your key?" link
  ↳ Their reasoning: a buyer setting up a new Mac meets the
    licence window with no key to hand, and the link takes them
    to the Merchant of Record's key lookup rather than to
    support.
  ↳ It bears on first run's licence step, which this topic owns.
```

10.4.3 Without the command, the menus show mail waiting, as today. [R13]

10.4.4 A message arriving at a topic can open a question on its map (9.5.2).
[R11]

### 10.5 What the sending conversation does not do

10.5.1 The sending conversation never visits the target topic: the target's
record and log would sit in the sending context for good and keep pulling the
conversation sideways. [R13]

10.5.2 No forked agent carries a message, since it carries the sender's lens.
[R13]

10.5.3 A fresh subagent that loads the target, writes the item in the target's
terms, takes the person's answer and lands it is held as a later fallback,
only if the one-command open still feels clunky. [R13]

## 10-S. Scenarios for §10

10.S1 Given a topic sends a message to another, then the message is one file in
the target's `topics/{topic}/mail/`, its path naming no phase, and the send's
report ends with `/workflow-start {work unit} {topic}` for the target.
(10.1.2, 10.1.3, 10.3.3, 10.3.4)

10.S2 Given the person types `/workflow-start {work unit} {topic}`, then that
topic opens as it would through the menus, mail or none. (10.3.1, 10.3.2)

10.S3 Given a topic with mail waiting, when it opens, then the mail is raised
first. (10.4.1, 10.4.2)

10.S4 Given a target topic already in session, when a message lands, then the
target raises it from its loop. (10.1.5)

10.S5 Given a topic with mail waiting, when the person views the epic menu, then
the topic's row shows mail waiting and no row shows "triage waiting". (10.1.7,
10.4.3)

10.S6 Given topic A's conversation finds that topic B's decision should change,
then A sends B a message with its reasoning and writes no entry replacing B's;
B's session writes the replacing entry. (10.1.1, 10.2.1, 10.2.2)

10.S7 Given topic A reaches the same answer to a decision topic B owns, then no
second entry is written and B's entry stands. (10.2.3)

10.S8 Given topic B replaces a decision topic A's record shows, then A's record
shows B's current answer with no stale copy to correct. (10.2.4)

10.S9 Given entries in a decided topic relied on an answer another topic
replaced, then that topic shows among what waits on the person until it records
"still holds" or a replacement for each. (10.2.6)

10.S10 Given a message to a decided topic, then the topic reopens through its
mailbox: it shows mail waiting and is no longer decided until its session
raises and answers the message. (10.2.7)

10.S11 Given a topic with mail waiting is cancelled, then its waiting mail moves
to the inbox. (10.1.6)

10.S12 Given a topic sending a message, then the sending conversation does not
load the target's record or log and no forked agent is dispatched to carry the
message. (10.5.1, 10.5.2)

10.S13 Given a postponed topic, when a message is sent to it, then the message
waits in its mailbox and is raised first when the topic returns; given a
cancelled topic, the message goes to the inbox and the sending session says so
in one line. (10.1.8)

## 11. Specification

### 11.1 What the spec is

11.1.1 The specification (the spec) is the build's working document: the
document the build reads. The ledger is the source of truth (§5). The spec stays, rather than the build working from the records alone,
because building from records alone is a bigger reasoning step. [R14; ruled by
the person 2026-10-14]

11.1.2 The knowledge base indexes the records drawn from the ledger, never the
spec (§22 §22). [R14; ruled by the
person 2026-10-14]

11.1.3 A finished spec is kept as history and never corrected (11.9). [R14;
ruled by the person 2026-10-14]

11.1.4 The spec is one file, `spec.md`, in the work unit's folder: the areas,
then the phase cut at its end (§4 §4). [Layout
on disk; R14]

11.1.5 The spec and the phase cut are each written by a named agent whose model
and effort are fixed in its own definition, working from the record and not
the conversation, which also tests that the record holds everything (§26). [R46; agreed by the person 2026-10-19]

11.1.6 A bugfix writes this same spec, with no rule of its own; a quick-fix has
no spec (§19 §19). [R20; ruled by the person 2026-10-16; R21; Layout
on disk]

### 11.2 When the spec is written

11.2.1 A work unit's spec waits until every topic is decided, cancelled or
postponed. Postponing a topic to the roadmap is how an epic moves on without
it. [R17; ruled by the person 2026-10-12; plan 3.5]

11.2.2 Once every topic is decided and before the spec, one sweep across all
the records looks for what falls between topics (§8 §8), and the
read for conflicting answers covers the whole project's current entries in the
areas the work touches (§5 §5). [R10; R23]

### 11.3 One spec per work unit, assembled by area

11.3.1 There is one spec per work unit, and no grouping step. An epic has one
spec and one build. [R14; ruled by the person 2026-10-14; Open, One build
across an epic; ruled by the person 2026-10-14]

11.3.2 The spec is written in sections by area, each section assembled from its
topics' records: assembly, not archaeology. [R14; ruled by the person
2026-10-14]

11.3.3 The sections stay by area; each phase of the cut names the sections it
draws on (11.5.4). [R14; ruled by the person 2026-10-15]

11.3.4 Today's spec construction goes: exhaustive extraction from the
discussion documents, a gate per topic, and tracking files proving each source
item incorporated. [R14; ruled by the person 2026-10-14]

11.3.5 Where the spec needs to know why a decision was made, it reads the
topic's log; a why missing from the log is a gap, decided as any gap at the
spec is (11.7.2). [R11; ruled by the person 2026-10-13]

11.3.6 The spec has no size limit: no job needs the whole spec read at once.
[Open, One build across an epic; ruled by the person 2026-10-14]

11.3.7 Left to the builder: whether what planning's set-up writes today (the
plan's context) moves to the spec or to the phase start. [R15; Claude's
engineering note]

11.3.8 Left to the builder: how the spec's areas are chosen, by the spec
agent's judgement. [Claude's sort, B29]

### 11.4 Every statement traces to an entry

11.4.1 Every statement in the spec cites the ledger entry it comes from (§5) or is marked the builder's. [R14; ruled by the person 2026-10-13]

11.4.2 A statement with no source is invented, and the spec's review finds it
mechanically. [R14; ruled by the person 2026-10-13]

11.4.3 The spec marks what it leaves to the builder: only what the matrix makes
the builder's, recorded as such (§16 §16). [R14]

11.4.4 Left to the builder: how a spec statement is marked the builder's; it
cites the "don't care" entry. [Claude's sort, B28]

### 11.5 The phase cut

11.5.1 The spec ends with the phase cut, made in a corridor at the end of
specification. Planning splits: the phase cut moves into specification, and
tasks are written as each build phase starts (12.5). [R14; R15; R2; R9]

11.5.2 The cut lists the phases in build order, each an independently
verifiable slice with acceptance criteria written as scenarios. [R14; R15]

11.5.3 A phase's acceptance criteria are its test list: every acceptance
criterion has a test (§15 §15). [R14; R33]

11.5.4 For each phase the cut lists its scenarios, the spec sections it draws
on, and what it relies on from earlier phases or from another work unit.
[R14; ruled by the person 2026-10-15; plan 3.5]

11.5.5 The cut orders every phase across the work unit, so a phase goes
straight into the tracker and whoever writes its tasks reads the sections the
cut names for it (12.5.6). [R14; R15; ruled by the person 2026-10-15 and
2026-10-16]

11.5.6 For an epic, the cut is made from an outline of the sections and the
dependency graph the ledger's relies-on links give. [Open, One build across an
epic; ruled by the person 2026-10-14]

11.5.7 The cut follows the principles for breaking up work in 12.3.
[R15; ruled by the person 2026-10-12]

### 11.6 Invariants and canonical assets

11.6.1 Each invariant in the spec names the hard check that enforces it — an
architecture test, a lint, an import-graph rule — where one can, so the
decision holds even for builders who never read the record. [R14; R34]

11.6.2 An invariant no check can enforce says so: the ready-to-build checklist
holds every invariant naming a check or saying none can (§6, the checklists). [plan 6.4; Claude's]

11.6.3 Canonical assets are linked from the spec: the builder cannot build a
design it has not seen. Canonical assets are those kept in the unit's
`assets/` as canonical (§9 §9, spikes). [R14; R12]

### 11.7 The review

11.7.1 The spec's review hunts gaps: fidelity to the records, contradictions
between topics, and the undecided detail the build would otherwise meet.
[R14; ruled by the person 2026-10-13]

11.7.2 The matrix answers what the review finds. A gap found at the spec is
decided at the spec: mostly by Claude's call, sometimes by the person, as the
ask rule sends it (§16 §16). [R14; ruled by the person 2026-10-13]

11.7.3 A gap that reaches the person is put in product terms, never by spec
section number. [R14; ruled by the person 2026-10-13]

11.7.4 Each gap's answer is written as an entry in the topic it belongs to, so
the record stays the source. [R14; ruled by the person 2026-10-13]

11.7.5 Gaps found at the spec are gaps discussion missed; the measures show
where they arise (§17 §17). [R14; R36]

11.7.6 A re-review reads only what changed, without asking the person whether
to go again, and the review stops when a pass changes nothing. [R14; ruled by
the person 2026-10-13]

11.7.7 Today's re-review cycle goes: each cycle rereading the whole spec, and
the question to the person whether to run another. [R14]

11.7.8 The review is run by the spec reviewer, one of the workflows' own agents,
from a brief the engine issues (§6 §6, briefs). [plan 6.5;
Claude's]

11.7.9 The spec's review also holds the spec against the code. It re-runs each
measurement the spec's found entries record, and reads the code behind every
product guarantee the spec states. A fact shown wrong is replaced (5.3.7), and
the decisions relying on it are affected (5.6). [today's product; Claude's sort,
T28]

### 11.8 Ready to build

11.8.1 Ready to build is the spec's gate, raised once per spec. It is an
authority gate and is never automatic (§3). [R14; R40; ruled by the person 2026-10-13]

11.8.2 Screen: Ready to build shows the short outline and the phase cut, and
offers the build's position, auto first (11.8.6), and the person's review of
the spec (11.11). What the short outline
holds, and the screen's rows and words, are drawn by Claude with the spec's
screens, in the existing design system, and marked as Claude's for the person
to tick or comment on. [R14; R15; R40; Claude's derivation, O94]

Screen, drawn by Claude: ready to build over Mint's Token-Aware Diff Sizing, a feature, so decided shares its screen (11.8.5). [Claude's derivation, O94]

```text
Token-Aware Diff Sizing — decided, and ready to build

WHAT YOU DECIDED (12)
  ├─ The lean default AI command
  ├─ Quotes respected in ai_command
  ├─ One size cap per AI call
  ├─ Exclusion lists per verb
  ├─ Oversized notes made in chunks
  ├─ Halving after an overflow under the cap
  ├─ The remediation floor
  ├─ --notes-file for notes you write
  ├─ One non-AI body, and no [release].fallback
  ├─ Chunked notes at the review gate
  ├─ Progress lines while chunks run
  └─ 180 seconds for release calls, 60 for commit

CLAUDE'S CALLS (40)
  19 behaviour · 12 words · 9 internals

FOR THE PRODUCT RECORD (2 lines)
  · No AI call is sent more than its size cap: a diff over it is
    split into chunks, never cut.
  · Every way an AI call can fail says what failed and what to do
    next.

THE OUTLINE (18 sections)
  ├─  1 Purpose and Scope
  ├─  2 The Lean Default AI Command
  ├─  3 Quote-Aware ai_command Parsing
  ├─  4 The Per-Call Size Cap
  ├─  5 Per-Verb Exclusion Lists
  ├─  6 The Exclusion Check
  ├─  7 Routing a Release's Notes
  ├─  8 Chunked Generation
  ├─  9 Failure Classification
  ├─ 10 Halving After an Under-Cap Overflow
  ├─ 11 Failures in a Chunked Run
  ├─ 12 The Remediation Floor
  ├─ 13 --notes-file
  ├─ 14 One Non-AI Body: Dropping [release].fallback
  ├─ 15 Chunked Notes at the Review Gate and in the Dry-Run Cache
  ├─ 16 Progress Narration
  ├─ 17 mint commit's AI-Failure Output
  └─ 18 Documentation and the Setup Guide

THE PHASE CUT (8 phases · 610 scenarios)
  ├─ 1 Lean default AI command and quote-aware parsing
  │     38 scenarios · draws on §2, 3, 4, 17, 18
  ├─ 2 Per-call size cap and chunked release notes
  │     77 scenarios · draws on §1, 4, 6, 7, 8, 10, 11, 12, 15,
  │     16, 17, 18
  ├─ 3 `--notes-file` and one non-AI body
  │     51 scenarios · draws on §6, 7, 11, 12, 13, 14, 18
  ├─ 4 Failure classification, halving and saved chunk notes
  │     101 scenarios · draws on §1, 4, 8, 9, 10, 11, 12, 13, 15,
  │     16, 17, 18
  ├─ 5 The remediation floor
  │     100 scenarios · draws on §1, 2, 6, 8, 9, 10, 11, 12, 13,
  │     14, 15, 16, 17, 18
  ├─ 6 Chunked notes at the review gate and in the dry-run cache
  │     81 scenarios · draws on §1, 2, 4, 6, 7, 8, 9, 10, 11, 12,
  │     13, 15, 16, 18
  ├─ 7 Per-verb exclusion lists and the exclusion check
  │     109 scenarios · draws on §2, 4, 5, 6, 7, 9, 10, 12, 13,
  │     14, 15, 16, 17, 18
  └─ 8 Recording exclusion answers
        53 scenarios · draws on §5, 6, 7, 9, 11, 12, 13, 14, 15,
        16, 18

· · · · · · · · · · · ·
Your pick marks Token-Aware Diff Sizing decided, with the two
product-record lines, approves the outline and the phase cut,
and starts the build in that position.

◆ Build it, and in which position?

a/auto   → Auto — runs on its own; danger stops what it
           touches, a question for you parks only what depends
           on it, and finish waits for you (recommended)
s/step   → Step — it also stops after each task, for you to
           review and test it
r/review → Review the spec on a page first — all of it, the
           parts you care about, or none
c/calls  → See Claude's 40 calls
Comment  → Ask for a change — to what you decided, a
           product-record line, the outline or the phase cut
```

11.8.3 The person approving the phase cut as a short outline, at ready to
build, is the one gate before building. [R15]

11.8.4 Ready to build replaces today's construction, finding, re-loop and
sign-off gates. [R14]

11.8.5 A topic's close is decided (§9 §9). For a feature, decided
and ready to build are one screen. [R14; R19; R40; plan 3.5]

11.8.6 The build's position, auto or step, is chosen once at ready to build,
auto by default (§3 §3). [R40; ruled by
the person 2026-10-15; plan 3.2]

11.8.7 Other areas place their own checks at ready to build: the ready-to-build
checklist (§6 §6), the drivers checking their needs (see
§7 Tasks, landing and their drivers), and, at the first ready to build, the
project's environment setup and linters (§22). [plan 6.4; plan 9.2; R34]

### 11.9 A concluded spec is never corrected

11.9.1 A concluded spec is never corrected. A later change replaces the entry
on the ledger, and the entries that relied on it are flagged in the work that
made the change (§5 §5). [R14; R23; ruled by the person
2026-10-14]

11.9.2 The corrigendum and the spec's re-index go. [R14]

### 11.10 An epic's size

11.10.1 An epic's size is never capped by a number. Size costs in two softer
ways — the read across for seams nobody linked, and the outline the person
approves at ready to build — so splitting an epic is a judgement, which Claude
raises as a question to the person whenever either grows unwieldy. [Open, One
build across an epic; ruled by the person 2026-10-14; Claude's derivation,
O39]

11.10.2 The ledger's link graph shows where an epic splits cleanly: groups of
topics linked within, with little between. [Open, One build across an epic;
ruled by the person 2026-10-14]

11.10.3 A split moves topics not yet started, or part of a topic's questions as
a new topic, to a next epic on the roadmap; the project ledger keeps every link
working. The topics that move go to the roadmap as postponements through
discovery, on a horizon the person names. [Open, One build across an epic;
ruled by the person 2026-10-14; Claude's derivation, O39]

11.10.4 Discovery shapes an epic by judgement, never a formula. The roadmap is
the level above: its epics are the versions, and no new layer is added (§8, §18). [Open, One build across an epic; ruled by
the person 2026-10-14]

### 11.11 The person's review of the spec

11.11.1 Ready to build offers the person a review of the spec, and makes plain
that it is optional: they can check all of it, the parts they care about, or
none, and skipping it is as good a way through as taking it. [ruled by the
person 2026-10-22]

11.11.2 Taking it publishes the spec as a page and opens it: a private artifact
on claude.ai, not a board panel, with a tick and a comment on every numbered
line, the lines resting on Claude's calls marked, filters, and each section's
progress. It is the page this release's own spec was reviewed on, as it is.
[ruled by the person 2026-10-22; marking Claude's calls from who decided each
entry, Claude's derivation]

11.11.3 The spec numbers its sections, statements and scenarios, so each mark
hangs on a number. A number never changes while the review runs: a line added
takes the next free number in its section. [Claude's derivation]

11.11.4 The person can stop at any time and ask at any time. Claude answers a
comment beneath its line, and a tick on a line Claude answered agrees the
answer. [ruled by the person 2026-10-22]

11.11.5 Claude reads the page's comments when the person asks: once the page
is open, ready to build's review row reads them, as a word in the conversation
does. [Claude's derivation]

11.11.6 An agreed answer that changes what the spec decides is written as an
entry in the topic it belongs to, decided by the person, and the spec is
rewritten from it, as a gap's answer is (11.7.4); an answer that changes only
the wording changes the spec. The page is republished with every mark kept.
[Claude's derivation]

11.11.7 Picking the build's position ends the review. Each ticked line is
recorded as approved by the person; every line not ticked is carried through
implicitly: it stands, but nobody said yes to it. [ruled by the person
2026-10-22]

Screen, drawn by Claude: the foot of ready to build over Mint's Token-Aware Diff Sizing while the review page is open; the rest as 11.8.2's screen. [Claude's derivation]

```text
· · · · · · · · · · · ·
Your pick marks Token-Aware Diff Sizing decided, with the two
product-record lines, approves the outline and the phase cut,
records the 214 lines you ticked on the review page (the other
862 pass without review), and starts the build in that
position.

◆ Build it, and in which position?

a/auto   → Auto — runs on its own; danger stops what it
           touches, a question for you parks only what depends
           on it, and finish waits for you (recommended)
s/step   → Step — it also stops after each task, for you to
           review and test it
r/review → Read the comments you've left on the page
c/calls  → See Claude's 40 calls
Comment  → Ask for a change — to what you decided, a
           product-record line, the outline or the phase cut
```

11.11.8 A position picked while a comment on the page has no answer does not
start the build: Claude answers the comment first and puts ready to build
back. [Claude's derivation]

11.11.9 The review's record is written beside the spec as `spec-review.md`, by
line number: what the person approved explicitly, what they approved after a
comment, any comment still open, and what passed without review. A comment
answered but never ticked leaves its line as written and is listed open. A
spec the person did not review has no record. [ruled by the person 2026-10-22;
where it sits and its name, Claude's derivation]

11.11.10 In this release the marks feed nothing else: the trust matrix does not
read them (27.1.2). [ruled by the person 2026-10-22]

11.11.11 Where the session cannot publish a page, ready to build does not offer
the review. [Claude's derivation]

11.11.12 Left to the builder: how the page is built from the spec and how its
marks are read back, starting from the page and scripts this release's own
spec was reviewed with. [Claude's sort]

## 11-S. Scenarios for §11

11.S1 Given an epic with three topics decided and one neither decided,
cancelled nor postponed, when Claude would start the specification, then no
spec is written; when that topic is postponed to the roadmap, then the spec
can be written. (11.2.1)

11.S2 Given an epic whose every topic is decided, when the spec is written,
then there is one `spec.md` for the unit, written by the spec's named agent,
in sections by area, each assembled from its topics' records, with no
grouping step, no gate per topic and no tracking files proving incorporation.
(11.1.4, 11.1.5, 11.3.1, 11.3.2, 11.3.4)

11.S3 Given a written spec, when any statement in it is read, then it cites a
ledger entry or is marked the builder's. (11.4.1, 11.4.3)

11.S4 Given a spec statement that cites no entry and is not marked the
builder's, when the spec's review runs, then the review reports it as
invented. (11.4.2)

11.S5 Given a written spec, when its end is read, then it carries the phase
cut: phases in build order, each listing its scenarios, the sections it draws
on, and what it relies on from earlier phases or another work unit; the
sections above it stay by area. (11.3.3, 11.5.1, 11.5.2, 11.5.4, 11.5.5)

11.S6 Given a phase in the cut, when the phase is built, then every acceptance
scenario it lists has a test. (11.5.3)

11.S7 Given an epic whose ledger holds relies-on links between its topics'
entries, when the cut is made, then it is drawn from an outline of the
sections and the dependency graph those links give. (11.5.6)

11.S8 Given an invariant whose rule an architecture test can hold, when the
spec is written, then the invariant names that test; given one no check can
hold, then the invariant says so. (11.6.1, 11.6.2)

11.S9 Given a spike kept in `assets/` as canonical, when the spec is written,
then the spec links it. (11.6.3)

11.S10 Given the spec's review finds two topics' records contradicting each
other, when the matrix makes it Claude's call, then the answer is written as
a ledger entry in the topic it belongs to and the person is not asked; when
the ask rule sends it to the person, then it is put in product terms with no
spec section numbers. (11.7.1, 11.7.2, 11.7.3, 11.7.4)

11.S11 Given a review pass that changed two sections, when the next pass runs,
then the spec reviewer, dispatched from a brief the engine issued, reads only
those two sections and the person is not asked whether to run it; when a pass
changes nothing, then the review stops. (11.7.6, 11.7.7, 11.7.8)

11.S12 Given the spec's review has stopped, when ready to build is raised, then
it shows the short outline and the phase cut, once, the build's position is
chosen there with auto as the default, and no construction, finding, re-loop
or sign-off gate was raised before it. (11.8.1, 11.8.2, 11.8.4, 11.8.6)

11.S13 Given ready to build is waiting, when the person has not said yes, then
no build starts. (11.8.1, 11.8.3)

11.S14 Given a feature whose topic closes, when its spec is ready, then decided
and ready to build show as one screen. (11.8.5)

11.S15 Given a concluded spec, when a later change replaces one of its entries,
then `spec.md` is unchanged, no corrigendum is written and the spec is not
re-indexed, the ledger holds the replacing entry, and the entries that relied
on the old one are flagged in the work that made the change. (11.9.1, 11.9.2,
11.1.3)

11.S16 Given a completed topic's record and a concluded spec, when the knowledge
base is queried, then the record can be returned and the spec never is.
(11.1.2)

11.S17 Given an epic of any size, when its spec is written and its build runs,
then nothing refuses it for its size and no job reads the whole spec at once.
(11.3.6, 11.10.1)

11.S18 Given an epic whose outline at ready to build has grown unwieldy, when
Claude sees it, then Claude raises the split as a question to the person; when
the person takes the split, then topics not yet started (or part of a topic's
questions, as a new topic) go to the roadmap as postponements through
discovery, on the horizon the person names, toward a next epic, and every
ledger link still resolves. (11.10.1, 11.10.2, 11.10.3)

11.S19 Given a bugfix whose investigation has concluded, when its spec is
written, then it has the same shape as any spec, ending with the phase cut;
given a quick-fix, then no `spec.md` is written. (11.1.6)

11.S20 Given a decided entry whose why the topic's log does not hold, when the
spec is assembled, then the missing why is decided as a gap at the spec.
(11.3.5, 11.7.2)

11.S21 Given a spec whose found entry records a measuring command, and a product
guarantee the spec states, when the spec's review runs, then it re-runs the
command and reads the code behind the guarantee; given the measured value has
changed, the fact is replaced and the decisions relying on it are affected.
(11.7.9)

11.S22 Given ready to build, when it shows, then it offers a review of the spec
on a page and says the person can check all of it, the parts they care about,
or none; given the person picks a position without taking it, then the build
starts with no page published and no review record written. (11.11.1, 11.11.9)

11.S23 Given the person takes the review, when the page opens, then every
numbered statement, scenario and screen of the spec is a line with a tick and
a comment, the lines resting on Claude's calls are marked, and each section
shows its progress. (11.11.2, 11.11.3)

11.S24 Given a comment left on a line, when the person picks the review row or
says so in the conversation, then Claude answers it beneath the line; given the
person then ticks that line and the answer changes what the spec decides, then
the answer is written as an entry decided by the person in the topic it belongs
to, the spec is rewritten from it, and the page is republished with every mark
kept and every number unchanged. (11.11.3, 11.11.4, 11.11.5, 11.11.6)

11.S25 Given a comment on the page with no answer, when the person picks a
position, then the build does not start: Claude answers the comment and ready
to build comes back. (11.11.8)

11.S26 Given a review with some lines ticked, one comment answered but not
ticked, and the rest untouched, when the person picks a position, then
`spec-review.md` beside the spec lists the ticked lines as approved explicitly,
the one comment as open with its line left as written, and the rest as passed
without review, and the trust matrix's counts are unchanged. (11.11.7, 11.11.9,
11.11.10)

11.S27 Given a session that cannot publish a page, when ready to build shows,
then it offers no review. (11.11.11)

## 12. The build

### 12.1 One orchestrator

12.1.1 Claude orchestrates the build: one orchestrator runs the build across
all its phases. [R15; ruled by the person 2026-10-12]

12.1.2 The orchestrator delegates rather than does: a task-writer agent writes
each phase's tasks, builder agents implement, and reviewer agents review, run
as pairs (§13 §13). Its own context grows slowly, so
compactions are rare. Each of those agents has its model and effort fixed at
medium in its own definition, never chosen per slice (§26). [R15; ruled by the person 2026-10-12; plan 3.6; Claude's
derivation, O42]

12.1.3 The build's orchestration stays in the main session, at the person's
effort (§26 §26). [R46; agreed by the person
2026-10-19]

12.1.4 A review sits between every slice and its merge (§13). [R15]

12.1.5 The build never hands off at a phase boundary: a handoff guarantees a
lossy reset. [R15; ruled by the person 2026-10-12]

12.1.6 When a compaction comes, the recovery note names the build log and
where the phase stands (§24 §24). [R15; R35]

12.1.7 The workflows carry the build's shape in their own prose,
self-contained; they never depend on a personal skill. [R15]

### 12.2 The build log

12.2.1 The build keeps a log, appended as it goes: what is in flight, what was
tried and dropped, and what a phase left for the next. [R15; ruled by the
person 2026-10-12]

12.2.2 The build log is read after a compaction and when a build resumes,
beside the ledger, which keeps holding Claude's calls. [R15; ruled by the
person 2026-10-12]

12.2.3 The build log is one of the kept artifacts, at `build/log.md` in the
work unit's folder (§4 §4). [R42; Layout on
disk]

### 12.3 How work is broken up

12.3.1 Six principles and the task template (12.4) replace planning's
teaching. [R15; ruled by the person 2026-10-12]

12.3.2 Principle 1. Every phase ends with the product running and its new
behaviour reachable. The builder proves it by running it (§15), and the phase review checks that proof. No phase leaves work
unwired for a later one to join up. [R15; R32; ruled by the person 2026-10-12]

12.3.3 Principle 2. The first phase gets the product running and drivable — it
launches, a smoke check passes, the verify setup exists — and sets the pattern
later work copies. It need not touch every layer; on an existing product it is
the first capability. [R15; ruled by the person 2026-10-12]

12.3.4 Principle 3. Shared ground first, then parallel: a design several tasks
touch is settled, and the code they share is built by one agent, before work
fans out; parallel tasks each own their files; work on a shared file runs one
task at a time. [R15; ruled by the person 2026-10-12]

12.3.5 Principle 4. Cut by what someone can do, not by layer, as far as the
product allows; where it is too interconnected, cut so the pieces meet as
early as they can. [R15; ruled by the person 2026-10-12]

12.3.6 Principle 5. A task is one piece of work an agent can finish and prove
in one go — not a single test cycle, and not a grab-bag of unrelated changes.
A task likely to run past about 10,000 changed lines is probably two. There is
no lower bound. [R15; agreed by the person 2026-10-15; plan 3.6]

12.3.7 Principle 6. Tasks are written at the phase start against the code, at
product altitude, naming no mechanism the record did not decide. [R15; ruled
by the person 2026-10-12]

12.3.8 The workflows' prose never instructs the builder to break a task down,
keep its own to-do list, check its own work, or finish rather than leave
stubs: the Claude 5 generation does these unprompted, and instructing it
backfires (telling it to verify makes it over-verify). [R15]

### 12.4 The task template

12.4.1 Every task uses the task template: problem, solution, outcome,
acceptance criteria as scenarios, and spec reference. [R15]

12.4.2 A task names no mechanism the record did not decide. [R15]

### 12.5 Writing a phase's tasks

12.5.1 A phase's tasks are written when the phase starts, in a short
corridor, against the code the previous phase left. [R15; R2]

12.5.2 They are recorded through the engine's task verbs (§7), with their dependencies and which of them can run
in parallel, before anything in the phase runs. [R15; R35]

12.5.3 The task writer records each task through the task verb as it goes, one
call per task, never a file it rewrites whole. [R15; agreed by the person
2026-10-19]

12.5.4 The task verb takes the task's text from a file, so no one types it
twice. [R15; agreed by the person 2026-10-19]

12.5.5 A gap the task writer finds is decided like any other gap (§16) and changes only the tasks it touches. The writer never re-runs the
phase. [R15; agreed by the person 2026-10-19; R4]

12.5.6 The task writer reads in full the spec sections its phase draws on,
which the phase cut names, never the whole spec, and reads further wherever it
meets a seam. [R15; agreed by the person 2026-10-19; plan 3.6; R14; ruled by
the person 2026-10-15; Claude's derivation]

12.5.7 The task writer runs Opus at medium, fixed in its own definition: never
chosen by the orchestrator, and never raised by a phase's size or difficulty.
[R15; ruled by the person 2026-10-19; plan 3.6]

12.5.8 No second pass runs over a phase's tasks once the writer has written
them. [R15; agreed by the person 2026-10-19; plan 3.6]

12.5.9 What the task writer misses, the builder meets with the code in front of
it, and it takes the route any gap takes: the builder's call to the ledger, or
the person's question while other tasks run on (12.13). The reviewers then
hold the code to it. [R15; agreed by the person 2026-10-19]

12.5.10 The measures record where each gap was found (§17 §17). [R15;
R36]

12.5.11 Shared design is settled first: a design question several tasks touch
is settled when the tasks are written, never by two builders separately.
[R15]

### 12.6 Dependencies

12.6.1 Inside a work unit the machinery between specs goes: the Dependencies
section, its states, the check at a build's start, and the build order.
[R15; ruled by the person 2026-10-16]

12.6.2 The phase cut orders every phase across the unit, each phase naming what
it relies on, another work unit's delivery included. The build checks another
work unit's delivery before the phase that relies on it starts. [R15; ruled by
the person 2026-10-16]

12.6.3 A phase starts once what it relies on is done. [R15; ruled by the
person 2026-10-16]

12.6.4 A phase's tracker links are set as its tasks are written: within the
phase, and onto unfinished tasks of earlier phases. [R15; ruled by the person
2026-10-16]

12.6.5 The plan-wide rebuild of every task link and priority, and its
approval, go. [R15; ruled by the person 2026-10-16]

12.6.6 The next task still comes from the tracker's dependencies, and the
orchestrator runs ready tasks side by side where they share no files. [R15;
ruled by the person 2026-10-16]

12.6.7 The build reads the phase cut before treating "nothing ready" as
finished, so a phase not yet written is never taken for a finished one (§7). [R15; ruled by the person 2026-10-16]

12.6.8 Left to the builder: what "another unit's delivery is done" checks
before a phase relying on it starts. [Claude's sort, B31]

### 12.7 Scheduling

12.7.1 Claude schedules: the order of work, parallel worktrees, subagents, and
merging back. The engine has no scheduler. [R15; plan 3.6]

12.7.2 The task-loop display shows progress rather than driving each step.
[R15]

12.7.3 Parallel tasks each run in their own worktree and are merged back by the
orchestrator; work on a shared file runs one task at a time. [Open, One build
across an epic; ruled by the person 2026-10-14]

12.7.4 What cannot run concurrently in a project (tests sharing a port or a
database) is recorded in its environment setup, so no build relearns it (see
§22 Setup, environment and the knowledge base). [R15]

12.7.5 Phases overlap where they can: a phase that relies on nothing
unfinished may start whenever Claude schedules it, and one that relies on the
one before waits for its merge. Starting while the one before is in its phase
review is the usual overlap, not a floor. The tasks' dependencies and the
ledger's links say which. [Open, One build across an epic; ruled by the person
2026-10-14; Claude's derivation, O35]

12.7.6 Each phase is a stack of its tasks' pull requests, merged whole once its
phase review passes (§7 §7). [Open, One
build across an epic; R35; ruled by the person 2026-10-18]

12.7.7 The orchestrator plans ahead and pulls work forward as it sees fit,
through the task tracker. [Open, One build across an epic; ruled by the person
2026-10-14]

12.7.8 A build, the review phase and a quick-fix's work take turns in one
checkout, whatever unit or topic the other session sits in. Entering one while
another session holds the checkout's code shows today's stop, naming that
session and when it was last active, with yes to go on anyway and back to
return. The review phase leaves the working tree as it found it: dirt outside
`.workflows/` after its runs stops for the person and is never reverted blind.
[today's product (`code-session-gate.md`,
`invoke-change-set-verifiers.md:96–116`); Claude's sort, T25]

### 12.8 How the builder works

12.8.1 No red-green loop is prescribed. Tests are written from the acceptance
criteria in any order, and their adequacy is checked by outcome (§15). [R15; R33; plan 3.6]

12.8.2 Code quality is held by boundaries — where things live and belong —
through the project's rules and hard checks (§15 §15). [R15;
R34]

12.8.3 The builder's calls go to the ledger (§5 §5). [R15]

12.8.4 A question the ask rule sends the person waits in the build's queue
while other tasks run on, never as a gate, and is raised in full once the
person says they are ready (12.13); the build carries on once it is answered.
[R15]

### 12.9 The doors

12.9.1 No code change without a task. [R15; ruled by the person 2026-10-16]

12.9.2 When something outside the plan turns up — a bug the person reports, a
gap the builder finds — Claude judges where it goes, and it lands through a
verb, one per door:
- a task in this phase or a later one;
- a note for later (12.10);
- a ledger entry: a call, or a question for the person through the ask rule;
- a message to another unit's topic still in discussion;
- the inbox;
- the roadmap.
A decision in the unit's own record that must change is replaced in the ledger
where it is found, never sent as a message; replacing one the person decided
always asks them (16.5.7).
[R15; ruled by the person 2026-10-16 and 2026-10-21; plan 3.6; Claude's
derivation, O34]

12.9.3 A find never corrects the spec: one that bears on a decision lands as a
ledger entry. [R15; R14]

12.9.4 Each door is an engine verb, one per destination. Today only the topic
send and the roadmap add are verbs; the rest of the doors are prose and direct
manifest writes, which go (§6 §6). [R15; plan 3.6]

12.9.5 An agent that finds something outside its task reports it, and the
orchestrator lands it through the doors. [R15; plan 3.6]

12.9.6 The commit door refuses a code commit that names no task, so nothing is
fixed off the books (§6 §6). [R15; R35; plan 3.6]

12.9.7 Comment corrections fold into the task in flight. [R15]

12.9.8 A raw `git commit` during a build is refused by the hook (§6). [R15; R35]

12.9.9 A quick-fix is its own task, so the commit door takes it without a plan
(§19 §19). [R21]

12.9.10 Left to the builder: how a find for a phase not yet written is held
until that phase's tasks are written. [Claude's sort, B30]

### 12.10 Notes for later

12.10.1 Notes for later are today's banking, kept as it works today. [R15;
ruled by the person 2026-10-15]

12.10.2 A note is deposited as it arrives, into the unit's `build/notes.md`
(§4 §4). [R15; Layout on disk]

12.10.3 At the phase's end, today's consolidation agent reads every note
against the phase's finished code, analyses, groups and de-duplicates them,
and drops what the code already settled, with its reason. [R15; ruled by the
person 2026-10-15]

12.10.4 The notes not dropped become tasks in the same phase, built through
the same loop. [R15; ruled by the person 2026-10-15]

### 12.11 The phase review

12.11.1 One independent phase review closes each phase. [R15; ruled by the
person 2026-10-16]

12.11.2 It covers each task's criteria, the phase's coherence, what should be
consolidated, and where the phase meets what it relies on from earlier
phases, which the phase cut names, so a fault between phases is found as the
next phase closes, before more is built on it. [R15; ruled by the person
2026-10-16]

12.11.3 Its fixes land before the phase closes. [R15; ruled by the person
2026-10-16]

12.11.4 Who runs the phase review and how its findings are handled is in §13
Reviews in the build. [R15; Reviews in the build]

### 12.12 What the person sees during the build

12.12.1 The build runs start to finish unattended, stopping only where the
shape says it must; a stop for good reason is a good outcome, not a failure.
[R15; agreed with the person 2026-10-12]

12.12.2 What the person sees during the build is engine-drawn, the same
whatever order Claude works in. [R15; agreed with the person 2026-10-12]

12.12.3 The story of the build stays in the transcript. [R15; ruled by the
person 2026-10-16]

12.12.4 Screen: the headline, printed as work starts. For each task it shows
the task's title, its number, its phase, what it is about to change, and what
to watch when it lands. Tasks started together share one block, never one
block each. [R15; ruled by the person 2026-10-16]

12.12.5 Screen: the landing summary, printed when a task lands: its product
summary — what changed, which criteria its tests prove, what running the product
proved, its proof a press away on the task's page on the board (15.2.14), the
reviewer pair's verdict and its rounds, and how many calls went to the ledger —
and beneath it, every time, the questions waiting on the person: how many, then
a line for every one of them, the list growing with the questions. [R15; ruled
by the person 2026-10-16 and 2026-10-20; the person 2026-10-12; Claude's
derivation, O36]

Screen, drawn by Claude: the landing summary of Mint's task 6.1, with the questions waiting beneath it. [Claude's derivation, O94]

```text
▪ `r` on chunked notes re-runs only the merge (task 6.1)

✓ Landed — its reviewer pair passed it in 2 rounds · 3 calls
  went to the ledger

WHAT CHANGED
  At the review gate, r on chunked release notes now runs only
  the merge again: the chunk notes stay as they were, and the
  merged notes come back to the gate.

ITS TESTS PROVE (3)
  ├─ r at the review gate re-runs only the merge
  ├─ The merged notes come back to the review gate
  └─ A failed merge on r keeps the chunk notes

RUNNING MINT PROVED 2 OF 3
  └─ △ Not proven: a failed merge on r keeps the chunk notes
  ↳ The proof is on 6.1's page on the board.

2 QUESTIONS WAITING FOR YOU
  ├─ ⚑ Q1 Every abort at the review gate unwinds · parks 6.7
  └─ ⚑ Q2 A failed re-merge at the gate · parks 6.8 and 2 more
```

12.12.6 Review reports are not printed: they go to the builder, the
orchestrator keeps the verdict, and the person reaches them through the task's
account (12.14). [R15; ruled by the person 2026-10-16]

12.12.7 Whether a gate follows a task is the phase's position: in step, the
gate after each task stops, carrying the task's account and diagrams as today
(12.14.3); in auto there is none, and the person meets only danger, the
authority gates and the questions the ask rule parks (12.12.8, 12.13; see §3
Stages, phases, gates and positions). [R15; R40; Claude's derivation, O52]

12.12.8 Danger and the authority gates stop what depends on them in every
position. [R15; R40]

12.12.9 Screen: the stop report, printed when nothing can proceed: what was
built, what waits on the person and why, and what runs after the answer, with
the questions waiting front and centre. [R15; agreed with the person
2026-10-12; ruled by the person 2026-10-20]

12.12.10 Every output agreed for the transcript — the headline, each landing's
summary with the questions waiting beneath it, the stop report — stays there
whether or not the build panel is open, so the person sees the waiting
questions without the panel. The panel is an addition the build
never depends on: the build reaches the person in full without it (§20). [R15; ruled by the person 2026-10-19 and 2026-10-20;
plan 3.6]

12.12.11 The build's phases and tasks, each with its state and what blocks it,
are printed into the conversation whenever the person asks in words; the board's
build view shows them too (20.5.1, 20.5.2). [R15, R6; Claude's derivation, T23]

### 12.13 Questions waiting on the person

12.13.1 In the build, a question for the person goes out only through the
engine's doors; one asked in plain prose is a slip the prose walks catch (see
§25 Prose tests and the test suites). [R2; plan 2.2; ruled 2026-10-19]

12.13.2 A task that needs the person parks, with whatever depends on it, and
everything else carries on. [R15; ruled by the person 2026-10-20]

12.13.3 Claude says so in one line in the transcript. [R15; ruled by the
person 2026-10-20]

12.13.4 As the task parks, the engine appends the question to the project's
ledger: what it asks, why it needs the person, its options with Claude's lean,
and the task it parks. [R15; R23; ruled by the person 2026-10-20]

12.13.5 The person's answer, "I don't follow" included, is recorded through
the engine's `raise` verb and appended to the ledger as a line of its own; the
board spike's `question` tool stands in for it. [R15; agreed with the person
2026-10-20; Claude's derivation, O38]

12.13.6 What waits is the questions with no answer yet: a projection of the
ledger, like the verdict queue, never a file. [R15; agreed with the person
2026-10-20; Layout on disk]

12.13.7 Every surface that shows waiting questions reads them from that
projection — the build panel, the waiting lines under each landing, the stop
report, the start menu's count (§18 §18) — so nothing
waiting on the person lives only in the conversation, and a compaction or a
new session finds it whole. [R15; agreed with the person 2026-10-20]

12.13.8 Not built in this release: a surface other than the conversation (the
panel, an app outside Claude Code) recording an answer through the verb, with
the session's mod telling Claude it arrived. [R15; the person 2026-10-20]

12.13.9 A waiting question never stands as a gate: a build can run ten hours
or more while the person is away, and a gate raised hours and several
compactions earlier is answered without context. [R15; ruled by the person
2026-10-20]

12.13.10 The person says when they are ready to talk about one question, or all
of them — in their own words, or from the build panel — and Claude raises it
then, in full and product first, from the work as it stands, while the other
tasks carry on. [R15; ruled by the person 2026-10-20]

12.13.11 On the panel, saying so takes two steps: a press queues a question in
a Ready to discuss box at the panel's foot, and nothing reaches the
conversation until the person sends the queue, as one message, in the order
they queued it (§20 §20). [R15; ruled by the person
2026-10-21]

12.13.12 "Discuss all" queues the rest of the waiting questions as the panel
lists them, oldest first. [R15; ruled by the person 2026-10-21]

12.13.13 A press never raises a question at once, since that would put a raise
into Claude's context the person may never have meant to have; and the queue
is never staged in the prompt box. [R15; ruled by the person 2026-10-21]

12.13.14 The panel never answers a question; it is the person's way of saying
they are here and ready to give their attention. [R15]

12.13.15 Claude takes the questions one at a time, recording each through the
verb. [R15; ruled by the person 2026-10-21]

12.13.16 Screen: the receipt, `raise`'s answer when a question is recorded:
one line, in the one format §20 draws — what became of the question, how many
still wait, and the next to raise. Claude shows it as it is. [R15; ruled by the
person 2026-10-21; Claude's derivation, O38]

12.13.17 Skipping a question, or cancelling the rest, is done on the banner
and on the board, as the locked board draws them: "▸ skip", and "▸ cancel" or
"▸ cancel all" (§20 §20). Each puts one line in the
conversation, so Claude hears it and the discussion closes in the record; each
question skipped or cancelled stays waiting, recorded through `raise` as set
aside. [R15; ruled by the person 2026-10-21; the person 2026-10-19 and
2026-10-20; Claude's derivation, O37]

12.13.18 Screen: a raised question whose options are clear product end states
ends on the engine's gate: the options as rows with the recommended one first,
and Comment beside them, as an executor block's gate does today. [R15; agreed
with the person 2026-10-20]

12.13.19 A raised question that is open ends in conversation. Anything typed at
the gate sets it aside, as at any gate. [R15; agreed with the person
2026-10-20]

12.13.20 That gate is raised only once the person has said they are ready, with
the question's context right above it. [R15]

12.13.21 A question left half-answered stays waiting, in the ledger and on the
panel. [R15]

12.13.22 When nothing left can proceed without an answer, the build stops with
its report (12.12.9) and the questions still wait for the person. The build
never concludes over a waiting question. [R15; plan 3.6]

12.13.23 Questions stay inside the build, in every work type that builds: once
the build has started, a question never takes the work back to the epic menu.
[R15; ruled by the person 2026-10-19]

### 12.14 The task's account

12.14.1 Any task's account is printed into the conversation whenever the
person asks for it in words, at any time, for any task however long ago, and
the task's page on the board shows the same account. It ships in the release.
[R15; the person 2026-10-15; ruled by the person 2026-10-19; the person
2026-10-20; Claude's derivation, O41]

12.14.2 Screen: a task's account — the task's description and the account
Claude wrote, which holds diagrams where Claude draws them — printed into the
conversation when the person asks for it; the task's page on the board shows
the account as written (§20 §20). Nothing on the board
sends it into the conversation. [R15; plan 3.6; the person 2026-10-15 and
2026-10-20; Claude's derivation, O41]

12.14.3 In step, the task's description, account and diagrams stay on each
task's gate, as today. The gate's rows and words are drawn by Claude with the
spec's screens, in the existing design system, and marked as Claude's for the
person to tick or comment on. [R15; Claude's derivation, O94]

Screen, drawn by Claude: the task's gate in step, its account above it. [Claude's derivation, O94]

```text
▪ 180-second shipped release timeout (task 1.4)

✓ Passed its review — 2 rounds, 1 finding fixed

- Phase: 1 — Lean default AI command and quote-aware parsing
- Position: 4 of 6 in phase

WHAT IT DOES
  With no timeout configured, a hung release-notes call fails
  after 180 seconds and a hung commit call after 60. An explicit
  timeout at either level still wins. Every surface that states
  the shipped timeout names both values.

WHAT WAS DONE
  With no timeout set at any level, a release-notes call now gets
  180 seconds per attempt before it fails as `AI timed out`, and
  a `mint commit` call keeps 60. `mint release regenerate
  <version>` from a fresh source gets the 180 seconds too. A
  `timeout` under `[release]` or `[commit]`, or a shared one,
  still wins. The README, `mint setup`'s config reference and its
  AI-transport paragraph now name both defaults, and the
  `[commit]` `timeout` row reads `shared, else 60` as well, which
  the task did not ask for.
  · internal/config/config.go: DefaultReleaseTimeout (180s) and
    DefaultCommitTimeout (60s) replace DefaultTimeout
  · internal/config/config.go: TimeoutFor falls to the verb's own
    floor; defaults() no longer seeds a shared 60s
  · internal/config/metadata.go: shared timeout row names both
    defaults; verb rows read `shared, else N`
  · README.md, internal/setupguide/setupguide.go: every stated
    timeout default names 180 and 60
  · 8 new tests check the deadline each call site gets (180s
    release and regenerate, 60s commit, 90s overrides) and every
    doc surface; 7 config and metadata tests rewritten for
    per-verb floors, 1 dropped
  ✓ Proves 6 criteria · 18 files changed · +331 −185

DIFFERS FROM THE TASK (3)
  △ With no .mint.toml, mint no longer writes a shared 60s
    timeout into the config, so the 180s and 60s defaults apply
    there too. The task's Context pointed at this; its Do did not
    name the edit.
  △ The [commit] timeout rows in the README and the config
    reference now read "shared, else 60". The task asked only for
    the release and shared rows.
  △ No test waits out a real 180-second hang: the tests read how
    much time the call's deadline leaves, through a new
    DeadlineRemaining on the test runner.

· · · · · · · · · · · ·
◆ Approve this task?

y/yes       → Approve it and continue to the next task
t/technical → Retell the result from the code's perspective
s/show      → Show the result as diagrams
Ask         → Ask questions about the task (doesn't approve or
              reject)
Comment     → Request changes
```

12.14.4 Claude writes the account as the task lands, into the task's file
beside the task as written; the file is the unit's `build/tasks/{task}.md`
(§4 §4). [R15; agreed with the person
2026-10-21; Layout on disk]

12.14.5 The account holds what was done, in product terms; where in the code;
what the tests prove; and every way the work differs from the task —
something done that the task never asked for, or something done another way.
[R15; agreed with the person 2026-10-21; plan 3.6]

12.14.6 As the task lands, Claude also writes a short summary of each review
round and stores it with the task's account, so the panel's page for the task
can show it (§20 §20). [R15; the person 2026-10-19; plan
3.6]

12.14.7 Each review round's two full reports are kept beside the task's
account, a press away on the task's page on the board. Where they are kept is
the builder's. [R15; Claude's derivation, O40]

12.14.8 Left to the builder: which agent writes a task's account and its round
summaries, the orchestrator taking no more of a report than the verdict and
nits. [Claude's sort, B27]

12.14.9 Left to the builder: whether `build/tasks/{task}.md` copies the task as
written or sits beside the tracker's copy. [Claude's sort, B32]

### 12.15 One build across an epic

12.15.1 Once every topic of an epic is decided and its spec is ready to build,
the person says "implement" once, and that is the ready-to-build yes (11.8):
Claude orders the work across the spec, breaks it up however suits the whole
epic, runs through the review phase, and reports when everything is fully
reviewed (§14 §14). [Open, One build across an epic; raised
by the person 2026-10-14; Claude's derivation, O42]

12.15.2 A question that needs the person parks what depends on it, and Claude
carries on with everything else (12.13). [Open, One build across an epic;
R15]

12.15.3 The epic is in one phase at a time; the epic menu names it once at the
top, and its rows carry no phase (§18 §18). [Open, One
build across an epic; the person 2026-10-14]

12.15.4 A decision that has to change after discussion is over is settled where
it is found, in the phase the epic is in. The epic never goes back to
discussion: the ledger records the change, and whatever was written or built on
the old answer is reworked by tasks. Replacing a decision the person made always
asks them (16.5.7). [Open, One build across an epic; ruled by the person
2026-10-14 and 2026-10-21]

## 12-S. Scenarios for §12

12.S1 Given the person's yes at ready to build, when the build runs, then one
orchestrator in the main session runs every phase with no handoff at any phase
boundary, and the task writer, builders and reviewers run as agents, each at
the medium effort its own definition fixes, none chosen per slice. (12.1.1,
12.1.2, 12.1.3, 12.1.5)

12.S2 Given a task built by a builder agent, when the slice is merged, then a
review ran between the slice and its merge. (12.1.4)

12.S3 Given a build in progress, when the build log is read, then it holds what
is in flight, what was tried and dropped, and what each finished phase left for
the next. (12.2.1, 12.2.3)

12.S4 Given a compaction mid-build, when the session carries on, then the
recovery note names the build log and where the phase stands, and the
orchestrator reads the log beside the ledger and carries on. (12.1.6, 12.2.2)

12.S5 Given the first phase of a build on a new product, when it closes, then
the product launches, a smoke check passes and the verify setup exists.
(12.3.3)

12.S6 Given any phase, when it closes, then the product runs with the phase's
new behaviour reachable, the builder has proven it by running it, and the
phase review checked that proof. (12.3.2)

12.S7 Given a phase starts, when the task writer runs, then it records each
task through the task verb, one call per task, the text taken from a file,
each with problem, solution, outcome, acceptance criteria as scenarios and
spec reference, with its links and which tasks can run in parallel, before
any builder starts; no task names a mechanism the record did not decide.
(12.3.7, 12.4.1, 12.4.2, 12.5.1, 12.5.2, 12.5.3, 12.5.4)

12.S8 Given the task writer meets a gap partway through a phase's tasks, when
the gap is decided, then only the tasks it touches change and the phase's
tasks are not rewritten. (12.5.5)

12.S9 Given a phase whose cut names two sections, when the task writer is
dispatched, then it reads those two sections in full and never the whole spec,
reading further only where it meets a seam, and it runs Opus at medium
whatever the phase's size. (12.5.6, 12.5.7)

12.S10 Given a phase's tasks are written, when the phase runs, then no second
pass reviews or rewrites the task list. (12.5.8)

12.S11 Given a builder meets an edge its task does not settle, when it is the
builder's call, then the call lands in the ledger; when it needs the person,
then the task parks and other tasks run on. (12.5.9, 12.8.3, 12.8.4)

12.S12 Given an epic whose earlier specs had Dependencies sections, when the
build runs, then no Dependencies section, its states, the check at a build's
start, or a build order appears, and no plan-wide link rebuild or its approval
is raised. (12.6.1, 12.6.5)

12.S13 Given a phase that relies on another work unit's delivery not yet done,
when the build reaches it, then the phase does not start; when that delivery
is done, then it starts. (12.6.2, 12.6.3)

12.S14 Given a phase's tasks are written, when the tracker's links are read,
then each runs within the phase or onto an unfinished task of an earlier
phase. (12.6.4)

12.S15 Given two ready tasks sharing no files, when the orchestrator takes
them, then they run side by side, each in its own worktree, and are merged
back by the orchestrator; given two tasks on one shared file, then they run
one at a time. (12.3.4, 12.6.6, 12.7.1, 12.7.3)

12.S16 Given the tracker reports nothing ready while the cut holds a phase not
yet written, when the orchestrator checks, then the build does not finish and
that phase is not taken for a finished one. (12.6.7)

12.S17 Given phase 2 relies on nothing unfinished and phase 3 relies on phase
2, when Claude schedules phase 2 while phase 1 is still being built, then
phase 2 starts without waiting for phase 1's phase review, and phase 3 waits
until phase 2's stack is merged. (12.6.3, 12.7.5, 12.7.6)

12.S18 Given a project whose tests share a port, when a build learns it, then
it is recorded in the project's environment setup and a later build does not
run them concurrently. (12.7.4)

12.S19 Given the person reports a bug mid-build, when Claude places it, then
it lands through exactly one verb: a task in this or a later phase, a note
for later, a ledger entry, a message to another unit's topic still in
discussion, the inbox or the roadmap; and the spec is unchanged. (12.9.1,
12.9.2, 12.9.3, 12.9.4)

12.S20 Given a builder reports a find outside its task, when the orchestrator
reads the report, then the orchestrator lands it through one of the doors.
(12.9.5)

12.S21 Given a code change during a build, when it is committed naming no task,
then the commit door refuses it; when a raw `git commit` is run, then the hook
refuses it. (12.9.6, 12.9.8)

12.S22 Given a comment correction found during a task, when it is made, then it
lands in the task in flight's commit, not a commit of its own. (12.9.7)

12.S23 Given notes for later deposited during a phase, when the phase ends,
then the consolidation agent reads them against the phase's finished code,
drops those the code settled with a reason each, and the rest become tasks in
the same phase, built through the same loop. (12.10.1, 12.10.2, 12.10.3,
12.10.4)

12.S24 Given a phase whose last task has passed its pair, when the phase
closes, then one phase review has run over the phase, including where it meets
what it relies on from earlier phases, and its fixes landed before the close.
(12.11.1, 12.11.2, 12.11.3)

12.S25 Given three tasks started together, when the headline prints, then one
block names all three, each with its title, number, phase, what it is about to
change and what to watch when it lands. (12.12.3, 12.12.4)

12.S26 Given two questions wait on the person, when a task lands, then its
summary shows what changed, which criteria its tests prove, what running the
product proved with its proof a press away on the board, the pair's verdict
and rounds and how many calls went to the ledger, and beneath it the two
questions' count and a line each; no review report is printed. Given five
questions wait, then the count reads five and each of the five has a line.
(12.12.5, 12.12.6)

12.S27 Given a build in step, when each task lands, then the gate after it
stops, carrying the task's account and diagrams; given auto, then no gate
follows any task, and a task whose question the ask rule sends the person
parks instead. (12.12.7, 12.13.2)

12.S28 Given a build in auto, when a task meets a danger question, then the
task and what depends on it stop. (12.12.8)

12.S29 Given the build panel was never opened, when a build runs to its end,
then the headline, every landing's summary with the waiting questions beneath
it, and any stop report were all printed in the transcript. (12.12.10)

12.S30 Given a task needs the person, when it parks, then what depends on it
parks too, other tasks carry on, Claude says so in one line, no gate is
raised, and the ledger holds the question with what it asks, why, its options
with Claude's lean and the task it parks. (12.13.2, 12.13.3, 12.13.4, 12.13.9)

12.S31 Given a question waiting, when a compaction happens or a new session
starts, then the panel, the lines under the next landing, the stop report and
the start menu's count all still show it. (12.13.6, 12.13.7)

12.S32 Given two waiting questions, when the person presses each on the panel,
then nothing reaches the conversation; when the person sends the queue, then
one message arrives naming both in the order pressed; when the person presses
"discuss all", then every remaining question is queued oldest first; at no
point does the panel offer a way to answer a question. (12.13.11, 12.13.12,
12.13.13, 12.13.14)

12.S33 Given the person says in their own words they are ready to talk about a
question, when Claude raises it, then it is raised in full and product first
from the work as it stands, while the other tasks carry on. (12.13.10)

12.S34 Given a raised question whose options are clear product end states, when
it is raised, then it ends on the engine's gate with the recommended option
first and Comment beside them, its context right above; when the person types
instead, then the gate is set aside. (12.13.18, 12.13.19, 12.13.20)

12.S35 Given the person answers a raised question, "I don't follow"
included, when Claude records it through `raise`, then the ledger gains the
answer as a line of its own, and `raise`'s one-line receipt — what became of
it, how many still wait, the next to raise — is shown as it is. (12.13.5,
12.13.15, 12.13.16)

12.S36 Given a queue of three questions, when the person presses "▸ skip" on
one, or "▸ cancel all", on the banner or on the board, then one line appears
in the conversation, the discussion closes in the record, and each question
skipped or cancelled still waits, recorded through `raise` as set aside.
(12.13.17)

12.S37 Given a question raised and left half-answered, when the conversation
moves on, then it still waits in the ledger and on the panel. (12.13.21)

12.S38 Given every remaining task depends on an unanswered question, when the
orchestrator finds nothing can proceed, then the build stops with its report —
what was built, what waits on the person and why, what runs after the answer,
the questions front and centre — and the build does not conclude. (12.12.9,
12.13.22)

12.S39 Given an epic's build with a question waiting, when the build runs on,
then the epic menu never comes back for it; the question stays in the build.
(12.13.23)

12.S40 Given a task that landed earlier in the build, when the person asks for
its account in words, then Claude prints it into the conversation: the task's
description and the account, with any diagrams Claude drew in it, saying what
was done, where in the code, what the tests prove, and each way the work
differs from the task; when the person opens the task's page on the board,
then the same account is there as written, and nothing is printed into the
conversation. (12.14.1, 12.14.2, 12.14.4, 12.14.5)

12.S41 Given a build in step, when a task's gate is raised, then the task's
description, account and diagrams are on it. (12.14.3)

12.S42 Given a task that took two review rounds, when it lands, then its file
holds the account and a short summary of each round. (12.14.4, 12.14.6)

12.S43 Given an epic whose every topic is decided and whose spec is ready to
build, in auto, when the person says "implement" as the ready-to-build yes
and no task needs the person, then the build runs through every phase and the
review phase and reports when everything is fully reviewed. (12.15.1, 12.15.2)

12.S44 Given an epic in its build, when a decision in its own record is found
that has to change, then the ledger records the replacement where it is found,
no message is sent to any topic, tasks rework what was built on the old
answer, and the epic does not go back to discussion. (12.9.2, 12.15.4)

12.S45 Given two tasks of a phase that touch one design question, when the
phase's tasks are written, then the question is settled as they are
written, and neither builder settles it on its own. (12.5.11)

12.S46 Given the build's prose, when it is read, then it names no personal
skill, prescribes no red-green loop, and never instructs the builder to break
a task down, keep a to-do list, check its own work, or finish rather than
leave stubs. (12.1.7, 12.3.8, 12.8.1)

12.S47 Given a prose walk of a build in which Claude asks the person a
question in plain prose, when the walk is asserted, then it fails. (12.13.1)

12.S48 Given an epic in its build, when its menu is shown, then the phase is
named once at the top and no row carries a phase. (12.15.3)

12.S49 Given a task that took two review rounds, when the person opens its page
on the board, then each round's two full reports are a press away. (12.14.7)

12.S50 Given one session building a unit, when another session in the same
checkout enters the review phase of another unit, then it shows today's stop,
naming the building session and when it was last active, with yes to go on
anyway and back to return. (12.7.8, 14.1.5, 19.5.18)

12.S51 Given a build under way, when the person asks in words for its phases and
tasks, then they are printed into the conversation, each task with its state and
what blocks it. (12.12.11)

## 13. Reviews in the build

### 13.1 Three reviews

13.1.1 The build has three reviews, each with its own job: one after each task, over the task; one closing each build phase, over the phase's whole diff; and the review phase at the end, over the whole change against the spec, running the product (§14). Each catches serious bugs the others miss. [Reviews in the build; agreed in shape by the person 2026-10-15; R16; plan 3.7]

13.1.2 Review layers go from five to three: the review after each task, the phase review and the review phase. Today's five are the per-task reviewer, the phase consolidation finder, the analysis loop's three agents run until all come back clean, review's per-task verifiers and its per-section change-set verifiers. [R16]

13.1.3 No review runs open-ended rounds, since a reviewer reading code returns a full list every time. Changed code is read again until the pair passes it (13.4); extra assurance otherwise goes into verification (§15) and, for slices where a subtle bug passes the tests (time, concurrency), into tests aimed at that risk. [R16]

13.1.4 A task is reviewed whole. The phase review splits a large change by area; the review phase is split by the spec's areas (14.2). [Reviews in the build; R16]

13.1.5 What the phase review reads beyond the phase's diff, and that its fixes land before the phase closes, are specified under The build (§12). [R15, R16]

13.1.6 Left to the builder: what makes a phase's change large enough for the phase review to split it, and by which areas. [Claude's sort, B36]

### 13.2 The reviewer agent

13.2.1 Every review is done by the workflows' own reviewer agent. It is fresh: never the agent that wrote the code, never the orchestrator's own read of a diff, and never Claude Code's built-in `/code-review`. [Reviews in the build; ruled by the person 2026-10-15; plan 3.7]

13.2.2 The reviewer reads the diff, the task's criteria, its spec section and the ledger's decided calls, and runs the tests. [Reviews in the build; ruled by the person 2026-10-15]

13.2.3 The reviewer agent is built from today's task reviewer and what worked in Switchboard's reviewer brief. [Reviews in the build]

### 13.3 The pair

13.3.1 Every review is two independent reviewer agents run side by side: the pair. Their model and effort are specified under Agents, models and effort (§26). [Reviews in the build; ruled by the person 2026-10-15; plan 3.7]

13.3.2 The same pair reviews again after a serious finding. [Reviews in the build; ruled by the person 2026-10-15]

13.3.3 Left to the builder: how "the same pair" is kept as the same two reviewer agents, continued. [Claude's sort, B34]

### 13.4 The task loop

13.4.1 Every finding a reviewer reports carries a user scenario and a call: serious, a real bug that is not serious, or a nit (13.6, 13.7). [Reviews in the build; ruled by the person 2026-10-15]

13.4.2 Every finding but a nit goes back to the same builder with both reviewers' reports. [Reviews in the build; ruled by the person 2026-10-15; plan 3.7]

13.4.3 Changed code is reviewed again, whole, by the pair, until a round passes with nothing serious and no bug. There is no count of rounds. [Reviews in the build; ruled by the person 2026-10-15; plan 3.7]

13.4.4 A round with only nits passes. [Reviews in the build; ruled by the person 2026-10-15]

13.4.5 A nit is mechanical with no ripple: a comment, a name, a test's wording. The orchestrator fixes it there and then, reading the nit from the report, with no trip back to the builder and no review round, so the tasks after it build on the fixed code. The phase review reads the fix. [Reviews in the build; the person 2026-10-15; plan 3.7]

13.4.6 A task stops looping only when a finding it already fixed comes back. It then parks with a report while the rest of the build runs, as any parked task does: one line in the transcript as it parks, its report kept with the task's account, and the task shown in the stop report if the build stops (a parked task: see §12, §12). [Reviews in the build; ruled by the person 2026-10-15; Claude's derivation, O51]

13.4.7 The gate after each task stops in step, carrying the task's account and diagrams as today, and never in auto, where the person meets only danger, the authority gates and the questions the ask rule parks (a phase's position, auto or step: see §3 and The build, §12). Task approval and the fix gate go with their loops. [R16, R40; R15; Claude's derivation, O52]

### 13.5 A failed review, met as a senior engineer would

13.5.1 A failed review is met as a senior engineer would, between two extremes, taking neither: fixes kept small and covering only the places a finding names, which leaves ripples unchecked; and starting again, which reworks a sound build into variations that raise decisions and stop the build for the person. [Reviews in the build; ruled by the person 2026-10-15; plan 3.7]

13.5.2 The starting point is that the work stands — the decisions are made, the spec written, the plan made — and a finding is often a plain oversight. [Reviews in the build; ruled by the person 2026-10-15]

13.5.3 The builder weighs each finding professionally: its cause, whether it is the symptom of a deeper fault, and the right fix, which is often the simple one. Where its design and its build hold, it stands by them. [Reviews in the build; ruled by the person 2026-10-15]

13.5.4 Whatever the fix's size, before it lands the builder checks the edge cases around it and whether it disturbs the design, the architecture, the data model, the plan, later phases' plans, or the considerations behind any decision. [Reviews in the build; ruled by the person 2026-10-15]

13.5.5 A gap the builder finds beyond the task goes to the notes for later or through the ask rule (§16); a find by an agent is landed by the orchestrator (§12). [Reviews in the build; plan 3.6]

13.5.6 The reviewer reviews the task as a professional would, never one small thing. [Reviews in the build; ruled by the person 2026-10-15]

13.5.7 Every builder and reviewer brief carries the stance in 13.5.1–13.5.6, so each agent is equipped to do the job well and pushed to neither extreme. [Reviews in the build; ruled by the person 2026-10-15]

13.5.8 Where the two reviewers disagree, or the builder rejects a finding, the builder decides against the brief and the design and says why. The next round reads the whole task again, so a wrongly rejected finding comes back. A product question in it goes through the ask rule (§16). [Reviews in the build; ruled by the person 2026-10-15]

13.5.9 The orchestrator takes the verdict and a report's nits, never the rest of the reports. [Reviews in the build; ruled by the person 2026-10-15]

13.5.10 The workflows own both briefs, the builder's and the reviewer's, and keep improving them: the builder and the reviewer work as a team. [Reviews in the build]

13.5.11 Left to the builder: the report format that lets the orchestrator take only the verdict and the nits. [Claude's sort, B35]

### 13.6 The serious call

13.6.1 A finding is serious unless its scenario needs an item from the edge list and the report names that item. [Reviews in the build; ruled by the person 2026-10-15; plan 3.7]

13.6.2 A scenario built only from ordinary use is serious, however many of its parts combine. [Reviews in the build; ruled by the person 2026-10-15]

13.6.3 Left to the builder: the edge list's content and home — the replay's labelling rubric, carried into the reviewer template. [Claude's sort, B33]

### 13.7 The target and the three kinds of finding

13.7.1 The target is product quality against cost and time: no serious bugs, real bugs that are not serious fixed too, and nits fixed as they are found. [Reviews in the build; the person 2026-10-15]

13.7.2 A finding is one of three kinds: serious; a real bug that is not serious; a nit. [Reviews in the build; the person 2026-10-15]

13.7.3 Serious findings and real bugs that are not serious go through the task loop (13.4). [Reviews in the build; the person 2026-10-15]

13.7.4 A nit is fixed in the moment and never kept for the phase's end, where the code built on it since could make the fix wrong or harder. [Reviews in the build; the person 2026-10-15]

### 13.8 Notes for later

13.8.1 The notes for later hold what lies outside the task: improvements, and holes and edge cases beyond the task's boundary. Banking stays as it works today. [Reviews in the build; ruled by the person 2026-10-15; R15; plan 3.7]

13.8.2 A wrong result in what the task's work does is always a finding, even when its fix reaches beyond the task. [Reviews in the build; ruled by the person 2026-10-15]

13.8.3 At the phase's end a separate agent, today's consolidation agent, reads the notes against the phase's finished code, groups and de-duplicates them, and drops what the code settled, with its reason. [Reviews in the build; R15; plan 3.7]

13.8.4 The notes that remain are written as tasks in the same phase and built in the same loop with their reviews, so a gap a reviewer saw never falls between scopes. [Reviews in the build; R15; plan 3.7]

### 13.9 Comments are never the standard

13.9.1 The reviewer judges code against the brief and the design, never against its comments. [Reviews in the build; ruled by the person 2026-10-15; plan 3.7]

13.9.2 Where a comment and the code disagree and the code matches the brief, the comment is adjusted. Where the comment is right and the code wrong, the brief and the design show it. Where the brief and the design do not settle it, it is a decision, taken as the build takes any decision (§12). [Reviews in the build; ruled by the person 2026-10-15]

13.9.3 A wrong comment is not a finding and starts no review: the reviewer points it out as a nit, and the orchestrator fixes it in the task in flight. [Reviews in the build; ruled by the person 2026-10-15; R15]

### 13.10 Fixes are reviewed by the layer above

13.10.1 Fixes are reviewed by the layer above, never by a round of their own: a task's fixes by its pair (the task loop); a phase review's fixes by the review phase; the review phase's own fix tasks through the task loop, with each area they changed read again whole by its pair (14.3.3). [Reviews in the build; ruled by the person 2026-10-15 and 2026-10-16; R16; plan 3.7]

### 13.11 Brief control

13.11.1 Every brief the workflows give their own agents — builders, reviewer pairs, the task writer, discussion's readers, the migration's agents and verifiers — comes from a template the workflows own, filled by the engine from the records and handed over unchanged. [Brief control; raised by the person 2026-10-15, ruled 2026-10-18; plan 3.7]

13.11.2 The records a template is filled from are the task, its spec sections, the ledger's decided calls, the diff, earlier reports verbatim, and the project's linters (6.5.4). Where the templates live, the verb that fills and issues them, and the roster of agents are specified under The engine's doors (§6) and Agents, models and effort (§26). [Brief control; ruled 2026-10-18; plan 6.5]

13.11.3 Anything else an agent should know goes onto the task through the task verbs, or into the ledger when it is a decision, marked as the orchestrator's or the person's, before the dispatch. What goes there is the person's instruction, a fact about the code the task was written before, or an answer to the builder's question. [Brief control; ruled 2026-10-18; plan 3.7]

13.11.4 No addition to a task or the ledger sets an agent's approach, focus or size. [Brief control; ruled 2026-10-18]

13.11.5 Reviewers read the task, so they see every addition and judge the work against it. Nothing reaches a reviewer any other way. [Brief control; ruled 2026-10-18]

13.11.6 Fix rounds carry the two reviewers' reports verbatim and nothing of the orchestrator's. The orchestrator takes only the verdict and the nits it fixes. [Brief control; ruled 2026-10-18; plan 3.7]

13.11.7 The builder never edits its task. [Brief control; ruled by the person 2026-10-19; plan 3.7]

13.11.8 The orchestrator edits tasks in place of ad hoc messages to the builder. [Brief control; ruled by the person 2026-10-19; plan 3.7]

13.11.9 The builder builds to the task. If it hits a problem, it stops and reports to the orchestrator, which decides what to do — raising it to the person by the ask rule, or stepping back and thinking it through — updates the task, and sends the builder back in. [Brief control; ruled by the person 2026-10-19; plan 3.7]

13.11.10 A feasible other way the builder takes on its own is recorded in the ledger as its call, and the reviewers pick it up. [Brief control; ruled by the person 2026-10-19; plan 3.7]

13.11.11 A hook refuses a dispatch of one of the workflows' agents whose brief the engine did not issue. Claude's other subagents are untouched. How the hook matches an issued brief is specified under The engine's doors (§6). [Brief control; ruled 2026-10-18; plan 3.7]

13.11.12 A refusal is recorded, so a template that keeps getting in the way is improved rather than worked around. [Brief control; ruled 2026-10-18]

13.11.13 Brief control stays deterministic while the restructure loosens procedure elsewhere, because a steered review reads like a passing one and the failure is invisible afterwards. [Brief control; ruled 2026-10-18]

13.11.14 The builder's and reviewers' templates say that the workflows' own references never go into the product's code or comments: task ids, phase numbers and spec sections. A reviewer meeting one returns it as a nit (13.9.3). Beyond that, quality is held by the project's own rules and checks (12.8.2). [R15, R34, record 1287; Claude's derivation, T17]

13.11.15 Left to the builder: whether the builder's template forbids changing a test to make code pass. A changed assertion the task did not ask for is already listed in the account (12.14.5) and read by the pair in the diff (13.2.2), and the template's wording is tuned by the brief-quality measurement (13.12.1). [Claude's sort, T62]

### 13.12 Brief quality, measured

13.12.1 Brief quality is a measurement: the same builder and reviewers run on a thin brief and on the full template, over the replay's Switchboard slices (`walks/build/replay/`). It tunes the templates. [Brief control; plan 8.4; Claude's proposal]

13.12.2 The measurement runs before the release, once the templates exist. [plan 8.4; Claude's, agreed]

13.12.3 Its cost is bounded by the replay's: $606 for 264 agents at API prices. [plan 8.4; Claude's, agreed]

13.12.4 Two tests run alongside it on the same slices: a habit hook (15.7), and the task-size test, the same work cut into tasks either side of the 10,000-line guide (a large task against the same work split in two), which moves where the guide sits (the guide: see §12, §12). Running the task-size test here is Claude's call. [Brief control; plan 8.4; Claude's proposal]

13.12.5 Left to the builder: what a thin brief is, and how the measurement changes a template. [Claude's sort, B44]

## 13-S. Scenarios for §13

13.S1 Given a task its builder reports built, when the task's review runs, then two reviewer agents run side by side, neither is the builder nor the orchestrator, Claude Code's `/code-review` is not invoked, and each reviewer reads the diff, the task's criteria, its spec section and the ledger's decided calls and runs the tests. (13.1.1, 13.2.1, 13.2.2, 13.3.1)

13.S2 Given a review round in which a reviewer reports a serious finding, when the round ends, then the same builder receives both reviewers' reports verbatim with nothing of the orchestrator's added, and once it has fixed the finding the same pair reviews the whole task again. (13.3.2, 13.4.2, 13.4.3, 13.7.3, 13.11.6)

13.S3 Given a review round that reports a real bug that is not serious, when the round ends, then the finding goes back to the builder, and the task does not pass until a round reports nothing serious and no bug, however many rounds that takes. (13.4.2, 13.4.3, 13.7.2, 13.7.3)

13.S4 Given a review round in which both reports carry only nits, when the round ends, then the round passes, the orchestrator fixes each nit itself in the task in flight, the builder is not sent back, and no further round runs. (13.4.4, 13.4.5, 13.7.4)

13.S5 Given a task whose latest round reports again a finding the builder fixed in an earlier round, when the round ends, then the task stops looping and parks with a report, Claude says so in one line in the transcript, the report is kept with the task's account, and the build's other tasks carry on; if the build later stops, the stop report shows the task. (13.4.6)

13.S6 Given a finding whose scenario combines several steps of ordinary use and whose report names no edge-list item, when its call is read, then it is serious; given a finding whose report names the edge-list item its scenario needs, then it is not serious. (13.6.1, 13.6.2)

13.S7 Given the two reviewers disagree about a finding, when the builder takes the reports, then it decides against the brief and the design and says why, and the next round reads the whole task again, so a finding it wrongly rejected is raised again. (13.5.8)

13.S8 Given a builder finds a gap beyond its task while fixing a finding, when it reports, then the gap lands as a note for later, landed by the orchestrator, or goes through the ask rule. (13.5.5)

13.S9 Given every builder and reviewer template, when read, then each carries the stance of a failed review met as a senior engineer would. (13.5.7, 13.5.10)

13.S10 Given a reviewer finds a comment that disagrees with code that matches the brief, when its report arrives, then the comment is listed as a nit, no finding is raised and no review round starts, and the orchestrator adjusts the comment in the task in flight. (13.9.1, 13.9.2, 13.9.3)

13.S11 Given a task's work returns a wrong result whose fix reaches beyond the task, when a reviewer reports it, then it is a finding that goes through the task loop. (13.8.2, 13.7.3)

13.S12 Given notes for later deposited during a phase, when the phase ends, then a separate agent reads them against the phase's code, drops those the code settled with a reason, groups and de-duplicates the rest, and those become tasks in the same phase, each reviewed through the task loop. (13.8.1, 13.8.3, 13.8.4)

13.S13 Given a phase review whose fixes have landed, when the build moves on, then no review round of their own runs over those fixes, and the review phase reads them. (13.10.1)

13.S14 Given the person tells Claude something a builder should know, when the builder is dispatched, then the addition is on the task, put there through the task verbs, or in the ledger marked as the person's when it is a decision, recorded before the dispatch, and the reviewers read it on the task. (13.11.3, 13.11.5)

13.S15 Given a dispatch of a builder, a reviewer, the task writer, one of discussion's readers or one of the migration's agents, when it is made, then its brief is the engine-filled template, unchanged; given the orchestrator dispatches any of the workflows' agents (the roster, §26) with a brief the engine did not issue, then the hook refuses it and the refusal is recorded; given it dispatches a subagent that is not one of the workflows' agents, nothing is refused. (13.11.1, 13.11.2, 13.11.11, 13.11.12)

13.S16 Given a builder hits a problem it cannot build past, when it stops, then it reports to the orchestrator without editing the task, and the orchestrator decides, updates the task and sends the builder back in, with no ad hoc message. (13.11.7, 13.11.8, 13.11.9)

13.S17 Given a builder takes a feasible other way on its own, when the task goes to review, then the ledger holds the way taken as the builder's call, and the reviewers' brief carries it among the ledger's decided calls. (13.11.10, 13.2.2)

13.S18 Given the templates exist and the release is not yet out, when the brief-quality measurement runs, then the same builder and reviewers run on a thin brief and on the full template over the replay's Switchboard slices, and a habit hook and the task-size test run on the same slices. (13.12.1, 13.12.2, 13.12.4)

13.S19 Given a build in step, when a task passes its pair, then the gate after it stops, carrying the task's account and diagrams; given a build in auto, then no gate follows the task; in neither position is a task-approval or fix gate raised. (13.4.7)

13.S20 Given a builder's and a reviewer's brief, when they are filled, then each template says the workflows' own references never go into the product's code or comments; given a diff whose comment names a task id, then a reviewer returns it as a nit. (13.11.14, 13.9.3)

## 14. The review phase

### 14.1 Its job

14.1.1 The review phase is the third review: the whole change-set held against the spec's intent by independent agents. [R16]

14.1.2 The review phase reads the ledger as a whole for calls that looked fine one phase at a time and are wrong in combination. [R16]

14.1.3 The review phase runs the product wherever the project has a way to (§15). What could not be run is reported not proven. [R16, R32; plan 3.10]

14.1.4 Left to the builder: which agent reads the ledger as a whole at the review phase. [Claude's sort, B37]

14.1.5 The review phase takes its turn in the checkout, and leaves the working tree as it found it (12.7.8). [today's product; Claude's sort, T25]

### 14.2 Split by the spec's areas

14.2.1 The review phase is split by the spec's areas, for an epic and every other type that has a review phase alike (which types have one: see §19, §19). The spec is written by area, so each area is a ready slice. [R16; ruled by the person 2026-10-16; plan 3.10]

14.2.2 Each area gets the pair every review gets (13.3), reading its area and where it meets the others, and running what touches it. [R16; ruled by the person 2026-10-16; plan 3.10]

14.2.3 The number of areas follows the spec. Today's merge down to four sections goes. [R16; ruled by the person 2026-10-16]

14.2.4 Today's test-surface agent stays: one reader over all the change's test files, held against everything the spec asks them to guard. [R16; the person 2026-10-19; plan 3.10]

14.2.5 Seams between phases are read earlier, by each phase review (§12). [R16; ruled by the person 2026-10-16]

14.2.6 An epic too big for one build is split on the roadmap into versions, each with its own review phase (§11). [R16, R14]

### 14.3 Every finding lands somewhere

14.3.1 Every finding lands somewhere. A finding below the floor, today's consequence floor, is dropped. [R16; Claude's derivation, O43]

14.3.2 In scope is in the work unit's delivered change-set, and out of scope is outside it, as today. A finding above the floor and in scope becomes a fix task. Each failing round's fix tasks are written as one more build phase and built in the same loop as everything else, the task loop reviewing each. Every fix phase lands at finish; how the driver chains them is the builder's. [R16; ruled by the person 2026-10-14; plan 3.10; Claude's derivation, O44, O46]

14.3.3 Once the fix tasks land, every area whose code they changed is read again whole by its pair, until a round passes with nothing serious and no bug, on the task loop's terms (13.4.3). An area nothing changed is not read again, and the whole change is not read against the spec once more. [R16; ruled by the person 2026-10-16; plan 3.10; Claude's derivation, O45]

14.3.4 The small fixes the review phase makes on the spot today become tasks too, since no code changes outside a task. [R16; ruled by the person 2026-10-14]

14.3.5 For findings out of scope, Claude drops what is not worth doing, groups related findings into one item, and files the rest to the inbox through a verb (§6). There is no keep-or-drop offer. [R16; ruled by the person 2026-10-14; plan 3.10]

14.3.6 The report lists what was filed to the inbox. A drop is neither raised nor listed. [R16; the person 2026-10-14; plan 3.10]

14.3.7 Each file-or-drop call is recorded in the ledger as a call Claude made, with its reason, and counted in the report's line of calls decided for the person, so any drop is one engine call away. [R16; ruled by the person 2026-10-14; plan 3.10]

14.3.8 The inbox is never flooded; this is the condition on which the person ruled that Claude files without an offer. It is kept by the ruling's own means, with no cap: Claude drops what is not worth doing and groups related findings, each call recorded and counted in the report (14.3.5, 14.3.7). [R16; ruled by the person 2026-10-14; Claude's derivation, O47]

### 14.4 The report

14.4.1 Screen: the review phase's report. It is short and product first, and shows: what the person can now do that they could not; what was proven by running it and what was not; what was fixed; what went to the inbox; and one line counting the calls decided for the person, by kind. [R16; ruled by the person 2026-10-14; plan 3.10]

14.4.2 The review phase's detailed checks are written to a file, not shown (where review reports are kept: see §4, §4). [R16; Layout on disk]

14.4.3 Screen: the report that closes a passing review phase. It covers the whole work unit: every round, broken up by round, and every call made for the person across the work unit, with the last build's share. It stands as the certificate of the work. [R16; plan 3.10; Claude's derivation, O48]

14.4.4 Screen: the calls, when the person asks to see them. They are grouped by kind, the ones that change what the product does first. [R16]

### 14.5 Finish

14.5.1 Screen: finish, the authority gate, after the review phase's report. It asks a verdict on each call the person changed in the build and the review phase (the verdict's options: see §16, §16), and invites questions about what was built, answering them before finishing. [R16, R23, R40; plan 3.10, plan 4.3]

### 14.6 The build runs straight into the review phase

14.6.1 The build runs straight into the review phase, in an epic too: implementation's conclude gate and the return to the epic menu between them go. [R16; ruled by the person 2026-10-14; plan 3.10]

14.6.2 A failing review's fix tasks and the rerun go on without stopping. The finish gate is the stop, and the epic menu follows it. [R16; ruled by the person 2026-10-14]

## 14-S. Scenarios for §14

14.S1 Given an epic whose build's last phase closes, when the build moves on, then the review phase starts with no conclude gate between them and no return to the epic menu. (14.6.1)

14.S2 Given a spec written in five areas, when the review phase runs, then five pairs run, each reading its area and where it meets the others and running what touches it, beside one test-surface reader over all the change's test files, and no areas are merged. (14.1.1, 14.2.1, 14.2.2, 14.2.3, 14.2.4)

14.S3 Given the review phase finds in-scope findings above the floor in two of five areas, when its round ends, then fix tasks are written as one more build phase and built through the task loop without stopping for the person, and once they land only the areas whose code they changed are read again, whole, by their pairs, until a round passes with nothing serious and no bug. (14.3.2, 14.3.3, 14.6.2, 13.10.1)

14.S4 Given a small fix the review phase would make on the spot, when it is made, then it is made as a task. (14.3.4)

14.S5 Given out-of-scope findings, when the review phase handles them, then Claude drops some, groups related ones into one item and files the rest to the inbox through a verb, with no keep-or-drop offer; the report lists what was filed and nothing dropped; and the ledger holds each file-or-drop call with its reason, counted in the report's line of calls decided for the person. (14.3.5, 14.3.6, 14.3.7)

14.S6 Given a review round closes, when its report is shown, then it shows what the person can now do, what was proven and what was not, what was fixed, what went to the inbox and one line counting the calls decided for the person by kind, and the detailed checks are in a file and not shown. (14.4.1, 14.4.2)

14.S7 Given a review phase that passes on its third round, when its closing report is written, then it covers the whole work unit: every round, broken up by round, and every call made for the person across the work unit with the last build's share. (14.4.3)

14.S8 Given the person asks to see the calls, when they are shown, then they are grouped by kind, the ones that change what the product does first. (14.4.4)

14.S9 Given the review phase has passed, when finish opens, then it asks a verdict on each call the person changed in the build and the review phase, and invites questions about what was built, answering them before finishing. (14.5.1)

14.S10 Given a scenario no drive could perform, when the review phase reports, then the report lists it under what was not proven. (14.1.3, 15.3.3)

14.S11 Given an epic whose review phase fails a round, when the fix tasks and the rerun run, then nothing stops for the person until the finish gate, and the epic menu follows the finish gate. (14.6.2)

14.S12 Given a review phase that fails two rounds, when each round's fix tasks are written, then each round's fix tasks form one more build phase of their own, and both fix phases land at finish. (14.3.2)

14.S13 Given the review phase's runs leave a file changed outside `.workflows/`, when they end, then the session stops for the person and reverts nothing. (14.1.5, 12.7.8)

## 15. Verification

### 15.1 Two kinds of trust

15.1.1 Trust in Claude's calls (strand B, §16) and trust in Claude's work are separate ladders. Verification is what lets the person stop reviewing work line by line. [R31; plan 7]

15.1.2 The workflows run the product. Today they never do: review's task verifiers read code and its change-set verifiers run linters and package tests. In the release the builder proves its work by running the product (15.2.14), and the review phase runs it (14.1.3). [R31, R32, R16; plan 7]

### 15.2 The verify setup

15.2.1 Each project has a verify setup, per project like the environment setup. [R32]

15.2.2 The verify setup is built the first time a build needs it, by interviewing the repository: what a user touches, how the product runs, how to drive it, what to observe, and whether instances isolate. [R32]

15.2.3 To build it, Claude studies the repository, then researches the current tools for that kind of product. The workflows give examples, never a fixed list, so the setup moves with the times. [R32]

15.2.4 The examples the workflows give, never prescriptions:
- a TUI run in a throwaway terminal through tmux or a pseudo-terminal, keys sent, the screen captured as text and compared, with recordings where the look matters and the project's own design generators;
- a tool built on tmux, run on a throwaway tmux server, killed and restarted for restore scenarios;
- web and Electron driven through the DevTools protocol;
- a router with no interface, stood up with stand-in upstreams and real requests asserted on where they went;
- a SaaS run locally against a test database and driven in the browser;
- a native macOS app launched and driven through the accessibility layer, which is harder, some of it possibly staying not proven;
- iOS on the simulator with UI tests.
[R32]

15.2.5 The verify setup provides five parts: launch, a health check, drive, evidence and cleanup. [R32; plan 7.1]

15.2.6 The verify setup also provides a feature map: how a user reaches each feature, how an agent drives it, and what proves it works. The build writes the feature map and proving the work reads it; it stays apart from the product record. [R32, R10]

15.2.7 The verify setup counts only once it has run end to end. [R32; plan 7]

15.2.8 The verify setup grows as features land, each phase adding the drives for its own scenarios (the feature map). It is kept honest against drift: researched again when it breaks or the tools move on. [R32; plan 7.1]

15.2.9 The verify setup lives in the product's code and is built by tasks: the first phase's tasks build it (the first phase's principle: see §12, §12), and each later phase adds the drives for its own scenarios. [plan 7.1; R15]

15.2.10 Because the verify setup drives the product and changes with it, it rides the same pull requests and reviews as the code. [plan 7.1; Claude's proposal]

15.2.11 The project's environment setup records where the verify setup is and how to call its five parts (the environment setup: see §22). The feature map sits beside the verify setup. [plan 7.1; Claude's proposal]

15.2.12 The verify setup is not kept on the state branch, where a phase's drives would land outside the phase's stack. [plan 7.1; Claude's proposal]

15.2.13 The verify setup holds how to run the product safely, given once. [R20]

15.2.14 The builder verifies each task through the user's real path; review reads the evidence; the mod can show it. How the evidence shows on the board is drawn by Claude with the spec's screens, in the board's own look (20.4), and marked as Claude's for the person to tick or comment on. [R32; plan 3.11, ruled by the person 2026-10-20; Claude's derivation, O94]

Screen, drawn by Claude: the evidence on a task's page on the board (the page's other sections as locked). [Claude's derivation, O94]

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

← back to the build

6.1 `r` on chunked notes re-runs only the merge
Phase 6 · Chunked notes at the review gate and in the… · ✓
done 21 Oct 09:40 · took 18m

EVIDENCE ──────────────────────────── 2 proven · 1 not proven
✓ r at the review gate re-runs only the merge            ▸ see
✓ The merged notes come back to the review gate          ▸ see
△ A failed merge on r keeps the chunk notes  not proven ▸ read
```

Screen, drawn by Claude: a scenario's evidence, opened from its row. [Claude's derivation, O94]

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

← back to 6.1

r at the review gate re-runs only the merge
✓ proven · run by the verify setup · 21 Oct 09:38
 ────────────────────────────────────────────────────────────
DRIVE ───────────────────────────────────────────────────────
mint release on the fixture repository, whose diff is over
the cap; at the review gate, r

CHECK ───────────────────────────────────────────────────────
one AI call, for the merge; no chunk call; the review gate
shown again with the merged notes

EVIDENCE ────────────────────────────────── kept with the run
captured screen · 41 lines                              ▸ open
```

15.2.15 Left to the builder: who studies the repository, researches the tools and runs the verify setup end to end, within the first phase's tasks (plan 7.1). [Claude's sort, B38]

15.2.16 Left to the builder: who notices the tools have moved on. [Claude's sort, B40]

### 15.3 Proven and not proven

15.3.1 Proven means a phase's acceptance scenarios were performed on the running product, through the path a user takes — or, for a product with no interface, a caller — and a script checked the result: a captured screen compared, a response asserted, a recording. [R32; Claude's definition, agreed by the person 2026-10-12; plan 7]

15.3.2 Claude's account of what happened never counts as proof. [R32]

15.3.3 A scenario that cannot be driven is reported not proven, and that is what reaches the person. [R32]

15.3.4 Evidence is computed, never narrated: scripts produce verdicts, and Claude never types a count. [R32; plan 7]

15.3.5 Zero tests is "not proven". A criterion whose tests were skipped is "named, not run". [R32]

### 15.4 The engine runs the proof and records it

15.4.1 A `verify` verb takes a scenario from the cut, runs the setup's drive for it, and records the verdict the script writes against the scenario. [plan 7.2, plan 6.1; Claude's, agreed]

15.4.2 Claude never types a verdict. [plan 7.2; Claude's, agreed]

15.4.3 The phase review reads the recorded runs. A scenario with no passing run reads "not proven" in every report. [plan 7.2; Claude's, agreed]

15.4.4 Text evidence (a captured screen, a response) is kept with the run. Each verification run's record and its text evidence have a home in the layout on disk, the paths the builder's (§4 §4). Recordings and images stay in the gitignored cache with their hash recorded, since the state branch is pushed on every commit. [plan 7.2; Claude's, agreed; Claude's derivation, O12]

### 15.5 The bug-proven check

15.5.1 In a bugfix, the first task writes the test that reproduces the bug. [R20; ruled by the person 2026-10-16]

15.5.2 The `verify` verb runs the reproducing test on the unfixed code five times and records each failure. [plan 7.3; R20]

15.5.3 The commit door refuses the fix commit until all five runs are recorded failing (the commit door: see §6). A run in which the test passes even once proves nothing: the fix commit stays refused and the test is reworked. [plan 7.3; R20; ruled by the person 2026-10-16; Claude's derivation, O49]

15.5.4 After the fix, the same test passes and is one of the build's own gates. [plan 7.3; R20]

15.5.5 The check is specific to bugfix, because proving the bug is what the type is. [R20]

15.5.6 The review phase reads the recorded runs on the unfixed code and does not run them again. [R20; R16; Claude's derivation, O49]

15.5.7 Left to the builder: how the commit door tells the fix commit from the reproducing test's commits. [Claude's sort, B41]

### 15.6 Test adequacy

15.6.1 Every acceptance criterion has a test. [R33]

15.6.2 Test quality is checked by machine: mutation testing where the language has a tool, otherwise deliberate breaks that must turn the tests red. [R33]

15.6.3 At the phase review, where the project's language has a mutation tool, the engine runs it over the lines the phase changed. The verify setup names the tool, after researching the current tools, never from a fixed list. [plan 7.4; Claude's, agreed]

15.6.4 A surviving mutant in code a criterion covers is a finding for the pair. [plan 7.4; Claude's, agreed]

15.6.5 Where no mutation tool exists, each reviewer breaks the riskiest line of a criterion's code in a scratch worktree. A break the tests do not catch is a finding. [plan 7.4; Claude's, agreed]

15.6.6 Either way, the cost of the adequacy check is bounded by the phase's diff. [plan 7.4; Claude's, agreed]

15.6.7 Left to the builder: which code a criterion covers, and the riskiest line's unit. [Claude's sort, B42]

### 15.7 Habit hooks

15.7.1 A habit hook catches a named smell and injects its fix. [R33]

15.7.2 No habit hook ships before it is tested, on the condition the person set when they agreed habit hooks on 2026-10-07: "let's make sure we run our own tests to validate. Let's not just blindly trust what we read." [R33; plan 7.5; ruled 2026-10-19]

15.7.3 A habit hook runs over the replay's slices alongside the brief-quality measurement (13.12), and ships if it cuts review findings. [R33; plan 7.5; ruled 2026-10-19]

15.7.4 Either way, a smell the reviews keep naming becomes a hard check where one can catch it (15.8), and otherwise a rule in a project skill (15.10), each through a task. The workflows never write a project rule into CLAUDE.md: a CLAUDE.md line is offered to the person to write. [plan 7.5; ruled 2026-10-19; Claude's derivation, O50]

15.7.5 Left to the builder: which habit hooks are candidates, and how "cuts review findings" is judged. [Claude's sort, B43]

### 15.8 Hard checks over soft rules

15.8.1 A spec invariant names the check that enforces it — an architecture test, a lint, an import-graph rule — where one can, so a decision holds even for builders who never read the record (ready to build's checklist item on invariants: see §6). [R34, R14]

15.8.2 The task that adds an invariant's check goes in the phase that introduces the invariant. [plan 7.6; Claude's, agreed]

15.8.3 The project's checks — tests, linters, architecture tests — run through the commit door before every code commit (the commit door: see §6). [plan 7.6, plan 6.3; Claude's, agreed]

15.8.4 A review finding that recurs becomes a hard check where one can catch it, or a rule in a project skill, each through a task, rather than coming back each cycle; a CLAUDE.md line is offered to the person to write. [R34; Claude's derivation, O50]

15.8.5 A finding the pairs raise in two tasks becomes a note for later proposing a check, and the phase's end turns it into a task. [plan 7.6; Claude's, agreed]

15.8.6 The person's coding rules (for Laravel: thin controllers, the action pattern, data objects, never passing primitives) split: what can be checked becomes an architecture test (Pest supports them); the rest stays guidance handed to the builder, through the project's skills and CLAUDE.md (15.10). [R34; plan 7.7]

15.8.7 The more hard structure a codebase already has, the less up-front decision it needs. [R34]

15.8.8 Left to the builder: how the same finding in two tasks is recognised. [Claude's sort, B45]

### 15.9 Linters

15.9.1 Linters are asked once per project: found and confirmed at the first ready to build, and recorded in the project's environment setup (§22). [R34; ruled by the person 2026-10-20; plan 7.6]

15.9.2 Linters are never asked again at a build, and are changed from manage on the start menu (§22). [R34; ruled by the person 2026-10-20]

15.9.3 Today's linters confirmation at every implementation start goes. [R34; ruled by the person 2026-10-20; plan 7.6]

### 15.10 How project skills and rules reach the builder

15.10.1 Project skills are not configured: there is no list, no mapping of skills to areas of the code, and no question. [R34; ruled by the person 2026-10-20; plan 7.7]

15.10.2 Today's question at every implementation start — which project skills to pass, their paths then going into each builder's and reviewer's brief — goes. [R34; ruled by the person 2026-10-20; plan 7.7]

15.10.3 Builders and reviewers are sub-agents. They find and invoke the project's skills through Claude Code's Skill tool without being handed them, and Claude Code loads the project's CLAUDE.md in every custom sub-agent. [R34; plan 7.7; ruled by the person 2026-10-20]

15.10.4 Rules that can be checked become checks (15.8). The rest stay in the project's skills and CLAUDE.md. [plan 7.7; ruled 2026-10-20]

15.10.5 Preloading a skill waits until a build shows a skill ignored; it is then a small change. [R34; plan 7.7; ruled by the person 2026-10-20]

15.10.6 The builder's and the reviewer's agent definitions give them the Skill tool, so 15.10.3 holds. [R34, plan 7.7; Claude's derivation]

### 15.11 The feature map and bugs found after review

15.11.1 The feature map groups bugs found after review by area, for Claude. [R32; plan 8.1; ruled 2026-10-19]

15.11.2 The grouping steers the verify setup's checks for that area and feeds the bugfix's "rework the area as a feature" option (§19), which puts the design look in front of the person when it matters. [R32, R20]

15.11.3 No flag the person sees comes of the grouping. [R32; plan 8.1; ruled 2026-10-19]

### 15.12 Verification and the ask rule

15.12.1 Verification never lowers how often Claude asks, and does not adjust the ask rule (§16). [R32; plan 7.8; ruled 2026-10-19]

15.12.2 The ask rule the person approved has no reversal-cost term: the ask rule matches the person's judgement, their verdicts already count what a mistake cost, and a mistake verification catches early already earns a "fix later" verdict. [R32; plan 7.8; ruled 2026-10-19]

## 15-S. Scenarios for §15

15.S1 Given a project with no verify setup, when its first build's first phase is built, then that phase's tasks build a verify setup in the product's code with launch, a health check, drive, evidence and cleanup and a feature map, and the setup does not count until it has run end to end. (15.2.1, 15.2.2, 15.2.5, 15.2.6, 15.2.7, 15.2.9)

15.S2 Given a project with a verify setup, when a later phase is built, then its tasks add the drives for that phase's scenarios, and those drives land in the phase's pull requests, reviewed with the code, and not on the state branch. (15.2.8, 15.2.9, 15.2.10, 15.2.12)

15.S3 Given a project with a verify setup, when its environment setup is read, then it names where the verify setup is and how to call its five parts. (15.2.11)

15.S4 Given a scenario from the cut, when `verify` runs it, then the setup's drive performs it and the verdict the script writes is recorded against the scenario, with no verdict typed by Claude. (15.4.1, 15.4.2, 15.3.4)

15.S5 Given a scenario with no passing run, when any report is written, then it reads "not proven". (15.4.3, 15.3.3)

15.S6 Given a criterion with zero tests, when evidence is reported, then it reads "not proven"; given a criterion whose tests were skipped, then it reads "named, not run". (15.3.5)

15.S7 Given a run that captured a screen as text and made a recording, when the run is recorded, then the text is kept with the run and the recording sits in the gitignored cache with its hash recorded. (15.4.4)

15.S8 Given a bugfix whose first task wrote the reproducing test, when the fix commit is attempted with fewer than five failing runs recorded on the unfixed code, then the commit door refuses it; once `verify` has recorded five failures, the fix commit is accepted, and the test then passes as one of the build's own gates. (15.5.1, 15.5.2, 15.5.3, 15.5.4)

15.S9 Given a phase in a language with a mutation tool the verify setup names, when the phase review runs, then the engine runs the tool over the lines the phase changed, and a surviving mutant in code a criterion covers reaches the pair as a finding. (15.6.3, 15.6.4, 15.6.6)

15.S10 Given a phase in a language with no mutation tool, when the phase review runs, then each reviewer breaks the riskiest line of a criterion's code in a scratch worktree, and a break the tests do not catch is a finding. (15.6.5)

15.S11 Given a code commit, when it is made through the commit door, then the project's tests, linters and architecture tests run first. (15.8.3)

15.S12 Given a phase that introduces an invariant a check can enforce, when its tasks are written, then the task that adds the check is in that phase. (15.8.1, 15.8.2)

15.S13 Given the pairs raise the same finding in two tasks of a phase, when the second is raised, then a note for later proposing a check is deposited, and the phase's end turns it into a task. (15.8.4, 15.8.5)

15.S14 Given a project's first ready to build, when it is reached, then the linters are found and confirmed and recorded in the environment setup; given a later build in the same project, when it starts, then no linters question is asked. (15.9.1, 15.9.2, 15.9.3)

15.S15 Given an implementation start, when the build begins, then no project-skills question is asked and no builder's or reviewer's brief carries project skill paths. (15.10.1, 15.10.2, 15.10.3)

15.S16 Given a habit hook proposed for the release, when the release is prepared, then it has run over the replay's slices alongside the brief-quality measurement before it ships, and it ships if it cut review findings. (15.7.2, 15.7.3)

15.S17 Given bugs found after review in one area, when they are grouped, then the feature map groups them under that area, the verify setup's checks for that area are steered by it, and the person sees no flag. (15.11.1, 15.11.2, 15.11.3)

15.S18 Given a builder finishes a task, when it reports, then it has verified the task through the user's real path, and the phase review reads the recorded runs. (15.2.14, 15.4.3)

15.S19 Given verification catches a mistake early, when the ask rule next computes whether to ask, then its computation is unchanged by the catch. (15.12.1, 15.12.2)

15.S20 Given a bugfix whose reproducing test passes in one of its five runs on the unfixed code, when the fix commit is attempted, then the commit door refuses it and the test is reworked; given a bugfix whose five failing runs are recorded, when the review phase runs, then it reads the recorded runs and does not run the test on the unfixed code again. (15.5.3, 15.5.6)

15.S21 Given a finding the reviews keep naming that no hard check can catch, when it is turned into a rule, then a task writes it into a project skill, a CLAUDE.md line is offered to the person to write, and the workflows write nothing into CLAUDE.md. (15.7.4, 15.8.4)

15.S22 Given the builder's and the reviewer's agent definitions, when they are read, then each gives its agent the Skill tool. (15.10.6, 15.10.3)

## 16. Trust

### 16.1 Who decides whether to ask

16.1.1 Whether Claude asks the person is arithmetic the engine computes over the person's own answers. Claude supplies the question and its lean, never the decision. [Strand B; ruled by the person 2026-10-12: "make as much of that mathematical as we can. It shouldn't be Claude deciding"]

16.1.2 Three parties take part in whether Claude asks. Claude supplies the question and its own answer, recorded sealed before the person answers, so it cannot change: in a raise it is shown as the lean, and in a blind question it is held back until after the person answers (16.17.2). The engine decides whether to ask. The person supplies answers, and each answer becomes evidence. [R24, R26; Claude's derivation, O59]

16.1.3 The engine decides from counts derived from the trust log (16.13); the same inputs always give the same decision. The session receives only that decision, never text from the log. [R24; ruled by the person 2026-10-19: "I want it to be algorithmic. I want it to be numbers-based"]

16.1.4 Claude's own stated confidence never gates whether a question is asked. [R25]

16.1.5 The ask rule takes its vocabulary from the existing ask-or-decide reference, which already asks for expensive-to-reverse calls. It gains three things: "the person cares" as a reason to ask (16.5.2), the ledger as the durable landing for decided calls (§5), and reach into the build, where the builder's block rules are separate today. [R24]

16.1.6 Door type is one reason to ask, not the name of the split. [R24]

### 16.2 One decision point

16.2.1 There is one decision point, reached from everywhere Claude makes a call: casually in conversation, a review finding, the closing pass, a message, and the build. The touch points are woven into the workflows so that the decision point is there whenever a call comes up; it joins Claude's reasoning to the person's learned taste. [R24, plan 4.4; ruled by the person 2026-10-13]

16.2.2 A review's lanes are the matrix's output: apply is what the record or a fact settles; decide is Claude's call; the walked lane is the person's question; route is what belongs elsewhere. [R24]

16.2.3 The reviewer's tie-break ("When a finding could read either way, it is `ask`") gives way to the matrix. The matrix is the sanctioned way to move a finding away from the person, where today a finding may only move toward them. [R24; ruled by the person 2026-10-14]

16.2.4 A finding that a later decision has removed is dropped with a one-line note. [R24; ruled by the person 2026-10-14]

16.2.5 A finding coming to the person is rechecked, before it is raised, against the answers given earlier in the same walk and against the record. [R24; ruled by the person 2026-10-14; the check against the record is Claude's addition]

16.2.6 A route names another topic, never a subtopic. [R24; ruled by the person 2026-10-14]

16.2.7 No cap is set on findings per report: more findings is the point, and the measure is the calls reaching the person (17.1.3). [R24; ruled by the person 2026-10-14]

### 16.3 Facts are checked, intent is asked

16.3.1 A question that reading the code, reading the record or running something can answer never reaches the person: Claude checks it. [R24, plan 4.4]

16.3.2 Only questions of intent and taste enter the trust layer. [R24]

16.3.3 Where there is more than one way and no obvious choice, Claude finds out before it leans. When each way has its pros, cons and risks and evidence can tell them apart, Claude spikes it, researches, reads or reverse-engineers the source, or looks at how open-source products do it, instead of guessing or asking. [R24, plan 4.4; the person's rule 2026-10-12, stated loosely on purpose]

16.3.4 Such a finding-out runs on a disposable machine (a macOS image under Tart, for example) or on the person's own machine; the person is not involved. [R24]

16.3.5 The ledger records the evidence beside the call (§5). [R24]

16.3.6 Finding out matters most where a wrong call means rebuilding inner machinery, even behind a contract. [R24]

16.3.7 Telling a call with one defensible answer from one with several is Claude's judgement, by the existing ask-or-decide reference (16.1.5), and a call with one defensible answer proceeds as Claude's (16.16.3) while the count of such calls allows (16.4.10). Every call on a question of intent or taste, those with one defensible answer included, reaches the decision point (16.2.1): the separate call labels it (16.19), it lands in the ledger and the trust log, where it can be overruled, it can be drawn as a blind question (16.17), and an overrule of it counts in the evidence (16.12). [R24, R25; ruled by the person 2026-10-13 and 2026-10-21; Claude's derivation, O65]

### 16.4 The ask rule

16.4.1 The engine asks when the pessimistic rate of real loss for the question's kind exceeds the person's threshold. [R24, plan 4.4]

16.4.2 Real loss is what the product would have lost had Claude built its own answer, taken from the person's verdict on each departure (16.10). Only a real loss counts as a loss; agreements count as no loss. [R24]

16.4.3 A departure without a verdict yet, or one the person cannot call, counts as a real loss until the person gives its verdict. [R24, R23, plan 4.3]

16.4.4 The pessimistic rate is taken per kind, per person, per project and per model: the upper end of a one-sided 95% range on the rate of real loss, the 95th percentile of Beta(1 + losses, 1 + clean answers) over the counts (16.12, 16.14). Few answers leave the range wide, so the system keeps asking. [R24, R25, R29; Claude's derivation, O54]

16.4.5 Worked values the arithmetic gives, for a kind's counts with nothing carried from the person's other projects and every answer at full weight: with no loss, 13 answers bring the bound under 20%, 18 under 15% and 28 under 10%; one loss among 20 answers puts the bound at 21%. [R24]

16.4.6 The threshold is one number the person picks from a replay of their own history. The release's default is 20%, the person's pick from the replay of theirs. [R24, R25, R29, plan 4.4]

16.4.7 Mid-build, where a question blocks work, the threshold is the same as elsewhere until the build's own answers show by how much to raise it; raising it is then the person's pick from a replay on the matrix screen (16.15). What marks a question as blocking work is the builder's. [R24, R25; Claude's derivation, O56]

16.4.8 A question whose answer would be hard to undo — a later change would reach beyond the piece — halves the threshold: 10% at the 20% default. [R24, R25, plan 4.4]

16.4.9 Data model and external contracts ask on evidence, not always as danger does: a contract question that would be hard to undo needs the bound under 10%, about 28 answers without a loss. [R24]

16.4.10 The calls Claude sorts as having one defensible answer (16.3.7) have a count of their own, an overrule of one counting as a loss: they proceed as Claude's, and such a call asks the person once overrules lift that count's bound past the threshold. [R24, R25; ruled by the person 2026-10-21]

### 16.5 What always asks: danger, care entries and the person's own decisions

16.5.1 Danger always asks: a question with an option that could destroy, overwrite or expose the person's data or secrets, or weaken permissions or security. No count loosens it. Danger's always-ask is read from the labeller's question 9 directly, whatever kind the twelve answers compose (16.11.3), so a question about the session whose option could lose data still asks. [R24, plan 4.4; Claude's derivation, O55]

16.5.2 A care entry in the record of the person (16.18) names one project and one kind, in the form "Aircon: look". While it stands, that kind always asks in that project, as danger does, however well Claude's calls have matched. [R24, R27, plan 4.4, plan 4.7; ruled by the person 2026-10-19: "I agree that the caring part should always ask, otherwise I think it has less value"]

16.5.3 A care entry has no every-project scope: what the person cares about depends on what the project is for. [R24, plan 4.4; ruled by the person 2026-10-19]

16.5.4 A "don't care" answer settles that one question only. If such answers keep coming for a kind under a care entry, Claude proposes dropping the entry. [R24, plan 4.4; ruled by the person 2026-10-19]

16.5.5 Answers to a kind under a care entry still count while the entry stands, so dropping the entry leaves the counts knowing how Claude does on that kind. [R24; ruled by the person 2026-10-19]

16.5.6 Left to the builder: how many "don't care" answers come before Claude proposes dropping a care entry (16.5.4), the drop proposed on the record-of-the-person proposal screen (16.18.3). [Claude's sort, B50]

Screen, drawn by Claude: the care entries, opened from the matrix's care row. [Claude's derivation, O94]

```text
■ Matrix · Fumi · Care entries

A kind under a care entry always asks you in Fumi, however well
my calls have matched. Its answers still count while it stands.

YOURS IN FUMI (1)
  └─ Fumi: look

· · · · · · · · · · · ·
◆ What would you like to do?

n/new  → Add a care entry — you pick the kind
d/drop → Drop "Fumi: look" — look goes back to the counts
h/help → What this screen is for, row by row
b/back → Back to the matrix
```

Screen, drawn by Claude: adding a care entry, asking which kind. [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
◆ Which kind should always ask you in Fumi?

1      → contract — what other code or saved data relies on
2      → scope — whether something is in the work at all
3      → behaviour — what a user sees it do
4      → words — what a user reads or types
5      → process — how the session runs, not the product
6      → internals — what no user sees
b/back → Back to the care entries
```

Screen, drawn by Claude: the lines reporting a care entry added, and one dropped. [Claude's derivation, O94]

```text
Care entry added: Fumi: words — words always asks you in Fumi.
```

```text
Care entry dropped: Fumi: look — look follows the counts again:
39%, over your 20%, so it still asks for now.
```

Screen, drawn by Claude: Claude's proposal to drop a care entry, on the proposal screen of the record of the person. [Claude's derivation, O94]

```text
FOR THE RECORD OF YOU
Drop the care entry "Fumi: look"
  ↳ Why: your look questions in Fumi keep coming back "don't
    care", so look may not need to ask you every time.
  ↳ Examples:
    · The note window's corner radius — don't care
    · The menu bar icon's weight — don't care
    · The colour of a fumi's title bar — don't care

· · · · · · · · · · · ·
Dropped, look follows the counts, which kept counting while the
entry stood: it asks you as any kind does, by its rate.

◆ Drop it from the record of you?

y/yes   → Drop it
n/no    → Keep it — look keeps asking you every time
Comment → Tell me why it should stay
```

16.5.7 Replacing an entry the person decided always asks, as danger and a care entry do: a call that would replace a ledger entry whose answer was the person's comes to them whatever the counts, the engine reading who decided it from the entry (9.2.14). [R24, R23; ruled by the person 2026-10-21]

### 16.6 Going quiet and asking again

16.6.1 A kind goes quiet when its bound falls below the threshold, and asks again only once the bound rises a quarter above the threshold: 25% at 20%, and 12.5% where a change would be hard to undo. [R24, plan 4.4; ruled by the person 2026-10-18]

16.6.2 So one bad call reopens a quiet kind only while its evidence is thin: at 20%, a loss among fewer than 16 clean answers reopens it, and from 16 clean answers on it stays quiet; where a change would be hard to undo, the line is 35 clean answers. [R24, plan 4.4; ruled by the person 2026-10-18]

16.6.3 Worked at 20%: behaviour goes quiet after 13 answers without a loss. A loss while it holds 13 to 15 clean answers puts its bound over 25%, and it asks again until 20 clean answers outweigh the loss; a loss after 16 or more clean answers leaves it quiet. [R24]

16.6.4 Blind questions (16.17) keep sampling a quiet kind. [R24]

### 16.7 The cone of collaboration

16.7.1 The cone of collaboration narrows as the product takes shape, not phase by phase: widest on a blank page, where the person drives and the framework goes in early, and narrowing as each decided topic constrains the next. Across an epic the first topics are the widest; across epics, a new epic's first topic starts narrower once the product's character is known (the product record). [R24, plan 4.4; the person's framing 2026-10-13]

16.7.2 The cone is never a key in the counts, and nothing computes where in the cone the work is. [R24]

16.7.3 The cone enters where the work does:
- Discovery stays conversation: the person brings the idea, it is shaped together, and Claude never decides there alone (§8).
- In discussion a topic's opening view carries it: the part that earlier decisions settle grows with every topic decided, so the forks shrink on their own (§9).
- Until a topic's shape is agreed, Claude makes no call of intent or taste on it alone (9.6.3).
- Hard to undo halves the threshold (16.4.8), which tends to bite on early calls, the ones later work builds on.
- Convergence (16.8) hands a topic's remaining calls to Claude's settling, and mid-build the threshold rises (16.4.7).
[R24; ruled by the person 2026-10-21]

### 16.8 Convergence

16.8.1 After 8 agreements in a row in a topic, or on the person's word, Claude offers to settle the rest of the topic. [R24, plan 4.4]

16.8.2 Screen: the convergence offer shows how many points are open, how many Claude would settle, and which still come to the person by the rule, by kind — "12 open: I'd settle 9; 3 come to you — 2 contracts, 1 look". The person accepts it with a yes or declines it. It is drawn by the engine, and its rows are drawn by Claude in the spec in the existing design system, marked as Claude's. [R24, R35; Claude's derivation, O58, O94]

Screen, drawn by Claude: the convergence offer. [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
8 agreements in a row on Licensing And Trial Integrity.

12 open: I'd settle 9; 3 come to you — 2 contracts, 1 look.

◆ Settle the rest?

y/yes → Settle the rest — my 9 go in the ledger, your 3 come one
        at a time, then the decided screen
n/no  → Not yet — keep going point by point; I'll offer again
        after the next run
```

16.8.3 On yes, Claude settles its points in the ledger, asks the rest one at a time in the conversation, and brings the topic to its decided screen, where the person signs off with the ledger in view (§9). [R24]

16.8.4 Declined, the offer waits for the next run. [R24]

16.8.5 The run only times the offer. Settling leaves the rule in force: the kinds the rule sends to the person still come to them. [R24]

16.8.6 A yes to the offer is stated intent, recorded in the trust log. [R24, R25]

16.8.7 Left to the builder: counting the convergence run — what counts as an agreement in it — with the next run counted from the decline (16.8.4). [Claude's sort, B49]

### 16.9 How a raise reaches the person

16.9.1 A raise is drawn by an engine command paired with the written rule, never by a prose rule alone: uptake follows design, not availability. [R24]

16.9.2 Screen: a raise reads cold and product first. It shows what is being decided, Claude's lean, what the person would notice either way, and why it asks (the kind, or the rule's reason). The mechanism sits behind a toggle. "I don't follow" is a button on it. Its rows and its toggle are drawn by Claude in the spec in the existing design system, marked as Claude's. [R24, plan 4.4; Claude's derivation, O59, O94]

Screen, drawn by Claude: a raise, over a question waiting in a build. [Claude's derivation, O94]

```text
Q1 · Token-Aware Diff Sizing · parks task 6.7

If the terminal closes while the review gate waits, should the
release unwind as a decline does, or keep its commit for the
operator to finish by hand?

I lean: unwind, as a decline does.

WHAT YOU'D NOTICE
  · Unwind: the branch is back where it was before the release;
    you run mint release again to start over.
  · Keep: the release commit stays on the branch, and you finish
    it or undo it by hand.

WHY I'M ASKING
  It's behaviour, and on behaviour in Mint my calls still miss
  more often than you allow: 21%, over your 20%.

· · · · · · · · · · · ·
◆ Which way?

1           → Unwind, as a decline does (recommended)
2           → Keep the commit for the operator to finish by hand
t/technical → Show the mechanism
e/explain   → I don't follow — explain it again
Comment     → Ask about it, or tell me what I've missed
```

16.9.3 "I don't follow" counts as no answer: Claude explains again, and the question stays open. [R24, R25, plan 4.4; Claude's derivation, O59]

16.9.4 Questions come to the person one at a time. In discussion each is slotted into the conversation at a natural pause. Where several wait at once they come back to back, each answered before the next shows. [R24, plan 4.4; ruled by the person 2026-10-14 ("drop things to me one at a time") and 2026-10-18 ("the decision process isn't a conveyor belt of decisions")]

### 16.10 Verdicts and the verdict queue

16.10.1 A departure is an answer that amends or overrules Claude's lean. Every departure gets a verdict: what the product would have lost had Claude built its own answer — nothing, a fix later, or a real loss — or a skip. A departure the person cannot call is a skip: it waits in the verdict queue and counts as a loss until the person calls it (16.4.3). [R23, R24, plan 4.3; Claude's derivation, O57]

16.10.2 Screen: a topic's decided screen asks a verdict on each call the person changed in that topic, one press each — nothing, a fix later, a real loss — with skip beside them (the rest of the decided screen: see §9). It is asked there because a verdict left to a page the person must open is a verdict not given. What each verdict row shows of the call it judges is drawn by Claude in the spec in the existing design system, marked as Claude's. [R23, plan 4.3; ruled by the person 2026-10-18; Claude's derivation, O94]

Screen, drawn by Claude: a verdict asked on a topic's decided screen (the same block decided carries in Discussion). [Claude's derivation, O94]

```text
YOUR VERDICT (1 of 2 calls you changed)
  └─ Sync toggle default
        Decides: whether sync is on when Fumi first runs
        My answer: on, once you pick a folder to sync
        Yours: off until you turn it on

· · · · · · · · · · · ·
◆ What would my answer have cost the product?

n/nothing → Nothing — mine would have served as well
f/fix     → A fix later
l/loss    → A real loss
s/skip    → Skip — I can't call it yet; it waits in the verdict
            queue
```

16.10.3 Screen: the finish gate asks the same, before the person's finish yes, for the calls the person changed in the build and the review phase (the rest of the finish gate: see §14). [R23, plan 4.3; ruled by the person 2026-10-18]

16.10.4 Screen: a quick-fix's close asks the same for the calls the person changed in it (the rest of the close: see §19). [R23, R21, plan 4.3; ruled by the person 2026-10-18]

16.10.5 Where the person changed no call, nothing is added to the decided screen, the finish gate or the quick-fix close. [R23; ruled by the person 2026-10-18]

16.10.6 A skipped verdict waits in the verdict queue, answered when the person chooses. [R23, plan 4.3]

16.10.7 Screen: the verdict queue opens from the start menu's verdict row and is an engine surface shaped like the page the person used for the verdicts of R29, which put each question product first (16.9.2); on it the person gives each waiting verdict — nothing, a fix later, a real loss. Its rows are drawn by Claude in the spec in the existing design system, marked as Claude's. [R23, R24, R35; Claude's derivation, O58, O94]

Screen, drawn by Claude: the verdict queue. [Claude's derivation, O94]

```text
■ Verdicts · 1 of 2 waiting

Fumi · Onboarding And Permissions · skipped at decided, 21 Oct
  └─ Notification permission ask
        Decides: when Fumi asks to send notifications
        My answer: in the first-run wizard, with the others
        Yours: the first time a fumi sets a reminder

· · · · · · · · · · · ·
◆ What would my answer have cost the product?

n/nothing → Nothing — mine would have served as well
f/fix     → A fix later
l/loss    → A real loss
h/help    → What this screen is for, row by row
b/back    → Back to the start menu — the rest keep waiting
```

16.10.8 Until judged, a departure counts as a real loss, so a backlog in the verdict queue only makes Claude ask more. [R23, R24, plan 4.3]

16.10.9 Each verdict on a departure is an event in the trust log. [R25]

16.10.10 A blind answer that differs from Claude's sealed answer is a departure, and so is a later reversal: each gets a verdict at the next verdict point — a topic's decided screen, the finish gate, a quick-fix's close — or waits in the verdict queue. [R23, R25, R26; Claude's derivation, O60]

### 16.11 Kinds of question

16.11.1 Kinds of question key every count. [R25]

16.11.2 A labeller answers twelve narrow yes/no questions about the question Claude put, from Claude's words alone, never the person's reply:
1. is it about the session rather than the product;
2. could Claude find the answer out;
3. would a user see the difference;
4. is it about how something looks;
5. the words a user reads or types;
6. the steps a user goes through;
7. whether something is in the work at all;
8. does other code or saved data come to rely on it;
9. could an option lose data or weaken security;
10. would a later change reach beyond the piece;
11. would one option be a mistake on its merits;
12. does answering need the code's insides.
[R25, R29, plan 4.5]

16.11.3 The engine composes the kind from the twelve answers in code, in this order, each kind from its question: process (1), danger (9), contract (8), scope (7); then, for what a user sees (3), look (4), words (5), else behaviour; else internals — as `trust/kinds.py` `compose()` does it. [R25, R29, plan 4.5; Claude's derivation, O55]

16.11.4 The steps a user goes through are part of behaviour: flow is not a kind of its own. [R25]

16.11.5 Every label stores all twelve answers, not only the composed kind. [R25, plan 4.5; ruled by the person 2026-10-19: "store the 12 answers because it's good data"]

16.11.6 Splitting a kind along the twelve answers is parked by the person, to come back to; it is not in the release (§27). [R25]

16.11.7 Two answers act beyond the kind: "would a later change reach beyond the piece" marks the question hard to undo, which halves the threshold (16.4.8); "could Claude find the answer out" routes the question to checking (16.3.1). [R25]

16.11.8 The labeller is never the Claude that wants to proceed: it is a separate Claude call (16.19), since a self-labelled question can drift into a trusted kind. [R25, R28, plan 4.5]

16.11.9 Gate answers are keyed by the gate's name. [R25]

### 16.12 Evidence and its weight

16.12.1 Evidence is weighted by what it proves:
- a blind question (16.17) answered cold: full weight;
- an answer to a recommendation the person was shown: full weight;
- a later reversal: a full disagreement, recorded as a new event pointing back at the call it reverses and cancelling the earlier agreement;
- "didn't follow": no weight.
[R25, plan 4.5; full weight for an answer to a shown recommendation ruled by the person 2026-10-18]

16.12.2 A reversal rewrites nothing: an "I agree" given in fatigue and overturned later counts as an overturn. [R25]

16.12.3 "Didn't follow" is a first-class answer: a yes to a question the person could not follow is not agreement. [R25]

16.12.4 Two starting values weight evidence by age and by model: an answer counts half once it is six months old, so a change of taste shows; and a new model starts from its predecessor's counts at half weight and earns the rest. [R25, plan 4.5; ruled as starting values by the person 2026-10-18]

16.12.5 Both starting values are set with no evidence yet and are retuned by replay once the trust log holds evidence. The procedure stays fixed across model generations; only the numbers move. [R25, plan 4.5; ruled by the person 2026-10-18]

16.12.6 Left to the builder: the age weighting (16.12.4), a step at six months, as worded. [Claude's sort, B48]

### 16.13 The trust log

16.13.1 The trust log is append-only, kept at user level in the person's workflows config directory (the one that already holds the system config and each conversation's state), across all the person's projects, and reached through the engine. [R25, plan 4.5]

16.13.2 Only the engine writes the trust log; Claude cannot edit it or the settings. [R25]

16.13.3 The trust log holds what the matrix needs and no decision's content, which stays in the project's ledger. The engine writes the ledger entry and the trust log event in the same command. [R25]

16.13.4 The trust log's events are:
- each raise, with Claude's sealed answer and the person's answer, by kind;
- each verdict on a departure;
- each gate answer, by the gate's name, with the option the engine recommended and the one picked, whether pressed or typed at the prompt;
- each ledger call;
- each blind question;
- each reversal;
- each switch of a phase's position (§3);
- each convergence accepted.
[R25]

16.13.5 Every event's key carries its scope: project and kind. [R25]

16.13.6 Counts are derived from the trust log, never stored. [R25]

16.13.7 Left to the builder: the trust log's file, format and event schemas, the guard against Claude editing it, and where its settings live (16.13.2); its events carry the model, since the bound is per model (16.4.4). [Claude's sort, B52]

### 16.14 The matrix at two levels, and the merge

16.14.1 The matrix is kept at two levels, the project's and the person's, so a call can follow the project's taste where it differs from the person's overall. Both are projections of decisions across work units, apart from the ledgers. [R25, plan 4.5; ruled by the person 2026-10-14]

16.14.2 The two levels merge for every decision: the person's counts across all projects are each project's starting point, and the project's own answers move it as they accumulate. A new project starts from the person's general taste; a project where they care about the UI soon shows it. [R25]

16.14.3 In the arithmetic, the person's counts from their other projects, capped at 10 answers' weight, are the prior that the project's counts update, and the pessimistic rate (16.4.4) is read from the merged range. [R25, plan 4.5; cap ruled by the person 2026-10-18]

16.14.4 Worked: for a kind whose capped 10 answers from the person's other projects hold no loss, a new project starts at a 24% bound, just over the 20% line, so the kind asks there about three times before going quiet, and one bad call reopens it. [R25; ruled by the person 2026-10-18]

16.14.5 The same merge lets gates of one kind share evidence, and lets a new model inherit its predecessor's counts at a discount (16.12.4). [R25, R29]

16.14.6 Left to the builder: how the cap of 10 answers' weight applies (16.14.3) — `trust/replay_rule.py` scales the other projects' counts together to the cap — and the order of the cap and the halvings (16.12.4). [Claude's sort, B47]

16.14.7 Left to the builder: which process gates count as of one kind and pool their evidence (16.14.5). [Claude's sort, B56]

### 16.15 The matrix screen and tuning by replay

16.15.1 Screen: the matrix is an engine-drawn screen the person can read and correct (16.15.4), reached from manage and on the person's word; trust stays the person's decision. It shows the overturn rate per kind — the ask rule's own number (17.1.2) — and, beside it, how a review's findings split across its lanes (17.1.3). Its rows are drawn by Claude in the spec in the existing design system, marked as Claude's. [R25, R36, plan 8.1; Claude's derivation, O58, O62, O94]

Screen, drawn by Claude: the matrix. [Claude's derivation, O94]

```text
■ Matrix · Fumi

Your threshold is 20%. A kind asks you until its rate falls under
it, then goes quiet, and asks again only once its rate rises over
25%. Where a change would be hard to undo, half: quiet under 10%,
asking again over 12.5%. Danger, a kind under your care entry,
and replacing an answer you gave always ask.

Rate is the pessimistic bound: the high end of a 95% range on how
often my answer would have cost the product, so a kind with few
answers reads high.

Nothing is carried from your other projects yet: every count
here is Fumi's own.

OVERTURN RATE BY KIND
  kind      answers  real losses  rate
  danger          —            —     —  always asks
  contract        4            0   45%  asks
  scope          11            0   22%  asks
  behaviour      20            1   21%  quiet · asks over 25%
  look            9            1   39%  asks · your care entry
  process        14            0   18%  quiet · hard to undo asks
  words          18            0   15%  quiet · hard to undo asks
  internals      30            0    9%  quiet

CLAUDE'S ONE-ANSWER CALLS
  64 calls · 1 overruled · rate 7%. They go ahead as mine, and
  ask you once overrules lift the rate over your 20%.

MID-BUILD, WHERE A QUESTION BLOCKS WORK
  20%, the same as elsewhere, until a build's own answers show
  how much to raise it.

HOW REVIEW FINDINGS SPLIT (212 across Fumi's reviews)
  apply    97  46%  the record or a fact settles it
  decide   81  38%  Claude's call
  walked   21  10%  asked you
  route    13   6%  belongs to another topic

· · · · · · · · · · · ·
◆ What would you like to do?

t/threshold → Change your threshold — a replay first shows what
              it would have changed
u/build     → Raise the threshold mid-build — a replay first
              shows what it would have changed
c/care      → Add or drop a care entry — a kind that always asks
              you in Fumi
h/help      → What this screen is for, row by row
b/back      → Back to manage
```

16.15.2 Tuning is by replay: the engine replays the trust log against a proposed setting, so the threshold is set from evidence, not feel. [R25, plan 4.5]

16.15.3 Screen: a replay of a proposed setting reports what the setting would have changed over a past period, in the form "last month this would have skipped 40 questions; you'd have overruled 2 of them". [R25]

Screen, drawn by Claude: the replay of a proposed threshold, and the pick after it. [Claude's derivation, O94]

```text
■ Matrix · Fumi · Replay

25% IN PLACE OF YOUR 20%
  Last month 25% would have skipped 6 questions; you'd have
  overruled 1 of them.

· · · · · · · · · · · ·
At 25%, the line where a change would be hard to undo moves to
12.5%, and a quiet kind asks again over 31%.

◆ Use 25% as your threshold?

y/yes   → Use 25% from now on
n/no    → Keep 20%
Comment → Try another number
```

16.15.4 Correcting the matrix means the person's own settings: the threshold, picked from a replay (16.15.2), and their care entries (16.5.2). A question's kind is never edited there. [R24, R25, R27; Claude's derivation, O62]

### 16.16 What ships

16.16.1 What ships is the procedure, never anyone's counts: the kinds and their questions, the arithmetic, and the defaults the person set from their own replay (16.20). [R25, plan 4.5]

16.16.2 Each person's counts are learned from their own answers; what transfers between people is the method, never decisions. [R25]

16.16.3 A new user starts with an empty trust log, so every question of taste or intent asks. The calls with one defensible answer, which today's apply and decide lanes settle, stay Claude's. [R25]

16.16.4 Each kind loosens on that person's evidence: after about 13 clean answers, 28 where a change would be hard to undo; danger never. [R25]

16.16.5 A user of today's workflows starts with an empty trust log too. Importing their transcripts (labelling, two checks, a verdict page) stays out of the release, added only if the first weeks of asking prove heavy (§27). [R25]

16.16.6 The person who designed the workflows starts with an empty trust log as well, meeting the first weeks every user meets; R29's history stays the replay set the defaults are tuned against, never a seed for anyone's counts. [R25, plan 4.5; ruled by the person 2026-10-18, over their 2026-10-12 call to seed their own log]

### 16.17 Blind questions

16.17.1 Now and then the engine holds back a call Claude would have made silently, keeps Claude's answer sealed, and asks the person the question cold, in the moment and in context. Blind questions replace after-the-fact spot checks. [R26; the person's idea 2026-10-12]

16.17.2 Screen: a blind question shows the question without Claude's answer; once the person has answered, it shows what Claude would have picked. [R26]

Screen, drawn by Claude: a blind question, over Fumi's Search And Retrieval (what it shows once answered: 16.17.7). [Claude's derivation, O94]

```text
Fumi · Search And Retrieval

A search finds a fumi that lives on another Space. When you pick
it, should Fumi take you to its Space, or bring the fumi to the
Space you're on?

WHAT YOU'D NOTICE
  · Take you there: the screen moves to the fumi's Space, and the
    fumi stays where it lives.
  · Bring it here: the fumi shows on this Space until you close
    it, then goes back to its own.

· · · · · · · · · · · ·
◆ Which way?

1           → Take you to the fumi's Space
2           → Bring the fumi to this Space for now
t/technical → Show the mechanism
e/explain   → I don't follow — explain it again
Comment     → Ask about it, or tell me what I've missed
```

16.17.3 The engine draws blind questions by a fixed share: one in ten of the calls Claude would make alone, to start, and more where a kind's range is wide (little history, a new model). Claude never chooses which calls are drawn. [R26, plan 4.6; ruled by the person 2026-10-18]

16.17.4 Each call draws on its own: the engine turns the call's id into a number, so blind questions fall at random across projects at the same rate, with no tally kept per project or per person, and the same call always draws the same way. [R26, plan 4.6; ruled by the person 2026-10-18]

16.17.5 Every draw is logged in the trust log. [R26, R25]

16.17.6 Mid-build, for a call cheap to undo — one where the labeller's "would a later change reach beyond the piece" answers no (16.11.2) — Claude proceeds on its own answer while the blind question waits; a disagreement undoes it. [R26, R24; Claude's derivation, O61]

16.17.7 The comparison is how the person comes to trust Claude, not only how the system does — for example, "Claude would have picked the same, 14 of the last 15 on error handling". [R26]

Screen, drawn by Claude: the reveal, once the person has answered the blind question above (16.17.2). [Claude's derivation, O94]

```text
You picked: take you to the fumi's Space.
I'd have picked the same. On behaviour in Fumi, I've picked the
same as you 18 of the last 21 times.
```

16.17.8 Reading the ledger as a whole, at the final review, still looks for calls that are fine alone and wrong in combination (§14). [R26]

16.17.9 Left to the builder: how much more often blind questions draw where a kind's range is wide, and how "wide" is measured (16.17.3). [Claude's sort, B51]

### 16.18 The record of the person

16.18.1 The release has a record of the person: the person's preferences in words, each with its reason and examples — never a decision tree, which breaks on the first case it did not anticipate. [R27, plan 4.7; ruled by the person 2026-10-06 and 2026-10-19]

16.18.2 Claude proposes an entry when it sees a pattern or the person states a preference outright. An entry steers nothing until the person says yes on the screen where Claude proposes it. [R27, plan 4.7]

16.18.3 Screen: the proposal of an entry shows the preference with its reason and examples, and takes the person's yes. Its other rows are drawn by Claude in the spec in the existing design system, marked as Claude's. [R27, plan 4.7; Claude's derivation, O94]

Screen, drawn by Claude: the proposal of an entry in the record of the person. [Claude's derivation, O94]

```text
FOR THE RECORD OF YOU
Show the product before asking for anything
  ↳ Why: you'd rather people see what it does before it asks them
    for a key, a permission or an account.
  ↳ Examples:
    · Fumi's first run: the tour first, then the licence as a
      wizard step
    · Fumi: sync stays off until you turn it on, so nothing asks
      for an account up front

· · · · · · · · · · · ·
It would shape what I pick in every project, whether I decide or
lean as I ask — never whether I ask.

◆ Keep it in the record of you?

y/yes   → Keep it
n/no    → Leave it out — nothing is kept
Comment → Tell me how to word it
```

16.18.4 The record shapes what Claude picks, whether Claude decides or gives its lean as it asks. It never shapes whether Claude asks; its one effect on asking is a care entry (16.5.2), and care entries live in it. [R27, plan 4.7]

16.18.5 The record lives at user level, ships empty for a new user, and fills from that person's raises and overturns. [R27, plan 4.7]

16.18.6 The record is not kept in Claude Code's memory, which is keyed to the project directory, so what one project learns there never reaches another. [R27]

16.18.7 No session searches the person's decisions in other projects: that would put another project's text into a session, and projects differ by what they are for. [R27, plan 4.7; ruled by the person 2026-10-19: "I do care about different things in different projects"]

16.18.8 Left to the builder: the record of the person's format, kept in `~/.config/workflows/`, and when a session reads it. [Claude's sort, B53]

### 16.19 The separate Claude call

16.19.1 The release has no decision model. A separate Claude call — never the Claude that wants to proceed — does three jobs: labelling a question's kind from the twelve questions (16.11), judging whether a ledger entry holds one decision (§5), and reading a typed gate answer. [R28, plan 4.8; ruled by the person 2026-10-18]

16.19.2 Deciding whether to ask is never the separate call's job; the engine's arithmetic decides it (16.1). [R28, R24]

16.19.3 The call is raw, made by the engine itself, never a subagent, so nothing the session writes reaches it but the question. [R28, plan 4.8; ruled by the person 2026-10-19: "It should be as raw as possible"]

16.19.4 The engine runs the call as `claude -p --system-prompt <fixed> --tools "" --strict-mcp-config --setting-sources "" --settings '{"disableAllHooks":true,"autoMemoryEnabled":false}' --disable-slash-commands --no-session-persistence --json-schema …` with `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, started from an empty folder, so nothing of the person's reaches it. [R28, plan 4.8; ruled by the person 2026-10-19]

16.19.5 The call never uses `--bare`: it reads only an API key, never a subscription or setup-token login. [R28, plan 4.8]

16.19.6 Sonnet runs the labeller, for labelling only; the check that a ledger entry holds one decision and the reading of typed gate answers run on Opus until a measurement says otherwise. [R28, plan 4.8; Claude's call 2026-10-19; Claude's derivation]

16.19.7 A decision model (Jev, Clef) is not in the release. One is offered later, as the person's choice at setup, only once a rerun of the same scripts on a new version shows it labels as well as a Claude call. When it is offered: each label names the labeller that wrote it, and a switch relabels the log from the questions' text, so the counts follow. Kept for that day: neutral wording; a threshold per question from the person's labels by the lower-bound rule, checked on held-out items; a per-question signal refining the per-kind counts last; the loop adjusting only on evidence larger than noise (§27). [R28, plan 4.8; the person 2026-10-18: "we can very much let the user decide"]

16.19.8 When the labelling call fails, or no login serves it, the question asks the person; a typed gate answer the call cannot read stands as typed text; a ledger entry that fails the one-decision check is sent back to be split before it lands (5.5.3). [R24, R28; Claude's derivation, O63; the person 2026-10-14]

16.19.9 Left to the builder: the labeller's effort, as the measured raw form ran it (`trust/label_raw.py`). [Claude's sort, B1]

16.19.10 Left to the builder: the separate call's system prompt, JSON schema and model flag, from the measured wording in `trust/label_raw.py` (16.19.4). [Claude's sort, B54]

16.19.11 Left to the builder: each label names the labeller that wrote it, from the release on (16.19.7). [Claude's sort, B55]

### 16.20 Starting numbers

16.20.1 The release ships these defaults, each setting one thing, set by the person from the replay of their own history (R29) and their rulings of 2026-10-18; the two weights are starting values set with no evidence yet (16.12.5):
- 20%: the threshold (16.4.6);
- half: the threshold where a change would be hard to undo, 10% (16.4.8);
- a quarter above the threshold: where a quiet kind asks again, 25% and 12.5% (16.6.1);
- the one-sided 95th percentile of Beta(1 + losses, 1 + clean answers): the pessimistic rate (16.4.4);
- 10 answers' weight: the cap on the person's other projects in a project's prior (16.14.3);
- half weight at six months old: an answer's age (16.12.4);
- half weight: a new model's start from its predecessor's counts (16.12.4);
- one in ten, to start: the share of Claude's silent calls drawn as blind questions (16.17.3);
- 8 agreements in a row: when convergence is offered (16.8.1).
[R29, R24, R25, R26, plan 4.9; Claude's derivation, O54]

16.20.2 A learned process gate (§3) goes automatic once the one-sided 95% upper bound on leaving its usual answer — the same Beta bound as the ask rule's (16.4.4) — falls below the person's threshold of 20% (16.4.6), with blind asks at 5%. Its usual answer is the one picked most often, and the person retunes it by replay (16.15.2). [R29, R24; Claude's derivation, O54, O64]

16.20.3 No process gate ships automatic: each asks until the person's own answers loosen it, the author's included. [R29, R25]

16.20.4 Spec sign-off qualifies for automatic by count and stays an authority gate. [R29]

### 16.21 Counter-measures

16.21.1 Every optimising loop has a counter-measure, and danger (16.5.1) is the frozen anchor, so trust cannot drift by optimising its own metric. [R30, plan 8]

16.21.2 The ask rule is checked by blind questions (16.17) and verdicts (16.10). [plan 8.3, R30]

16.21.3 Learned process gates are checked by blind asks at 5% and by answers that start to vary. [plan 8.3, R29, R30]

## 16-S. Scenarios for §16

16.S1 Given a kind that has not gone quiet, whose bound is above the threshold, when Claude makes a call of that kind with a lean, then the engine's answer to the session is to ask, and the session receives that decision and no text from the trust log. (16.1.1, 16.1.2, 16.1.3, 16.4.1, 16.6.1)

16.S2 Given one trust log and one question of one kind, when the engine decides whether to ask twice over the same inputs, then both decisions are the same. (16.1.3)

16.S3 Given two calls of the same kind over the same counts, one where Claude states high confidence and one where it states none, when the engine decides, then both decisions are the same. (16.1.4)

16.S4 Given a review returns findings, when they are routed, then each lands in a lane: apply where the record or a fact settles it, decide where it is Claude's call, walked where the engine asks the person, route where it belongs elsewhere. (16.2.1, 16.2.2)

16.S5 Given a review finding that could read either way, of a kind whose bound is under the threshold, on a call whose id does not draw blind, when it is routed, then it does not reach the person and lands as Claude's call. (16.2.3)

16.S6 Given a finding that a later decision has removed, when the review's findings are routed, then the finding is dropped and a one-line note says so. (16.2.4)

16.S7 Given a review finding that belongs elsewhere, when it is routed, then its route names another topic, never a subtopic of its own topic. (16.2.6)

16.S8 Given a review reports any number of findings, when they are routed, then none is dropped for exceeding a count. (16.2.7)

16.S9 Given a question that reading the code would answer, when it comes up, then it never reaches the person, Claude checks it, and nothing about it enters the trust log as an answer of the person's. (16.3.1, 16.3.2, 16.11.7)

16.S10 Given two ways with no obvious choice that evidence can tell apart, when Claude must lean, then it spikes, researches or reads the source first, on a disposable machine or the person's own, without asking the person, and the ledger records the evidence beside the call. (16.3.3, 16.3.4, 16.3.5)

16.S11 Given a kind with 12 clean answers, no loss, nothing from other projects and every answer at full weight, when a question of that kind comes up on a call whose id does not draw blind, then it asks; given 13 clean answers, it does not. (16.4.1, 16.4.4, 16.4.5, 16.4.6)

16.S12 Given a kind holding one loss among 20 answers and nothing from other projects, when its bound is read, then it is 21%. (16.4.5)

16.S13 Given a departure the person skipped, when the bound for its kind is computed, then the departure counts as a real loss; once the person gives it "a fix later", it counts as no loss. (16.4.2, 16.4.3, 16.10.8)

16.S14 Given a question labelled hard to undo, of a kind with 18 clean answers (a bound under 15%), nothing from other projects and every answer at full weight, when it comes up at the 20% default, then it asks, the threshold being 10%. (16.4.8)

16.S15 Given a contract question that would be hard to undo, on a call whose id does not draw blind, with nothing from other projects and every answer at full weight, when its kind holds 27 clean answers it asks, and when it holds 28 clean answers it does not. (16.4.9)

16.S16 Given a question that blocks build work, before the build's own answers have shown how much to raise the threshold, when the engine decides, then it uses the same threshold as elsewhere. (16.4.7)

16.S17 Given a danger question of a kind holding many clean answers, when it comes up, then it asks. (16.5.1)

16.S18 Given a care entry "Aircon: look" and a look kind whose bound is under the threshold, when a look question comes up in Aircon, then it asks; when a look question comes up in another project, the counts decide. (16.5.2, 16.5.3)

16.S19 Given a care entry whose kind keeps drawing "don't care" answers, when the answers keep coming, then each settles only its own question, Claude proposes dropping the entry, and once dropped the kind's bound reflects the answers given while it stood. (16.5.4, 16.5.5)

16.S20 Given a quiet behaviour kind at 20% holding 13 clean answers, nothing from other projects and every answer at full weight, when a loss lands, then its bound passes 25% and it asks again, and it goes quiet again only once it holds 20 clean answers beside the loss. (16.6.1, 16.6.2, 16.6.3)

16.S21 Given a quiet kind at 20% holding 16 clean answers, nothing from other projects and every answer at full weight, when a loss lands, then its bound stays under 25% and it stays quiet: a call of it whose id does not draw blind does not ask. (16.6.1, 16.6.2)

16.S22 Given a kind gone quiet for questions that would be hard to undo (its bound under 10%), with nothing from other projects and every answer at full weight, when a loss lands while it holds 34 clean answers, then a hard-to-undo question asks again; when the loss lands at 35, it stays quiet, and a hard-to-undo question whose id does not draw blind does not ask. (16.6.1, 16.6.2)

16.S23 Given a quiet kind, when Claude makes its calls, then some are still drawn as blind questions. (16.6.4, 16.17.3)

16.S24 Given a discovery conversation, when a call comes up, then Claude does not decide it alone; and the trust log's keys hold project and kind, never a position in the cone. (16.7.2, 16.7.3, 16.13.5)

16.S25 Given 8 agreements in a row in a topic, when the eighth lands, then Claude offers to settle the rest on an engine-drawn screen, showing how many points are open, how many it would settle and which come to the person by kind. (16.8.1, 16.8.2)

16.S26 Given the convergence offer, when the person says yes, then Claude's points are settled in the ledger, the rest come one at a time in the conversation, the topic reaches its decided screen with the ledger in view, and the trust log holds the convergence accepted. (16.8.3, 16.8.6, 16.13.4)

16.S27 Given the convergence offer, when the person declines, then no offer comes again until the next run. (16.8.4)

16.S28 Given 3 agreements in a row, when the person asks Claude to settle the rest, then the offer is made. (16.8.1)

16.S29 Given an accepted convergence with a danger point open, when Claude settles the rest, then the danger point still comes to the person. (16.8.5, 16.5.1)

16.S30 Given the engine decides to ask, when the raise shows, then an engine command draws it with what is being decided, Claude's lean, what the person would notice either way and why it asks, the mechanism behind a toggle, and an "I don't follow" button. (16.9.1, 16.9.2)

16.S31 Given a raise, when the person presses "I don't follow", then the trust log records an answer with no weight that counts as neither agreement nor departure, Claude explains again, and the question stays open. (16.9.3, 16.12.1, 16.12.3)

16.S32 Given three questions waiting at once in a discussion, when they reach the person, then they come back to back, each answered before the next shows. (16.9.4)

16.S33 Given the person changed two of Claude's calls in a topic, when its decided screen shows, then it asks a verdict on each, one press — nothing, a fix later, a real loss — with skip beside them. (16.10.1, 16.10.2)

16.S34 Given the person changed none of Claude's calls in a topic, when its decided screen shows, then it asks no verdict. (16.10.5)

16.S35 Given the person changed calls in the build and the review phase, when the finish gate shows, then it asks a verdict on each before the finish yes. (16.10.3)

16.S36 Given the person changed a call in a quick-fix, when the quick-fix closes, then the close asks its verdict. (16.10.4)

16.S37 Given the person skips a verdict, when they later open the verdict queue from the start menu's verdict row, then the departure waits there in the product-first shape, counts as a real loss until judged, and the verdict they give lands in the trust log. (16.10.6, 16.10.7, 16.10.8, 16.10.9)

16.S38 Given a question Claude put, when it is labelled, then a separate raw call answers the twelve questions from Claude's words alone, and the label stores all twelve answers beside the composed kind. (16.11.1, 16.11.2, 16.11.5, 16.11.8, 16.19.1, 16.19.3)

16.S39 Given a label whose answers compose to none of process, danger, contract or scope, when "would a user see the difference" and "is it about how something looks" are yes, then the engine composes look; when "would a user see the difference" is yes and, of the look, words and steps questions, only "the steps a user goes through" is yes, it composes behaviour; when "would a user see the difference" is no, it composes internals. (16.11.3, 16.11.4)

16.S40 Given the person answers a gate by typing at the prompt, when the answer is recorded, then the separate call reads it and the trust log holds the gate's name, the option the engine recommended and the one picked. (16.11.9, 16.13.4, 16.19.1)

16.S41 Given the person agreed with a call and later reverses it, when the reversal is recorded, then a new event points back at the call and cancels the earlier agreement, and the earlier event is unchanged. (16.12.1, 16.12.2)

16.S42 Given an answer six months old, when the counts are derived, then it counts half. (16.12.4)

16.S43 Given a new model starts, when the counts for its calls are derived, then they start from its predecessor's counts at half weight. (16.12.4, 16.14.5)

16.S44 Given a raise is answered, when it is recorded, then one engine command writes the ledger entry in the project and an event in the trust log in the user-level workflows config directory, and the event holds no decision's content. (16.13.1, 16.13.2, 16.13.3)

16.S45 Given a switch of a phase's position, an accepted convergence and a blind draw, when each happens, then each is an event in the trust log keyed by its project and kind where it has one. (16.13.4, 16.13.5, 16.17.5)

16.S46 Given the trust log, when the engine decides, then it derives the counts from the log, and no stored count exists. (16.13.6)

16.S47 Given a person whose other projects hold more than 10 clean answers on a kind and no loss, when a question of that kind first comes up in a new project, then its bound is 24% and it asks; after three clean answers there it goes quiet, and a call of it whose id does not draw blind no longer asks. (16.14.2, 16.14.3, 16.14.4)

16.S48 Given a person whose other projects are clean on look, when look answers in one project carry enough real losses to lift its merged bound over the threshold, then look asks in that project, its own answers having moved the person's prior. (16.14.1, 16.14.2, 16.14.3)

16.S49 Given the matrix screen, when the person opens it from manage or asks for it in their own words, then it shows the overturn rate per kind and how a review's findings split beside it; when the person proposes a setting, the engine replays the trust log and reports how many questions it would have skipped and how many of those the person would have overruled. (16.15.1, 16.15.2, 16.15.3)

16.S50 Given a new user with an empty trust log, when a question of taste or intent comes up, then it asks; when a call with one defensible answer comes up, it stays Claude's. (16.16.1, 16.16.3, 16.16.4)

16.S51 Given the release as installed, when its contents are read, then it holds the kinds, their questions, the arithmetic and the defaults, and no one's counts; the author's trust log starts empty. (16.16.1, 16.16.2, 16.16.5, 16.16.6)

16.S52 Given a call Claude would make alone whose id draws blind, when it comes up, then the engine asks the person cold, shows what Claude would have picked once they answer, and logs the draw; the same call draws the same way every time. (16.17.1, 16.17.2, 16.17.3, 16.17.4, 16.17.5)

16.S53 Given a blind question mid-build on a call whose "would a later change reach beyond the piece" answers no, when it is drawn, then Claude proceeds on its own answer while the question waits, and a disagreeing answer undoes it. (16.17.6)

16.S54 Given Claude proposes an entry for the record of the person, when the proposal shows, then it states a preference in words with its reason and examples; while the person has not said yes, the entry steers nothing; once they say yes, it shapes what Claude picks and leaves whether Claude asks unchanged unless it is a care entry. (16.18.1, 16.18.2, 16.18.3, 16.18.4)

16.S55 Given a new user, when the record of the person is read, then it is empty; once an entry is accepted in one project, it is there in the person's other projects. (16.18.5, 16.18.6)

16.S56 Given a session in one project, when it works, then no text from another project's decisions enters it. (16.18.7)

16.S57 Given the engine labels a question, when the call runs, then it is the stated `claude -p` command, without `--bare`, from an empty folder, never a subagent, on Sonnet. (16.19.3, 16.19.4, 16.19.5, 16.19.6)

16.S58 Given a fresh install, when any process gate comes up, then it asks; spec sign-off asks however many matching answers it holds. (16.20.3, 16.20.4)

16.S60 Given a fresh install with no setting changed, when the engine decides whether to ask, then it uses a 20% threshold, 10% where a change would be hard to undo, asks again at 25% and 12.5%, caps the person's other projects at 10 answers' weight, halves answers six months old and a new model's inherited counts, draws blind questions from Claude's silent calls at a share starting at one in ten, and Claude offers convergence after 8 agreements in a row. (16.20.1)

16.S61 Given a unit's ledger whose calls are each fine alone, when the final review reads the ledger as a whole, then it looks for calls wrong in combination. (16.17.8)

16.S59 Given a process gate whose usual answer is the one picked most often, and whose one-sided 95% upper bound on leaving it falls below 20%, when it comes up, then it goes automatic, and about one time in twenty it asks anyway. (16.20.2, 16.21.3)

16.S62 Given a question about the session whose option could lose data, when it is labelled, then its kind composes as process and it still asks, danger being read from question 9. (16.5.1, 16.11.3)

16.S63 Given the build's own answers show the mid-build threshold should rise, when the person picks a higher one from a replay on the matrix screen, then questions blocking build work use it; until the person picks one, they use the threshold used elsewhere. (16.4.7)

16.S64 Given a departure the person cannot call, when its verdict is asked, then they skip it, the verdict offering nothing, a fix later, a real loss and skip and no other answer; the departure waits in the verdict queue and counts as a real loss until they call it. (16.10.1, 16.4.3)

16.S65 Given Claude's answer to a question the person has not yet answered, then the answer is already recorded sealed and cannot change; a raise shows it as the lean, and a blind question holds it back until the person has answered. (16.1.2)

16.S66 Given a blind answer that differs from what Claude would have picked, or the person's later reversal of a call, when the next verdict point shows — a decided screen, the finish gate or a quick-fix's close — then it asks a verdict on each; skipped, each waits in the verdict queue. (16.10.10)

16.S67 Given the matrix screen, when the person corrects it, then they can change the threshold, picked from a replay, and their care entries, and no question's kind can be edited there. (16.15.4)

16.S68 Given the labelling call fails or no login serves it, when a question needs its kind, then the question asks the person; given a typed gate answer the call cannot read, then it stands as typed text; given a ledger entry that fails the one-decision check, then it is sent back to be split and does not land until it is. (16.19.8, 5.5.3)

16.S69 Given a call on a question of intent or taste that Claude judges, by the ask-or-decide reference, to have one defensible answer, when it comes up, then it reaches the decision point: the separate call labels its kind, it lands in the ledger and the trust log, and it proceeds as Claude's unless drawn as a blind question or the count of such calls asks; when the person later overrules it, the overrule counts in the evidence. Given a question reading the code would answer, it never reaches the decision point. (16.3.1, 16.3.2, 16.3.7, 16.4.10)

16.S70 Given the separate call checks that a ledger entry holds one decision, or reads a typed gate answer, when it runs, then it runs on Opus; when it labels a question, it runs on Sonnet. (16.19.6)

16.S71 Given the calls Claude sorts as having one defensible answer, proceeding as Claude's, when the person's overrules of them lift that count's bound past the threshold, then the next such call asks the person, though Claude still sorts it as having one defensible answer. (16.3.7, 16.4.10)

16.S72 Given a ledger entry whose answer the person gave, of a kind gone quiet, when Claude finds mid-build that it has to change, then replacing it asks the person whatever the counts, in the phase the epic is in; given an entry that was Claude's call, its replacement follows the ask rule. (16.5.7, 12.9.2, 12.15.4)

## 17. Measures

### 17.1 The six measures

17.1.1 The system adjusts itself through six measures, each moving one lever. The product computes them all from what is already recorded, never kept by hand, where today none is measured by the product. [R36, plan 8, plan 8.1, R45]

17.1.2 Overturn rate per kind of question: the ask rule's own number, the rate of real loss per kind, an unjudged departure counting as a loss (16.10.8) — one number, not two; computed from the trust log; shown on the matrix screen (16.15.1); it moves how often Claude asks — the ask rule, by its own arithmetic. [R36, plan 8.1, R23; Claude's derivation, O62]

17.1.3 How a review's findings split across its lanes: computed from the ledger — each finding, and who answered it; shown on the matrix screen beside the overturn rate; its lever is whether the matrix answers what the reviews find, and it moves the person's threshold and this repo's review briefs. [R36, plan 8.1]

17.1.4 The findings split is an indicator of the matrix working, never a target: when Claude's calls match the person's, of ten findings about one reaches the person. [R24]

17.1.5 Review findings per phase: computed from the ledger's findings, each tagged with its phase (5.2.3, 5.3.9), and the pairs' recorded verdicts and rounds (§13), for each phase of the pipeline — discussion's reviews and closing pass, the spec's review, the task writer, the build's pairs and the review phase — so it shows where each gap was found (11.7.5, 12.5.10); shown by an engine query this repo's authors run over their own projects; its lever is where the build is cutting corners, and it moves this repo's builder briefs and principles. [R36, plan 8.1; Claude's derivation]

17.1.6 Bugs found after review: computed from bugfix units, each relying on the unit whose code it fixes, grouped by the feature map's areas (§15); the grouping is Claude's and has no flag of its own; its lever is where verification has a gap, and it moves the verify setup's drives for that area and the bugfix's "rework the area as a feature" option (§19). [R36, plan 8.1, R32; ruled by the person 2026-10-19; Claude's derivation, O66]

17.1.7 Contracts slipping in prose tests: computed from the walks' invariant failures, by contract; shown in the prose harness's run summary; it moves which contract needs a verb or a check. [R36, plan 8.1, R4]

17.1.8 Context spent before the first question, per phase: computed from the walks, per phase; shown in the prose harness's run summary, against the budget (§2); it moves what a phase loads, and when. [R36, plan 8.1, R43]

17.1.9 Left to the builder: how a bugfix unit records the unit whose code it fixes (17.1.6). [Claude's sort, B58]

### 17.2 Two audiences, and where the measures show

17.2.1 The overturn rate, the findings split and bugs after review are the product's measures. Review findings per phase, contracts slipping and context before the first question are this repo's, seen in queries and the prose harness. [plan 8.2; Claude's proposal]

17.2.2 The measures are computed, never added to what the person reads at a gate: no measure adds a line to a topic's decided screen or the finish report, which keep the contents agreed for them. Each is shown on the matrix screen or one question away. [R36, plan 8.2; ruled by the person 2026-10-14 (a list they never asked for is one "I end up ignoring") and 2026-10-19]

17.2.3 Screen: the prose harness's run summary shows contracts slipping, by contract, and the context each phase spent before its first question, against the budget (§25). [plan 8.1; Claude's proposal]

17.2.4 Screen: the authors' engine query of review findings per phase shows the findings for each phase of the pipeline (17.1.5) over the projects it is run on, from the ledger's findings and the pairs' recorded verdicts and rounds. [R36, plan 8.1; Claude's derivation]

17.2.5 Left to the builder: the engine query for review findings per phase (17.2.4). [Claude's sort, B57]

### 17.3 Counter-measures

17.3.1 Review findings are checked by bugs found after review: findings falling while bugs after review rise means the reviews are weakening, not the code improving. [plan 8.3, R30]

17.3.2 The ask rule and the learned process gates have their counter-measures in 16.21. [plan 8.3, R30]

### 17.4 The brief-quality measurement

17.4.1 The brief-quality measurement runs before the release: the same builder and reviewers run on a thin brief and on the full template, over the replay's Switchboard slices (`walks/build/replay/`). [plan 8.4; Claude's proposal, agreed]

17.4.2 It runs once the templates exist, and is used to tune them. Its cost is bounded by the replay's — $606 for 264 agents at API prices — of which it needs a fraction. [plan 8.4; Claude's proposal, agreed]

17.4.3 Two more run alongside it on the same slices: a habit hook (§15), and the task-size test, a large task against the same work split in two. [plan 8.4; the person 2026-10-15: "the more data we can get on our decisions, the better"; running it here is Claude's]

## 17-S. Scenarios for §17

17.S1 Given a project with raises answered and reviews routed, when the person opens the matrix screen, then it shows the overturn rate per kind, computed from the trust log, and how a review's findings split, computed from the ledger, beside it. (17.1.1, 17.1.2, 17.1.3)

17.S2 Given a topic reaches its decided screen and a unit reaches its finish report, when they show, then neither carries a line for any measure. (17.2.2)

17.S3 Given the workflows' authors, when they run the engine query of review findings per phase over their own projects, then it shows findings for each phase of the pipeline — discussion's reviews and closing pass, the spec's review, the task writer, the build's pairs and the review phase — from the ledger's findings and the pairs' recorded verdicts and rounds. (17.1.5, 17.2.1, 17.2.4)

17.S4 Given a bugfix unit relying on the unit whose code it fixes, when bugs after review are counted, then the bug is grouped under its feature-map area, and the person sees no flag for it. (17.1.6)

17.S5 Given a prose-test run, when its summary prints, then it shows the invariant failures by contract and each phase's context before its first question against the budget. (17.1.7, 17.1.8, 17.2.3)

17.S6 Given review findings per phase falling while bugs found after review rise, when the authors read the two measures together, then they read it as the reviews weakening, not the code improving. (17.3.1)

17.S7 Given the brief templates exist and the release is not yet made, when the brief-quality measurement runs, then the same builder and reviewers run on a thin brief and on the full template over the Switchboard replay slices, with a habit hook and the task-size test alongside. (17.4.1, 17.4.2, 17.4.3)

17.S8 Given a kind whose departures hold one judged a real loss, one judged a fix later and one not yet judged, when the matrix screen shows its overturn rate, then the rate counts two real losses, the judged one and the unjudged one, and it is the same rate the ask rule runs on. (17.1.2, 16.15.1)

## 18. The tracking layer

### 18.1 What tracking holds

18.1.1 The start menu, the inbox, the roadmap, the work types, the work units and the epic menu stay. Together they hold the person's work across sessions: state a model cannot hold and memory does not replace. [R17]

18.1.2 Picking up work, taking it on and filing it into its place keep getting stronger. [R17]

18.1.3 The roadmap holds every kind of work. The backlog is one of its horizons, and the inbox is triaged onto it (18.7). [R17]

18.1.4 The epic menu simplifies as phase gating thins: most of its states (waits, holds, entry gates, staleness flags) exist to police phase order. What it keeps and what goes is 18.4. [R17]

### 18.2 The start menu

18.2.1 The start menu lists work units. The person steps into a unit before picking anything in it. [R17; ruled by the person 2026-10-16]

18.2.2 Each unit's row shows its type, its phase and its progress — "discussion, 1 of 4 topics decided"; "build, phase 2 of 3" — and never its topics. [R17; ruled by the person 2026-10-16]

18.2.3 A unit's row marks what waits on the person in it as a count ("1 question waiting for you"), and the units with something waiting are listed first. The count is the unit's authority gates waiting, its questions waiting, a builder's question waiting in the ledger among them (§12), and its decided topics waiting because an answer they relied on was replaced (10.2.6). Verdicts are not in it: they show on the verdict queue's project row (18.2.11), since the queue spans units. [R17; ruled by the person 2026-10-16; R15; the person 2026-10-14; Claude's derivation, O67]

18.2.4 Inside a unit, the unit's own menu lists what waits on the person first (18.4.2 for an epic; 19.1.3 for the linear types). [R17; ruled by the person 2026-10-16]

18.2.5 There is no separate waiting section and no row that jumps past the unit: with several things waiting, such a section would repeat each unit's menu. [R17; ruled by the person 2026-10-16]

18.2.6 Continue rows name the type first: "Continue epic: Tagging And Filtering", "Continue bugfix: …". [R17; ruled by the person 2026-10-16]

18.2.7 The start menu has one Start row, and discovery finds the type as the person talks (§8). The five start-by-type rows go. [R17; ruled by the person 2026-10-16]

18.2.8 The inbox is one line with its count by kind, in place of a row per item. [R17; ruled by the person 2026-10-16]

18.2.9 The triage row reads "t/triage → Triage the inbox" (18.7). [R17; ruled by the person 2026-10-16]

18.2.10 The roadmap, completed units, cancelled units, manage and help stay on the start menu. [R17; ruled by the person 2026-10-16]

18.2.11 The verdict queue (§16), which spans units, is a project row beside the inbox and the roadmap, shown only while verdicts wait. [R17; ruled by the person 2026-10-16; plan 3.11]

18.2.12 Screen: the start menu. It shows:
- one row per work unit, each naming the type first ("Continue epic: Tagging And Filtering"), with the unit's phase and progress and, where something waits on the person in it, the count of its authority gates, questions and topics waiting (18.2.3; "1 question waiting for you"); units with something waiting listed first; no topics on any row;
- one Start row;
- the inbox as one line with its count by kind, and its row "t/triage → Triage the inbox";
- the roadmap row;
- the verdict queue's row, only while verdicts wait;
- completed units; cancelled units;
- manage (18.3);
- h help (18.9).
There is no waiting section, no row that jumps past a unit, and no start-by-type row. The keys the sources leave open are drawn by Claude in the spec (18.10.8). [R17; ruled by the person 2026-10-16; plan 3.11; the person 2026-10-14; Claude's derivation, O67, O94]

Screen, drawn by Claude: the start menu, over Portal. [Claude's derivation, O94]

```text
Inbox: 3 ideas · 2 bugs · 1 quick-fix

· · · · · · · · · · · ·
◆ What would you like to do?

1          → Continue bugfix: Killing All Sessions Wipes Restore
             State — investigation · 1 question waiting for you
2          → Continue feature: Lazy Resume On Attach — build,
             phase 5 of 7
3          → Continue epic: Agent First Portal — discussion, 0 of
             7 topics decided
s/start    → Start something new — describe it, and we'll find
             what kind of work it is
t/triage   → Triage the inbox
r/roadmap  → Open the product roadmap
e/verdicts → Give the 2 verdicts waiting on calls you changed
v/view     → View completed & cancelled work units
m/manage   → Manage work units, the project's setup and drivers,
             and the matrix
h/help     → How the workflows work
```

### 18.3 Manage

18.3.1 A feature, bugfix or quick-fix has no menu of its own, so reopening its decision and bringing back a cancelled one go through manage on the start menu. One door per kind of unit: an epic's map changes go through its discovery (18.4.9). [R17, R19, plan 3.11; ruled by the person 2026-10-15 and 2026-10-16]

18.3.2 Revisiting an earlier phase of a feature, bugfix or quick-fix moves to manage on the start menu, beside pivot, absorb and cancel. In the new shape revisiting is mostly reopening the decision, and a later change to a decision replaces its entry on the ledger (§5). [R19; ruled by the person 2026-10-16]

18.3.3 Pivot and absorb stay. [R19]

18.3.4 Screen: manage on the start menu. Rows the sources give: reopen a feature's, bugfix's or quick-fix's decision (revisiting); pivot; absorb; cancel; bring back a cancelled unit. Manage also changes the environment setup and the drivers (§22). Manage also opens the matrix (16.15.1). Its rows' labels and keys are drawn by Claude in the spec (18.10.8). Moving a quick-fix to a feature or bugfix is not among its rows: it happens inside the quick-fix's own session (19.5.9). [R17, R19, plan 3.11, plan 9.2; Claude's derivation, O94, O68]

Screen, drawn by Claude: manage. [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
◆ What would you like to manage?

1         → Killing All Sessions Wipes Restore State — bugfix
2         → Lazy Resume On Attach — feature
3         → Agent First Portal — epic
4         → Split Oversized Go Files — feature, cancelled
s/setup   → Change the environment setup — how to run Portal,
            what can't run at once, the linters
d/drivers → Change the task driver or the landing driver
m/matrix  → See the matrix — how often Claude's calls miss, by
            kind
h/help    → What this menu is for, row by row
b/back    → Back to the start menu
```

Screen, drawn by Claude: manage, a feature picked. [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
Lazy Resume On Attach (feature)

◆ What would you like to do?

r/reopen → Reopen its decision — back into its discussion
p/pivot  → Convert to epic (enables multiple topics)
a/absorb → Merge into an existing epic
c/cancel → Mark as cancelled
h/help   → What this menu is for, row by row
b/back   → Back to manage
Ask      → Ask a question about this work unit
```

Screen, drawn by Claude: manage, a cancelled unit picked. [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
Split Oversized Go Files (feature, cancelled)

◆ What would you like to do?

r/reactivate → Bring it back — in progress again
h/help       → What this menu is for, row by row
b/back       → Back to manage
Ask          → Ask a question about this work unit
```

18.3.5 Pivot and absorb are open only while the feature is before its spec, and absorb only into an epic before its spec. A pivoted epic adds topics through its discovery, as any epic's map is re-shaped (8.8.14). Left to the builder: how an absorbed feature's entries become the epic topic's, through the move event (5.3.3). [R19, record 611, 3008–3009; Claude's derivation, T13]

18.3.6 A completed feature, bugfix or quick-fix is brought back by reopening its decision through manage. A completed epic is not reopened: later change to it is new work, and a replacement affecting its entries is flagged where it is made (5.6.13). [R17, R19, R37, record 3755–3760; Claude's derivation, T22]

18.3.7 Left to the builder: the summary and description a topic gets when it arrives by absorb or pivot, or from a migrated map row that has none, drawn from the topic's own record and log. Such a topic has started, so it gets no brief (8.7.6). [Claude's sort, T67]

### 18.4 The epic menu

18.4.1 The phase heads the screen. The epic does not move out of its phase until everything in it is finished — in the person's words: "decision phase, everything gets done. We don't move out of that phase until everything's finished. There is no menu for spec, for example, until everything's done." [R17; ruled by the person 2026-10-15]

18.4.2 What waits on the person comes first, each with its door: an authority gate waiting (start this work, approve the map, decided, ready to build, finish), a decided topic with an entry relying on a replaced answer — "Note Window: a decision it relies on changed" — whose door opens the topic to confirm "still holds" or replace (10.2.6), and verdicts waiting (§16). [R17; the person 2026-10-14 and 2026-10-19]

18.4.3 The topics show by what they need: in progress, decided, in session, mail waiting, experiments waiting. [R17]

18.4.4 No count of a topic's questions shows (the person, 2026-10-14: "I think it's noise. I don't care."). [R17, plan 3.11; ruled by the person 2026-10-14; Claude's derivation]

18.4.5 Starting a topic is "Start", with no routing (§8). [R17, R10]

18.4.6 Once every topic is decided, the menu offers the spec; then it shows the build's phase N of M; then the review — in place of the plan rows. No spec row and no ready-to-build row shows while any topic is undecided (18.5). [R17, plan 3.11]

18.4.7 The recommended row comes first, in the foundations-first order (§8). [R17, R41]

18.4.8 A topic in session elsewhere stays on the menu, struck through, so several topics can be open at once. [R17]

18.4.9 Changing the map is discovery's: a new topic, cancelling, postponing to the roadmap, pulling forward, reactivating, and reopening a decided topic all go through the discovery row, which says what it is for. A new topic, pulling forward, reactivating and reopening a decided topic, asked for in the person's words, are done and reported in one line; only cancelling confirms. [R17, plan 3.11; ruled by the person 2026-10-15; R10; Claude's derivation, O24]

18.4.10 The menu keeps the topics' rows, discovery and back. The new-topic doors, grouping, resume completed and reactivate rows are not among its rows; reactivating and a new topic go through the discovery row (18.4.9). [R17; ruled by the person 2026-10-15; Claude's derivation, O69]

18.4.11 Everything that kept research apart from discussion goes from the menu, as does everything about planning, and grouping (one spec per work unit; see §11). [R17]

18.4.12 The soft gates that remain become learned process gates (§3). [R17, R40]

18.4.13 The merged phase is named discussion throughout the menu. [R17]

18.4.14 Cancelling a topic moves its waiting mail to the inbox. [R17, plan 3.11; ruled by the person 2026-10-15]

18.4.15 "Dead end" goes. A topic that ends in not doing the work is decided with that as its decision, or cancelled. [R17; ruled by the person 2026-10-15]

18.4.16 "triage waiting" on an epic's rows becomes "mail waiting". [R17; ruled by the person 2026-10-16]

18.4.17 Screen: the epic menu. It shows, top to bottom:
- the phase the epic is in, as the heading, with the epic's tally beneath it: its topics, then how many are decided, in progress, not started, cancelled and postponed, a count of none left out;
- what waits on the person, each row with its door: an authority gate waiting (start this work, approve the map, decided, ready to build, finish), a decided topic with an entry relying on a replaced answer ("Note Window: a decision it relies on changed"), its door opening the topic (10.2.6), verdicts waiting;
- the topics by what they need — in progress, decided (listed with no key), in session (struck through when in session elsewhere), mail waiting, experiments waiting — with no count of a topic's questions, and "Start" on a topic not yet started; then the topics set aside, cancelled and postponed (a postponed one with its horizon), listed with no key, as decided topics are;
- once every topic is decided: the spec row; during the build, the build's phase N of M; then the review;
- before the spec, the discovery row, key d, saying what it is for (18.4.19);
- h help (18.9); b back.
The recommended row comes first, in the foundations-first order. Variants drawn in the spec: in discussion with topics still open; every topic decided (the spec row offered); during the build (phase N of M); in the review. Row wording, the discovery row's included, is drawn by Claude in the spec (18.10.8). [R17, plan 3.11; the person 2026-10-14, 2026-10-15 and 2026-10-19; key d agreed with the person 2026-10-14; Claude's derivation, O69, O94, T2]

Screen, drawn by Claude: the epic menu in discussion, with topics still open, a decided topic waiting because a decision it relies on changed, and topics set aside. [Claude's derivation, O94]

```text
■ Discussion — Fumi
20 topics · 9 decided · 5 in progress · 1 not started ·
4 cancelled · 1 postponed

DECIDED
  ├─ Note Model
  ├─ Storage And Sync
  ├─ Engine Architecture
  ├─ Space Homing
  ├─ Platform Support
  ├─ Search And Retrieval
  ├─ Status And Alerts
  └─ Agent Surface

SET ASIDE
  ├─ Positioning And Audience — cancelled
  ├─ Scale And Performance — cancelled
  ├─ Data Export — cancelled
  ├─ Privacy And Data Handling — cancelled
  └─ Website — postponed · roadmap next

· · · · · · · · · · · ·
◆ What would you like to do?

1           → "Note Window": a decision it relies on changed —
              confirm it still holds, or replace it (recommended)
2           → Continue "Management Window" — in progress · mail
              waiting
3           → Continue "Onboarding And Permissions" — in progress
              · mail waiting
4           → Continue "Commercialization" — in progress · mail
              waiting
5           → ~~Continue "Licensing And Trial Integrity" — in~~
              ~~progress · mail waiting~~ · in session (last
              active 6m ago)
6           → ~~Continue "Support And Diagnostics" — in~~
              ~~progress~~ · in session (last active 2m ago)
7           → Start "Build And Release" — not started · mail
              waiting
d/discovery → Change the map — a new topic, cancel, postpone,
              pull forward, reactivate, or reopen a decided topic
h/help      → What this menu is for, row by row
b/back      → Back to the start menu
```

Screen, drawn by Claude: the epic menu with every topic decided, the spec row offered. [Claude's derivation, O94]

```text
■ Discussion — Agent First Portal
7 topics · 7 decided

DECIDED
  ├─ Agent State
  ├─ Agent State Surfacing
  ├─ Session Control Overlay
  ├─ Resume Hook Internalisation
  ├─ Mobile Client
  ├─ Transport
  └─ Productisation

· · · · · · · · · · · ·
◆ What would you like to do?

s/spec      → Start the specification — every topic is decided
              (recommended)
d/discovery → Change the map — a new topic, cancel, postpone,
              pull forward, reactivate, or reopen a decided topic
h/help      → What this menu is for, row by row
b/back      → Back to the start menu
```

Screen, drawn by Claude: the epic menu during the build. [Claude's derivation, O94]

```text
■ Build — Agent First Portal
7 topics · 7 decided

DECIDED
  ├─ Agent State
  ├─ Agent State Surfacing
  ├─ Session Control Overlay
  ├─ Resume Hook Internalisation
  ├─ Mobile Client
  ├─ Transport
  └─ Productisation

· · · · · · · · · · · ·
◆ What would you like to do?

1          → Continue the build — phase 3 of 5 (recommended)
e/verdicts → Give the verdict waiting on a call you changed
h/help     → What this menu is for, row by row
b/back     → Back to the start menu
```

Screen, drawn by Claude: the epic menu in the review. [Claude's derivation, O94]

```text
■ Review — Agent First Portal
7 topics · 7 decided

DECIDED
  ├─ Agent State
  ├─ Agent State Surfacing
  ├─ Session Control Overlay
  ├─ Resume Hook Internalisation
  ├─ Mobile Client
  ├─ Transport
  └─ Productisation

· · · · · · · · · · · ·
◆ What would you like to do?

1      → Finish — the review passed, and finish waits on your yes
         (recommended)
h/help → What this menu is for, row by row
b/back → Back to the start menu
```

18.4.18 A decided topic is listed on the menu with no key, since reopening it is discovery's (18.4.9), except while it waits under 10.2.6, when it is a row with its door among what waits (18.4.2). Cancelled and postponed topics are listed after the live ones with no key, a postponed one with its horizon, as the board's epic tab shows the topics set aside (§20). [R17; the person 2026-10-14 and 2026-10-15; Claude's derivation, O69]

18.4.19 From the spec on, an epic's map is closed: the discovery row leaves the menu, and no topic is added, cancelled, postponed, pulled forward, reactivated or reopened. A topic exists only before the spec (4.11.2), and a decision that must change is settled in the phase the epic is in (12.15.4). A split the person agrees at the outline moves topics as 11.10.3 says, before ready to build's yes. Abandoning the work is the unit's cancel through manage (18.3.4). [record 3036–3037, 3755–3760; R17; Claude's derivation, T2]

18.4.20 A cancel or postpone of the topic, asked for inside its own session, is made through the discovery row. Claude commits the sitting, settles the topic's running agents (9.7.8), and returns to the epic menu, where the discovery row makes the change. For a feature or bugfix, cancelling is manage's (18.3.4). A single question put off for later stays in the conversation (9.5.4). [R17; Claude's derivation, T19]

18.4.21 A topic held by another session is never the recommended row. Entering it asks first, naming when that session was last active, as today. [today's product; Claude's sort, T34]

18.4.22 Cancelling a topic ends each of its open experiments as abandoned, with the cancel recorded as the reason. Reactivating the topic leaves them abandoned. [today's product; Claude's sort, T45]

### 18.5 A specification waits until every topic is decided

18.5.1 A specification waits until every topic is decided, cancelled or postponed. Today the engine refuses new spec structure only while a discussion is in progress, so unstarted topics do not block it; the rule tightens. The reason: groups drawn from half the records come out differently once the rest are decided, and a topic decided after its spec can change the spec's nature. The specification's own gate is Specification's (§11). [R17, plan 3.5; ruled by the person 2026-10-12]

18.5.2 Postponing a topic to the roadmap is how an epic moves on without it. [R17; ruled by the person 2026-10-12]

18.5.3 Grouping a decided subset of topics early is rejected. [R17; ruled by the person 2026-10-12]

### 18.6 The inbox stays true

18.6.1 Each capture skill ends with one fixed engine line that takes the item's text, writes it into the inbox wherever the state lives, commits under the lock and pushes. Today captures are never committed by the skill; now each capture commits its own file. [R17, plan 3.11; ruled by the person 2026-10-16]

18.6.2 The capture skills stay self-contained and know nothing of the engine beyond that line (the person, 2026-10-16: "if we can do that as a one-liner so that Claude has no knowledge, then fine"): a capture is often made from a session in another project, and engine knowledge must not enter a context that only logs and moves on. [R17; ruled by the person 2026-10-16]

18.6.3 The capture line works from any checkout or worktree, and every state commit is the engine's (§4). [R17, R23]

18.6.4 When a unit finishes, Claude checks the inbox against what was built and archives each item the work resolved, through a verb that records the unit that did it (§6). [R17, plan 3.11; ruled by the person 2026-10-16]

18.6.5 The finish report lists every inbox closure, so nothing is silently discarded and a wrong closure can be reopened. [R17; ruled by the person 2026-10-16]

18.6.6 The same verb closes an inbox item fixed straight away. [R17; ruled by the person 2026-10-16]

18.6.7 Screen: the finish report's inbox closures. The finish report (§14) lists every inbox item the finished work closed. [R17]

Screen, drawn by Claude: the finish report's inbox closures, as Portal's Lazy Resume On Attach finishes (the rest of the finish report: see §14). [Claude's derivation, O94]

```text
CLOSED IN THE INBOX (2)
  ├─ Attaching Waits While Every Session Resumes          [bug]
  └─ Resume A Session Only When It's Attached To         [idea]
  ↳ Each is archived as closed by Lazy Resume On Attach. One
    closed wrongly comes back from the archived items in
    triage, or ask me to bring it back.
```

18.6.8 A capture lands in the inbox of the project the item concerns, whichever project's session made it. How the fixed line finds that project and carries the item's kind is the builder's. [R17; Claude's derivation, O70]

18.6.9 A wrong closure is reopened from the archived store's view (18.7.11), or when the person asks in their own words: the item is restored from the archive through its door verb. [R17; today's product; Claude's derivation, O6]

18.6.10 Left to the builder: what the close verb records for an inbox item fixed with no unit. [Claude's sort, B59]

### 18.7 Triage

18.7.1 The inbox is where items live; triage is the act. [R17; ruled by the person 2026-10-16]

18.7.2 "Triage" no longer names anything about mail: messages between topics are mail (§10), the word's last use for mail goes ("triage waiting" becomes "mail waiting", 18.4.16), and the glossary says so (§23). [R17; ruled by the person 2026-10-16]

18.7.3 The triage list shows the inbox items by kind, each with its age. [R17; ruled by the person 2026-10-16]

18.7.4 When the person picks items, Claude names others that fit with them. [R17; ruled by the person 2026-10-16]

18.7.5 The person adjusts which items the set holds with c change; Claude asks which. Today's add, drop and view rows go. [R17; ruled by the person 2026-10-16]

18.7.6 w work them now: the set is worked as one unit, through discovery, whatever kinds it mixes; discovery finds the type from the conversation. [R17; ruled by the person 2026-10-16; Claude's derivation, O71]

18.7.7 r put them on the roadmap: the items go on a horizon the person has named, bugs and quick-fixes included. Claude never names a horizon (18.8.2). [R17, plan 3.11; ruled by the person 2026-10-16]

18.7.8 a archive them. [R17; ruled by the person 2026-10-16]

18.7.9 b back. [R17; ruled by the person 2026-10-16]

18.7.10 Screen: triage. It shows the inbox items by kind, each with its age; once the person has picked items, the others Claude names as fitting with them. Rows: w work, r roadmap, a archive, c change, h help, b back; and, while the archived store holds items, a row into it (18.7.11). [R17; ruled by the person 2026-10-16; today's product; Claude's derivation, O6]

Screen, drawn by Claude: triage over Portal, one bug picked and two items named as fitting with it. [Claude's derivation, O94]

```text
■ Triage · Portal

IDEAS (3)
  ├─ 1. Session Previews Show The Last Command        [3 days]
  ├─ 2. Group Sessions By Project In The Picker      [12 days]
  └─ 3. Rename A Session From The Picker             [5 weeks]

BUGS (2)
  ├─ 4. Preview Flickers When A Session Closes        [2 days]
  └─ 5. Window Names Lost On Restore                  [9 days]

QUICK-FIXES (1)
  └─ 6. Preview Border Off By One At 80 Columns       [1 week]

PICKED (1)
  └─ 4. Preview Flickers When A Session Closes

FITS WITH IT, BY MY READ (2)
  ├─ 1. Session Previews Show The Last Command
  └─ 6. Preview Border Off By One At 80 Columns

· · · · · · · · · · · ·
◆ What would you like to do with what's picked?

w/work    → Work on it now — discovery finds what kind of work
            it is
r/roadmap → Put it on the roadmap, on a horizon you name
a/archive → Archive it
c/change  → Change what's picked — I'll ask which items
v/view    → View the archived items, to restore or delete one
h/help    → What this menu is for, row by row
b/back    → Back to the start menu, nothing changed
```

18.7.11 Today's archived store stays, and so does its view, as today: reached from triage by a row of its own, it lists the archived items, and an item picked there is restored to the inbox or deleted, each a row of its own and the delete confirmed first, through the `inbox` door verbs (6.1.15); its keys are drawn by Claude (18.10.8). [R17; ruled by the person 2026-10-16; today's product; Claude's derivation, O6]

Screen, drawn by Claude: the archived items, opened from triage's view row. [Claude's derivation, O94]

```text
■ Triage · Archived

· · · · · · · · · · · ·
◆ Which item?

1      → Tab Completion For Session Names — idea, archived 3 Oct
2      → Enter In The Preview Should Attach — idea, closed by
         Enter Attaches From Preview
3      → Hidden Sessions Flash On Startup — bug, archived 18 Sep
h/help → What this menu is for, row by row
b/back → Back to triage
```

Screen, drawn by Claude: an archived item picked. [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
Selected: Enter In The Preview Should Attach (idea, closed by
Enter Attaches From Preview)

◆ What would you like to do with it?

u/unarchive → Restore it to the inbox
d/delete    → Delete it for good — it can't be brought back
h/help      → What this menu is for, row by row
b/back      → Back to the archived items
```

Screen, drawn by Claude: the delete, confirmed first. [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
Deleting "Enter In The Preview Should Attach" takes it out of
the archive for good.

◆ Delete it?

y/yes → Delete it for good
n/no  → Keep it in the archive
```

### 18.8 The roadmap

18.8.1 Roadmapping is one step from anywhere: "roadmap it" puts the item on a horizon and reports it in one line, without opening the roadmap. [R17, plan 3.11; ruled by the person 2026-10-16]

18.8.2 The horizon is always the person's: named in their words, or asked — even when only one horizon exists, since the one there may be the backlog when the person wants the item next, in a horizon they would name. Claude never names one. [R17; ruled by the person 2026-10-16]

18.8.3 Starting work from the roadmap goes through discovery, as Start and triage's work do, with the picked items as its seeds. Discovery finds the type — any type, quick-fixes included. This replaces the pull that makes an epic or a feature, and today's pull, which creates the unit itself and skips the opener. [R17, plan 3.11; ruled by the person 2026-10-16]

18.8.4 A roadmap item can also join an epic in progress as a new topic, through that epic's discovery (18.4.9). [R17; ruled by the person 2026-10-16]

18.8.5 The roadmap's home shows each item on one line, with its kind and where it came from. An item's summary shows when the item is picked or asked for. [R17; ruled by the person 2026-10-16]

18.8.6 The roadmap's menu is explicit rows: w work, n new (Claude asks what and which horizon), m move, a archive, p plan the product, h help, b back. [R17; ruled by the person 2026-10-16]

18.8.7 p plan the product is discovery at the product level (§8): the one row that is a conversation, named for what it does. [R17; ruled by the person 2026-10-16]

18.8.8 Today's "converse" row goes: with the gate mod every row is a button, and a button that only says "talk" still leaves the person to say what they meant. [R17; ruled by the person 2026-10-16]

18.8.9 A product-wide talk starts from Start or from the roadmap's plan the product (19.6). [plan 3.11, R22; the person 2026-10-16]

18.8.10 Screen: the roadmap's home. Each item on one line with its kind and where it came from; an item's summary when it is picked or asked for. Rows: w work, n new, m move, a archive, p plan the product, h help, b back. [R17; ruled by the person 2026-10-16]

Screen, drawn by Claude: the roadmap's home, over Fumi. [Claude's derivation, O94]

```text
■ Roadmap · Fumi

next (1)
  └─ 1. A fumi pinned above every window         idea · inbox

later (4)
  ├─ 2. Fumi Sync, a hosted sync service         idea · discovery
  ├─ 3. Storage over a network: SFTP and a…      idea · discovery
  ├─ 4. A fumi's colour drawn from its tags      idea · discovery
  └─ 5. A lifetime tier                          idea · discovery

· · · · · · · · · · · ·
◆ What would you like to do?

w/work    → Work on items now — discovery finds what kind of
            work they are
n/new     → Add an item — I'll ask what it is and which horizon
m/move    → Move an item to another horizon you name
a/archive → Archive an item
p/plan    → Plan the product — a conversation about the product
            as a whole
h/help    → What this menu is for, row by row
b/back    → Back to the start menu
```

18.8.11 Screen: "roadmap it". Where the person has not named a horizon, Claude asks which, even when only one horizon exists, listing the person's existing horizons and a new one and never naming one itself; then one line reports the item put on its horizon. The roadmap is not opened. Its words are drawn by Claude in the spec (18.10.8). [R17; ruled by the person 2026-10-16; Claude's derivation, O94]

Screen, drawn by Claude: the horizon ask of "roadmap it". [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
Putting "A Shortcuts Action To Make A Fumi" on the roadmap.

◆ Which horizon?

1     → next — 1 waiting
2     → later — 4 waiting
n/new → A new horizon — name it
```

Screen, drawn by Claude: the line reporting the item put on its horizon. [Claude's derivation, O94]

```text
On the roadmap: "A Shortcuts Action To Make A Fumi" → later.
```

18.8.12 m move puts a roadmap item on another horizon the person names. [R17; Claude's derivation, O72]

18.8.13 Left to the builder: where an archived roadmap item goes. [Claude's sort, B60]

18.8.14 Outside a topic's map (9.5.4), where the person's words put an item aside without saying where ("backlog that", "later", "not now", naming no horizon), Claude asks whether it goes on the roadmap or into the inbox, and never chooses. [today's product; Claude's sort, T53]

18.8.15 An inbox item put on the roadmap takes its note with it, and every roadmap item keeps pointers to the session logs that shaped it. When work starts from roadmap items, discovery reads each picked item's note and the log sections its pointers name, and only those. [today's product; Claude's sort, T44]

18.8.16 When work starts from some of a horizon's items, Claude names what stays waiting there. [today's product; Claude's sort, T59]

18.8.17 A topic postponed to the roadmap keeps its item saying where it came from (18.8.5). Pulled back into its own epic, the topic returns as it was. Pulled into another epic, it opens as a fresh topic that reads the earlier record as input and never changes it (21.8.9). Postponing is refused while one of the topic's experiments runs. Archiving an item that holds a postponed topic is refused, naming the epic's discovery row, where the topic is cancelled (18.4.9). Left to the builder: a postponed topic whose name another roadmap item already has. [R17, R37, plan 3.11; Claude's derivation, T11]

18.8.18 Plan the product ends, when the person calls for it, with the capabilities the conversation named proposed as roadmap items on one screen. Each is on a horizon the person named or is asked for (18.8.2), and they land on the person's yes, a process gate. "Roadmap it" during the conversation lands an item at once (18.8.1). [R10, R17, record 41; Claude's derivation, T18]

Screen, drawn by Claude: plan the product's close, over Fumi: the capabilities proposed as roadmap items, each on its horizon. [Claude's derivation, O94]

```text
TO THE ROADMAP (4, from this conversation)
  ├─ Import from Apple Stickies                          [next]
  ├─ Fumi on iPhone and iPad                            [later]
  ├─ Fumi widgets on the desktop                        [later]
  └─ Shared fumis between people                      [someday]

· · · · · · · · · · · ·
Your yes puts these 4 on Fumi's roadmap, each on the horizon you
gave it.

◆ Put them on the roadmap?

y/yes        → Put them on the roadmap
Keep shaping → Tell me what to change — an item or its horizon
```

18.8.19 Renaming or rewording a roadmap item, and adding, renaming, reordering, merging, splitting or removing an empty horizon, are done when the person asks in words, and reported in one line with no confirm. The horizons' order is the person's, and the first is read as next. [today's product; Claude's sort, T52]

18.8.20 Once work starts from roadmap items, they leave the roadmap and go with the work as its seeds, the way triaged items leave the inbox: from then on the work shows their progress, and the roadmap shows only what waits. Cancelling the work, cancelling the topic an item became, or removing that topic before it starts (8.8.16) puts the item back on the horizon it came from, as renamed or merged since; where that horizon has been removed, Claude asks which (18.8.2). A topic that takes a waiting item in (8.1.6) takes it off the roadmap the same way. [R17; ruled by the person 2026-10-21; Claude's derivation for a horizon changed since]

### 18.9 Menus explicit and keyed alike, with help

18.9.1 On every menu, anything with a fixed shape is its own row. [R17; ruled by the person 2026-10-16]

18.9.2 Typing stays open at any menu, for a question. [R17; ruled by the person 2026-10-16]

18.9.3 The same action keeps the same key on every menu: a archive, w work, b back. [R17, plan 3.11; ruled by the person 2026-10-16]

18.9.4 Every menu screen has h help, so help is always one press away rather than something the person has to know they can ask for. Gates and raises do not carry it: a question typed at a gate sets the gate aside, as at any gate. [R17, plan 3.11; the person's addition 2026-10-16; R40; Claude's derivation, O73]

18.9.5 Screen: help, on any menu. A few lines on what this screen is for and what each row does — what discovery, the roadmap or triage is, where the screen needs it — then an invitation to ask about anything else. The start menu's help opens the same, with the full walkthrough reached from it (§23). [R17; the person's addition 2026-10-16]

Screen, drawn by Claude: a menu's help, here triage's. [Claude's derivation, O94]

```text
■ Help · Triage

Triage works through the inbox: the ideas, bugs and quick-fixes
noted down to come back to. Pick items, and I'll name others
that fit with them.
  · Work starts on what's picked now, as one piece of work;
    discovery finds what kind of work it is as we talk.
  · Roadmap puts what's picked on the roadmap, on a horizon you
    name; I never pick one.
  · Archive takes what's picked out of the inbox and into the
    archived items.
  · Change adds items to what's picked, or takes some out; I'll
    ask which.
  · View lists the archived items, to restore one to the inbox
    or delete it for good.
  · Back leaves triage with nothing changed.
Ask about anything else.

· · · · · · · · · · · ·
◆ What would you like to do?

b/back → Back to triage
Ask    → Ask anything about triage or the inbox
```

### 18.10 Every screen follows the existing design system

18.10.1 The release does not redesign the screens. New screens and edits to existing ones keep to the existing design system's standards, the tree included. [R17, plan 3.11; ruled by the person 2026-10-19]

18.10.2 Most screens are engine-drawn, so most of the release's screens fall out of the design system. [R17; ruled by the person 2026-10-19]

18.10.3 Edits and variants that fit the design system are allowed and stay consistent with it ("it needs to be consistent"). Every variant or change is drawn in the spec, so the person sees it before it is built. [R17, plan 3.11; ruled by the person 2026-10-19]

18.10.4 A new look, if one is ever wanted, is made across the whole product as its own release, never part of this one. [R17, plan 3.11; ruled by the person 2026-10-19]

18.10.5 The gate mod shows a menu's rows as buttons, so the screen above them stays a printed message the engine draws. [R17]

18.10.6 The mod's panel is not held to the design system: see §20. [R17, plan 3.11; ruled by the person 2026-10-20]

18.10.7 The menus' ⚑ keeps its colour in the transcript. [R17; agreed in the panel spike 2026-10-20]

18.10.8 Where the sources leave a screen's rows or words open — the start menu's keys, manage's rows, row wording across the menus (the discovery row's included), the horizon ask, the quick-fix's close, the migration guard's refusal and boot's refusal past an unfinished directive — Claude draws it in the spec, in the existing design system, from the rows the sources name, the same action on the same key (a archive, w work, b back, h help), and marks it as Claude's; the person ticks or comments on it on the spec page, and none is raised beforehand. Where the sources pin part of a screen, that part holds. [R17; Claude's derivation, O94]

18.10.9 The gate mod's band keeps today's behaviour:
- rows only typing can answer are dim, with a footer saying so;
- rows page inside a fixed height;
- a second click while Claude works is held, marked queued, and sent only if the same gate still stands;
- Esc before a tool runs puts the gate back;
- the gate is kept per conversation and drawn again on resume, while the transcript still ends there.
[today's product; Claude's sort, T31]

## 18-S. Scenarios for §18

18.S1 Given a project with an epic in discussion where 1 of 4 topics is decided and a feature in its build at phase 2 of 3, when the person opens the start menu, then the epic's row reads "Continue epic: {Name}" with "discussion, 1 of 4 topics decided", the feature's row "Continue feature: {Name}" with "build, phase 2 of 3", and neither row names a topic. (18.2.1, 18.2.2, 18.2.6, 18.2.12)

18.S2 Given two units, one with a builder's question waiting and one with nothing waiting, when the start menu renders, then the unit with the question is listed first with "1 question waiting for you" and no separate waiting section or jump-past row appears. (18.2.3, 18.2.5, 18.2.12)

18.S3 Given the person picks a unit on the start menu, when the unit opens, then what waits on the person in it is listed first, inside the unit. (18.2.1, 18.2.4)

18.S4 Given any project, when the start menu renders, then it shows one Start row and no start-by-type rows, and the inbox as one line with its count by kind rather than a row per item. (18.2.7, 18.2.8, 18.2.12)

18.S5 Given a project, when the start menu renders, then it shows the triage row "t/triage → Triage the inbox", the roadmap, completed units, cancelled units, manage and h help. (18.2.9, 18.2.10, 18.2.12)

18.S6 Given verdicts waiting in the verdict queue, when the start menu renders, then a verdict-queue project row shows beside the inbox and the roadmap; given none waiting, no such row shows. (18.2.11, 18.2.12)

18.S7 Given a decided feature, when the person opens manage on the start menu, then manage offers to reopen its decision beside pivot, absorb and cancel; given a cancelled bugfix, manage offers to bring it back. (18.3.1, 18.3.2, 18.3.3, 18.3.4, 19.1.2)

18.S8 Given a feature whose decision the person reopens through manage and changes, when the change is recorded, then the ledger holds a new entry replacing the earlier one. (18.3.2)

18.S9 Given an epic in discussion with an approve-the-map gate waiting and a verdict waiting, when the epic menu renders, then it is headed by the phase, and the gate and the verdict are listed first, each with its door. (18.4.1, 18.4.2, 18.4.17)

18.S10 Given an epic in discussion with topics in progress, decided, with mail waiting and with experiments waiting, when the epic menu renders, then the topics are shown by those needs, no topic shows a count of its questions, and a topic not yet started reads "Start". (18.4.3, 18.4.4, 18.4.5, 18.4.17)

18.S11 Given an epic with one topic undecided, when the epic menu renders, then no spec row and no ready-to-build row shows; given every topic decided, then the spec row is offered. (18.4.1, 18.4.6, 18.5.1, 18.4.17)

18.S12 Given an epic in its build, when the epic menu renders, then it shows the build's phase N of M in place of plan rows, and later the review. (18.4.6, 18.4.17)

18.S13 Given an epic whose topics have a foundations-first order, when the epic menu renders, then the recommended row comes first in that order. (18.4.7)

18.S14 Given a topic held by a session in another pane, when the epic menu renders in this session, then that topic's row is struck through and the person can open another topic. (18.4.8)

18.S15 Given an epic before its spec, when the person wants a new topic, to cancel, postpone, pull forward, reactivate or reopen a decided topic, and looks at the epic menu, then none of these has a row of its own and each is done through the discovery row, whose label says what it is for. (18.4.9, 18.4.10, 18.4.17)

18.S16 Given the epic menu, when it renders, then it carries no research-only rows, no planning rows, no grouping row, no "dead end" state, and every phase label reads discussion where research and discussion were. (18.4.11, 18.4.13, 18.4.15)

18.S17 Given a soft gate that remains on the way between epic phases, when the person has answered it the same way repeatedly, then it is learned like any process gate. (18.4.12)

18.S18 Given a topic with two messages waiting, when the person cancels the topic, then both messages land in the inbox and the topic no longer shows "mail waiting". (18.4.14)

18.S19 Given a topic that ends in not doing the work, when it closes, then it is either decided with "not doing it" as its decision or cancelled; no "dead end" state is available. (18.4.15)

18.S20 Given a topic with messages waiting, when the epic menu renders, then its row reads "mail waiting", never "triage waiting". (18.4.16, 18.7.2)

18.S21 Given an epic with three topics decided, one cancelled, one postponed to the roadmap and none in progress or unstarted, when spec structure is asked for, then the spec proceeds; given one topic unstarted, then it waits. (18.5.1, 18.5.2)

18.S22 Given a session in another project, when the person says to log a bug and the capture skill runs, then the skill's one fixed engine line writes the item into the inbox where the state lives, commits it under the lock and pushes, and the capture skill's context holds no other engine knowledge. (18.6.1, 18.6.2)

18.S23 Given a session running in a code worktree, when a capture is made, then the item still lands in the one state copy and its commit is the engine's. (18.6.3)

18.S24 Given an inbox holding two items the finished unit resolved and one it did not, when the unit finishes, then the two are archived through the close verb recording the unit, the third stays, and the finish report lists both closures. (18.6.4, 18.6.5, 18.6.7)

18.S25 Given an inbox item the person fixes straight away in conversation, when Claude closes it, then the same close verb archives it. (18.6.6)

18.S26 Given an inbox of bugs and ideas and nothing archived, when the person opens triage, then the items show by kind, each with its age, and the menu reads w work, r roadmap, a archive, c change, h help, b back. (18.7.3, 18.7.10, 18.9.3)

18.S27 Given the person picks one bug in triage, when the pick lands, then Claude names other items that fit with it, and c change lets the person adjust the set, Claude asking which items. (18.7.4, 18.7.5, 18.7.10)

18.S28 Given a set of picked items, when the person presses w, then the set goes into discovery as one unit. (18.7.6)

18.S29 Given a picked bug and the person has not named a horizon, when they press r, then Claude asks which horizon and never proposes one; the bug lands on the roadmap, on the horizon the person names. (18.1.3, 18.7.7, 18.8.2)

18.S30 Given picked items, when the person presses a, then the items are archived; when they press b instead, triage is left with nothing changed. (18.7.8, 18.7.9)

18.S31 Given a discussion session and a roadmap with one horizon, when the person says "roadmap it" without naming a horizon, then Claude asks which horizon, listing the existing one and a new one and naming neither as its own pick, puts the item on the horizon the person names and reports it in one line, without opening the roadmap. (18.8.1, 18.8.2, 18.8.11)

18.S32 Given the person says "roadmap it for next", when Claude acts, then the item goes on "next" and one line reports it, with no question. (18.8.1, 18.8.2, 18.8.11)

18.S33 Given roadmap items picked with w, when the work starts, then it starts in discovery with the items as its seeds, and discovery settles the type, a quick-fix included; no unit is created before discovery's opener. (18.8.3)

18.S34 Given an epic in progress, when a roadmap item is to join it, then it joins as a new topic through that epic's discovery. (18.8.4)

18.S35 Given a roadmap with items, when the person opens it, then each item shows on one line with its kind and where it came from, the menu reads w work, n new, m move, a archive, p plan the product, h help, b back, and no "converse" row shows; picking an item shows its summary. (18.8.5, 18.8.6, 18.8.8, 18.8.10, 18.9.1)

18.S36 Given the roadmap, when the person presses n, then Claude asks what the item is and which horizon it goes on. (18.8.6)

18.S37 Given the roadmap, when the person presses p, then a product-level discovery conversation opens. (18.8.7, 18.8.9)

18.S38 Given any menu, when the person types a question instead of pressing a row, then it is taken as a question and answered. (18.9.2)

18.S39 Given the start menu, triage, the roadmap and the epic menu, when each renders, then each carries h help, and archive is a, work is w and back is b on every one that offers them. (18.9.3, 18.9.4)

18.S40 Given the triage menu, when the person presses h, then a few lines say what triage is for and what each row does, followed by an invitation to ask about anything else; given the start menu, the help also reaches the full walkthrough. (18.9.4, 18.9.5)

18.S41 Given any screen the release adds or changes, when it is compared with the existing design system, then it keeps to its standards, the tree included, and the spec draws it, marked as Claude's where the sources left its rows or words open. (18.10.1, 18.10.3, 18.10.8)

18.S42 Given a menu rendered with the gate mod running, when it shows, then the engine's printed message stands above the rows and the rows show as buttons. (18.10.5)

18.S43 Given a menu carrying ⚑, when it renders in the transcript, then the ⚑ keeps its colour. (18.10.7)

18.S44 Given a unit with an authority gate waiting and a question waiting, and verdicts waiting in the project's queue, when the start menu renders, then the unit's count covers the gate and the question and not the verdicts, which show on the verdict queue's project row. (18.2.3, 18.2.11, 18.2.12)

18.S45 Given an epic, when the person asks in their own words for a new topic, or to pull one forward, reactivate one or reopen a decided one, then it is done and reported in one line with no confirm; when they ask to cancel a topic, the cancel confirms first. (18.4.9)

18.S46 Given an epic with a decided topic, a cancelled topic and a postponed topic, when the epic menu renders, then beneath the phase heading a tally counts its topics and how many are decided, cancelled and postponed, the decided topic is listed with no key, and the cancelled and postponed topics are listed after the live ones with no key, the postponed one with its horizon. (18.4.17, 18.4.18)

18.S47 Given a session in one project, when the person logs a bug about another project, then the item lands in the other project's inbox. (18.6.8)

18.S48 Given an inbox item a unit's finish closed though the work did not resolve it, and another archived in triage by mistake, when the person opens the archived store from triage's row and restores the first, and asks in words to bring the second back, then each is restored from the archive to the inbox through its door verb; when the person deletes an archived item from that view, then the delete confirms first and the item is gone from the archive. (18.6.5, 18.6.9, 18.7.10, 18.7.11, 6.1.15)

18.S49 Given a picked idea and a picked bug, when the person presses w, then the two are worked as one unit through discovery, which finds the type from the conversation. (18.7.6)

18.S50 Given a roadmap item on one horizon, when the person presses m and names another horizon, then the item sits on the horizon they named. (18.8.6, 18.8.12)

18.S51 Given a gate or a raise, when it renders, then it carries no h help; when the person types a question at the gate, the gate is set aside and the question answered. (18.9.4)

18.S52 Given an epic in discussion with a decided topic whose entry relied on an answer another topic replaced, when the epic menu renders, then that topic is among what waits on the person, reading "{topic}: a decision it relies on changed", with a door that opens the topic to confirm "still holds" or replace, and it is not in the decided list; the start menu's count for the epic includes it; once the topic records "still holds" or a replacement for each such entry, it is listed with the decided topics again, with no key. (18.2.3, 18.4.2, 18.4.17, 18.4.18, 10.2.6)

18.S53 Given a feature whose spec has started, when the person opens it in manage, then pivot and absorb are not offered; given a feature before its spec, absorb offers only epics before their spec. (18.3.5)

18.S54 Given a completed feature, when the person reopens its decision through manage, then it is brought back; given a completed epic, manage offers no reopen. (18.3.6)

18.S55 Given an epic whose spec has started, when its menu shows, then it carries no discovery row, and no topic can be added, cancelled, postponed, pulled forward, reactivated or reopened; given the person agrees a split at the outline, topics move as 11.10.3 says, before ready to build's yes. (18.4.19, 18.4.17, 8.6.5)

18.S56 Given a topic in session, when the person asks inside it to postpone the topic, then Claude commits the sitting, settles the topic's running agents and returns to the epic menu, where the discovery row makes the change; given a single question put off for later, it stays in the conversation. (18.4.20, 9.7.8, 9.5.4)

18.S57 Given a topic held by another session, when the epic menu shows, then it is never the recommended row; when the person enters it, they are asked first, naming when that session was last active. (18.4.21)

18.S58 Given a topic with an open experiment, when the topic is cancelled, then the experiment ends abandoned with the cancel as its reason; when the topic is reactivated, the experiment stays abandoned. (18.4.22)

18.S59 Given the person says "backlog that" outside a topic's map, naming no horizon, then Claude asks whether it goes on the roadmap or into the inbox, and does not choose. (18.8.14)

18.S60 Given an inbox item put on the roadmap, then its note travels with it; given work started from roadmap items, then discovery reads each picked item's note and the log sections its pointers name, and no other log. (18.8.15)

18.S61 Given work started from two of a horizon's five items, then Claude names the three still waiting there. (18.8.16)

18.S62 Given a postponed topic, when it is pulled back into its own epic, then it returns as it was; when it is pulled into another epic instead, it opens as a fresh topic that reads the earlier record and never changes it. Given one of a topic's experiments running, postponing the topic is refused; given a roadmap item holding a postponed topic, archiving it is refused, naming the epic's discovery row. (18.8.17)

18.S63 Given plan the product, when the person calls for its end, then the capabilities the conversation named show as roadmap items on one screen, each on a horizon the person named or was asked for, and they land on the person's yes. (18.8.18)

18.S64 Given the person asks in words to rename a horizon and merge two others, then both are done and each is reported in one line with no confirm. (18.8.19)

18.S65 Given a gate on the band, when the person clicks a second row while Claude works, then the click is held, marked queued, and sent only if the same gate still stands; given Esc before a tool runs, the gate is put back; given a resume while the transcript still ends at the gate, the gate is drawn again. (18.10.9)

18.S66 Given two items waiting on the horizon "later", when work starts from both, then neither shows on the roadmap's home and the work holds both as seeds; when that work is cancelled, both show again on "later". Given a topic made from a roadmap item, removed before it starts, then the item shows again on its horizon; given that horizon since removed, Claude asks which horizon it goes on. (18.8.20, 8.8.16, 18.8.2)

## 19. Work types

### 19.1 The types

19.1.1 The work types are epic, feature, bugfix and quick-fix. Cross-cutting goes as a type (19.6). [R10, R18–R22]

19.1.2 A feature, bugfix or quick-fix has no menu of its own; reopening its decision and bringing back a cancelled one go through manage (18.3). [R17, plan 3.11; Claude's derivation, O81]

19.1.3 "Continue feature: X" goes straight to where the unit stands: into its current phase, or onto what waits on the person there, with no menu between. The same holds for "Continue bugfix" and "Continue quick-fix". Today's in-between menu ("Proceed to {phase}" or "Revisit an earlier phase") goes; revisiting moves to manage (18.3.2). [R19, plan 3.12; ruled by the person 2026-10-16]

### 19.2 Epic

19.2.1 An epic's phases are discovery → discussion → specification → implementation → review. [R18]

### 19.3 Feature

19.3.1 A feature is its own type, and linear. [R19]

19.3.2 In discussion a feature is an epic with one topic: its decision can be the opening view and one answer (§9). [R19, R11]

19.3.3 Discovery leans one topic (§8). [R19, R10]

19.3.4 A feature stops for the person at start this work, at decided and ready to build (one screen; see §11), at finish, and where the ask rule sends a question (§16). [R19, R14, R40]

19.3.5 A feature's phases are discovery → discussion → specification → implementation → review, with an experiment called from discussion. [R9, R18, R19; Claude's derivation, O74]

19.3.6 A feature's discussion offers the pivot to an epic when a point needs decisions of its own. The point lands as a message to the new topic, and the conversation carries on. [today's product; Claude's sort, T51]

### 19.4 Bugfix

19.4.1 A bugfix's phases are discovery → investigation → specification → implementation → review. [R20]

19.4.2 Investigation's rigour stays — symptoms, code analysis, root cause before fix — with its procedure loosened like every phase's. [R20]

19.4.3 Investigation is the log of finding the cause, dead ends included. A bugfix has one topic, whose log is the investigation, and its record is drawn from its entries, as for any topic. [R20, Layout on disk]

19.4.4 The root cause, the findings and the fix are ledger entries, which the knowledge base reaches through the records. The specification is what the builder works from. [R20]

19.4.5 A root cause that is really a design problem is raised to the person, and the work may become a feature. [R20]

19.4.6 A bug folded into a feature skips investigation, as the mailbox rework ruled. [R20]

19.4.7 Both validations — the root cause's and the fix's — always run, and Claude acts on what they find, recording it in the investigation. [R20, plan 3.12; ruled by the person 2026-10-12]

19.4.8 The root-cause validation runs at extra-high, fixed in its agent's definition (§26, which also sets the fix validation's level). [R20, R46]

19.4.9 The address-or-dismiss gates after the validations go. [R20; ruled by the person 2026-10-12]

19.4.10 A validation finding that changes what the fix does for the person reaches them as a product question. [R20; ruled by the person 2026-10-12]

19.4.11 Earlier fixes are part of the analysis: as Claude reads the code, it checks whether the area was fixed before and whether the cause sits in the design. Nothing of this is shown to the person and nothing is counted. [R20, plan 3.12; ruled by the person 2026-10-12]

19.4.12 When the cause sits in the design or the area keeps breaking, the fix-direction question gains one option: rework the area as a feature. What feeds this option beyond the investigation's own reading is Verification's (the feature map's bugs grouped by area). [R20, R32; ruled by the person 2026-10-12]

19.4.13 Before setting out fix options, Claude steps back from the bug, with the same stance as a failed review in the build (§13): is the bug there because the implementation was wrong, or was it right and an edge case has turned up; is there another way to do it — a different abstraction or mechanism — that higher-level thinking reveals. The fix options show what that found. [R20, plan 3.12; ruled by the person 2026-10-16]

19.4.14 No step prescribes finding out how comparable tools handle the problem: the rule is the general one (§2), and looking at other tools is one way Claude may reach for it. [R20; ruled by the person 2026-10-16]

19.4.15 A bugfix's spec is the spec every type writes (§11), with no rule of its own: assembled from the investigation's entries — the root cause, the fix, the existing rules it keeps with their checks — and ending with the phase cut. Its review hunts gaps and reads again only what changed, usually one pass at this size. Ready to build shows a short outline and the cut. [R20, plan 3.12; ruled by the person 2026-10-16]

19.4.16 The bug is proven before it is fixed, by a check. The first task writes the test that reproduces the bug. [R20, plan 3.12; ruled by the person 2026-10-16]

19.4.17 The engine records the reproducing test run on the unfixed code, several times, failing every time, and the commit door refuses a fix commit until that run is recorded (the verb and the number of runs: see §15). Today this is guidance only. [R20, plan 3.12; ruled by the person 2026-10-16]

19.4.18 After the fix, the same test passes in the build's own gates. [R20; ruled by the person 2026-10-16]

19.4.19 Investigation's plan, check-in and conclude gates follow the phase's position (§3): learned in auto, stopping in step. Ready to build stays the authority gate before any code. [R20, R40, plan 3.12; ruled by the person 2026-10-16]

19.4.20 Testing against a live server is danger (§16), which stops in both positions. The per-project verify setup (§15) holds how to run the product safely, given once. [R20, R24, R32; ruled by the person 2026-10-16]

19.4.21 Screen: the bugfix's fix-direction question, when the ask rule sends it to the person (19.4.22). It sets out the fix options, showing what Claude's step back found (19.4.13); where the cause sits in the design or the area keeps breaking, it carries one more option: rework the area as a feature. [R20; Claude's derivation, O75]

Screen, drawn by Claude: the fix-direction question over Portal's bugfix, in an area that keeps breaking, so it carries the option to rework the area as a feature. [Claude's derivation, O94]

```text
Q1 · Killing All Sessions Wipes Restore State · investigation

Killing every session leaves restore nothing to bring back. How
should Portal fix it?

WHAT I FOUND STEPPING BACK
  · Restore saves what's running every few seconds. Once nothing
    is running, the next save is empty and replaces the last
    good one. The code does what it was written to do; killing
    everything is a case it never met.
  · Another way: restore keeps its last few saves, so an empty
    moment never replaces the ones with sessions in them.

I lean: never save an empty restore state over a full one.

WHAT YOU'D NOTICE
  · Never save empty: after killing everything, the next start
    brings back what was running before the kill.
  · Keep the last few: the same, and a save that went wrong can
    fall back to the one before it.
  · Rework restore: nothing changes yet; how restore works is
    decided afresh as a feature, then built.

WHY I'M ASKING
  It's behaviour, and on behaviour in Portal my calls still miss
  more often than you allow: 26%, over your 20%.

· · · · · · · · · · · ·
◆ Which way?

1           → Never save an empty restore state over a full one
              (recommended)
2           → Keep the last few saves, and restore from the
              newest with sessions in it
3           → Rework restore as a feature — you'll confirm the
              feature at start this work
t/technical → Show the mechanism
e/explain   → I don't follow — explain it again
Comment     → Ask about it, or tell me what I've missed
```

19.4.22 The fix-direction question goes through the ask rule like any product question (§16). A direction that reworks the area as a feature still meets start this work when the feature is created. [R20, R40; Claude's derivation, O75]

19.4.23 The conclude gate shows a short recap of the hunt, with the root cause told against the symptoms the person reported, and the fix direction, at its heart. Today's separate findings sign-off folds into it. Where the gate runs as an automatic step, its one-line report stands in its place (3.2.9) and the recap stays on the board's investigation view (20.12). [R20; Claude's derivation, T15]

19.4.24 A finding that invalidates the agreed analysis plan brings the revised plan back to the plan gate; the analysis never re-plans past it. [R20; Claude's derivation, T16]

19.4.25 When a start's seeds mix bugs with ideas and discovery makes a feature or an epic, Claude says that each bug gets no investigation of its own. [today's product; Claude's sort, T60]

### 19.5 Quick-fix

19.5.1 Quick must be quick: a quick-fix is one session from "what's the change?" to closed, with no handoffs. The clean-context handoff stays for the heavy phases (§24). [R21, plan 3.12; ruled by the person 2026-10-12]

19.5.2 Every way into a quick-fix — the start menu, the inbox (one item or a set), the roadmap — lands on the same short opener (§8). Today a roadmap pull skips the opener and goes straight to scoping. [R21; ruled by the person 2026-10-12]

19.5.3 Claude does the work, runs the tests and linters, and commits. Its calls go to the ledger, and a question the ask rule sends the person is raised as anywhere else (§16). [R21; ruled by the person 2026-10-12]

19.5.4 A quick-fix is its own task, each fix in a set its own (19.5.11), so the commit door takes it without a plan (§6). [R21; ruled by the person 2026-10-12; Claude's derivation, O76]

19.5.5 No document is written before the work, and no plan. Scoping goes. [R21, R9; ruled by the person 2026-10-12]

19.5.6 A short record is written after the work — what changed, why, what it leaves out — and the knowledge base indexes it. It is the quick-fix's `summary.md` (§4). [R21, Layout on disk; ruled by the person 2026-10-12]

19.5.7 A quick-fix has no review step. A change to behaviour is proven by running the product where the project has a way to (§15). The person can ask for a review, through a row at the close (19.5.13). [R21, plan 3.12; ruled by the person 2026-10-12; Claude's derivation, O94]

19.5.8 The quick-fix's close is its finish gate: it says what was proven and asks a verdict on each call the person changed in it (§16); where they changed none, nothing is added. [R21, R23; ruled by the person 2026-10-12 and 2026-10-18; Claude's derivation, O76]

19.5.9 Work that needs a decision from the person beyond a quick call moves to feature or bugfix through a verb (§6), inside the quick-fix's own session, when the work shows that need. Today that is a line of prose with no route. [R21, plan 3.12; ruled by the person 2026-10-12; Claude's derivation, O68]

19.5.10 The size check before the work goes. [R21; ruled by the person 2026-10-12]

19.5.11 A set of items from the inbox (triage's w, 18.7.6) runs in one sitting as one unit, each fix its own task, keeping its own commit and its own short record. [R21; ruled by the person 2026-10-16; Claude's derivation, O76]

19.5.12 A quick-fix stays a tracked work unit on the start menu, and it closes. [R21]

19.5.13 Screen: the quick-fix's close, its finish gate. It says what was proven by running the product, and asks a verdict on each call the person changed in the quick-fix, with skip beside them; where they changed none, nothing is added (16.10.5). It carries a row to ask for a review. Its other rows and words are drawn by Claude in the spec (18.10.8). [R21, R23; Claude's derivation, O76, O94]

Screen, drawn by Claude: the quick-fix's close, where the person changed none of Claude's calls. [Claude's derivation, O94]

```text
M Marks Highlighted On Entry — ready to close

PROVEN BY RUNNING PORTAL
  └─ ✓ m marks the session under it

· · · · · · · · · · · ·
◆ Close it?

y/yes    → Close it — merge its pull request and mark it complete
r/review → Have it reviewed before it closes
Ask      → Ask about the change before it closes
```

19.5.14 A quick-fix's phases are discovery → implementation, with a review only when the person asks. [R9, R21, Layout on disk; Claude's derivation, O76]

19.5.15 A quick-fix's code lands as a pull request through the landing driver, merged at the close (§7). [R35, R21; Claude's derivation, O76]

19.5.16 Left to the builder: what the quick-fix's move verb carries into the feature or bugfix. [Claude's sort, B61]

19.5.17 Left to the builder: where a quick-fix set's several short records sit beside `summary.md`. [Claude's sort, B62]

19.5.18 A quick-fix's work takes its turn in the checkout (12.7.8). [today's product; Claude's sort, T25]

19.5.19 A quick-fix's opener runs one knowledge-base query for earlier work on the area it touches, before the work starts. [today's product; Claude's sort, T46]

### 19.6 Cross-cutting goes as a type

19.6.1 Cross-cutting goes as a work type. Its point was a terminal spec later work reads; the product record (§8) now does that job, and a spec is the build's working document (§11), which a unit with no build never needs. [R22, plan 3.12; ruled by the person 2026-10-16]

19.6.2 Promoting a topic into a cross-cutting unit goes with grouping (§11). [R22]

19.6.3 A principle is decided where it arises and marked product-wide. [R22, plan 3.12; ruled by the person 2026-10-16]

19.6.4 A principle the person wants to talk through on purpose is a product-level conversation, reached through Start, where discovery meets it at the level it reaches, or through the roadmap's plan the product (18.8.7). It is logged in the roadmap's per-session logs. [R22; ruled by the person 2026-10-16; Claude's derivation, O33]

19.6.5 That conversation is discovery, so it decides nothing: its principles are carried as input and decided in the first topic each bears on, as product-wide entries (§8). [R22, R10; ruled by the person 2026-10-19]

19.6.6 A design system or similar convention more often belongs in a project skill or CLAUDE.md, which the workflow sessions pull in anyway; the workflows never write CLAUDE.md (§8). [R22, R10]

19.6.7 Existing cross-cutting units migrate: their specs become product-wide entries (21.7.3). [R22, R37]

## 19-S. Scenarios for §19

19.S1 Given a new piece of work, when discovery settles its type, then the type is one of epic, feature, bugfix or quick-fix; cross-cutting is never offered. (19.1.1, 19.6.1)

19.S2 Given a feature mid-discussion, when the person picks "Continue feature: X" on the start menu, then the session goes straight into discussion, or onto what waits on the person there, with no "Proceed" or "Revisit" menu between. (19.1.3, 19.3.1)

19.S3 Given a bugfix in its build and a quick-fix in progress, when the person continues each, then each goes straight to where it stands. (19.1.3)

19.S4 Given an epic, when it moves through its phases, then they run discovery, discussion, specification, implementation, review. (19.2.1)

19.S5 Given a feature in discussion whose opening view settles everything but one question, when the person answers it, then the topic can go to decided. (19.3.2)

19.S6 Given a feature from start to finish in auto, when it runs, then the person is stopped at start this work, at one combined decided-and-ready-to-build screen, at finish, and wherever the ask rule sends a question. (19.3.4)

19.S7 Given a bugfix, when it moves through its phases, then they run discovery, investigation, specification, implementation, review; its one topic's log is the investigation, dead ends included, and it records symptoms and code analysis and settles the root cause before any fix is set out. (19.4.1, 19.4.2, 19.4.3)

19.S8 Given a bugfix's investigation, when the cause is found, then the root cause, the findings and the fix exist as ledger entries on its topic, and the topic's record shows them. (19.4.4)

19.S9 Given a bug added to a feature, when the feature runs, then no investigation phase runs for the bug. (19.4.6)

19.S10 Given an investigation that has a root cause and a proposed fix, when the validations run, then both always run, the root-cause validator at extra-high, their findings are recorded in the investigation, and no address-or-dismiss gate follows. (19.4.7, 19.4.8, 19.4.9)

19.S11 Given a validation finding that changes what the fix does for the person, when Claude acts on it, then the person gets it as a product question. (19.4.10)

19.S12 Given an investigation in an area fixed several times before, when Claude sets out fix options, then the fix-direction question carries "rework the area as a feature", and the person is shown no count of the earlier fixes. (19.4.11, 19.4.12, 19.4.21)

19.S13 Given a bug whose cause shows the design is right and an edge case has turned up, when Claude sets out fix options, then the options show what the step back found, including any different mechanism it revealed. (19.4.13, 19.4.21)

19.S14 Given a root cause that is really a design problem, when Claude finds it, then it raises it to the person, with becoming a feature among the ways forward. (19.4.5)

19.S15 Given a bugfix whose investigation is decided, when its spec is written, then it is assembled from the investigation's entries — root cause, fix, existing rules kept with their checks — ending with the phase cut, and ready to build shows a short outline and the cut. (19.4.15)

19.S16 Given a bugfix build whose first task wrote the reproducing test, when Claude tries to commit the fix before the engine has recorded the test failing on the unfixed code, then the commit door refuses; once the failing runs are recorded, it takes the commit, and after the fix the test passes in the build's gates. (19.4.16, 19.4.17, 19.4.18)

19.S17 Given an investigation in auto whose plan gate the person always answers "proceed", when the plan gate comes, then it is a learned step; given step, it stops. In both, ready to build stops before any code. (19.4.19)

19.S18 Given an investigation whose testing would run against a live server, when the question arises, then it stops for the person in auto and in step. (19.4.20)

19.S19 Given a quick-fix started from the start menu, from a single inbox item, from an inbox set and from the roadmap, when each begins, then each lands on the same short opener, and none goes straight to scoping. (19.5.2)

19.S20 Given a quick-fix, when it runs, then it runs to closed in one session with no handoff, no document before the work, no plan and no size check; Claude makes the change, runs the tests and linters, and commits, and the commit door takes it without a plan. (19.5.1, 19.5.3, 19.5.4, 19.5.5, 19.5.10)

19.S21 Given a quick-fix whose change alters behaviour and whose project has a way to run the product, when it closes, then no review step runs, the close says what was proven by running it, and a short record of what changed, why and what it leaves out is written and indexed. (19.5.6, 19.5.7, 19.5.8, 19.5.13)

19.S22 Given a quick-fix in which the person changed one of Claude's calls, when it closes, then the close, its finish gate, asks a verdict on that call with skip beside it; given none changed, no verdict is asked. (19.5.8, 19.5.13)

19.S23 Given a quick-fix whose close is reached, when the person picks the close's row to ask for a review, then one runs. (19.5.7, 19.5.13)

19.S24 Given a quick-fix that turns out to need a decision from the person beyond a quick call, when that shows, then the work moves to a feature or a bugfix through the verb, from inside the quick-fix's own session, with no visit to manage. (19.5.9, 18.3.4)

19.S25 Given three quick-fix items worked as one set from triage, when the unit closes, then each fix is its own task with its own commit and its own short record, and the unit sat on the start menu until it closed. (19.5.4, 19.5.11, 19.5.12)

19.S26 Given a principle decided inside a topic as bearing on the whole product, when it is recorded, then it is a product-wide entry. (19.6.3)

19.S27 Given the person wants to talk through a product-wide principle, when they pick Start or the roadmap's plan the product, then the conversation is discovery at the product level, logged in the roadmap's per-session logs, and the principle enters the record only when the first topic it bears on decides it. (19.6.4, 19.6.5)

19.S28 Given an epic's specification, when it is written, then no topic can be promoted into a cross-cutting unit. (19.6.2)

19.S29 Given a feature, when it moves through its phases, then they run discovery, discussion, specification, implementation, review, and an experiment runs only when the discussion calls one. (19.3.5)

19.S30 Given a bugfix's fix-direction question, when it arises, then it goes through the ask rule like any product question; given the person takes reworking the area as a feature, then start this work stops for them when the feature is created. (19.4.21, 19.4.22)

19.S31 Given a quick-fix, when it runs, then its phases are discovery then implementation, and a review runs only when the person asks for one. (19.5.14)

19.S32 Given a quick-fix in a project on GitHub, when its change is committed, then it lands as a pull request through the landing driver, merged at the close. (19.5.15)

19.S33 Given a feature's discussion where a point needs decisions of its own, then Claude offers the pivot to an epic; on the person's yes, the point lands as a message to the new topic and the conversation carries on. (19.3.6)

19.S34 Given an investigation reaching its conclude gate, when the gate shows, then it carries a short recap of the hunt, with the root cause told against the symptoms the person reported, and the fix direction, and no separate findings sign-off comes before it. (19.4.23)

19.S35 Given a finding that invalidates the agreed analysis plan, then the revised plan comes back to the plan gate before the analysis goes on. (19.4.24)

19.S36 Given a start whose seeds mix a bug with ideas, when discovery makes a feature, then Claude says the bug gets no investigation of its own. (19.4.25)

19.S37 Given a quick-fix's opener, when it runs, then one knowledge-base query for earlier work on the area it touches runs before the work starts. (19.5.19)

## 20. The workflows board

The canonical asset for this section is the locked spike,
`~/.claude/projects/-Users-leeovery-Code-agentic-workflows/workflows-reshaped-measure/build-panel-spike/`
(`hooks/register.ts`, `hooks/four.ts` and their tests), locked by the person
on 2026-10-21 over snapshots of real projects: the build over Mint's build,
the discussion over Fumi's epic, the specification and the review over Mint's
records, each in a round of its own; then discovery over Fumi's first
session, a bug's investigation over Portal's kill-all bug and a quick-fix
over Portal's m-marks fix in one round, the experiment drawn in it over a
real question from Fumi's scale topic with the experiment itself made up, no
project having run one. Every drawing below is rendered from it at 64
columns, long lines wrapped as the pane wraps them. Where a statement here and the spike differ,
the difference is raised with the person, never settled by the builder.

### 20.1 What it is

20.1.1 The workflows board is a pane the mod draws beside the conversation,
showing what is happening now. The transcript cannot redraw what is happening
now, and reprinting it buries the conversation, so the now moves to the
board. [R15; Open, The workflows board; wanted by the person 2026-10-12]

20.1.2 It ships in the release, with a view for every phase the session can
be in: discovery, discussion, an experiment, an investigation, a
specification, the build, the review phase, and a quick-fix's one session.
[R15, plan 3.6, 12.1; ruled by the person 2026-10-19, agreed 2026-10-21;
each view locked by the person 2026-10-21]

20.1.3 It supplements the conversation and never replaces it. Every output
agreed for the transcript stays there whether or not the board is open: the
headline when work starts, each landing's summary with the questions waiting
beneath it, the stop report with the questions front and centre. [R15;
ruled by the person 2026-10-20]

20.1.4 It is an addition: the work reaches the person in full without it.
Nothing the person must read is only on the board. [R15, R6; ruled by the
person 2026-10-19]

20.1.5 It is read-only browsing. Its one action is the person queuing the
questions they are ready to discuss and sending the queue, as one line
naming the questions (20.6.6). Nothing else on it sends its own content into
the conversation. [R15, plan 3.6; ruled by the person 2026-10-21; the locked
spike]

20.1.6 It does not drive the workflows' menus or answer their gates. Whether
it ever does is not yet discussed. [R15]

20.1.7 It never answers a question waiting on the person. Answering stays in
the conversation. [R15, plan 3.6; ruled by the person 2026-10-20]

20.1.8 It is, on the whole, a picture of what the engine holds — the units'
state and the ledger — drawn from engine projections, with room for Claude
to put on it what the engine does not hold, such as each review round's
summary. [Open, The workflows board; R15]

20.1.9 It sits apart from the person's sitrep board, which works across
projects and sessions a level above and is updated by Claude through its own
plugin. The workflows never write to sitrep, and the workflows' mod never
changes sitrep. [Open, The workflows board; the person 2026-10-19]

### 20.2 Where it sits, and the banner

20.2.1 The pane's tab in Claude Code's tab row is titled "workflows". It
sits beside sitrep's tab: two mods' panes share the row, one tab each, and a
click on a tab shows that pane. [R15, plan 10.9; agreed 2026-10-21;
measured 2026-10-19 on Claude Code 2.1.303]

20.2.2 Docked beside a fullscreen transcript the pane has the full height.
Inline above the prompt (the main-screen layout) it gets about a third, and
draws the same lines spread to its width, leaving the scrolling to Claude
Code. [plan 10.9; the locked spike; Claude's proposal]

20.2.3 A banner — one line in the band above the prompt — names the work and
where it stands, and carries a button that shows or hides the board:
"▸ show board" while it is hidden, "hide board" while it is up. It names the
board, never the build, as sitrep's does. [the locked spike; the person
2026-10-20: "that should just say 'Show board,' not 'build'"]

20.2.4 Screen: the banner, by where the session is. The work's name in bold,
then grey facts separated by " · ", then the banner's buttons at the right:
- in a build: "◐ {unit} · {type} · build", then "N building", "N in review"
  and "⚑ N waiting on you" where non-zero, with "▸ discuss" (one question)
  or "▸ discuss all" (several); "⚑" replaces "◐" and "stopped" leads the
  facts when nothing can proceed;
- while questions are queued: "⚑ N queued to discuss" with "▸ send to
  Claude" and "▸ cancel all";
- while a question is being discussed: "⚑ Discussing Q1 · task 6.7 "{its
  title}"", then "N more to discuss" and "N queued" where non-zero, with
  "▸ skip" and "▸ cancel all" when more are queued after it, else "▸ cancel",
  and "▸ send to Claude" when questions are queued meanwhile;
- in a discussion: "◐ {unit} · {type} · discussion · {topic} · N of yours
  open" (or "nothing of yours open"), and "N messages waiting" where any are;
- at an epic's menu: "◐ {unit} · epic · at its menu · N of M topics
  decided";
- in a specification: "⚑ {unit} · {type} · specification · pass N waits on
  you · ⚑ 1 waiting on you" while a question waits, else where its review
  stands;
- in the review phase: "◐ {unit} · {type} · review · round N reading";
- in discovery: "◐ {unit} · {type} · discovery · N topics on the map", with
  "⚑" leading and "⚑ the map waits on you" while approve the map waits;
- in an investigation: "◐ {unit} · bugfix · investigation · {where it
  stands}" (validating the root cause, fix direction, validating the fix,
  concluded · the specification next), with "⚑" leading and "⚑ 1 waiting on
  you" while a question waits;
- in an experiment: "◐ {unit} · {type} · experiment {id} · N of M runs",
  "✓" and "concluded" once the verdict is in;
- in a quick-fix: "◐ {unit} · quick-fix · N of M done", with "⚑" leading and
  "⚑ 1 waiting on you" while close waits; "✓ {unit} · quick-fix · complete ·
  at the start menu" once it closes.
[the locked spike]

```text
◐ Token-aware diff sizing · feature · build · 1 building · 1 in review · ⚑ 3 waiting on you   ▸ discuss all   ▸ show board
◐ Token-aware diff sizing · feature · build · ⚑ 1 queued to discuss   ▸ send to Claude   ▸ cancel all   hide board
◐ Token-aware diff sizing · feature · build · ⚑ Discussing Q1 · task 6.7 "Every abort at the review gate unwinds" · 2 more to discuss   ▸ skip   ▸ cancel all   hide board
◐ Fumi · epic · discussion · Onboarding and permissions · 1 of yours open · 1 message waiting   hide board
⚑ Token-aware diff sizing · feature · specification · pass 5 waits on you · ⚑ 1 waiting on you   hide board
◐ Token-aware diff sizing · feature · review · round 1 reading   hide board
⚑ Fumi · epic · discovery · 12 topics on the map · ⚑ the map waits on you   hide board
⚑ killing-all-sessions-wipes-restore-state · bugfix · investigation · validating the root cause · ⚑ 1 waiting on you   hide board
◐ Fumi · epic · experiment E1 · 26 of 40 runs   hide board
◐ m-marks-highlighted-on-entry · quick-fix · 4 of 6 done   hide board
```

20.2.5 A banner too long for the band truncates from its right end, keeping
the buttons. [the locked spike]

### 20.3 The three tabs, and following the session

20.3.1 The board has three tabs: "⌂ This session", the unit's own tab
("≡ {unit}"), and "≡ All work". [R15, plan 3.6; agreed 2026-10-21]

20.3.2 "⌂ This session" is never renamed. The phase is named in the page's
header instead. [R15; agreed 2026-10-21]

20.3.3 This session shows the most specific place the session is: a phase's
view while the session is in a phase; the unit's page at the unit's menu;
All work at the start menu. [R15, plan 3.6; agreed 2026-10-21]

20.3.4 This session follows the session by the position the workflows already
record on arriving anywhere (the position the tmux label uses). When the
session moves — into a topic, back to the menu, from approve the map to the
epic's menu, from an experiment's verdict to the epic's menu, from the
specification into the build, from finish or a quick-fix's close to the
start menu — This session moves with it. [R15; agreed 2026-10-21; the four
views locked by the person 2026-10-21]

20.3.5 A page the person is reading (a task, an entry, a finding, another
unit) stays until the person presses back, even when the session moves
beneath it. [R15; agreed 2026-10-21]

20.3.6 The unit's tab shows the unit's page, and All work the project's
work; a press on another unit in All work opens that unit's page, and a press
on this unit opens its tab. [R15; the locked spike]

20.3.7 On the unit's tab, a phase the session is in opens This session; a
finished phase opens in full. [R15; the locked spike]

20.3.8 The session's position is recorded wherever the board can be open,
whether or not tmux labels are on, so This session follows the session in
every case. [R15; Claude's derivation]

### 20.4 How it is drawn

20.4.1 The board is not held to the engine's design system. It mirrors the
conversation's design and uses what a pane can do: tabs, columns, folding,
and colour with one meaning each. [plan 3.11; ruled by the person
2026-10-20]

20.4.2 Each colour means one thing, on the board and on the banner alike:
peach (#f5a97f) needs you; seafoam (#86d4cc) running; sage (#a3c98a) done;
rose (#ee7a8c) failed; slate (#6e7799) not started; lavender (#a9a1e1) this
view, the active tab and every button. Body text is a soft off-white
(#c3c9e3), headers pure white, secondary facts a lifted slate (#a3abd0),
rules a dark slate (#3d4260). Every view's section headings carry the
colours the locked spike gives them: sky blue (#7fb4f0), sage, violet
(#c0a7f0) and gold (#e3c78a) — on the task page, what it does sky blue, what
was done sage, reviews violet, calls made gold — with peach, rose and the
lifted slate where a section is what waits, what failed, or set aside; a
phase heading still to come is sky blue; page titles are white. Each colour
meaning one thing holds for the state colours. [plan 3.11; agreed in the
spike 2026-10-20 and 2026-10-21; the locked spike]

20.4.3 Marks: ✓ done or decided; ◐ running (building, in review, being
read, in discussion); ⚑ waits on the person; ✗ failed or found; ○ not
started or waiting; ◇ Claude's call or an item; ◆ a review round or pass; △
a difference, a finding or something not proven; » a message, or a move; →
sent; – cancelled; ↷ postponed. [the locked spike]

20.4.4 A section opens with an uppercase heading, a rule running to the
right edge, and its count or summary at the end of the rule. [the locked
spike]

20.4.5 Each item is one line, its state at the right; a title too long for
its line is cut with "…" before the state. A question or a body of prose
wraps under its mark. [the locked spike]

20.4.6 Every button is lavender, whatever it does. An action reads
"▸ {verb}"; "hide board", "▾ hide", "← back" and "✕" read as drawn. [the
locked spike; the person 2026-10-20, a button colour consistent for whatever
a button is; 2026-10-21, "the button colour works well"]

20.4.7 A complete phase folds to one line with "▸ show", and opens with
"▾ hide". A phase not yet written is one line saying so. [the locked spike]

20.4.8 Whatever is running — a task building or in review, a review round,
a pass or area being read, a validation, an experiment's runs, a quick-fix's
step, discovery shaping — shows its clock where it has one ("building 2:14",
"in review 0:40"), and its ◐ turns a quarter (◐ ◓ ◑ ◒) every 250 ms while the
board is up. Nothing that is not running moves. [the locked spike; the person
2026-10-21: "I like the very subtle sort of spinner"]

20.4.9 The statuses are the workflows' own: a task is building, in review,
done, failed or waits on a question; a phase whose tasks are all done is
"complete". No other word ("landed") stands in for them. [plan 3.6; ruled by
the person 2026-10-21]

### 20.5 In the build

20.5.1 This session in a build shows: the header ("{unit} · {type} · build
phase"); a progress bar with tasks done of the total, the phase of the cut
and how many are running; WAITING ON YOU with every question waiting on the
person; then every phase of the cut in order, the running phase's tasks
listed with their states, complete phases folded, phases not yet written
saying so. [R15, plan 3.6; locked 2026-10-21]

20.5.2 A task's line names its number and title and, at the right, its
state: done; building or in review with its clock; failed; "waits on Q1"
for a task a question parks; "after 6.4" for a task waiting on another.
[R15; the locked spike]

20.5.3 Each question waiting shows its number, its full wording, what it
parks ("parks 6.8, and 2 after it"), how long it has waited, and "▸ discuss".
The heading carries the count and "▸ discuss all" when more than one waits.
[R15, plan 3.6; ruled by the person 2026-10-20 and 2026-10-21]

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

Token-aware diff sizing · feature · build phase
▰▰▰▰▰▰▰▱  58 of 68 tasks done · phase 6 of 8 · 2 running

WAITING ON YOU ───────────────────────────── 3 · ▸ discuss all
⚑ Q1 If the terminal closes while the review gate waits,
  should the release unwind as a decline does, or keep its
  commit for the operator to finish by hand?
     parks 6.7 · waiting 4h                          ▸ discuss
⚑ Q2 When a re-merge fails at the review gate, should the
  notes the operator already saw stay on offer to accept, or
  should the run abort with the chunk notes saved?
     parks 6.8, and 2 after it · waiting 1h          ▸ discuss
⚑ Q3 While a regeneration runs as chunks, should plain mode
  (CI and agents) print a line as each part finishes, or one
  line when the whole wave is done?
     parks 6.5 · waiting 10m                         ▸ discuss

PHASE 1 · Lean default AI command and quote-…─ complete ▸ show

PHASE 2 · Per-call size cap and chunked rele…─ complete ▸ show

PHASE 3 · `--notes-file` and one non-AI body ─ complete ▸ show

PHASE 4 · Failure classification, halving an…─ complete ▸ show

PHASE 5 · The remediation floor ────────────── complete ▸ show

PHASE 6 · Chunked notes at the review gate and …─ 2 of 12 done
✓ 6.1 `r` on chunked notes re-runs only the merge         done
✓ 6.2 Regenerate's `r` on chunked notes re-runs only the… done
◐ 6.3 `r` on single-pass notes re-runs from th… in review 0:00
◐ 6.4 A failed single-pass `r` call is classifi… building 0:00
⚑ 6.5 An `r` that becomes a chunked run narrates … waits on Q3
✗ 6.6 Chunked notes come back from the notes cache wit… failed
⚑ 6.7 Every abort at the review gate unwinds       waits on Q1
⚑ 6.8 A failed re-merge aborts with every chunk's… waits on Q2
○ 6.9 A failed `r` the ladder made chunked aborts w… after 6.4
○ 6.10 A failed regenerate `r` saves the version's … after 6.8
○ 6.11 One `r` regenerator for both verbs, with the… after 6.8
○ 6.12 One review-gate `r` assembly for both verbs  after 6.11

PHASE 7 · Per-verb exclusion lists and the e…─ not yet written
PHASE 8 · Recording exclusion answers ──────── not yet written
```

20.5.4 A press on a task opens its page: its number and title; its phase,
state, when it finished and how long it took; WHAT IT DOES (the task's goal,
its count of acceptance criteria and steps, and "▸ read the task" for the task
as written); WHAT WAS DONE (Claude's account of the work, where in the code,
what the tests prove, the files changed and lines added and removed); DIFFERS
FROM THE TASK (every way the work differs from the task as written, one △
line each, or that nothing differs); REVIEWS (each round's summary, "▸ read"
opening its full report); CALLS MADE (each call the task made, "▸ read"
opening it). "← back to the build" returns. [R15, plan 3.6; agreed
2026-10-19 and 2026-10-21]

20.5.7 The task page shows any task's account, at any time. Any task's
account is also printed into the conversation whenever the person asks for
it in words, at any time, for any task however long ago; in step it stays on
each task's gate. Nothing on the board prints it into the conversation. [R15,
plan 3.6; the person 2026-10-15 and 2026-10-20; Claude's derivation, O41]

20.5.5 Claude writes each review round's short summary as the task lands, and
stores it with the task's account, so the board can show it. [R15; the
person 2026-10-19]

20.5.6 A done task with no account written says so beside its real figures.
A parked task's page shows the question it waits on, with its "▸ discuss".
[the locked spike]

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

← back to the build

1.4 180-second shipped release timeout
Phase 1 · Lean default AI command and quote-aware parsing · ✓
done 20 Oct 00:03 · took 12m

WHAT IT DOES ────────────────────────────────────────────────
With no timeout configured, a hung release-notes call fails
after 180 seconds and a hung commit call after 60. An explicit
timeout at either level still wins. Every surface that states
the shipped timeout names both values.
6 acceptance criteria · 3 steps                ▸ read the task

WHAT WAS DONE ───────────────────────────────────────────────
With no timeout set at any level, a release-notes call now
gets 180 seconds per attempt before it fails as `AI timed
out`, and a `mint commit` call keeps 60. `mint release
regenerate <version>` from a fresh source gets the 180 seconds
too. A `timeout` under `[release]` or `[commit]`, or a shared
one, still wins. The README, `mint setup`'s config reference
and its AI-transport paragraph now name both defaults, and the
`[commit]` `timeout` row reads `shared, else 60` as well,
which the task did not ask for.
· internal/config/config.go: DefaultReleaseTimeout (180s) and
  DefaultCommitTimeout (60s) replace DefaultTimeout
· internal/config/config.go: TimeoutFor falls to the verb's
  own floor; defaults() no longer seeds a shared 60s
· internal/config/metadata.go: shared timeout row names both
  defaults; verb rows read `shared, else N`
· README.md, internal/setupguide/setupguide.go: every stated
  timeout default names 180 and 60
· 8 new tests check the deadline each call site gets (180s
  release and regenerate, 60s commit, 90s overrides) and every
  doc surface; 7 config and metadata tests rewritten for
  per-verb floors, 1 dropped
✓ Proves 6 criteria · 18 files changed · +331 −185

DIFFERS FROM THE TASK ────────────────────────────────────── 3
△ With no .mint.toml, mint no longer writes a shared 60s
  timeout into the config, so the 180s and 60s defaults apply
  there too. The task's Context pointed at this; its Do did
  not name the edit.
△ The [commit] timeout rows in the README and the config
  reference now read "shared, else 60". The task asked only
  for the release and shared rows.
△ No test waits out a real 180-second hang: the tests read how
  much time the call's deadline leaves, through a new
  DeadlineRemaining on the test runner.

REVIEWS ───────────────────────────────────────────── 2 rounds
◆ Round 1 · 1 finding, fixed                            ▸ read
◆ Round 2 · passed                                      ▸ read

CALLS MADE ───────────────────────────────────────────────── 2
◇ Each names the exclusion check's answers as the exce… ▸ read
◇ The list also covers failure classification (§9) and… ▸ read
```

### 20.6 Questions: Ready to discuss

20.6.1 Questions wait like a mailbox, in the ledger, never as a standing
gate. The board shows them; answering happens in the conversation. [R15,
plan 3.6; ruled by the person 2026-10-20]

20.6.2 Discussing is two steps. A press on "▸ discuss" queues that question
in a READY TO DISCUSS box; "▸ discuss all" queues every waiting question not
yet queued, in the order the board lists them. Nothing reaches the
conversation until the person presses "▸ send to Claude". [R15, plan 3.6;
ruled by the person 2026-10-21, as sitrep does it]

20.6.3 A press never fills the prompt box. Staging in the prompt box is
rejected. [plan 3.6; the person 2026-10-21: "I don't like the idea of
staging in the prompt box"]

20.6.4 A queued question's row in WAITING ON YOU reads "queued ▸ unqueue".
In READY TO DISCUSS each queued question has its row and a ✕; "▸ unqueue"
or its ✕ take it back out, and "▸ cancel all" empties the box — none
of them says anything to Claude. [the locked spike]

20.6.5 The READY TO DISCUSS box is the same box on every tab, fixed at the
foot of the pane while the list above it scrolls, as sitrep's queue sits
beside it. The spike draws the box after the list once the list outgrows
the pane; this statement is the one to build. [R15, "at the panel's foot";
the locked spike; Claude's derivation, O93]

20.6.6 "▸ send to Claude" sends the queue as one message, in the order it was
queued: "Ready to discuss Q1: {the question}" for one; "Ready to discuss
{all }N waiting questions, in this order: Q1, Q2, Q3." for several. Claude
then takes them one at a time, raising each in full from the work as it
stands. [R15, plan 3.6; the locked spike]

20.6.7 A queue sent while a discussion is under way joins the end of it:
"Also ready to discuss Q2, after Q1." [the locked spike]

20.6.8 While a question is discussed, "▸ skip" sets it back to waiting and
moves to the next ("Skip Q1 for now; it stays waiting. Next: Q2."), and
"▸ cancel" or "▸ cancel all" sends it and every one after it back to waiting
in one line ("Set Q1 aside; it stays waiting." / "Set Q1, Q2 aside; they
stay waiting."). Each puts exactly one line in the conversation. [R15, plan
3.6; the person 2026-10-21]

20.6.9 Recording what became of a question — answered, "I don't follow"
included, or set aside — is the engine's `raise`, whose response is a
one-line receipt Claude shows as it is: "{Q1} {answered|set aside} · {task
6.7 builds again|their tasks build again|still waiting} · {N waiting on
you|nothing waiting on you}{ · next: Q2}". [R15, plan 3.6, 6.1; the locked
spike stands its `question` tool in for the verb; Claude's derivation, O38]

20.6.10 A question no longer waiting is refused by the verb. [the locked
spike]

20.6.11 On the board, the question being discussed reads "being discussed"
with "▸ skip" when more are queued after it, else "▸ cancel"; while a queue is
being discussed, WAITING ON YOU's heading carries "▸ cancel all". Each does
what its twin on the banner does (20.6.8). [R15; the person 2026-10-19 and
2026-10-20, cancel "both on the board and on the banner"; the locked spike]

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

Token-aware diff sizing · feature · build phase
▰▰▰▰▰▰▰▱  58 of 68 tasks done · phase 6 of 8 · 2 running

WAITING ON YOU ───────────────────────────── 3 · ▸ discuss all
⚑ Q1 If the terminal closes while the review gate waits,
  should the release unwind as a decline does, or keep its
  commit for the operator to finish by hand?
     parks 6.7 · waiting 4h                   queued ▸ unqueue
⚑ Q2 When a re-merge fails at the review gate, should the
  notes the operator already saw stay on offer to accept, or
  should the run abort with the chunk notes saved?
     parks 6.8, and 2 after it · waiting 1h          ▸ discuss
⚑ Q3 While a regeneration runs as chunks, should plain mode
  (CI and agents) print a line as each part finishes, or one
  line when the whole wave is done?
     parks 6.5 · waiting 10m                         ▸ discuss

PHASE 1 · Lean default AI command and quote-…─ complete ▾ hide
✓ 1.1 Quote-aware `ai_command` splitting                  done
✓ 1.2 Lean shipped default AI command                     done
✓ 1.3 Reject a malformed `ai_command` at config load      done
✓ 1.4 180-second shipped release timeout                  done
✓ 1.5 Commit's AI failure carries the AI's verbatim outp… done
✓ 1.6 One composition rule for a failed AI call's captur… done

PHASE 2 · Per-call size cap and chunked rele…─ complete ▸ show

PHASE 3 · `--notes-file` and one non-AI body ─ complete ▸ show

PHASE 4 · Failure classification, halving an…─ complete ▸ show

PHASE 5 · The remediation floor ────────────── complete ▸ show

PHASE 6 · Chunked notes at the review gate and …─ 2 of 12 done
✓ 6.1 `r` on chunked notes re-runs only the merge         done
✓ 6.2 Regenerate's `r` on chunked notes re-runs only the… done
◐ 6.3 `r` on single-pass notes re-runs from th… in review 0:00
◐ 6.4 A failed single-pass `r` call is classifi… building 0:00
⚑ 6.5 An `r` that becomes a chunked run narrates … waits on Q3
✗ 6.6 Chunked notes come back from the notes cache wit… failed
⚑ 6.7 Every abort at the review gate unwinds       waits on Q1
⚑ 6.8 A failed re-merge aborts with every chunk's… waits on Q2
○ 6.9 A failed `r` the ladder made chunked aborts w… after 6.4
○ 6.10 A failed regenerate `r` saves the version's … after 6.8
○ 6.11 One `r` regenerator for both verbs, with the… after 6.8
○ 6.12 One review-gate `r` assembly for both verbs  after 6.11

PHASE 7 · Per-verb exclusion lists and the e…─ not yet written
PHASE 8 · Recording exclusion answers ──────── not yet written

READY TO DISCUSS ─────────────────────────────────────────── 1
└ Q1  Every abort at the review gate unwinds                 ✕
▸ send to Claude                                  ▸ cancel all
```

### 20.7 In a discussion

20.7.1 This session in a discussion shows the topic: its header ("{topic} ·
discussion", the unit and type); progress as the person's questions decided
of theirs, and the count of Claude's calls; STILL OPEN, what of the person's
is still open, each marked whose and where it came from; MESSAGES WAITING,
mail waiting to be raised, "raised at the next pause"; SINCE YOU LAST
LOOKED, Claude's calls since the person last looked; REVIEWS, each round —
one running with its clock, each finished round's findings taken in or
waiting; DECIDED, every decision, each marked "yours" or "Claude's call";
SENT, what the topic sent other topics, each with where and when it went and
whether it waits in their mailbox. [R15; locked by the person 2026-10-21,
"This is great!!"]

20.7.2 Opening the board is not looking. "Since you last looked" moves on
only when the conversation shows the person the map. [R15; agreed
2026-10-21]

20.7.3 Any entry, message or report opens in full with a press, and "← back
to {topic}" returns. [R15]

20.7.4 A point an experiment measures shows under STILL OPEN marked as
waiting on it, "{id} running", as on the topic's map (9.1.11). [R15;
Claude's derivation, T6]

```text
⌂ This session   ≡ Fumi   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

Onboarding and permissions · discussion
Fumi · epic
▰▰▰▰▰▰▰▱  11 of 12 of yours decided · 6 calls by Claude

STILL OPEN ───────────────────────────────────────────────── 1
○ An unlicensed Fumi opens on a licence window, and setup runs
  once a licence is in
     yours · from Commercialization's message           ▸ read

MESSAGES WAITING ──────────────── 1 · raised at the next pause
» The licence window carries a "Lost your key?" link
     from Commercialization · 16 Oct                    ▸ read

SINCE YOU LAST LOOKED ─────────────────────── 1 call by Claude
◇ Pricing mention                                       ▸ read
     No price line in the walkthrough or anywhere else in fir…

REVIEWS ───────────────────────────────────────────── 3 rounds
◐ Round 3 · reading the record                    running 4:12
◆ Round 2 · near-settled · 9 findings, all taken in     ▸ read
◆ Round 1 · forming · 7 findings, all taken in          ▸ read

DECIDED ───────────────────────── 11 yours · 6 calls by Claude
✓ Enabling sync later                                    yours
✓ First run shape                                        yours
✓ Launch at login offer                                  yours
✓ No iCloud account state                                yours
✓ First run landing                                      yours
◇ First launch definition                        Claude's call
✓ Sample notes and sync                                  yours
◇ Login item banner                              Claude's call
✓ Sync toggle default                                    yours
◇ Who performs the restart after the Accessibil… Claude's call
◇ The engine needs Files-and-Folders access — a… Claude's call
✓ Sync offer copy                                        yours
✓ Notification permission ask                            yours
◇ Screen title                                   Claude's call
◇ Pricing mention                                Claude's call
✓ Wizard step content                                    yours
✓ Personalisation step                                   yours

SENT ─────────────────────────────────────────────────────── 2
→ Fumi is also in ⌘Tab and the Dock while the first-run wizard
  or the licence window is open
     to Management window · 21 Oct · in its mailbox
→ First run shows the product before the licence: the licence
  is a wizard step after the tour
     to Commercialization · 20 Oct · in its mailbox
```

```text
⌂ This session   ≡ Fumi   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

← back to Onboarding and permissions

Pricing mention
◇ Claude's call
 ────────────────────────────────────────────────────────────
No price line in the walkthrough or anywhere else in first
run. The licence step is first run's only commercial moment: a
key field and Buy, which opens the checkout on Fumi's website,
where the price is met. The tour's agent and CLI rows show
features every licensed user has.
The question this section handed away is answered, and the
condition that would have brought it back — premium met in the
first few minutes, so a counter starts before any judgement
has formed — can no longer occur: there is no premium and no
counter. The session's earlier lean, no pricing screen and one
honest line at most, lands at its lower end.
One thing differs from the answer as sent. commercialization
placed the licence window ahead of the wizard, so the licence
screen sat outside first run; this topic has since placed the
licence as a step inside the wizard, after the tour (see An
unlicensed Fumi opens on a licence window, and setup runs once
a licence is in). The licence step is therefore inside first
run, and is still the only place in it that mentions buying.
```

### 20.8 At an epic's menu, and the epic's tab

20.8.1 At an epic's menu, This session is the epic's page, its header saying
"at its menu". [R15; agreed 2026-10-21]

20.8.2 The epic's page lists its topics under the epic dashboard's stages —
DISCOVERY, DEFINITION, DELIVERY — each topic with its state (decided, its
person's questions decided of all, not started), where a session is (this
session, another session) and what messages wait; DEFINITION holds the
specification waiting on the topics still open ("waits until every topic is
decided · N to go"); DELIVERY the build and review after it; then SET ASIDE,
the topics cancelled or postponed (with the roadmap horizon); then LATELY.
[R15; locked by the person 2026-10-21]

20.8.3 A topic opens on its own page; the topic the session is in is This
session. [R15]

```text
⌂ This session   ≡ Fumi   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

Fumi · epic · at its menu
Fumi — a smarter macOS Stickies alternative: notes assigned to
specific macOS Spaces (returning to their Space on relaunch),
remembering exact screen position, with titles and a full fumi
CLI/MCP scripting surface
started 17 Jul · in discussion
▰▰▰▰▰▱▱▱  9 of 15 topics decided · 5 in discussion

DISCOVERY ──────────────────────────────────── 9 of 15 decided
✓ Note model                                           decided
✓ Storage and sync                                     decided
✓ Note window                                          decided
✓ Engine architecture                                  decided
✓ Space homing                                         decided
✓ Platform support                                     decided
✓ Search and retrieval                                 decided
✓ Status and alerts                                    decided
✓ Agent surface                                        decided
◐ Management window                           36 of 36 decided
     1 message waiting
◐ Onboarding and permissions                  11 of 12 decided
     1 message waiting
◐ Commercialization                           25 of 25 decided
     1 message waiting
◐ Licensing and trial integrity               10 of 15 decided
     another session · 2 messages waiting
◐ Support and diagnostics                       0 of 6 decided
     another session
○ Build and release                                not started
     17 messages waiting

DEFINITION ──────────────────────────────────────────────────
○ Specification · waits until every topic is decided · 6 to go

DELIVERY ────────────────────────────────────────────────────
○ Build and review · after the specification

SET ASIDE ────────────────────────────────────────────────── 5
– Positioning and audience                           cancelled
– Scale and performance                              cancelled
– Data export                                        cancelled
– Privacy and data handling                          cancelled
↷ Website                             postponed · roadmap next

LATELY ──────────────────────────────────────────────────────
» Licensing and trial integrity took in 8 messag… 21 Oct 13:10
» Onboarding and permissions took in a message f… 21 Oct 12:10
» Onboarding and permissions sent a message to M… 21 Oct 12:10
» Onboarding and permissions took in a message f… 20 Oct 21:18
» Onboarding and permissions sent a message to C… 20 Oct 21:18
◐ Support and diagnostics started                 20 Oct 20:40
↷ Website postponed to the roadmap · next         20 Oct 20:28
```

```text
⌂ This session   ≡ Fumi   ≡ All work
─────────────────━━━━━━───────────────────────────────────────

← back to Fumi

Note model · discussion
Fumi · epic
What a fumi is: a Markdown body with a stable UID, an optional
first-line-derived title, tags, and colour; agentic
addressing/disambiguation via list -> read -> reason.
▰▰▰▰▰▰▰▰  11 of 11 decided

DECIDED ─────────────────────────────────────────────────── 11
✓ Content format
✓ Markdown dialect
✓ Non-Text content
✓ Title derivation
✓ Content preview
✓ Tags
✓ Colour
✓ Identity & UID
✓ Agentic addressing
✓ Metadata & state representation
✓ Note size classification
```

### 20.9 In a specification

20.9.1 This session in a specification shows: its header, the unit and type,
and a facts line (sections, phases cut, passes run and found, what waits);
WAITING ON YOU, each question "asked in the conversation", never queued, with
which pass found it and the sections it touches; SINCE YOU LAST LOOKED,
Claude's calls since the person last looked, each with its pass and sections;
REVIEW, the review's passes newest first, each reading only what the one
before changed, the heading saying it "stops when a pass changes nothing",
the next pass shown as waiting with why; SECTIONS, each section with the
passes that changed it, "unchanged", or "being read"; PHASE CUT, each phase
with its scenario count and the sections it draws on; READY TO BUILD, waiting
on what it waits on, then on the person's yes. [R15; locked by the person
2026-10-21, "looks good"]

20.9.2 A section, a pass or a finding opens on its own page. [R15; the locked
spike]

20.9.3 Once the person's yes at ready to build lands, This session follows
the session into the build. [R15; agreed 2026-10-21]

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

Token-aware diff sizing · specification
Mint · feature
18 sections · 8 phases cut · 4 passes, 24 found · ⚑ pass 5
waits on your answer

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ The halving progress line's part count
     found by pass 4 · touches §16                      ▸ read

SINCE YOU LAST LOOKED ────────────────────── 4 calls by Claude
◇ r at single-version regenerate's review gate on chunked notes
     pass 4 · §1, 15                                    ▸ read
◇ The progress example merges fewer parts than its own halving
  left
     pass 4 · §8, 16                                    ▸ read
◇ r at regenerate --all's per-version review gate on chunked
  notes
     pass 4 · §1, 12, 15                                ▸ read
◇ The documented timeout default stays 60 seconds while
  releases default to 180
     pass 4 · §4, 18                                    ▸ read

REVIEW ───────────────────── stops when a pass changes nothing
○ Pass 5 · reads what pass 4 changed, once you answer
◆ Pass 4 · 6 found · 4 calls, 2 yours                   ▸ read
◆ Pass 3 · 5 found · 4 calls, 1 yours                   ▸ read
◆ Pass 2 · 3 found · 2 calls, 1 yours                   ▸ read
◆ Pass 1 · 10 found · 8 calls, 2 yours                  ▸ read

SECTIONS ────────────────────────────────────────────────── 18
✓  1 Purpose and Scope                               pass 1, 4
✓  2 The Lean Default AI Command                        pass 1
✓  3 Quote-Aware ai_command Parsing                     pass 3
✓  4 The Per-Call Size Cap                           pass 1, 4
✓  5 Per-Verb Exclusion Lists                        unchanged
✓  6 The Exclusion Check                             pass 1, 3
✓  7 Routing a Release's Notes                          pass 2
✓  8 Chunked Generation                              pass 2, 4
✓  9 Failure Classification                          pass 2, 4
✓ 10 Halving After an Under-Cap Overflow                pass 3
✓ 11 Failures in a Chunked Run                       pass 1, 2
✓ 12 The Remediation Floor                     pass 1, 2, 3, 4
✓ 13 --notes-file                                    unchanged
✓ 14 One Non-AI Body: Dropping [release].fallback       pass 3
✓ 15 Chunked Notes at the Review Gate and in the Ca… pass 2, 4
✓ 16 Progress Narration                           pass 1, 3, 4
✓ 17 mint commit's AI-Failure Output                    pass 1
✓ 18 Documentation and the Setup Guide            pass 1, 3, 4

PHASE CUT ─────────────────────────── 8 phases · 610 scenarios
1 Lean default AI command and quote-aware parsing           38
     draws on §2, 3, 4, 17, 18
2 Per-call size cap and chunked release notes               77
     draws on §1, 4, 6, 7, 8, 10, 11, 12, 15, 16, 17, 18
3 `--notes-file` and one non-AI body                        51
     draws on §6, 7, 11, 12, 13, 14, 18
4 Failure classification, halving and saved chunk notes    101
     draws on §1, 4, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18
5 The remediation floor                                    100
     draws on §1, 2, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,…
6 Chunked notes at the review gate and in the dry-run cache 81
     draws on §1, 2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 18
7 Per-verb exclusion lists and the exclusion check         109
     draws on §2, 4, 5, 6, 7, 9, 10, 12, 13, 14, 15, 16, 17, …
8 Recording exclusion answers                               53
     draws on §5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 18

READY TO BUILD ──────────────────────────────────────────────
○ once a pass changes nothing
```

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

← back to the specification

§4 The Per-Call Size Cap
changed by pass 1, 4 · 747 words
 ────────────────────────────────────────────────────────────
max_prompt_bytes replaces max_diff_lines:
- an integer count of bytes, defaulting to 1,500,000 - at the
shared top level only, so one cap covers both verbs.
It bounds the composed prompt mint sends in any single AI
call, measured in bytes: instructions, Change Map, diff and
closing reminder together. The AI tool's own overhead is
invisible to mint and sits outside the cap. No call mint makes
is ever bigger than the cap.
As a new key it takes the strict-config path: a schema entry,
a friendly type error, a config-metadata row and the README
tables.
A value of zero or less is rejected when config loads, before
any step runs, in the same load-error shape as a malformed
ai_command: invalid .mint.toml: max_prompt_bytes must be a
positive number of bytes. Zero never means "no cap", the way
timeout = 0 means no deadline: the cap sizes every chunk and
keeps every call under claude's stdin limit. An operator who
wants a cap mint never reaches sets a large one.
```

### 20.10 In the review phase

20.10.1 This session in the review phase shows the round under way: its
header, the unit, type and how many tasks were built; "round N · X of Y
areas read" and where the round stands; FOUND, each finding in scope with the
area it belongs to; ROUND N, one row per area — one per specification section
and one reader over the tests — each with what it ran and found, or that it is
being read with its clock, or waiting; NOT PROVEN, the checks that could not
be run; TO THE INBOX, what went to the inbox as Claude's call; VERDICT. [R15;
locked by the person 2026-10-21, "looks good"]

20.10.2 A round that fails shows its fix tasks as the build's next phase
(FIX TASKS · PHASE N, each with its state), and the next round reads only the
areas those tasks changed, every other area marked "unchanged, not read
again". [R15, R16; the locked spike]

20.10.3 Each finding, fix task and unproven check opens its page with a
press. [R15]

20.10.4 Once the person finishes, the unit moves to COMPLETE and This session
follows the session to All work at the start menu. [R15; agreed 2026-10-21]

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

Token-aware diff sizing · review
Mint · feature · 99 tasks built
round 1 · 14 of 19 areas read · ◐ 3 being read

FOUND ───────────────────────────────────────────── 8 in scope
△ §4 The comment above the regeneration stage says every exit…
△ §12 The Edit method doc says "A non-nil error means no edit…
△ §12 The file header (lines 19-22) says batch skip-and-conti…
△ §5 This task changed the assertion two lines above to expec…
△ §6 The CheckNarration doc says it is told "when the exclusi…
△ §12 The touchesConfig doc says the git calls naming .mint.t…
△ §6 The AUTO-UNWIND header says the unwind "re-commits the e…
△ §12 The phase 11 comment-corrections commit (49f7b86) delet…

ROUND 1 ───────────────────────────── every area, read and run
✓ §1 Purpose and Scope                           nothing found
✓ §2 The Lean Default AI Command                 nothing found
✓ §3 Quote-Aware ai_command Parsing              nothing found
✗ §4 The Per-Call Size Cap                             1 found
✗ §5 Per-Verb Exclusion Lists                  ran 1 · 1 found
✗ §6 The Exclusion Check                       ran 4 · 2 found
✓ §7 Routing a Release's Notes                   nothing found
✓ §8 Chunked Generation                          nothing found
✓ §9 Failure Classification                      nothing found
✓ §10 Halving After an Under-Cap Overfl… ran 1 · nothing found
✓ §11 Failures in a Chunked Run                  nothing found
✗ §12 The Remediation Floor                    ran 2 · 5 found
✓ §13 --notes-file                       ran 9 · nothing found
✓ §14 One Non-AI Body: Dropping [release].fallb… nothing found
◐ §15 Chunked Notes at the Review Gate and in th… reading 2:18
◐ §16 Progress Narration                          reading 2:18
◐ §17 mint commit's AI-Failure Output             reading 2:18
○ §18 Documentation and the Setup Guide                waiting
○ Tests held against the specification                 waiting

NOT PROVEN ──────────────────────────────── 8 could not be run
△ Afterwards notes.md is still untracked with its contents un…
△ afterwards the file carries the same edits, staged if they …
△ The notes file stays in the work tree through the run with …
△ the file that path names is the one left out of the clean-t…
△ In each case HEAD is back at the starting commit, and the r…
△ Given that file, --autostash with other uncommitted changes…
△ Given either warning, carrying out the steps it names, in t…
△ A tracked .mint.toml, one a .gitignore rule matches include…

TO THE INBOX ─────────────────────────────── 1 · Claude's call
» The file header still says processOneVersion returns "a per…

VERDICT ─────────────────────────────────────────────────────
○ once every area is read
```

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

← back to the review

The comment above the regeneration stage says every exit
closes it via "success via the timed completion closure, a
transport failure via the…
✗ in scope · a fix task · §4 · task 2.2
internal/commit/run.go
 ────────────────────────────────────────────────────────────
The comment above the regeneration stage says every exit
closes it via "success via the timed completion closure, a
transport failure via the spinner-stopping AI-failure Warn …,
any other failure via surface's StageFailed". This task added
the over-cap branch at run.go:681-684, which closes the stage
through the oversized Warn, not a StageFailed, so the
comment's "any other failure" claim is now false. Replace the
sentence with: "Every exit closes it: success via the timed
completion closure, a transport failure via the
spinner-stopping AI-failure Warn and an over-cap prompt via
the oversized Warn (r is interactive-only, so both paths are
always attended), any other failure via surface's
StageFailed." — FAILS: a reader trusting the comment expects
an over-cap regeneration to emit a StageFailed. The code and
TestRun_Oversized_RegenNudgeOverCap_OpensEmptyEditor
(run_oversized_test.go:557) assert the opposite, which breaks
the project's comments-true-to-as-built rule (CLAUDE.md,
Comments).
```

### 20.11 In discovery

20.11.1 This session in discovery shows: its header ("{unit} · discovery"),
the unit and type, which session it is and when it started; a facts line
(topics on the map, items going to the roadmap, and "◐ shaping" or "⚑ the
map waits on you"); WAITING ON YOU while approve the map waits, "asked in
the conversation"; THE MAP, the topics in the map's order, "foundations
first", each numbered with its summary on a second line cut to the width; TO
THE ROADMAP, what the map parks, with its horizon, "with the map"; NOT
TAKEN, the directions not taken, each with its reason, "kept in the log";
SPIKES, each spike with its tool and what it showed, "reference" or
"canonical"; YOUR VIEWS OF THE PRODUCT, what the person said of the product
as a whole, "carried into the topics". [R10, R12, R15; locked by the person
2026-10-21, "all looks great"]

20.11.2 A topic opens on its brief: its number on the map, "What discovery
heard: decided in its discussion, not here", its summary, then LEANS, PATHS
NOT TAKEN and OPEN QUESTIONS, a section with nothing in it left out. Nothing
on the page is a decision. [R10; the person 2026-10-19: "Nothing during
discovery is a decision"; the locked spike]

20.11.3 A spike opens on its page: its tool, whether it is reference or
canonical, that it is kept in the unit's assets with its live link, what it
showed, and the live link. [R12; the locked spike]

20.11.4 Once the person approves the map, This session follows the session
to the epic's menu: the epic's page with every topic not started, the first
in the map's order marked "next", and what was parked now on the roadmap in
All work. [R10, R15, R41; the locked spike]

```text
⌂ This session   ≡ Fumi   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

Fumi · discovery
Fumi · epic · session 1 · started 17 Jul
10 topics on the map · 4 to the roadmap · ◐ shaping

THE MAP ─────────────────────────────── 10 · foundations first
 1 Note model
     What a fumi is: a Markdown body with a stable UID, an op…
 2 Storage and sync
     File-based Markdown store in a user-chosen folder (local…
 3 Note window
     The floating fumi as an on-screen object: near-frameless…
 4 Engine architecture
     One always-on app over a local socket; note windows, men…
 5 Space homing
     Notes remember their macOS Space and return to it across…
 6 Positioning and audience
     Positioning as a polished do-one-thing-well tool, user p…
 7 Agent surface
     The fumi CLI and MCP server over the engine socket: oper…
 8 Management window
     The main app window as an organiser (browse/search/filte…
 9 Onboarding and permissions
     First-run permission wizard for the Accessibility permis…
10 Commercialization
     One-time ~$19 plus paid major upgrades, no subscription …

TO THE ROADMAP ────────────────────── 4 · later · with the map
◇ Fumi Sync, a hosted sync service
◇ Storage over a network: SFTP and a hosted API
◇ A fumi's colour drawn from its tags
◇ A lifetime tier

NOT TAKEN ──────────────────────────────── 3 · kept in the log
– The Mac App Store · the private Spaces APIs are an automatic
  rejection
– Importing Stickies · a blank slate, no legacy baggage
– A billing backend · the Merchant of Record covers checkout,
  tax and licences

SPIKES ───────────────────────────────────────── 1 · reference
◇ Note window · Paper · Luminous Liquid Glass and stronger ty…

YOUR VIEWS OF THE PRODUCT ──────── 2 · carried into the topics
» Clean, well-structured, beautiful, and it just works
» Modern Swift, correctness over speed, no shortcuts
```

```text
⌂ This session   ≡ Fumi   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

← back to discovery

Note model · topic 1 of 10
What discovery heard: decided in its discussion, not here

What a fumi is: a Markdown body with a stable UID, an optional
first-line-derived title, tags, and colour; agentic
addressing/disambiguation via list -> read -> reason.

LEANS ────────────────────────────────────────────────────── 7
· Content is Markdown — a single source of truth serving both
  the human GUI and the agent surface (clean to
  generate/parse).
· Identity = a stable per-note UID, fixed for the note's life.
  The title is a human-facing label layered on top.
· Titles are optional, with a display fallback (first line of
  body, or "Untitled"). Not forced unique.
· Title is derived, not first-class — there is no separate
  title field. The label used by the manager, the CLI/MCP
  list, and window identity = the first non-empty line,
  Markdown-stripped, truncated. Prominence comes from Markdown
  (a # heading first line renders as a heading); "giving a
  note a title" is just writing a good first line.
· Agentic addressing: the UID is the reliable identity;
  CLI/MCP accept a title as convenience when unambiguous; on
  ambiguity the agent reads the candidates and reasons (list →
  read → reason), escalating to the human only as a last
  resort.
· Tags: a multi-valued set per note — a light, cheap
  classification/filter axis and an optional organising layer
  parallel to Spaces (the natural axis for single-Space
  users). Primary home = the management UI (filter/group);
  also shown subtly on the note when present.
· Colour: an independent per-note visual property (visual
  treatment lives in note-window).
  Colour-derived-from-taxonomy is a later enhancement.

PATHS NOT TAKEN ──────────────────────────────────────────── 4
· RTF / rich text — predates Markdown, adds nothing here, and
  makes the scripting surface awkward.
· A first-class stored title field — two sources of truth
  (field vs first line) that drift and need reconciling UI.
· Forcing unique titles — the UID already provides identity;
  uniqueness adds friction and breaks natural patterns (a
  "todo" on Personal and another on Fabric).
· Colour derived from tags for the first cut — a note has
  multiple tags, so "colour = the tag's colour" doesn't
  resolve; deferred.

OPEN QUESTIONS ───────────────────────────────────────────── 2
· Tags: how they are created, applied, and edited (surfaces in
  management-window).
· Whether tags-on-note show at rest vs on hover — lean
  at-rest-but-subtle (tags are content, not controls).
```

```text
⌂ This session   ≡ Fumi   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

Fumi · epic · at its menu
Fumi — a smarter macOS Stickies alternative: notes assigned to
specific macOS Spaces (returning to their Space on relaunch),
remembering exact screen position, with titles and a full fumi
CLI/MCP scripting surface
started 17 Jul · discovery complete 17 Jul
▱▱▱▱▱▱▱▱  0 of 12 topics decided

DISCOVERY ──────────────────────────────────── 0 of 12 decided
○ Note model                                              next
○ Storage and sync                                 not started
○ Note window                                      not started
○ Engine architecture                              not started
○ Space homing                                     not started
○ Positioning and audience                         not started
○ Agent surface                                    not started
○ Management window                                not started
○ Onboarding and permissions                       not started
○ Commercialization                                not started
○ Licensing and trial integrity                    not started
○ Build and release                                not started

DEFINITION ──────────────────────────────────────────────────
○ Specification · waits until every topic is decided · 12 to go

DELIVERY ────────────────────────────────────────────────────
○ Build and review · after the specification

LATELY ──────────────────────────────────────────────────────
✓ Map approved · 12 topics, 4 to the roadmap          just now
◇ Spike: note window · reference                        17 Jul
✓ Started as an epic                                    17 Jul
```

### 20.12 In an investigation

20.12.1 This session in a bug's investigation shows: its header ("{unit} ·
investigation"), the project, type and when it started; a facts line
(hypotheses, how many confirmed, experiments, and where it stands —
validating the root cause, the fix direction waiting on the person,
validating the fix, or "concluded · the specification next"); WAITING ON
YOU, a question a validation or the fix direction put to the person, "asked
in the conversation", with what raised it and why it reached them; DECIDED,
what the person decided, marked "yours"; SYMPTOMS; HYPOTHESES, each
"confirmed", "ruled out" or, where the person's ruling made it so,
"intended"; EXPERIMENTS, each with what it showed; ROOT CAUSE, its opening,
"being validated" or "validated"; VALIDATION, both validations, "both always
run", one being read with its clock, each finished one with what it found
and that Claude acted on it; CLAUDE'S CALLS since the person last looked;
FIX DIRECTION, waiting on the root cause, then what stepping back found and
the options, Claude's lean marked, and once picked the person's pick. [R15,
R20; locked by the person 2026-10-21, "all looks great"]

20.12.2 Each hypothesis, experiment, option and call, the root cause, and
what stepping back found opens on its own page, "← back to the
investigation" returning. [R20; the locked spike]

20.12.3 Earlier fixes to the area are part of Claude's analysis and are not
shown on the board. [R20: "nothing is shown to the person and nothing is
counted"]

20.12.4 Once the investigation concludes, the unit's tab shows the
specification next; the specification opens in a clean context (§24), and
This session follows the session into it. [R15, R20; the locked spike]

```text
⌂ This session   ≡ killing-all-sessions-wipes-re…   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

killing-all-sessions-wipes-restore-state · investigation
Portal · bugfix · started 16 Aug
6 hypotheses · 4 confirmed · 10 experiments · ◐ validating the
root cause

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ A session you kill yourself: should it ever come back?
  Killing every one today empties the saved state and deletes
  its scrollback.
     raised by the root-cause validation · deleted scrollback
     cannot be got back

SYMPTOMS ─────────────────────────────────────────────────── 3
· sessions.json overwritten with an empty (or shrunken) index.
· Every saved scrollback .bin file removed by the housekeeping
  pass.
· No confirmation, no warning — the next restore simply has
  nothing to restore.

HYPOTHESES ─────────────────────────────────────── 4 confirmed
✓ H1 Killing every session empties the state         confirmed
– H2 kill-server saves an empty state                ruled out
✓ H3 The daemon's last save catches a dying server   confirmed
– H4 A real reboot finds the server already gone     ruled out
✓ H5 At reboot, sessions die before tmux does        confirmed
✓ H6 A dying tmux reads as zero sessions             confirmed

EXPERIMENTS ───────────────────────── 10 · on a throwaway tmux
✓ E1 Kill every session, hook on   each kill shrank it · 3 → 0
✓ E1b Kill every session, no hook            next tick saved 0
✓ E2 kill-server, the runtime live                 5 of 5 kept
✓ E3 One SIGTERM to everything                     5 of 5 kept
✓ E4 Panes, then daemon, then server           3 sessions lost
✓ E5 Panes and daemon, server after       10 ms gap: all wiped
✓ E6 list-sessions racing a SIGTERM            2 empty answers
✓ E7 E5, every tmux call logged       every wipe a failed read
✓ E8 list-panes racing a SIGTERM               2 empty answers
✓ E9 Kill every session, hooks set         hooks reaped in 7 s

ROOT CAUSE ─────────────────────────────────── being validated
Every Portal save treats the session list tmux gives it at
that instant as the complete, authoritative truth, and acts on
it irreversibly in the same step: whatever sessions the
capture does not see are dropped from sessions.json, and the
housekeeping pass that runs inside every commit
(gcOrphanScrollback, internal/state/commit.go:39) deletes
every scrollback file the new index no longer names.

VALIDATION ─────────────────────────────────── both always run
◐ Root cause · extra-high                         reading 6:12
○ Fix                                  after the fix direction

FIX DIRECTION ─────────────────────────── after the root cause
○ once the root cause is validated
```

```text
⌂ This session   ≡ killing-all-sessions-wipes-re…   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

killing-all-sessions-wipes-restore-state · investigation
Portal · bugfix · started 16 Aug
6 hypotheses · 3 confirmed · 10 experiments · ⚑ the fix
direction waits on you

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ Which fix: 3 options, Claude's lean first

DECIDED ──────────────────────────────────────────── 1 · yours
✓ A session you kill never comes back; a session you detach
  from does, and so do sessions ended by kill-server or a
  reboot

SYMPTOMS ─────────────────────────────────────────────────── 3
· sessions.json overwritten with an empty (or shrunken) index.
· Every saved scrollback .bin file removed by the housekeeping
  pass.
· No confirmation, no warning — the next restore simply has
  nothing to restore.

HYPOTHESES ─────────────────────────────────────── 3 confirmed
– H1 Killing every session empties the s… intended · your rule
– H2 kill-server saves an empty state                ruled out
✓ H3 The daemon's last save catches a dying server   confirmed
– H4 A real reboot finds the server already gone     ruled out
✓ H5 At reboot, sessions die before tmux does        confirmed
✓ H6 A dying tmux reads as zero sessions             confirmed

EXPERIMENTS ───────────────────────── 10 · on a throwaway tmux
✓ E1 Kill every session, hook on   each kill shrank it · 3 → 0
✓ E1b Kill every session, no hook            next tick saved 0
✓ E2 kill-server, the runtime live                 5 of 5 kept
✓ E3 One SIGTERM to everything                     5 of 5 kept
✓ E4 Panes, then daemon, then server           3 sessions lost
✓ E5 Panes and daemon, server after       10 ms gap: all wiped
✓ E6 list-sessions racing a SIGTERM            2 empty answers
✓ E7 E5, every tmux call logged       every wipe a failed read
✓ E8 list-panes racing a SIGTERM               2 empty answers
✓ E9 Kill every session, hooks set         hooks reaped in 7 s

ROOT CAUSE ───────────────────────────────────────── validated
Every Portal save treats the session list tmux gives it at
that instant as the complete, authoritative truth, and acts on
it irreversibly in the same step: whatever sessions the
capture does not see are dropped from sessions.json, and the
housekeeping pass that runs inside every commit
(gcOrphanScrollback, internal/state/commit.go:39) deletes
every scrollback file the new index no longer names.

VALIDATION ─────────────────────────────────── both always run
✓ Root cause · extra-high                    2 found, acted on
○ Fix                                  after the fix direction

CLAUDE'S CALLS ───────────────────── 2 · since you last looked
» Restore keeps reading "no tmux" as "no sessions"; only
  saving stops trusting it
» Measuring a real reboot waits for your next one: the fix
  logs every session a save drops

FIX DIRECTION ────────────────────────────────────── 3 options
Stepped back first: other tools that save tmux state take a
snapshot every 15 minutes and never promise a kill is final.
1 Harden the reads, outlast the shutdown, log every drop ·
Claude's lean
2 Read hardening alone
3 Read hardening plus hold every removal until tmux outlives it
```

```text
⌂ This session   ≡ killing-all-sessions-wipes-re…   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

← back to the investigation

H6 A dying tmux reads as zero sessions
confirmed
 ────────────────────────────────────────────────────────────
Basis: found in the reboot-timing trials (E5): a 10ms gap
between the daemon's SIGTERM and the server's wiped 5/5
sessions including two whose programs had survived.
Mechanism, two paths: (1) Portal — Client.ListSessions
swallows every list-sessions failure and returns an empty list
("the error is the no-server signal",
internal/tmux/tmux.go:130-135), and ListSessionNames passes
that on as a successful empty read; the committer's earlier
reads (@portal-restoring, skeleton markers) had already
succeeded, so nothing stands it down. Measured (E7, logging
shim on tmux): every wiping trial's list-sessions returned
rc=1 server exited unexpectedly, swallowed into sessions=0.
(2) tmux — a command client accepted before the server began
exiting is ended with a payload-less MSG_SHUTDOWN, which
leaves client_exitval at its zero default, so list-sessions
exits 0 with no output (client.c:654-657,
client_dispatch_exit_message). Measured (E6): 2 of ~5,800
list-sessions calls racing a SIGTERM returned rc=0 and
nothing. Either path yields a valid empty Index with a nil
error.
Reach: any committer — the daemon's SIGTERM flush (E5, E7) and
a hook-run commit-now (E7, gap 30ms #1: 0/0 with
flush_completed=false). Where list-sessions succeeds but a
later per-session read is refused, the all-sessions-failed
guard holds (E7, gap 20ms #1 and 30ms #2: 5/5 kept).
Beyond list-sessions: tmux's exit-0-and-nothing answer comes
from the client side and is command-agnostic. Measured for
list-panes -a (E8: 2 of ~2,900 calls); not observed for
capture-pane in ~2,900 calls but taking the same client path.
Two further destructive consumers follow from it, neither
reproduced in a committer: (a) an empty pane listing with a
surviving show-environment records a session with no windows
(capture.go:540-565), so its .bin files are deleted while its
name stays in sessions.json; (b) an empty capture-pane during
the daemon's dump hashes differently from the saved file and
WriteScrollbackIfChanged (internal/state/scrollback.go:77-87,
from dumpPane, cmd/state_daemon.go:316-337) atomically
overwrites that pane's .bin with zero bytes — a loss that
involves no housekeeping pass and no change to the session
list.
```

### 20.13 In an experiment

20.13.1 This session in an experiment shows: its header ("{id} {the
question}"), the unit and type and the topic it serves; a facts line (when
the person approved it, runs done of all, "◐ running" or "✓ concluded");
THE QUESTION, from the topic, with what was measured so far; THE DESIGN,
"frozen when you approved it", what it measures, each condition and the
pre-registered rule; RUNS, each condition with its runs done and its median
so far; VERDICT, "once every run is in", then what the rule gives, opening
the report; WAITS ON IT, the topic waiting, and once concluded that the
report waits for it. [R11 ("experiments to measure (unchanged: a rigid
laboratory …)"), R15; locked by the person 2026-10-21, "all looks great",
drawn over a made-up experiment]

20.13.2 Once the verdict is in, This session follows the session to the
epic's menu, where the topic that waits on the experiment says "{id}
concluded · the report waits". While it runs, the topic's row says "{id}
running · this session". [R15; the locked spike]

20.13.3 An abandoned experiment's facts line says "abandoned" with its
reason, such as the topic's cancel (18.4.22). [R15; Claude's derivation,
T45]

```text
⌂ This session   ≡ Fumi   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

E1 What does a real fumi cost at launch?
Fumi · epic · an experiment for Scale and performance
approved 2 Sep · 26 of 40 runs · ◐ running

THE QUESTION ────────────────────── from Scale and performance
Measured so far: sixteen bare NSWindows created, placed one
per Space and shown non-activating in 242 ms total.
What is left is what each window is: the burst used bare
windows, where a fumi carries glass material, custom chrome, a
Markdown editor, autosave wiring and per-note appearance
state.

THE DESIGN ─────────────────────── frozen when you approved it
· Measures the time from launch to the last fumi shown on its
  Space
· 20 cold launches of 16 bare windows: the floor, again
· 20 cold launches of 25 real fumis, the top of your open set
  (~20–25)
· The rule: if the 25th real fumi is on screen in under 1
  second, eager restore stands as decided; at 1 second or
  more, placing fumis beyond the active Space lazily is open
  again.

RUNS ──────────────────────────────────────────────── 26 of 40
✓ 16 bare windows                     20 of 20 · median 0.24 s
◐ 25 real fumis                        6 of 20 · median 0.67 s

VERDICT ──────────────────────────────────── the rule, applied
○ once every run is in

WAITS ON IT ────────────────────────────────────────── 1 topic
◐ Scale and performance                   its discussion waits
```

```text
⌂ This session   ≡ Fumi   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

E1 What does a real fumi cost at launch?
Fumi · epic · an experiment for Scale and performance
approved 2 Sep · 40 of 40 runs · ✓ concluded

THE QUESTION ────────────────────── from Scale and performance
Measured so far: sixteen bare NSWindows created, placed one
per Space and shown non-activating in 242 ms total.
What is left is what each window is: the burst used bare
windows, where a fumi carries glass material, custom chrome, a
Markdown editor, autosave wiring and per-note appearance
state.

THE DESIGN ─────────────────────── frozen when you approved it
· Measures the time from launch to the last fumi shown on its
  Space
· 20 cold launches of 16 bare windows: the floor, again
· 20 cold launches of 25 real fumis, the top of your open set
  (~20–25)
· The rule: if the 25th real fumi is on screen in under 1
  second, eager restore stands as decided; at 1 second or
  more, placing fumis beyond the active Space lazily is open
  again.

RUNS ──────────────────────────────────────────────── 40 of 40
✓ 16 bare windows                     20 of 20 · median 0.24 s
✓ 25 real fumis                       20 of 20 · median 0.68 s

VERDICT ──────────────────────────────────── the rule, applied
✓ 0.68 s, under 1 second: eager restore stands

WAITS ON IT ────────────────────────────────────────── 1 topic
◐ Scale and performance                the report waits for it
```

```text
⌂ This session   ≡ Fumi   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

Fumi · epic · at its menu
Fumi — a smarter macOS Stickies alternative: notes assigned to
specific macOS Spaces (returning to their Space on relaunch),
remembering exact screen position, with titles and a full fumi
CLI/MCP scripting surface
started 17 Jul · in discussion
▰▰▰▰▰▱▱▱  9 of 16 topics decided · 6 in discussion

DISCOVERY ──────────────────────────────────── 9 of 16 decided
✓ Note model                                           decided
✓ Storage and sync                                     decided
✓ Note window                                          decided
✓ Engine architecture                                  decided
✓ Space homing                                         decided
✓ Platform support                                     decided
✓ Search and retrieval                                 decided
✓ Status and alerts                                    decided
✓ Agent surface                                        decided
◐ Management window                           36 of 36 decided
     1 message waiting
◐ Onboarding and permissions                  11 of 12 decided
     1 message waiting
◐ Commercialization                           25 of 25 decided
     1 message waiting
◐ Licensing and trial integrity               10 of 15 decided
     another session · 2 messages waiting
◐ Support and diagnostics                       0 of 6 decided
     another session
○ Build and release                                not started
     17 messages waiting
◐ Scale and performance                         3 of 5 decided
     E1 concluded · the report waits

DEFINITION ──────────────────────────────────────────────────
○ Specification · waits until every topic is decided · 7 to go

DELIVERY ────────────────────────────────────────────────────
○ Build and review · after the specification

SET ASIDE ────────────────────────────────────────────────── 4
– Positioning and audience                           cancelled
– Data export                                        cancelled
– Privacy and data handling                          cancelled
↷ Website                             postponed · roadmap next

LATELY ──────────────────────────────────────────────────────
» Licensing and trial integrity took in 8 messag… 21 Oct 13:10
» Onboarding and permissions took in a message f… 21 Oct 12:10
» Onboarding and permissions sent a message to M… 21 Oct 12:10
» Onboarding and permissions took in a message f… 20 Oct 21:18
» Onboarding and permissions sent a message to C… 20 Oct 21:18
◐ Support and diagnostics started                 20 Oct 20:40
↷ Website postponed to the roadmap · next         20 Oct 20:28
```

### 20.14 In a quick-fix

20.14.1 This session in a quick-fix's one session shows: its header ("{unit}
· quick-fix"), the project, where it came from, "one session" and when it
started; a facts line (steps done of all, and what is under way, or "⚑ close
waits on you", or "✓ complete"); WAITING ON YOU while close waits, saying
what was proven and whether a verdict is owed on a call the person changed;
THE CHANGE, as the person's note pins it, "confirmed in one line; nothing
shaped again"; THE WORK, step by step — the change, the tests, the linters,
the proof by running the product, the commit and the record — one under way
with its clock; CLAUDE'S CALLS; REPLACES, an earlier decision the change
supersedes, with the unit it came from; THE RECORD once committed — what
changed, why, what it leaves out. [R10, R21, R23; locked by the person
2026-10-21, "all looks great"]

20.14.2 Once the person closes it, the unit moves to COMPLETE and This
session follows the session to All work at the start menu. [R15, R21; the
locked spike]

```text
⌂ This session   ≡ m-marks-highlighted-on-entry   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

m-marks-highlighted-on-entry · quick-fix
Portal · from your inbox note · one session · started 15 Jul
4 of 6 done · ◐ proving it in Portal

THE CHANGE ───────────────────────────────── your note pins it
Pressing m on a highlighted session marks it as the first
multi-select selection on entry, instead of entering
multi-select mode with an empty set
✓ confirmed in one line; nothing shaped again

THE WORK ────────────────────────────────────────────── 4 of 6
✓ Mark the highlighted row on entry · model.go · 3 lines
✓ Flip the tests that expected an empty set
✓ go test ./... passes
✓ go vet · gofmt · golangci-lint · clean
◐ Prove it in Portal: m marks the session under it        0:41
○ Commit, and write the record

CLAUDE'S CALLS ───────────────────────────────────────────── 2
» The README says entering marks the highlighted row
» The capture harness keeps entering with a named set, as it did

REPLACES ────────────────────────────────── 1 · yours, earlier
↺ "m enters a real mode you can sit in with zero selected" ·
restore-host-terminal-windows
```

```text
⌂ This session   ≡ m-marks-highlighted-on-entry   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

m-marks-highlighted-on-entry · quick-fix
Portal · from your inbox note · one session · started 15 Jul
6 of 6 done · ⚑ close waits on you

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ Close: what was proven; you changed none of Claude's calls,
  so there is no verdict to give

THE CHANGE ───────────────────────────────── your note pins it
Pressing m on a highlighted session marks it as the first
multi-select selection on entry, instead of entering
multi-select mode with an empty set
✓ confirmed in one line; nothing shaped again

THE WORK ────────────────────────────────────────────── 6 of 6
✓ Mark the highlighted row on entry · model.go · 3 lines
✓ Flip the tests that expected an empty set
✓ go test ./... passes
✓ go vet · gofmt · golangci-lint · clean
✓ Prove it in Portal: m marks the session under it
✓ Commit, and write the record

CLAUDE'S CALLS ───────────────────────────────────────────── 2
» The README says entering marks the highlighted row
» The capture harness keeps entering with a named set, as it did

REPLACES ────────────────────────────────── 1 · yours, earlier
↺ "m enters a real mode you can sit in with zero selected" ·
restore-host-terminal-windows

THE RECORD ───────────── what changed, why, what it leaves out
· What changed: entering multi-select marks the highlighted
  session; on a group header it still marks none
· Why: Entering multi-select mode by pressing m on a
  highlighted session should immediately select that session
  as the first marked item — rather than entering the mode
  with nothing selected.
· Leaves out: No change to behaviour after entry; no footer or
  banner copy change; WithInitialMultiSelect is unaffected; no
  new visual state, Paper frame, or visual gate
```

### 20.15 The unit's tab

20.15.1 The unit's tab shows what the unit is for, when it started and the
phase it is in, a progress bar of its phases complete, WAITING ON YOU, then
PHASES from discovery to review — each finished one with its date and what it
produced, the one under way with its state, those after it with what they
wait on — then LATELY, what happened recently, newest first. [R15; locked
2026-10-21]

20.15.2 For an epic the tab is the epic's page (20.8.2); while discovery
runs, before any topic exists, it shows the epic's phases instead —
discovery under way, then discussion "once the map is approved", the
specification "once every topic is decided", the build and review after it.
A bugfix's phases are discovery, investigation, specification, build and
review; a quick-fix's are discovery and implementation, its one session.
[R15, R18, R20, R21; the locked spike]

20.15.3 A linear unit's discovery opens in full on the note it began from.
[R15; the locked spike]

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
─────────────────━━━━━━━━━━━━━━━━━━━━━━━━━────────────────────

Token-aware diff sizing · feature
Token-aware diff sizing plus graceful handling of oversized
diffs for mint's notes engine, replacing the hard line-count
fail with a budget-aware guard and a chunk/summarise fallback
started 26 Jun · building since 19 Oct
▰▰▰▱▱  3 of 5 phases complete · in build

WAITING ON YOU ───────────────────────────── 3 · ▸ discuss all
⚑ Q1 If the terminal closes while the review gate waits,
  should the release unwind as a decline does, or keep its
  commit for the operator to finish by hand?
     parks 6.7 · waiting 4h                   queued ▸ unqueue
⚑ Q2 When a re-merge fails at the review gate, should the
  notes the operator already saw stay on offer to accept, or
  should the run abort with the chunk notes saved?
     parks 6.8, and 2 after it · waiting 1h          ▸ discuss
⚑ Q3 While a regeneration runs as chunks, should plain mode
  (CI and agents) print a line as each part finishes, or one
  line when the whole wave is done?
     parks 6.5 · waiting 10m                         ▸ discuss

PHASES ──────────────────────────────────────────────────────
✓ Discovery · the seed                         complete 26 Jun
✓ Discussion · 52 decisions                    complete 17 Oct
✓ Specification · 18 sections · 8 build phases complete 19 Oct
◐ Build · 58 of 68 tasks done                         building
○ Review                                       after the build

LATELY ──────────────────────────────────────────────────────
⚑ Q3 raised · parks 6.5                                10m ago
✗ 6.6 Chunked notes come back from the notes cache wi… 18m ago
◐ 6.4 A failed single-pass `r` call is classified and… 25m ago
⚑ Q2 raised · parks 6.8                                 1h ago
⚑ Q1 raised · parks 6.7                                 4h ago
✓ Phase 5 · The remediation floor complete        20 Oct 21:27

READY TO DISCUSS ─────────────────────────────────────────── 1
└ Q1  Every abort at the review gate unwinds                 ✕
▸ send to Claude                                  ▸ cancel all
```

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
─────────────────━━━━━━━━━━━━━━━━━━━━━━━━━────────────────────

Token-aware diff sizing · feature
Token-aware diff sizing plus graceful handling of oversized
diffs for mint's notes engine, replacing the hard line-count
fail with a budget-aware guard and a chunk/summarise fallback
started 26 Jun · specifying since 17 Oct
▰▰▱▱▱  2 of 5 phases complete · in specification

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ The halving progress line's part count

PHASES ──────────────────────────────────────────────────────
✓ Discovery · the seed                         complete 26 Jun
✓ Discussion · 52 decisions                    complete 17 Oct
⚑ Specification · 18 sections · 4 passes          waits on you
○ Build                                after the specification
○ Review                                       after the build

LATELY ──────────────────────────────────────────────────────
⚑ Pass 4 asked you about the halving progress line      3m ago
◆ Pass 4 found 6 · 4 calls, 2 yours                     5m ago
◆ Pass 3 found 5 · 4 calls, 1 yours                    41m ago
◆ Pass 2 found 3 · 2 calls, 1 yours                     1h ago
◆ Pass 1 read the whole specification · found 10        2h ago
✓ Specification written · 18 sections, 8 phases cut     3h ago
```

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
─────────────────━━━━━━━━━━━━━━━━━━━━━━━━━────────────────────

Token-aware diff sizing · feature
Token-aware diff sizing plus graceful handling of oversized
diffs for mint's notes engine, replacing the hard line-count
fail with a budget-aware guard and a chunk/summarise fallback
started 26 Jun · in review since 21 Oct
▰▰▰▰▱  4 of 5 phases complete · in review

PHASES ──────────────────────────────────────────────────────
✓ Discovery · the seed                         complete 26 Jun
✓ Discussion · 52 decisions                    complete 17 Oct
✓ Specification · 18 sections · 8 build phases complete 19 Oct
✓ Build · 99 tasks done                        complete 21 Oct
◐ Review · round 1                                   reviewing

LATELY ──────────────────────────────────────────────────────
✗ §12 read and run · 5 found                            2m ago
✓ §1 to §11 read and run                                9m ago
◐ Round 1 started · 19 areas                           24m ago
✓ Build complete · 99 tasks done                       25m ago
```

```text
⌂ This session   ≡ Fumi   ≡ All work
─────────────────━━━━━━───────────────────────────────────────

Fumi · epic
Fumi — a smarter macOS Stickies alternative: notes assigned to
specific macOS Spaces (returning to their Space on relaunch),
remembering exact screen position, with titles and a full fumi
CLI/MCP scripting surface
started 17 Jul · in discussion
▰▰▰▰▰▱▱▱  9 of 15 topics decided · 5 in discussion

DISCOVERY ──────────────────────────────────── 9 of 15 decided
✓ Note model                                           decided
✓ Storage and sync                                     decided
✓ Note window                                          decided
✓ Engine architecture                                  decided
✓ Space homing                                         decided
✓ Platform support                                     decided
✓ Search and retrieval                                 decided
✓ Status and alerts                                    decided
✓ Agent surface                                        decided
◐ Management window                           36 of 36 decided
     1 message waiting
◐ Onboarding and permissions                  11 of 12 decided
     this session · 1 message waiting
◐ Commercialization                           25 of 25 decided
     1 message waiting
◐ Licensing and trial integrity               10 of 15 decided
     another session · 2 messages waiting
◐ Support and diagnostics                       0 of 6 decided
     another session
○ Build and release                                not started
     17 messages waiting

DEFINITION ──────────────────────────────────────────────────
○ Specification · waits until every topic is decided · 6 to go

DELIVERY ────────────────────────────────────────────────────
○ Build and review · after the specification

SET ASIDE ────────────────────────────────────────────────── 5
– Positioning and audience                           cancelled
– Scale and performance                              cancelled
– Data export                                        cancelled
– Privacy and data handling                          cancelled
↷ Website                             postponed · roadmap next

LATELY ──────────────────────────────────────────────────────
» Licensing and trial integrity took in 8 messag… 21 Oct 13:10
» Onboarding and permissions took in a message f… 21 Oct 12:10
» Onboarding and permissions sent a message to M… 21 Oct 12:10
» Onboarding and permissions took in a message f… 20 Oct 21:18
» Onboarding and permissions sent a message to C… 20 Oct 21:18
◐ Support and diagnostics started                 20 Oct 20:40
↷ Website postponed to the roadmap · next         20 Oct 20:28
```

```text
⌂ This session   ≡ Fumi   ≡ All work
─────────────────━━━━━━───────────────────────────────────────

Fumi · epic
Fumi — a smarter macOS Stickies alternative: notes assigned to
specific macOS Spaces (returning to their Space on relaunch),
remembering exact screen position, with titles and a full fumi
CLI/MCP scripting surface
started 17 Jul · in discovery
▱▱▱▱  0 of 4 phases complete

PHASES ──────────────────────────────────────────────────────
◐ Discovery · 10 topics                                shaping
○ Discussion                          once the map is approved
○ Specification                    once every topic is decided
○ Build and review                     after the specification

LATELY ──────────────────────────────────────────────────────
◇ Spike: note window · reference                        1h ago
✓ Started as an epic                                    3h ago
```

```text
⌂ This session   ≡ killing-all-sessions-wipes-re…   ≡ All work
─────────────────━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━─────────────

killing-all-sessions-wipes-restore-state · bugfix
Killing all tmux sessions wipes sessions.json and every
scrollback file within one daemon tick
started 16 Aug · investigating since 16 Aug
▰▱▱▱▱  1 of 5 phases complete

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ A session you kill yourself: should it ever come back?
  Killing every one today empties the saved state and deletes
  its scrollback.
     raised by the root-cause validation · deleted scrollback
     cannot be got back

PHASES ──────────────────────────────────────────────────────
✓ Discovery · from your inbox note             complete 16 Aug
⚑ Investigation · 6 hypotheses                    waits on you
○ Specification                        after the investigation
○ Build                                after the specification
○ Review                                       after the build

LATELY ──────────────────────────────────────────────────────
⚑ A question raised by the root-cause validation        2m ago
◐ Root-cause validation started · extra-high            6m ago
✓ Root cause written                                    9m ago
✓ E9 Kill every session, hooks set                     31m ago
```

```text
⌂ This session   ≡ m-marks-highlighted-on-entry   ≡ All work
─────────────────━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━───────────────

m-marks-highlighted-on-entry · quick-fix
Pressing m on a highlighted session marks it as the first
multi-select selection on entry, instead of entering
multi-select mode with an empty set
started 15 Jul · one session
▰▱  1 of 2 phases complete

PHASES ──────────────────────────────────────────────────────
✓ Discovery · your note, confirmed             complete 15 Jul
◐ Implementation · 4 of 6 done                         working

LATELY ──────────────────────────────────────────────────────
✓ go vet · gofmt · golangci-lint · clean                1m ago
✓ go test ./... passes                                  2m ago
✓ Started from your inbox note                          9m ago
```

### 20.16 All work

20.16.1 All work shows the project: a count of units in progress, waiting on
the person and complete; IN PROGRESS, every unit under way with its type,
phase and progress, what waits in it and where a session is; ROADMAP, the
items waiting under their horizon; INBOX, its captures by kind; COMPLETE, folded
with "▸ show". [R15; locked 2026-10-21]

```text
⌂ This session   ≡ Token-aware diff sizing   ≡ All work
─────────────────────────────────────────────━━━━━━━━━━───────

All work · Mint
3 in progress · ⚑ 4 waiting on you · 5 complete

IN PROGRESS ──────────────────────────────────────────────── 3
◐ Token-aware diff sizing                          ⚑ 3 waiting
     feature · build · 58 of 68 tasks done · this session
◐ Rate-limit-aware publish                         ⚑ 1 waiting
     feature · discussion · retry or wait for the reset ·
     another session
○ Publish failure swallows gh stderr
     bugfix · investigation · cause found, not yet confirmed

ROADMAP ──────────────────────────────────────────── 3 waiting
Next
◇ Headline first release notes
◇ Agent authored release notes
◇ Agent guide for running releases

INBOX ─────────────────────────────────────── 2 ideas · 3 bugs
◇ Mint CLI UI/UX overhaul
◇ Actionable notes-timeout error
✗ Single-version regenerate prepends changelog entry at top
  instead of semver position
✗ Publish heal hint: wrong diagnosis, wrong command form
✗ version_pattern without {version} passes preflight, fails at
  record after the user approves the release

COMPLETE ──────────────────────────────────────────── 5 ▸ show

READY TO DISCUSS ─────────────────────────────────────────── 1
└ Q1  Every abort at the review gate unwinds                 ✕
▸ send to Claude                                  ▸ cancel all
```

```text
⌂ This session   ≡ Fumi   ≡ All work
──────────────────────────━━━━━━━━━━──────────────────────────

All work · Fumi
1 in progress · 0 complete

IN PROGRESS ──────────────────────────────────────────────── 1
◐ Fumi
     epic · discussion · 9 of 15 topics decided · this session

ROADMAP ──────────────────────────────────────────── 4 waiting
next
◇ Liquid glass note surface
◇ Grid drag preset editor
◇ In place preset creation
◇ Website · postponed from Fumi

INBOX ──────────────────────────────────────── 1 idea · 0 bugs
◇ Fumi stacks
```

```text
⌂ This session   ≡ m-marks-highlighted-on-entry   ≡ All work
━━━━━━━━━━━━━━────────────────────────────────────────────────

All work · Portal · at the start menu
2 in progress · 58 complete

IN PROGRESS ──────────────────────────────────────────────── 2
○ agent-first-portal
     epic · discussion
○ tagging-and-filtering
     epic · discussion

ROADMAP ──────────────────────────────────────────── 3 waiting
next
◇ Picker row redesign
◇ Preferences ui
◇ Durable pane identity

INBOX ───────────────────────────────────── 15 ideas · 15 bugs
◇ Portal command for cleaning up ghost tmux clients
◇ Cmd-layer soft-fail / error-path test gaps
◇ Unify open-coded previewModel construction across the
  preview test corpus
◇ cmd-layer test scaffolding hardening (bundle)
◇ Compiler-check the closed component / op / via / reason
  vocabularies
◇ Close the two structural-only verification gaps with
  end-to-end tests
◇ Harden the ListSessions error swallow (discriminate
  server-absent from other failures)
◇ Mechanical guard test for the §2.9 colour role-discipline rule
◇ Restore reopened windows to their origin macOS Space
◇ A health validation + surfacing layer for the resume system
◇ Decide whether a burst that never started should emit spawn:
  opened 0/N
◇ Portal should own the resume-registration lifecycle, not an
  external shell hook
◇ Shard sessions across multiple tmux servers
◇ Pause a running pane into the waiting state on demand
◇ A Portal menu inside the tmux session
✗ Narrow-width overflow in the section header, command band,
  and edit-modal panel
✗ cmd config-path fallback tests can relocate the developer's
  real config files
✗ Session list clips the keymap footer on short terminals
✗ The bootstrap composite e2e convergence assertion flakes
✗ The NO_COLOR loading bar shows no progress
✗ Integration-test tmux servers outlive the test run and can
  pin a core indefinitely
✗ Saver respawn can leave the install with no daemon at all
✗ Restore leaves a dead zombie session behind when
  respawn-pane fails during the arm phase
✗ The cmd/bootstrap integration lane fails whole-package with
  no established cause
✗ The discard-logger guard matches one spelling
✗ Grouped sessions and linked windows share one pane token
✗ Scrolling in the preview leaks into the session list on
  dismiss
✗ Session preview shows too little scrollback to scroll
✗ A session's project link is lost on every reboot
✗ A | in a session name breaks Portal's session listing

COMPLETE ─────────────────────────────────────────── 58 ▸ show
```

## 20-S. Scenarios for §20

20.S1 Given a build with three questions waiting, when the person opens the
board, then This session shows the build, WAITING ON YOU lists the three with
"▸ discuss" each and "▸ discuss all" on the heading, and the running tasks
show their clocks. (20.3.3, 20.5.1, 20.5.3)

20.S2 Given the board is hidden, when the person presses "▸ show board" on the
banner, then the pane opens and the banner's button reads
"hide board"; pressed again, the pane closes. (20.2.3)

20.S3 Given a question waiting, when the person presses its "▸ discuss",
then it appears in READY TO DISCUSS on every tab and nothing reaches the
conversation or the prompt box. (20.6.2, 20.6.3, 20.6.5)

20.S4 Given two questions queued, when the person presses "▸ send to Claude",
then one message reaches the conversation naming both in the order queued, and
Claude raises the first in full. (20.6.6)

20.S5 Given Q1 under discussion with Q2 after it, when the person presses
"▸ skip", then exactly one line reaches the conversation, Q1 waits again and
Claude raises Q2. (20.6.8)

20.S6 Given Q1 answered in the conversation, when Claude records it, then the
verb's receipt is one line naming the task that builds again and how many
still wait, Claude shows it as it is, and the board no longer lists Q1.
(20.6.9)

20.S7 Given a question already answered, when the verb is called for it
again, then it refuses. (20.6.10)

20.S8 Given the person reading a task's page, when the session moves from the
build to the review phase, then the page stays until the person presses back,
and back shows the review. (20.3.4, 20.3.5)

20.S9 Given a session at an epic's menu, when it opens a topic, then This
session changes from the epic's page to the topic's discussion, and back at
the menu it changes back. (20.3.3, 20.3.4, 20.8.1)

20.S10 Given a specification whose last pass changed nothing, when the person
says yes at ready to build, then This session shows the build. (20.9.3)

20.S11 Given a review round that fails, when its fix tasks land and the next
round runs, then the areas the fixes did not change read "unchanged, not read
again". (20.10.2)

20.S12 Given a task building, when the board is up, then its ◐ turns a quarter
every 250 ms and nothing else on the board moves; with the board hidden,
nothing turns. (20.4.8)

20.S13 Given the board open or closed, when a task lands, then the
conversation shows the same summary and waiting questions either way.
(20.1.3, 20.1.4)

20.S14 Given a list longer than the pane with a question queued, when the
person scrolls the board, then the list scrolls and READY TO DISCUSS stays
at the pane's foot. (20.6.5)

20.S15 Given a done task, when the person opens its page, then its account
is there, and nothing on the page sends it to the conversation. (20.5.7)

20.S16 Given a session in discovery with ten topics on the map, when the
person opens the board, then This session shows THE MAP in the map's order
with each summary, what goes to the roadmap, what was not taken, the spikes
and the person's views; a press on a topic opens its brief, which says it
is decided in its discussion, not here. (20.11.1, 20.11.2)

20.S17 Given approve the map waiting, when the person approves it in the
conversation, then This session shows the epic's page at its menu with every
topic not started and the first marked "next", and All work's roadmap holds
what the map parked. (20.11.4, 20.3.4)

20.S18 Given an investigation whose root-cause validation raised a question,
when the person opens the board, then WAITING ON YOU shows it "asked in the
conversation" with what raised it, and the validation shows its clock.
(20.12.1)

20.S19 Given the person's answer recorded, when the root cause is validated,
then DECIDED shows the person's ruling as theirs, a hypothesis the ruling
made intended reads "intended", and FIX DIRECTION shows what stepping back
found and the options, Claude's lean marked. (20.12.1)

20.S20 Given an area fixed before, when Claude's analysis reads it, then the
board shows no history of earlier fixes and no count. (20.12.3)

20.S21 Given an experiment running, when the person opens the board, then
This session shows the question, the design frozen at approval with its
rule, each condition's runs and median so far, and the topic that waits on
it; the topic's row on the epic's page says "{id} running · this session".
(20.13.1, 20.13.2)

20.S22 Given the last run in, when the rule gives its verdict, then VERDICT
shows it and opens the report, and This session follows the session to the
epic's menu, where the topic says the report waits. (20.13.1, 20.13.2)

20.S23 Given a quick-fix from an inbox note that pins the change, when the
person opens the board, then This session shows the change confirmed in one
line, each step of the work with the one under way and its clock, Claude's
calls, and the earlier decision it replaces. (20.14.1)

20.S24 Given the quick-fix committed, when close waits, then THE RECORD
shows what changed, why and what it leaves out, and once the person closes
it This session shows All work at the start menu with the unit under
COMPLETE. (20.14.1, 20.14.2)

## 21. Migration

### 21.1 What migrates, and from what

21.1.1 Every existing project migrates fully, as if it had always had this shape: one canonical path, with no second set of skills, no old units on old prose, and no runtime code that recognises an older shape (§2). [R37, R8, plan 5.1]

21.1.2 A project migrates when the person updates its skills and next runs `/workflow-start`. A dormant project migrates whenever it is brought back. [R37, plan 5.1]

21.1.3 Only the current shape is migrated from. The existing chain of migrations brings an older project up first, and the reshape's migration is written against today's shape alone — the shape the existing chain leaves (072 when ruled; see §1 for rebasing onto later migrations). [R37, plan 5.1; ruled by the person 2026-10-16]

21.1.4 The migration never touches a project's code. [R37, plan 5.1]

21.1.5 The migration writes nothing into the trust log: it is new and starts empty for everyone, the author included (§16). [R37, R25; Claude's derivation, O80]

### 21.2 One sequence

21.2.1 The migration is one numbered sequence of code steps and directives (21.10), interleaved and each grouped by its job, run in this order:
1. Guard (code).
2. The legacy split (code, directive, code).
3. The move (code).
4. The records (directive).
5. The cut and the merges (directive).
6. Finish (code).
[R37, plan 5.2]

### 21.3 Step 1: the guard

21.3.1 The migration refuses while another session is live in the project. It reads this from the old skills' presence files, whose paths only the migration may know. [R37]

21.3.2 The migration refuses while `.workflows/` has uncommitted changes, which the migration commit would otherwise sweep in. [R37]

21.3.3 A major upgrade under a running session is declined outright. [R37; the person 2026-10-17]

21.3.4 Screen: the guard's refusal. The migration stops without running; the sources give its two causes — another session live in the project, uncommitted changes under `.workflows/` — and Claude draws the rest of it in the spec (18.10.8). [R37; Claude's derivation, O94]

Screen, drawn by Claude: the guard's refusal, another session live in the project. [Claude's derivation, O94]

```text
▪ Migration
⚑ The migration can't run while another session is live here
> Another session is working in this project: Fumi, in the
> discussion of Licensing And Trial Integrity, last active 3m
> ago. A major upgrade never runs under a live session, so
> nothing has been changed.
>
> End that session, then run /workflow-start here again.
```

Screen, drawn by Claude: the guard's refusal, uncommitted changes under .workflows/. [Claude's derivation, O94]

```text
▪ Migration
⚑ The migration can't run: .workflows/ has uncommitted changes
> The migration's commit would sweep them in with its own, so
> nothing has been changed.
>
> Commit or discard them, then run /workflow-start here again.
```

### 21.4 Step 2: the legacy split

21.4.1 The legacy split cuts broad research that migration 038 seeded, still in progress, into topic-sized files and map items, interviewing the person per file. [R37]

21.4.2 The split is no longer a skill run on opening an epic: it becomes a directive numbered just before the reshape, written against today's shape — the shape it already runs on, since today it runs only after every migration up to 072 has. The split's skill folder goes. [R37]

21.4.3 Code detection walks every epic. Where nothing qualifies, the step is recorded with nothing done and never reaches the session. [R37]

21.4.4 Where something qualifies, the interview runs per epic, and code applies the split. [R37]

21.4.5 Screen: the legacy split's interview. It stays the split's interview, per file, run per epic, and appears only where detection found something. [R37, R38]

### 21.5 Step 3: the move

21.5.1 The move is code. It puts the project into the layout (§4). [R37, plan 5.2]

21.5.2 A topic's log is its research then its discussion, each verbatim under its own heading, with the repetition between them kept (a discussion's inherited position restates its research). [R37]

21.5.3 A bugfix's investigation becomes its topic's log. [R37]

21.5.4 Research feeding one topic joins that topic's log. Research feeding several topics goes to the unit's discovery log, where epic-wide research belongs, until the cut-and-merges directive places it by judgment (21.7.2). [R37; ratified by the person 2026-10-17]

21.5.5 Each topic's mail moves to its own folder as one sequence, renumbered where the topic had mail in both its research box and its discussion box. [R37]

21.5.6 Mail for a cancelled topic goes to the inbox, as cancelling does from now on (18.4.14). [R37, R17]

21.5.7 Briefs move into their topics; `imports/` becomes `assets/`, and `.roadmap/imports/` becomes `.roadmap/assets/`; roadmap items' source paths are rewritten. [R37; Claude's derivation, O82]

21.5.8 Retired state is dropped: map routing, staging, review-cycle and plan-review tracking, scoping state, the Dependencies machinery and build order (§12). [R37, R15]

21.5.9 Fields added since the record was first written carry over: promoted topics, unstarted messages, where a topic came from, a roadmap item's kind. [R37]

21.5.10 The old cache is left alone: nothing reads it, and completion deletes `.cache/{unit}` whole without knowing what is inside. [R37]

21.5.11 `.workflows/` leaves the default branch (§4). The new layout becomes the first commit of the state's own branch, checked out where `.workflows/` was, and the default branch drops the folder and ignores it. These two commits are the migration's commit, made at finish on the person's yes (21.9). [R37, R23, plan 5.2, plan 6.3]

21.5.12 Anything still pending in the old state — a review not folded in, carry-notes waiting — is folded into its topic's log by the records directive (21.6). [R37]

21.5.13 Each topic's experiment records move to the layout's home for them (§4). [R37, R11; Claude's derivation, O12]

21.5.14 A cancelled unit moves like any other, its status cancelled. [R37; Claude's derivation, O78]

21.5.15 A completed quick-fix's scoping spec becomes its `summary.md`, and its plan goes. [R37, R21; Claude's derivation, O78]

21.5.16 Left to the builder: the move's destinations the sources do not name — discovery session paths, old plan files, implementation folders, existing review reports, and where the carried-over fields (21.5.9) live. [Claude's sort, B63]

21.5.17 The move drops tracking and analysis files (4.10.3); task accounts and their review rounds' reports are kept (4.10.1). [R42, plan 3.13; Claude's derivation]

### 21.6 Step 4: the records

21.6.1 The records step is a directive. [R37, plan 5.2]

21.6.2 Every topic gets a record, completed and cancelled units included, so everything moves forward in one shape: reopening or revisiting a completed unit meets nothing special, the knowledge base reaches shipped decisions, and a mature product's ledger is not empty where most of its decisions sit in finished work. [R37, plan 5.3; ruled by the person 2026-10-17; Claude's derivation, O78]

21.6.3 The stream starts at the migration: each question's current answer only, one thing per entry, each citing the log section it came from, with the earlier answers left in the log. [R37, plan 5.3; ruled by the person 2026-10-17; the person 2026-10-14]

21.6.4 Specs are read as well as logs. Decisions made at the spec stage — review gaps decided in the spec, amendments, corrigenda — exist nowhere else, and each becomes an entry on the topic it belongs to, citing the spec section it came from (21.10.7). [R37; Claude's derivation, O77]

21.6.5 An entry says who decided it where the log shows it, and "carried over" where it does not, so a migrated entry never passes as the person's decision. [R37, plan 5.3]

21.6.6 Measured results become findings saying how they are known. [R37]

21.6.7 Items still exploring or pending become open questions on the topic's map. [R37]

21.6.8 Nothing is invented. [R37]

21.6.9 The entries the directive marks product-wide start the product record (§8). [R37]

21.6.10 The records directive asks nothing per entry. At its end it raises what no log settles, one point at a time, each answered or left open (§16). [R38; ruled by the person 2026-10-17]

21.6.11 Screen: the records directive's closing raises. After the directive's work, each point no log settles is raised to the person one at a time; each is answered or left open. [R38, R24]

### 21.7 Step 5: the cut and the merges

21.7.1 The cut-and-merges step is a directive. It writes the phase-cut entries for builds under way (21.8.6–21.8.7). [R37, plan 5.2]

21.7.2 It places research that does not map one-to-one onto a topic where it bears (21.5.4). [R37]

21.7.3 It turns cross-cutting units into product-wide entries (19.6.7). [R37, R22]

21.7.4 It takes the topics that must leave a building unit (21.8.9). [R37]

21.7.5 A cross-cutting unit leaves the registry once its spec's entries land product-wide, and its spec is kept as reference in `.roadmap/assets/`. [R37, R22, R8; Claude's derivation, O78]

### 21.8 Specs: the line is whether building has started

21.8.1 How a unit's specs migrate depends on whether building has started. [R37, plan 5.4; ruled by the person 2026-10-17]

21.8.2 Nothing built: the old specs and any plans become reference in `assets/`, and the topics keep their states. [R37, plan 5.4; ruled by the person 2026-10-17]

21.8.3 Nothing built: the unit sits in discussion until every topic is decided; then one spec is written fresh from the records, through the new review and the ready-to-build gate (§11). [R37, plan 5.4; ruled by the person 2026-10-17]

21.8.4 Nothing built: tasks a plan already put in the tracker are closed by the directive, through the engine's task verbs (§7). [R37, R35; ruled by the person 2026-10-17]

21.8.5 Building started: a spec past its gate is history and never corrected, the tasks cite its sections, and a merge would be a restatement, so the unit's specs are joined verbatim into `spec.md`, one part each, in build order, never merged. [R37, plan 5.4; ruled by the person 2026-10-17]

21.8.6 Building started: the plans' phases become the phase cut. A built phase gets its name, its goal and "built". [R37, plan 5.4; ruled by the person 2026-10-17]

21.8.7 Building started: a phase not started or partly done gets its full cut entry — scenarios, the sections it draws on, what it relies on — written by the directive from the plan's phase and its acceptance criteria; the dependencies between the old specs become relies-on lines. [R37; ruled by the person 2026-10-17]

21.8.8 Building started: tasks keep their ids and their tracker state, the tracker is left untouched, and the cut names each phase's existing tracker parent. Banked findings become notes for later; approved staging goes. A spec built but never reviewed needs nothing, since the review phase reads the whole unit. Where the manifest and the tracker disagree, the tracker wins and the disagreement becomes an open note. [R37; ruled by the person 2026-10-17]

21.8.9 Mixed: a building unit cannot take a topic its spec does not cover. Topics not started, in progress, or decided but in no spec leave it, and the directive asks the person, per unit, where they go:
- a new epic the person names, the topics moving whole and starting in discussion; or
- the roadmap, as postponed topics on a horizon the directive asks the person for, a later pull opening a fresh topic that reads the earlier record.
The building unit is then whole: every topic decided, its specs joined, one build. [R37, plan 5.4; ruled by the person 2026-10-17; Claude's derivation, O79]

21.8.10 Screen: the mixed unit's question. Once per building unit with topics its specs do not cover, the directive asks where those topics go: a new epic the person names (the topics moving whole, starting in discussion), or the roadmap as postponed topics, the directive then asking which horizon. [R37; Claude's derivation, O79]

Screen, drawn by Claude: the mixed unit's question, over the rehearsal's Fumi variant mid-build. [Claude's derivation, O94]

```text
▪ Migration

Fumi is being built, and its specs cover 6 of its topics. A unit
being built can't take a topic its specs don't cover, so these 9
leave it:

IN PROGRESS (6)
  ├─ Platform Support
  ├─ Search And Retrieval
  ├─ Status And Alerts
  ├─ Management Window
  ├─ Onboarding And Permissions
  └─ Commercialization

NOT STARTED (3)
  ├─ Licensing And Trial Integrity
  ├─ Support And Diagnostics
  └─ Build And Release

· · · · · · · · · · · ·
Once they go, Fumi is whole: every topic decided, its specs
joined, one build.

◆ Where do these 9 topics go?

n/new     → A new epic, which you name — they move whole and
            start in discussion
r/roadmap → The roadmap, as postponed topics — I'll ask which
            horizon next
```

21.8.11 Completed units stay as history, their specs joined. A completed unit's concluded discussions that never reached a spec stay decided topics in the finished unit (tick v1's two are the case). [R37, plan 5.4; ruled by the person 2026-10-17]

21.8.12 Left to the builder: which directive closes a nothing-built unit's tracker tasks (21.8.4). [Claude's sort, B65]

21.8.13 Left to the builder: what the migration does with a building unit whose plan is in plain files or Linear. None of the person's projects has one (record 2997–2999). [Claude's sort, T69]

### 21.9 Step 6: finish, and the migration commit

21.9.1 Finish is code: the records are indexed (§22), then the migration's commit is made on the person's yes, as today. [R37, R44, plan 5.2]

21.9.2 The migration's commit is two commits: the default branch dropping `.workflows/`, and the state branch's first. [plan 6.3, R37; Claude's, agreed; Claude's derivation, O81]

21.9.3 Nothing is committed before the migration's commit. [R38]

21.9.4 Screen: the migration commit gate. It stays today's migration review (§22), and its one yes makes the two commits of 21.9.2. [R37, plan 6.3, plan 9.2]

21.9.5 Left to the builder: the two commits' order, what happens if one lands and the other fails, and how the state branch is checked out where `.workflows/` was before finish. [Claude's sort, B64]

21.9.6 Left to the builder: how the knowledge store's old chunks are dropped at migration (what is dropped: 22.6). [Claude's sort, B68]

### 21.10 Directives

21.10.1 A directive is a migration kind whose transform is judgment. It was chosen over stretching today's verification addenda, which check after a code transform, fire once and live in the start session's context. The legacy split was a directive under another name. [R38, plan 5.5; ruled by the person 2026-10-17]

21.10.2 A directive is one file of instructions, numbered in the same sequence as the migrations, written against the shape at its number, and frozen once released, like any migration. It runs in order, because a directive written for one shape cannot run on the shape months later. [R38, plan 5.5; ruled by the person 2026-10-17]

21.10.3 Directives are grouped by job — neither one directive doing everything nor one per action — and code steps may sit before and after each: as much as can be mechanical is. [R38; ruled by the person 2026-10-17]

21.10.4 The runner runs code migrations until it reaches a directive, stops, and hands it to the start session, which carries it out, records it once its check passes, and then carries on. One start may meet several directives. [R38, plan 5.5; ruled by the person 2026-10-17]

21.10.5 In a large unit, the start session gives each topic to its own agent, at Opus medium; the session is the ledger's only writer (§26). [R38; told to the person 2026-10-17]

21.10.6 A directive names the files it may touch. [R38]

21.10.7 A directive's check passes before the directive is recorded. The check is mechanical, through an engine verb — every entry cites a log section that exists, or a section of the old spec (now in `spec.md` or `assets/`); every decided map item has its entry — plus an independent verifier per topic hunting, against the log, detail the record dropped (§6 for the check, §26 for the verifier). [R38, plan 5.5, plan 6.4; Claude's derivation, O77]

21.10.8 A directive may ask the person: the person started the migration and is watching. Each directive's file says what it asks. The split keeps its interview (21.4.5); the records directive asks nothing per entry and raises at its end (21.6.10); the cut and the merges asks where a mixed unit's topics go (21.8.9). [R38, R37; ruled by the person 2026-10-17]

21.10.9 Progress survives a session that dies: the work is on disk, and the check tells finished topics from unfinished, so an interrupted topic is redone from the start, never resumed from half a judgment. [R38, plan 5.5; ruled by the person 2026-10-17; Claude's derivation, O81]

21.10.10 Boot refuses to continue past an unfinished directive, so no session works in a half-migrated project. [R38; ruled by the person 2026-10-17]

21.10.11 Screen: boot's refusal past an unfinished directive (21.10.10), drawn by Claude in the spec (18.10.8). [R38; Claude's derivation, O94]

Screen, drawn by Claude: boot's refusal past an unfinished directive. [Claude's derivation, O94]

```text
▪ Migration
⚑ The migration stopped part-way: its records step isn't done
> No session works in this project until the migration is done.
> What it finished is kept: 12 of Fumi's 19 topics have their
> records, each checked. A topic it was in the middle of is
> redone from the start.
>
> This session carries the migration on from its records step;
> the start menu follows once the migration is done and
> committed.
```

21.10.12 Left to the builder: the per-topic verifier's pass criterion, and its re-read of what the directive changed. [Claude's sort, B66]

21.10.13 Today's verification addenda and notices stay for code migrations; the reshape retires neither. [R38; Claude's derivation]

21.10.14 Left to the builder: how today's verification addenda and notices sit beside directives (21.10.13). [Claude's sort, B67]

### 21.11 The brownfield docs

21.11.1 A project holding `.baseline/` docs has them moved by the migration into `.roadmap/assets/`, as reference, and the move drops the baseline's status fields. The brownfield assessment itself folds into discovery (§8). [plan 9.1; Claude's, agreed; Claude's derivation, O32; ruled by the person 2026-10-22]

### 21.12 Rehearsal before release

21.12.1 Before release, the migration runs on copies of all 13 projects the migration survey covers (`workflows-reshaped-measure/walks/migration/01-survey.md`), in scratch repositories cut from their remotes: git remotes removed, pushing made impossible and proven to fail before anything runs. The real projects are never touched. [R39, plan 5.6; ruled by the person 2026-10-17]

21.12.2 The migration is adjusted until every project migrates cleanly. [R39, plan 5.6; ruled by the person 2026-10-17]

21.12.3 Variants are built for the cases no project holds: codeintel and galley pre-split copies for the legacy split (codeintel at `ce5323c` and galley at `5d4679e`, each the commit before its first split, migrated from 044 and 039 respectively up to 072); a Fumi variant with a spec started; and a Fumi variant mid-build, simulated through tasks, since the migration never touches code. [R39, R37, plan 5.6; ruled by the person 2026-10-17]

21.12.4 On the pre-split copies, the split's detection finds exactly the sources split for real — codeintel's six, galley's exploration — and the directive is checked against the person's real choices, which git holds. Every other epic in the 13 projects detects nothing. [R37]

21.12.5 Moving files is mechanical and easy to check; the rehearsal's focus is the ledger's completeness and the logs' shape. [R39, plan 5.6; ruled by the person 2026-10-17]

21.12.6 The rehearsal measures how long Fumi's first start takes — the largest derivation, estimated at an hour. [R39]

21.12.7 Every decision is carried with high confidence: the manifest lists every decided item, and the check refuses a topic missing one (21.10.7). Detail is carried less fully, and is what the per-topic verifier hunts. [R39, R38]

21.12.8 Fumi, as it stood when ruled, migrates to: six topics decided; six in progress (five waiting only on mail, commercialization on one open question); three not started, with their mail (build-and-release 17, licensing-and-trial-integrity 10, support-and-diagnostics); four cancelled. It moves forward as one spec and one build: the person holds Fumi in discussion until this release. [R39]

## 21-S. Scenarios for §21

21.S1 Given a project on today's shape with updated skills, when the person next runs `/workflow-start`, then the migration runs, every unit ends in the new layout, and none of the project's code is changed. (21.1.1, 21.1.2, 21.1.4)

21.S2 Given a project on a shape older than today's, when the migration runs, then the existing chain brings it up to today's shape before the reshape's steps run. (21.1.3)

21.S3 Given any migrated project, when the trust log is read, then it holds nothing from the migration. (21.1.5)

21.S4 Given a migration with a directive in the sequence, when the runner reaches it, then the steps run guard, legacy split, move, records, cut and merges, finish, in that order, the records and the cut and merges each handed to the start session as a directive. (21.2.1, 21.6.1, 21.7.1)

21.S5 Given another session live in the project, when the migration starts, then it refuses and does nothing. (21.3.1, 21.3.3, 21.3.4)

21.S6 Given uncommitted changes under `.workflows/`, when the migration starts, then it refuses and does nothing. (21.3.2, 21.3.4)

21.S7 Given a project with no epic carrying 038-seeded research still in progress, when the legacy split step runs, then it is recorded with nothing done and the person sees no interview. (21.4.3)

21.S8 Given the codeintel pre-split copy, when the legacy split step runs, then detection finds exactly the six sources split for real, the interview runs per file for that epic, and code applies the split into topic-sized files and map items. (21.4.1, 21.4.4, 21.4.5, 21.12.4)

21.S9 Given an updated install, when the skills are listed, then the legacy split's skill folder is gone. (21.4.2)

21.S10 Given a topic with a research file and a discussion file, when the move runs, then the topic's log holds the research verbatim under one heading and then the discussion verbatim under another, the repetition kept. (21.5.1, 21.5.2)

21.S11 Given a bugfix unit, when the move runs, then its investigation is its topic's log. (21.5.3)

21.S12 Given a research file feeding one topic and another feeding three, when the move runs, then the first joins its topic's log, and the second goes to the unit's discovery log until the cut-and-merges directive places it. (21.5.4, 21.7.2)

21.S13 Given a topic with messages in both its research box and its discussion box, when the move runs, then its mail sits in its own folder as one sequence, renumbered. (21.5.5)

21.S14 Given a cancelled topic with messages waiting, when the move runs, then those messages land in the inbox. (21.5.6)

21.S15 Given a unit with briefs, an `imports/` folder and roadmap items pointing at its files, and a project with `.roadmap/imports/`, when the move runs, then each brief sits in its topic, `imports/` is `assets/`, `.roadmap/imports/` is `.roadmap/assets/`, and the roadmap items' source paths point at the new places. (21.5.7)

21.S16 Given a manifest carrying map routing, staging, review-cycle and plan-review tracking, scoping state, the Dependencies machinery and build order, when the move runs, then none of them remains; promoted topics, unstarted messages, where a topic came from and a roadmap item's kind remain. (21.5.8, 21.5.9)

21.S17 Given an old `.cache/{unit}`, when the migration runs, then the cache is left as it was. (21.5.10)

21.S18 Given the person says yes at the migration commit gate, when finish runs, then the default branch has a commit dropping `.workflows/` and ignoring it, and the state branch's first commit holds the new layout, checked out where `.workflows/` was; nothing was committed before. (21.5.11, 21.9.1, 21.9.2, 21.9.3, 21.9.4)

21.S19 Given a topic with a review not folded in, when the records directive runs, then the review's content is in the topic's log. (21.5.12)

21.S20 Given a completed unit, when the records directive runs, then each of its topics has a record whose entries are each question's current answer only, one thing per entry, each citing a log section that exists. (21.6.2, 21.6.3, 21.10.7)

21.S21 Given a spec carrying a corrigendum, when the records directive runs, then the corrigendum's decision is an entry on the topic it belongs to, citing the spec section it came from, and the directive's check accepts that source. (21.6.4, 21.10.7)

21.S22 Given a decision whose log does not show who made it, when it becomes an entry, then the entry reads "carried over", never the person's. (21.6.5)

21.S23 Given a log with a measured result and an item still pending, when the records directive runs, then the measurement is a finding saying how it is known, and the pending item is an open question on the topic's map. (21.6.6, 21.6.7)

21.S24 Given entries the records directive marks product-wide, when the migration finishes, then the product record holds them. (21.6.9)

21.S25 Given a point no log settles, when the records directive ends, then it is raised to the person on its own, after the rest of the work, and the person answers it or leaves it open; no per-entry question was asked. (21.6.10, 21.6.11, 21.10.8)

21.S26 Given a cross-cutting unit with a spec, when the cut-and-merges directive runs, then the spec's rules are product-wide entries, the unit leaves the registry, and its spec sits in `.roadmap/assets/` as reference. (21.7.3, 21.7.5, 19.6.7)

21.S27 Given a unit with three unbuilt specs and a plan with tasks in the tracker, when the migration runs, then the specs and plan sit in `assets/`, the tracker tasks are closed through the task verbs, the topics keep their states, and the unit sits in discussion; once every topic is decided, one spec is written fresh through the review and ready to build. (21.8.2, 21.8.3, 21.8.4)

21.S28 Given a unit with two specs, one built and one at 167 of 210 tasks, when the migration runs, then `spec.md` holds both specs verbatim, one part each, in build order; the built plan's phases appear in the cut with name, goal and "built"; the unfinished phases carry scenarios, sections and relies-on; task ids and tracker state are unchanged; and each cut phase names its tracker parent. (21.7.1, 21.8.5, 21.8.6, 21.8.7, 21.8.8)

21.S29 Given a building unit whose manifest credits a task the tracker has open, when the migration runs, then the tracker's state stands and the disagreement is an open note. (21.8.8)

21.S30 Given a building unit with banked findings and approved staging, when the migration runs, then the findings are notes for later and the staging is gone. (21.8.8)

21.S31 Given a building unit with a topic in progress that no spec covers, when the cut-and-merges directive runs, then the person is asked once for the unit where the uncovered topics go, and, where they pick the roadmap, which horizon; after their answers the unit has every topic decided, its specs joined, one build. (21.8.9, 21.8.10, 21.7.4)

21.S32 Given a completed unit with two concluded discussions that never reached a spec, when the migration runs, then its specs are joined and the two remain decided topics in the finished unit. (21.8.11)

21.S33 Given a migration with directives, when the runner meets one, then it stops, the start session carries it out, records it only after its check passes, and the runner continues; a start may meet several. (21.10.2, 21.10.4)

21.S34 Given a directive's file, when it is read, then it names the files the directive may touch and what it asks the person. (21.10.6, 21.10.8)

21.S35 Given a large unit under a directive, when the session carries it out, then each topic goes to its own agent at Opus medium and only the session writes the ledger. (21.10.5)

21.S36 Given a topic missing an entry for a decided map item, when the directive's check runs, then the check fails and the directive is not recorded. (21.10.7, 21.12.7)

21.S37 Given a session that dies mid-directive with two topics finished and one half done, when the next start runs, then boot will not go past the unfinished directive, the two finished topics pass the check, and the half-done topic is redone from the start. (21.10.9, 21.10.10, 21.10.11)

21.S38 Given a project holding `.baseline/` docs, when the migration runs, then the docs sit in `.roadmap/assets/` as reference, and no baseline status field remains. (21.11.1)

21.S39 Given the rehearsal's scratch copies, when the migration is about to run on them, then each copy has no git remote and a push from it has been shown to fail. (21.12.1)

21.S40 Given all 13 rehearsal copies and the variants, when the migration runs, then each migrates cleanly; any that fails sends the migration back for adjustment. (21.12.2, 21.12.3)

21.S41 Given the rehearsal's other epics, when the split's detection runs, then it finds nothing in any of them. (21.12.4)

21.S42 Given the Fumi copy, when it migrates, then the time of its first start is measured, and it ends with six topics decided, six in progress, three not started with their mail, four cancelled, headed for one spec and one build. (21.12.6, 21.12.8)

21.S43 Given a topic with experiment records, when the move runs, then they sit in the layout's home for experiment records. (21.5.13)

21.S44 Given a cancelled unit, when the migration runs, then it sits in the new layout with its status cancelled, and every one of its topics has a record. (21.5.14, 21.6.2)

21.S45 Given a completed quick-fix unit with a scoping spec and a plan, when the move runs, then the spec is its `summary.md` and the plan is gone. (21.5.15)

21.S46 Given a unit with review reports and tracking and analysis files, when the move runs, then no tracking or analysis file remains. (21.5.17)

21.S47 Given a knowledge store holding chunks of files the move relocates or retires, when the migration finishes, then none of those chunks comes back from a query, and the records are indexed. (21.9.1, 22.6.3, 22.6.5, 22.6.12)

21.S48 Given a code migration after the reshape that returns a verification addendum or a notice, when it runs at boot, then the addendum's checks are performed and the notice shown, as today. (21.10.13)

## 22. Setup, environment and the knowledge base

### 22.1 Boot

22.1.1 Boot keeps running the migrations, the knowledge sync, the hooks and
the worktree include. Boot also keeps its two housekeeping passes. The label
repair puts back this session's tmux name and any stranded one. The tidy-up
removes a conversation's folder once Claude Code has deleted its transcript,
never by age. [plan 9.2; Claude's; today's product; Claude's sort, T36]

22.1.2 Boot also adds the state worktree on a fresh clone, locked, and checks
the state worktree and the state branch on every run (§4). [plan 9.2, 10.5, 4.2; Claude's]

22.1.3 Left to the builder: the worktree include's role once `.workflows/` is
a state worktree that code worktrees never hold. [Claude's sort, B77]

22.1.4 The engine keeps today's runtime: Node 18 or newer, Node's built-ins
only, no runtime dependencies and nothing to build at install. Entry ids
(5.2.1) are generated with Node's own crypto. [today's product; Claude's
sort, T39]

### 22.2 Start's setup gates

22.2.1 Start keeps these gates as they are: the Claude Code floor, the
walkthrough offer, session labels, the knowledge gate and the migration
review. [plan 9.2; Claude's]

22.2.2 Start's offer of the brownfield assessment stays, pointing at the
roadmap's "plan the product"; the baseline skill it pointed at goes (§8). [plan 9.1; ruled by the person 2026-10-22]

22.2.3 When the session runs below medium, the recommended minimum effort,
start says so once and carries on (§26 §26).
[R46, plan 2.13; agreed by the person 2026-10-19]

22.2.4 Where the mod could run but is not running, start keeps today's
notice: a plain title and the three causes, then the session carries on with
typed menus. Where the mod cannot run, start says nothing. [today's product;
Claude's sort, T55]

22.2.5 Left to the builder: the Claude Code floor, measured as the oldest
release on which every surface the mod draws runs, the board's pane included.
The start's stop, the mod's own oldest version and the test pinning them move
together, as today. [Claude's sort, T68]

### 22.3 What first use no longer asks

22.3.1 The plan-format gate goes. No phase asks which plan format to use;
today planning and scoping ask it at first use. [plan 9.2; Claude's]

22.3.2 The question asked at each implementation start, of which project
skills to pass to builders and reviewers, goes. Project skills are not
configured: there is no list of them, no mapping of skills to areas of the
code, and no question (§15 §15). [R34, plan 7.7; ruled by the
person 2026-10-20]

22.3.3 Linters are no longer confirmed per topic at each implementation
start. They are asked once per project (22.5.4). [R34, plan 9.2; ruled by
the person 2026-10-20]

22.3.4 The environment setup is no longer asked when implementation first
starts. It is asked once per project, at the first ready to build (22.5.3).
[plan 9.2; Claude's]

### 22.4 The drivers' defaults and their checks

22.4.1 The drivers need no question when their defaults fit. [plan 9.2;
Claude's]

22.4.2 The task driver's default is Tick. [plan 9.2, R35; ruled by the
person 2026-10-17]

22.4.3 The landing driver's default is GitHub's driver when the project's
remote is on GitHub, and the local driver when the project has no remote or
a remote that is not on GitHub. A driver for another code host comes by pull
request against the conformance suite. [plan 9.2; Claude's; Claude's
derivation, O14]

22.4.4 Manage on the start menu changes either driver. [plan 9.2; Claude's]

22.4.5 Both drivers check their needs at ready to build, the last stop
before a build that runs unattended, so a missing tool never stops a build
the person has walked away from. [plan 9.2; Claude's]

22.4.6 GitHub's driver's needs include GitHub's CLI and its stack extension.
[R35; ruled by the person 2026-10-18]

22.4.7 A missing tool stops ready to build with what is missing, never an
install command. [plan 9.2; Claude's]

22.4.8 Screen: the missing-tool stop at ready to build shows what is missing
and no install command. Claude draws the rest in the existing design system,
marked as Claude's, for the person to tick or comment on in the spec. [plan
9.2; Claude's derivation, O94]

Screen, drawn by Claude: the missing-tool stop at ready to build. [Claude's derivation, O94]

```text
⚑ Ready to build stopped: the landing driver is missing a tool
> Mint lands its work through GitHub's driver, which needs
> GitHub's CLI and its stack extension. The CLI is here; the
> stack extension isn't.
>
> Nothing has been built. Ready to build waits until the
> extension is installed, or until the landing driver is changed
> from manage on the start menu.
```

22.4.9 A driver declares the oldest version of its tool it works with. At
ready to build, an older tool stops as a missing one does, naming the version
found, the one needed and where its update instructions live, never an
install command. [today's product; Claude's sort, T38]

### 22.5 The environment setup

22.5.1 The environment setup is per project and holds everything a build
needs:
- how to run the product;
- what cannot run concurrently in the project, such as tests sharing a port
  or a database;
- where the verify setup is, recorded by the task that builds it, and how to
  call its five parts: launch, health check, drive, evidence and cleanup;
- the linters;
- the steps that prepare the environment, such as env files, keys,
  dependencies and a test database: run as written before the build's first
  task, and in each worktree a task runs in for whatever a fresh worktree
  lacks.

[plan 9.2, 7.1, R15; record 3599–3603; Claude's; Claude's derivation, O83,
T8]

22.5.2 Project skills are not part of the environment setup. [plan 9.2, 7.7;
ruled by the person 2026-10-20]

22.5.3 The environment setup is asked once, at the first ready to build, and
never again at a build. [plan 9.2; Claude's]

22.5.4 The linters are found and confirmed at the first ready to build,
recorded in the environment setup, and never asked again at a build. [R34;
ruled by the person 2026-10-20]

22.5.5 The environment setup, the linters included, is changed from manage
on the start menu. [plan 9.2, R34; ruled by the person 2026-10-20]

22.5.6 What cannot run concurrently in a project is recorded in its
environment setup, so no build relearns it. [R15]

22.5.7 Screen: at the first ready to build, the environment setup is asked:
how to run the product, the steps that prepare the environment, what cannot
run concurrently so far, and the linters, shown as found for the person to
confirm. Claude draws it in the existing design system, marked as Claude's,
for the person to tick or comment on in the spec. [plan 9.2, R34; Claude's
derivation, O83, O94, T8]

Screen, drawn by Claude: the environment setup, asked at the first ready to build. [Claude's derivation, O94]

```text
Environment setup — Portal

HOW TO RUN PORTAL
  · Build: go build ./...
  · Tests: go test ./...
  · Run: go run .

TO PREPARE THE ENVIRONMENT, AS FOUND
  · Dependencies: go mod download — before the first task, and in
    each worktree a task runs in

WHAT CAN'T RUN AT ONCE, SO FAR
  · Nothing found yet — a build records it when it learns it

LINTERS, AS FOUND
  · go vet — go vet ./...
  · gofmt — gofmt -l .
  · golangci-lint — golangci-lint run ./...

· · · · · · · · · · · ·
Asked once, at the first ready to build.

◆ Record this setup for Portal?

y/yes   → Record it — change it later from manage
Comment → Tell me what's different
```

22.5.8 Screen: manage on the start menu offers changing the environment
setup and changing either driver. Claude draws its rows and keys in the
existing design system, the same action on the same key as on every menu,
marked as Claude's, for the person to tick or comment on in the spec. [plan
9.2, R34; Claude's derivation, O94]

Screen, drawn by Claude: manage, with its project rows (the same screen as manage in the tracking layer). [Claude's derivation, O94]

```text
· · · · · · · · · · · ·
◆ What would you like to manage?

1         → Killing All Sessions Wipes Restore State — bugfix
2         → Lazy Resume On Attach — feature
3         → Agent First Portal — epic
4         → Split Oversized Go Files — feature, cancelled
s/setup   → Change the environment setup — how to run Portal,
            what can't run at once, the linters
d/drivers → Change the task driver or the landing driver
m/matrix  → See the matrix — how often Claude's calls miss, by
            kind
h/help    → What this menu is for, row by row
b/back    → Back to the start menu
```

22.5.9 The first ready to build asks only what exists then: how to run the
product, the steps that prepare the environment, what cannot run concurrently
so far, and the linters. The verify setup is built by the first phase's
tasks, after it; what cannot run concurrently is recorded whenever a build
learns it. [plan 7.1, 9.2, R15; Claude's derivation, O83, T8]

22.5.10 A quick-fix in a project with no environment setup runs the tests
and linters Claude finds in the repository, asking nothing. The
once-per-project confirmation stays at the first ready to build. [R21, R34,
plan 9.2; Claude's derivation, O84]

22.5.11 The migration carries an existing environment-setup file and the
linters recorded today into the project's environment setup (§21). [plan 9.2; Claude's derivation, O85]

22.5.12 Left to the builder: where the per-project environment setup lives
and in what form. [Claude's sort, B69]

22.5.13 Left to the builder: the verb with which a build records what cannot
run concurrently. [Claude's sort, B70]

### 22.6 The knowledge base

22.6.1 The knowledge base stays, as the first look: the cheap first pointer,
and the reach across work units. [R44, plan 2.11; ruled by the person
2026-10-12]

22.6.2 The knowledge base indexes records, which hold current decisions,
through the one file each is written to: the rendered copy in the gitignored
`.workflows/.knowledge/`, kept for indexing alone (22.6.7). The
entries of a cancelled topic or unit, and of a postponed topic while it
waits, are not current and are not indexed (5.8.17). [R44; ruled by the
person 2026-10-12; Claude's derivation, T4]

22.6.3 The knowledge base never indexes a log. A topic's log, the build's
log, and discovery's and the roadmap's per-session logs are all logs. [R44,
R11, R15; ruled by the person 2026-10-12]

22.6.4 The knowledge base never indexes the ledger: the ledger holds
replaced answers, which search would return as current. [R44, R23; ruled by
the person 2026-10-12]

22.6.5 The knowledge base never indexes the spec. [R14; ruled by the person
2026-10-14]

22.6.6 When a topic's entries change, the engine renders the topic's record
from the ledger and the knowledge base indexes it, so a replaced answer
drops out of search the moment it is replaced. [R44, R23; ruled by the
person 2026-10-17]

22.6.7 The rendered copy lives in the gitignored `.workflows/.knowledge/` and
is rebuilt from the ledger. It is the one rendering of a record that is
kept; a topic's record is otherwise a projection of the ledger, never a
file. [R23, R44, Layout on disk; ruled by the person 2026-10-17]

22.6.8 A bugfix's root cause, findings and fix are ledger entries, which the
knowledge base reaches through the topic's record. [R20]

22.6.9 A quick-fix's short record after the work, saying what changed, why
and what it leaves out, is indexed. [R21; ruled by the person 2026-10-12]

22.6.10 Plain search, when depth matters, runs in a helper agent, the
plain-search helper on the roster (§26 §26), so
its cost stays out of the conversation. [R44, R43; ruled by the person
2026-10-12; Claude's derivation, O1]

22.6.11 The product record's rendered file sits in `.workflows/.knowledge/`
beside the rendered records, for a CLAUDE.md line to point at (§8). [Layout on disk, R10, plan 3.3; Claude's call]

22.6.12 The knowledge base indexes records only: never assets, seeds, inbox
items or the product record's rendered file. An asset is reached through
the entry that links it. [R44; Claude's derivation, O29]

22.6.13 Left to the builder: ranking, decay, the per-topic ordering and the
reopened marker once specs and logs are not indexed, settled by the re-made
eval (25.5). [Claude's sort, B71]

22.6.14 Left to the builder: when the `.workflows/.knowledge/` copies are
rebuilt from the ledger. [Claude's sort, B72]

22.6.15 A failure to render or index a record after its entries change is a
warning, never a refusal of the entry. The entry stands, vectors fill in the
background, and the next start re-renders and re-indexes whatever failed.
[today's product; Claude's sort, T29]

22.6.16 Left to the builder: what a knowledge result carries to cite its
source. A result an answer will rest on is followed up through `ledger`
(5.8.3), never through the rendered copy (22.6.7). [Claude's sort, T63]

22.6.17 Left to the builder: what an opening does when a knowledge query
fails. It says so once and never carries on silently, and plain search
(22.6.10) stands in. [Claude's sort, T64]

## 22-S. Scenarios for §22

22.S1 Given any project, when boot runs, then it runs the migrations, the
knowledge sync, the hooks and the worktree include. (22.1.1)

22.S2 Given a fresh clone whose remote holds the state branch and which has
no state worktree, when boot runs, then the state worktree exists and is
locked. (22.1.2)

22.S3 Given a project with its state worktree, when boot runs, then it
checks the state worktree and the state branch, and does so again on the
next run. (22.1.2)

22.S4 Given a project, when start runs, then the Claude Code floor, the
walkthrough offer, session labels, the knowledge gate and the migration
review behave as they did before the release. (22.2.1)

22.S5 Given a project whose code predates the workflows, when the person
takes start's brownfield offer, then the roadmap's "plan the product" opens,
and no baseline skill is installed. (22.2.2)

22.S6 Given a session running below medium effort, when start runs, then it
says once that the recommended minimum is medium and carries on to the
menu. (22.2.3)

22.S7 Given a project's first build, when its spec reaches ready to build
and the build starts, then no phase asks for a plan format and nothing asks
which project skills to pass. (22.3.1, 22.3.2, 22.5.2)

22.S8 Given a project whose environment setup is recorded, when a later
ready to build passes and its build starts, then neither the linters nor
the environment setup is asked. (22.3.3, 22.3.4, 22.5.3, 22.5.4)

22.S9 Given a project whose remote is on GitHub, when its first ready to
build is reached, then no driver question is asked, the task driver is Tick
and the landing driver is GitHub's. (22.4.1, 22.4.2, 22.4.3)

22.S10 Given a project with no remote, when its first ready to build is
reached, then the landing driver is the local one, unasked. (22.4.1,
22.4.3)

22.S11 Given a project, when the person changes the task driver or the
landing driver from manage on the start menu, then the project's driver
setting holds the new driver. (22.4.4, 22.5.8)

22.S12 Given a project on GitHub's driver with GitHub's CLI or its stack
extension missing, when ready to build is reached, then it stops showing
what is missing and no install command, and the build does not start.
(22.4.5, 22.4.6, 22.4.7, 22.4.8)

22.S13 Given a project with no environment setup, when its first ready to
build is reached, then the environment setup is asked (how to run the
product, the steps that prepare the environment, what cannot run concurrently
so far, and the linters found, for the person to confirm), the verify setup's
location is not asked, and the setup is recorded once for the project and
holds no project skills. (22.5.1, 22.5.2, 22.5.3, 22.5.4, 22.5.7, 22.5.9)

22.S14 Given a recorded environment setup, when the person changes its
linters from manage on the start menu, then the environment setup records
the change. (22.5.5, 22.5.8)

22.S15 Given a project whose environment setup records that its tests share
a database, when a later build runs, then the environment setup still holds
that record for it. (22.5.6)

22.S16 Given a topic whose decision is replaced by a new ledger entry, when
the knowledge base is queried for it, then the result is the re-rendered
record showing the current answer, and the replaced answer is not returned.
(22.6.2, 22.6.6)

22.S17 Given a project holding topic logs, a build log, discovery and
roadmap session logs, the ledger and a spec, when the knowledge base is
queried for words found only in them, then none of them is returned.
(22.6.3, 22.6.4, 22.6.5)

22.S18 Given a topic whose record has been rendered, then its copy is under
the gitignored `.workflows/.knowledge/`, and no record file exists in the
unit's tree. (22.6.7)

22.S19 Given the copies in `.workflows/.knowledge/` are gone, when they are
rebuilt, then each record is rendered from the ledger. (22.6.7)

22.S20 Given two work units with records, when the knowledge base is queried
from a session in one, then records of the other are among the results.
(22.6.1)

22.S21 Given a finished bugfix, when the knowledge base is queried for its
root cause, then the bugfix topic's record is returned. (22.6.8)

22.S22 Given a closed quick-fix, when the knowledge base is queried for what
it changed, then its short record is returned. (22.6.9)

22.S23 Given a need the knowledge base does not answer in depth, when Claude
searches plainly, then the search runs in a helper agent and only its
result enters the conversation. (22.6.10)

22.S24 Given a product-wide entry that changes, then the product record's
rendered file in `.workflows/.knowledge/` shows the change. (22.6.11, 8.9.4)

22.S25 Given a project whose remote is not on GitHub, when its first ready
to build is reached, then the landing driver is the local one, unasked.
(22.4.1, 22.4.3)

22.S26 Given a project's first build, when the task that builds the verify
setup lands, then the environment setup records the verify setup's
location. (22.5.1, 22.5.9)

22.S27 Given a build that learns two of the project's tests cannot run at
once, then the environment setup records it, and a later build does not
relearn it. (22.5.6, 22.5.9)

22.S28 Given a project with no environment setup whose work is a quick-fix,
when the quick-fix runs, then it runs the tests and linters Claude finds in
the repository and asks nothing; and the project's first ready to build
still asks the person to confirm the environment setup. (22.5.10)

22.S29 Given a project with an environment-setup file and linters recorded
before the release, when it migrates, then they are its environment setup,
and its next ready to build asks for neither. (22.5.11)

22.S30 Given a project holding assets, seeds, inbox items and the product
record's rendered file, when the knowledge base is queried, then no result
comes from any of them, and an asset is reached through the entry that
links it. (22.6.12)

22.S31 Given a tmux session name a crashed session left changed, when boot
runs, then the name is put back; given a conversation folder whose transcript
Claude Code has deleted, boot removes the folder, and a folder whose
transcript remains stays, however old. (22.1.1)

22.S32 Given the engine as installed, then it runs on Node 18 with Node's
built-ins only and nothing built at install, and its entry ids come from
Node's own crypto. (22.1.4)

22.S33 Given a session where the mod could run but is not running, when start
runs, then it shows today's notice — a plain title and the three causes — and
carries on with typed menus; given the mod cannot run there, start says
nothing of it. (22.2.4)

22.S34 Given a driver whose tool is older than the version it declares, when
ready to build runs, then it stops, naming the version found, the one needed
and where its update instructions live, with no install command. (22.4.9)

22.S35 Given an environment setup with a step that installs dependencies,
when a task runs in a fresh worktree, then the step has run there before the
task; at the first ready to build the steps are shown as found for the person
to confirm. (22.5.1, 22.5.7, 22.5.9)

22.S36 Given a topic's entries change and the indexing of its record fails,
then the entry stands, a warning shows, and the next start re-indexes the
record. (22.6.15)

## 23. Help, the glossary and the user docs

### 23.1 Help

23.1.1 Help is rewritten in the release, after the phases. [plan 9.3;
Claude's]

23.1.2 The walkthrough's samples keep rendering through the real
projections, from new fixtures: the discussion phase's map, the new start
and epic menus, and the build's progress. [plan 9.3; Claude's]

23.1.3 No help screen, walkthrough fixture, help content file or glossary
entry names the tracker or the code host's CLI: each is named only in its
driver, the user docs and design notes. [R35; ruled by the person 2026-10-17
and 2026-10-18; Claude's derivation, O92]

23.1.4 Help, the glossary and the user docs call the product "the
workflows" until the person settles its name (§28 Open). [Open, The
product's name; Claude's derivation, O90]

23.1.5 Left to the builder: which other walkthrough screens keep a rendered
sample, the roadmap's among them. Any that does renders through the real
projection from a new fixture (23.1.2). [Claude's sort, T70]

### 23.2 Help on every menu

23.2.1 Every menu screen has h help. Help is always one press away, rather
than something the person has to know they can ask for. [R17, plan 3.11;
the person's addition 2026-10-16]

23.2.2 Screen: a menu's help shows a few lines on what the screen is for and
what each row does (what discovery, the roadmap or triage is, where the
screen needs it), then an invitation to ask about anything else. [R17; the
person's addition 2026-10-16]

23.2.3 Screen: the start menu's help opens the same, with the full
walkthrough reached from it. Claude draws the rest of it, the help home and
what becomes of today's reference cards, in the existing design system,
marked as Claude's, for the person to tick or comment on in the spec. [R17;
the person's addition 2026-10-16; Claude's derivation, O94]

Screen, drawn by Claude: the start menu's help, the help home. [Claude's derivation, O94]

```text
■ Help

The start menu is where every piece of work begins and resumes.
  · A number continues that piece of work: a feature, bugfix or
    quick-fix goes straight to where it stands, an epic opens its
    menu; the ones with something waiting on you come first.
  · Start begins something new: describe it, and the kind of work
    is settled as we talk.
  · Triage works through the inbox, the things you noted down to
    come back to: work on them now, put them on the roadmap, or
    archive them.
  · The roadmap holds what you've shaped but not yet committed to
    build, by horizon.
  · Verdicts appears while a call you changed waits for your word
    on what Claude's answer would have cost.
  · View lists completed and cancelled work.
  · Manage reopens, pivots, absorbs, cancels or brings back a
    piece of work, and changes the project's setup, its drivers
    and the matrix.
Ask about anything else, or walk through the whole thing.

· · · · · · · · · · · ·
◆ What would you like to do?

w/walk   → Walk through how the workflows work
t/topics → Read about one area in more depth
b/back   → Back to the start menu
Ask      → Ask anything about how the workflows work
```

Screen, drawn by Claude: the reference cards, reached from the help home. [Claude's derivation, O94]

```text
■ Help · Topics

· · · · · · · · · · · ·
◆ Which area?

1      → The kinds of work
2      → The phases
3      → Epics: the map and the menu
4      → The roadmap
5      → Gates, auto and step
6      → The knowledge base
7      → The inbox and triage
8      → Reshaping work
9      → Working in parallel
b/back → Back to help
Ask    → Ask anything about how the workflows work
```

23.2.4 Each menu's help is an engine content file beside the screen's
projection, so a menu and its help change together. [plan 9.3; Claude's]

### 23.3 The glossary

23.3.1 The glossary drops its terms tied to retired things: research and
discussion as separate phases, scoping, planning, cross-cutting, build
order, dead end, and document. [plan 9.3; Claude's]

23.3.2 The glossary gains these terms, written in the engineer's terms R45
asks for: discussion as the merged phase; record; log; ledger; entry; map;
product record; phase cut; builder; task loop; reviewer pair; notes for
later; stack; the ask rule; kind; verdict; blind question; auto and step;
proven and not proven; verify setup; feature map; driver; state branch.
[plan 9.3, R45; Claude's]

23.3.3 "Review" names three things today: the review phase, a phase's
review in the build, and a document's closing review. Each gets its own
term: the review phase, the phase review and the closing pass. [plan 9.3;
Claude's; Claude's derivation, O87]

23.3.4 The glossary says that the inbox is where items live and triage is
the act, and that messages between topics are mail: "triage waiting"
becomes "mail waiting". [R17; ruled by the person 2026-10-16]

23.3.5 Any session answers a question about how the workflows work from the
glossary, in the words the person meets on screen, never in engine verbs,
paths or skill names. It says where the glossary stops and points at the user
docs, never invents an answer, and puts back the gate the question set aside.
[today's product; Claude's sort, T54]

### 23.4 The user docs

23.4.1 The user docs are rewritten in the release from the shipped skills,
last, since the skills are the source of truth. [plan 9.4; Claude's]

23.4.2 The book's chapters are: an introduction; how it fits together; work
types; discovery; discussion, replacing today's research and discussion;
experiments; investigation; specification; the build (tasks, reviews, pull
requests, the drivers); review; trust, new (the ledger, the ask rule,
verdicts, the matrix); verification, new; state and git, new (the state
branch, pushing, a second machine); tracking; the knowledge base; the engine;
reliability; configuration; lifecycle; agents; contributing, with an index.
Today's collaboration chapter folds into trust, whose cone (16.7) is its
subject. [plan 9.4, record 3599–3603; Claude's; Claude's derivation, T24]

23.4.3 history.md gains the reshape. [plan 9.4; Claude's]

23.4.4 planning.md goes, and the tracker moves to the configuration and
build chapters. [plan 9.4; Claude's]

23.4.5 The docs are one of the three places a driver's tool may be named,
beside its driver and design notes. [plan 9.4, R35; Claude's]

23.4.6 The person's internal products are never named in the docs, only
described. [plan 9.4; Claude's]

23.4.7 The docs state the main session's recommended minimum effort: medium,
Opus 5.5's own default. [R46; agreed by the person 2026-10-19]

23.4.8 The README, whose pipeline table shows retired phases, is rewritten
with the book. [plan 9.4; Claude's derivation, O88]

## 23-S. Scenarios for §23

23.S1 Given the release, when the walkthrough is opened, then its samples of
the discussion phase's map, the start and epic menus and the build's
progress are rendered from new fixtures through the real projections.
(23.1.1, 23.1.2)

23.S2 Given a change to the start menu's projection, when the walkthrough's
start-menu sample renders, then it shows the change. (23.1.2)

23.S3 Given the shipped skills and engine content, when they are searched
for the tracker's name or the code host's CLI, then no help screen,
walkthrough fixture, help content file or glossary entry contains either.
(23.1.3)

23.S4 Given any menu screen, when the person presses h, then a few lines on
what the screen is for and what each row does show, followed by an
invitation to ask about anything else. (23.2.1, 23.2.2)

23.S5 Given the triage menu, when the person presses h, then its help says
what triage is. (23.2.2)

23.S6 Given the start menu, when the person presses h, then the same kind of
help opens, and the full walkthrough is reached from it. (23.2.3)

23.S7 Given the engine's content, then every menu's projection has its help
content file beside it, and a change to a menu that changes its rows lands
with its help file's change. (23.2.4)

23.S8 Given the shipped glossary, then it has no entries for research and
discussion as separate phases, scoping, planning, cross-cutting, build
order, dead end or document, and has an entry for each term 23.3.2 lists.
(23.3.1, 23.3.2)

23.S9 Given the shipped glossary, then the review phase, a phase's review in
the build and a document's closing review each have a term of their own: the
review phase, the phase review and the closing pass. (23.3.3)

23.S10 Given the shipped glossary, then its entries say triage is the act on
the inbox and messages between topics are mail. (23.3.4)

23.S11 Given the shipped docs, then they hold the chapters 23.4.2 lists,
history.md covers the reshape, no planning.md exists, and the tracker is
covered in the configuration and build chapters. (23.4.1, 23.4.2, 23.4.3,
23.4.4)

23.S12 Given the shipped docs, then the tracker and the code host's CLI may
be named in them, and none of the person's internal products is named.
(23.1.3, 23.4.5, 23.4.6)

23.S13 Given the shipped docs, then they state that the recommended minimum
effort for the main session is medium. (23.4.7)

23.S14 Given the shipped README, then it was rewritten with the book, and its
pipeline table shows no retired phase. (23.4.8)

23.S15 Given the shipped help, glossary and user docs, while the person has
not settled the product's name, then they call the product "the workflows".
(23.1.4)

23.S16 Given a gate on screen, when the person asks how the workflows work,
then the answer comes from the glossary in the words the screens use, with no
engine verb, path or skill name; it says where the glossary stops and points
at the user docs, and the gate is put back. (23.3.5)

23.S17 Given the user docs, when their chapters are listed, then an
introduction, how it fits together and an index are among them, and no
collaboration chapter stands apart from trust. (23.4.2)

## 24. Handoffs and compaction recovery

### 24.1 What hands off

24.1.1 The handoff mechanism stays. The engine names the move; where the mod
runs, the mod clears the conversation and sends the continuation; without
the mod, the skill is invoked inline. [plan 9.6; Claude's]

24.1.2 The table of moves follows the new phases. The new gates add four
moves to it, a bugfix's investigation one, and an experiment's spawn one:
- start this work, into the first topic: for a feature, its discussion; for a
  bugfix, its investigation; for an epic, the conversation goes on to shape
  the topics, and approve the map makes this move;
- decided, into the next topic or the spec;
- ready to build, into the build;
- finish, back to the menus;
- a bugfix's investigation, once concluded, into the spec, as a feature's
  decided does; the conclude stays a process gate (19.4.19);
- an experiment's spawn, from the topic's conversation into the laboratory,
  which never runs inside the conversation that spawned it. The choice of now
  or later is a process gate, and later is reached from the epic menu's
  experiments-waiting row or a feature's Continue.

[plan 9.6; Claude's; R11, R20, record 872–874, 1946; Claude's derivation,
O22, O89, T14]

24.1.3 Nothing hands off inside a build, a quick-fix or a topic (an
experiment's spawn leaves the topic: 24.1.2). [plan 9.6; Claude's; Claude's
derivation, T14]

24.1.4 One orchestrator runs a build across all its phases, with no handoff
at a phase boundary. A handoff at every phase boundary is rejected: it
guarantees a lossy reset, then spends tokens regaining the state the
session already had. [R15, plan 9.6; ruled by the person 2026-10-12]

24.1.5 A quick-fix is one session, from "what's the change?" to closed, with
no handoffs. [R21, plan 9.6; ruled by the person 2026-10-12]

24.1.6 The build runs straight into the review phase, in an epic too:
implementation's conclude gate and the return to the epic menu between them
go, and the table holds no move between them (§14 §14).
[R16, plan 9.6; ruled by the person 2026-10-14]

24.1.7 Moves into work from a menu, and `/workflow-start {unit} {topic}`,
still hand off as today. [plan 9.6; Claude's derivation, O89]

### 24.2 Recovery after a compaction, a crash or a new session

24.2.1 After a compaction, a crash or a new session alike, the engine's note
names the topic's record and log, so the conversation carries on where it
was. [plan 9.6; Claude's]

24.2.2 The note names the skill and each document to re-read: in the
discussion phase, the record and the log; in the build, the build's log and
where the phase stands. [R35, R15, plan 9.6; ruled by the person 2026-10-12]

24.2.3 Resuming a topic reads its record and its log, after any question
whose answer may discard them. [R43, plan 9.6; ruled by the person
2026-10-19]

24.2.4 The position the workflows record holds every task in flight with its
builder's id, not one task, so after a compaction a fix round still goes
back to the same builder. [plan 9.6; Claude's]

24.2.5 The build's log is read after a compaction and when a build resumes,
beside the ledger (§12 §12). [R15; ruled by the person 2026-10-12]

24.2.6 The twelve skills' own sections on resuming after a refresh go: the
note carries the recovery whole. [plan 9.6; Claude's]

24.2.7 Left to the builder: what delivers the recovery note after a crash, a
new session, or a compaction where the mod does not run; the note reaches the
session wherever the workflows run (24.2.1). [Claude's sort, B74, T61]

24.2.8 In discovery, once the work-type commit has run, the recovery note
names the active discovery log and the unit's map; at the product level, the
roadmap's session log. Before the commit nothing is on disk, and shaping
carries on from the conversation. [today's product; Claude's sort, T42]

## 24-S. Scenarios for §24

24.S1 Given a feature's discovery where the person gives "start this work",
when the move is made where the mod runs, then the engine names the move,
and the mod clears the conversation and sends the continuation into the
first topic. (24.1.1, 24.1.2)

24.S2 Given the same move where the mod does not run, then the first topic's
skill is invoked inline. (24.1.1)

24.S3 Given an epic topic the person declares decided, when other topics
remain, then the move goes into the next topic; when it was the last topic,
then the move goes into the spec. (24.1.2)

24.S4 Given a spec whose ready to build the person passes, then the move
goes into the build. (24.1.2)

24.S5 Given a finish the person passes, then the move goes back to the
menus. (24.1.2)

24.S6 Given a build whose first phase closes, when its next phase starts,
then no handoff happens and the same orchestrator carries on. (24.1.3,
24.1.4)

24.S7 Given a build that closes its last phase, then it runs straight into
the review phase with no handoff and no stop at the epic menu. (24.1.6)

24.S8 Given a quick-fix, from its opener to its close, then no handoff
happens. (24.1.3, 24.1.5)

24.S9 Given a topic in discussion that spawns no experiment, from its opening
until the person declares it decided, then no handoff happens. (24.1.3)

24.S10 Given a discussion session that compacts, then the engine's note
names the skill, the topic's record and its log, and the conversation
carries on where it was. (24.2.1, 24.2.2)

24.S11 Given a topic whose session crashed, when a new session opens the
topic, then the note names its record and log, and they are read after any
question whose answer may discard them. (24.2.1, 24.2.3)

24.S12 Given a build that compacts with three tasks in flight, when a fix
round is due on one of them, then it goes back to that task's builder.
(24.2.4)

24.S13 Given a build that compacts, then the note names the build's log and
where the phase stands, and the build's log is read beside the ledger.
(24.2.2, 24.2.5)

24.S14 Given the shipped skills, then none carries a section of its own on
resuming after a refresh. (24.2.6)

24.S15 Given an epic's discovery where the person gives "start this work",
then no handoff happens: the conversation goes on to shape the topics, and
when the person approves the map, the move goes into the first topic.
(24.1.2)

24.S16 Given a menu where the person picks a unit or a topic to work on, or
`/workflow-start {unit} {topic}` run, then the move into that work hands off
as today. (24.1.7)

24.S17 Given a bugfix's discovery, when the person says yes at start this
work, then the work hands off into its investigation; when the investigation
concludes, the work hands off into the spec. (24.1.2, 8.8.13, 19.4.19)

24.S18 Given a topic's conversation that spawns an experiment, when the
person picks now, then the laboratory opens in a clean conversation once the
spawning conversation's work is on disk; when they pick later, it is reached
from the epic menu's experiments-waiting row, or a feature's Continue.
(24.1.2, 24.1.3)

24.S19 Given a discovery session past the work-type commit, when the context
compacts, then the recovery note names the active discovery log and the
unit's map; given a session before the commit, shaping carries on from the
conversation. (24.2.8)

## 25. Prose tests and the test suites

### 25.1 The harness

25.1.1 The prose-test harness stays, adapted. [plan 9.5; Claude's]

25.1.2 Worlds gain the state branch as a worktree, and code worktrees for
the build. [plan 9.5; Claude's]

25.1.3 Worlds use the local landing driver, since they have no remote.
[plan 9.5, R35; ruled by the person 2026-10-18]

25.1.4 Invariants gain the ledger: the events a walk appended, their kinds
and links, and the append-only check passing. [plan 9.5; Claude's]

25.1.5 Screen: the harness's run summary shows the walks' invariant
failures by contract, and each phase's context before its first question
against its budget (§17 §17). [plan 8.1, R36, R43]

25.1.6 Left to the builder: which task driver the prose-test worlds use.
[Claude's sort, B75]

### 25.2 The corpus

25.2.1 The corpus is rebuilt, not ported: today's cases assert today's
steps. [plan 9.5; Claude's]

25.2.2 Every phase's rewrite lands with its cases. [plan 9.5, 11.3;
Claude's]

25.2.3 Each door and each checklist item is asserted by at least one case.
[plan 9.5; Claude's]

25.2.4 The mainlines are rebuilt for epic, feature, bugfix, quick-fix and
roadmap. The cross-cutting mainline goes. [plan 9.5; Claude's]

25.2.5 Among the rebuilt cases: the task writer meets a gap partway through
a phase's tasks, and only the tasks the gap touches change. The case guards
against the whole-phase rewrite that today's prose prescribes. [R4, plan
2.4, R15; agreed by the person 2026-10-20]

### 25.3 Walks on the product's models

25.3.1 Walks run on the product's models. The walker's model and effort are
set per run. [plan 9.5, R4; Claude's]

25.3.2 The release's walks run each agent's prose at the effort its
definition fixes, and the main session's prose at the walker's effort set
per run; no release condition requires the main session's prose walked at
medium. The prose is walked again on each model the workflows adopt. [plan
9.5, 2.4, R4; agreed 2026-10-19; Claude's derivation, O3]

25.3.3 Every walk records the context spent before its first question.
[plan 9.5, R43; ruled by the person 2026-10-12]

25.3.4 The budget a walk's context is held against counts only what the
workflows load before the first question, never Claude Code's own share or
the person's MCP servers; Claude sets each phase's figure once the rebuilt
phase is first walked (§2 §2). [R43, plan 8.2; Claude's
derivation, O5]

25.3.5 Left to the builder: the prose-test orchestrator's and asserter's
models. [Claude's sort, B76]

### 25.4 The pipeline simulation

25.4.1 The pipeline simulation is rebuilt for the new verbs and phases, as
CLAUDE.md requires of any change to the workflows. [plan 9.5; Claude's]

### 25.5 The knowledge eval

25.5.1 The knowledge eval is re-made by migrating its three frozen projects
and re-judging its queries against the rendered records. [plan 9.5, R44;
Claude's]

25.5.2 The old baseline stays as the comparison: the knowledge base ranked
replaced answers inside long documents, and the records should end that.
[plan 9.5, R29; Claude's]

25.5.3 The eval gains a third arm: one to three quick plain searches, judged
blind beside the other two arms, which are R29's: the knowledge base's own
query, and an Opus agent searching with grep and reads. The third arm's
result, the comparison R29 left unmeasured, is evidence on whether the index
earns its place, and is brought to the person if the index loses. [R44,
plan 9.5; Claude's call 2026-10-19; Claude's derivation, O86]

25.5.4 Left to the builder: re-pinning the keyword gate's baseline once the
eval is re-made. [Claude's sort, B73]

## 25-S. Scenarios for §25

25.S1 Given a case's world materialised, then it holds the state branch as a
worktree, code worktrees for a build, and the local landing driver.
(25.1.1, 25.1.2, 25.1.3)

25.S2 Given a walk that appends ledger events, when its invariants run, then
they check the events appended, their kinds and links, and that the
append-only check passes. (25.1.4)

25.S3 Given a walk whose invariant for a contract fails, when the run ends,
then the run summary lists the failure under that contract. (25.1.5)

25.S4 Given a walk of a phase, when the walk reaches its first question,
then the context spent so far is recorded, and the run summary shows it
against the phase's budget. (25.1.5, 25.3.3)

25.S5 Given the rebuilt corpus, then every door and every checklist item is
asserted by at least one case. (25.2.1, 25.2.3)

25.S6 Given the change that rewrites a phase, then the same change carries
that phase's cases. (25.2.2)

25.S7 Given the rebuilt corpus, then mainlines exist for epic, feature,
bugfix, quick-fix and roadmap, and none for cross-cutting. (25.2.4)

25.S8 Given a build phase whose task writer meets a gap partway through its
tasks, when the gap is decided, then only the tasks the gap touches change,
and the phase's tasks are not rewritten. (25.2.5)

25.S9 Given a walk, when it is run, then its walker's model and effort are
the ones set for that run; and the release's walks run each agent's prose
at the effort its definition fixes, none of them required to walk the main
session's prose at medium. (25.3.1, 25.3.2)

25.S10 Given the rebuilt pipeline simulation, when `npm test` runs, then its
scenarios drive the new verbs and phases and pass. (25.4.1)

25.S11 Given the re-made knowledge eval, when it runs, then its queries are
judged against the rendered records of the three migrated projects, its
results stand beside the old baseline, and a third arm of one to three quick
plain searches is judged blind beside the knowledge base's own query and an
Opus agent searching with grep and reads. (25.5.1, 25.5.2, 25.5.3)

25.S12 Given the re-made eval's result in which the index loses, then it is
brought to the person as evidence on whether the index earns its place.
(25.5.3)

25.S13 Given a rebuilt phase walked for the first time, then Claude sets the
phase's budget from it, and the run summary of a later walk shows that
walk's context before its first question against the budget, counting only
what the workflows loaded. (25.1.5, 25.3.4)

## 26. Agents, models and effort

### 26.1 Agents write what the workflows prescribe

26.1.1 Every prescribed artifact is written by a named agent: the spec (assembled from the ledger), the phase cut, the tasks, reviews, deep dives, gap analysis and experiment write-ups. Each such agent is on the roster (26.5.1); at a topic's close, the closing-pass reader carries the gap analysis. [R46; agreed by the person 2026-10-19; plan 2.13; Claude's derivation, O1]

26.1.2 Each such agent's model and effort are fixed in its own definition. [R46; agreed by the person 2026-10-19; plan 2.13]

26.1.3 Each such agent's one job is its artifact, with its rules and references boxed inside it. [R46]

26.1.4 An agent's decisions come back to the orchestrator and take the trust matrix's route (§16). [R46; plan 2.13]

26.1.5 An agent works from the record, not the conversation, which also tests that the record holds everything (§11). [R46, R14]

26.1.6 The agents keep the main session's context small, and they are what the measurements test. [R46]

### 26.2 The main session

26.2.1 The conversation stays in the main session, at the person's effort: discussion conversations, research included, the calls the matrix routes, and the build's orchestration. [R46; agreed by the person 2026-10-19; plan 2.13]

26.2.2 The main session's effort is recommended, never set. The recommended minimum is medium, Opus 5.5's own default, and the docs state it (§23). [R46; plan 2.13]

26.2.3 `workflow-start` reads the session's effort level and, if it runs below medium, says so once, then carries on. [R46; plan 2.13]

26.2.4 Screen: `workflow-start`'s effort notice — shown once when the session's effort runs below the recommended minimum, medium, saying so; nothing is answered and `workflow-start` carries on. [R46; plan 2.13]

26.2.5 The workflows do not put a top-level `effortLevel` in the project's `.claude/settings.json`: it would outrank the person's own saved level in every session there, and the file is committed, so it would override everyone's choice. [R46; plan 2.13]

26.2.6 No skill holds a conversation's effort: a skill's `effort:` holds only for the turn it is invoked in, whether by slash command or by Claude, and the next message runs at the session's level again. [R46, measured 2026-10-19; plan 2.13]

26.2.7 An agent definition's effort holds whatever the session runs at. [R46, measured 2026-10-19]

26.2.8 Following the workflows' prose at medium has no dedicated test, and no release condition requires the main session's prose walked at medium: the person moves to medium at release, perhaps sooner, runs it live, and the recommendation moves on what that shows. The design bet is that the engine deciding what comes next, and refusing a wrong move, makes the main session's adherence matter less. [R46; ruled by the person 2026-10-20; plan 2.13; Claude's derivation, O3]

26.2.9 Left to the builder: how `workflow-start` reads the session's effort, and the notice's wording; the "once" of 26.2.3 is once per `workflow-start` run. [Claude's sort, B2]

### 26.3 Models

26.3.1 Builders and reviewers run Opus. [record: Reviews in the build, ruled by the person 2026-10-15; R28; plan 3.7]

26.3.2 The labeller runs Sonnet. It is a raw call the engine makes itself, never a subagent (§16). [plan 3.7, plan 4.8; R28; Claude's, 2026-10-19]

26.3.3 Every other job runs Opus until a measurement says otherwise. [plan 3.7; R28; Claude's, 2026-10-19]

26.3.4 Reviews run on no other model: no Sonnet reviewer, and no outside model such as DeepSeek. [record: Reviews in the build, No other reviewer model; ruled by the person 2026-10-15]

### 26.4 Effort

26.4.1 Every agent that writes a prescribed artifact runs Opus at medium until a measurement says otherwise. [R46; agreed by the person 2026-10-19; plan 2.13]

26.4.2 Everything runs at medium: there are no higher-effort builder, reviewer or task-writer agents for Claude to reach for by a slice's complexity. The task writer's effort is fixed in its definition, never chosen by the orchestrator and never raised by a phase's size or difficulty (§12). [record: Reviews in the build, Everything at medium; ruled by the person 2026-10-19; R15; plan 3.7]

26.4.3 Builders run Opus at medium, and reviewers run Opus at medium, never high and never max (§13). [record: Reviews in the build; ruled by the person 2026-10-15; plan 3.7]

26.4.4 The medium defaults rest on measurement — every job measured so far (builders and reviewers on Switchboard's replay, the task writer on Mint, decisions on the Fumi replay) performs as well at medium, and what fails in decisions is knowing when to ask, not depth of reasoning — and they are tested again with data later. [R46, measured 2026-10-19; plan 2.13, plan 3.7]

26.4.5 No agent runs at extra-high without a use case. A gap checker at every phase was considered and dropped, so there is none. [R46; ruled by the person 2026-10-20; plan 2.13]

26.4.6 No extra-high reviewer runs at prescribed points (the end, or each phase's end) in the release. It is parked until data says it adds something, and if it ever comes in it is always prescribed, never Claude's pick (§27). [record: Reviews in the build, Everything at medium; parked by the person 2026-10-19; plan 3.7, plan 12.7]

26.4.7 Investigation's root-cause validation runs at extra-high, inferred from the measurements so far rather than measured: it reasons through code to a conclusion, the one kind of work where extra-high measurably gained; it runs once per bug; and a wrong root cause is the costliest miss a bugfix makes, because the fix, its test and the spec are all built on it (§19). [R46, R20; ruled by the person 2026-10-20; plan 2.13]

26.4.8 The root-cause validator's level is fixed in its definition, never Claude's pick. [R46; plan 2.13]

26.4.9 Claude acts on what the root-cause validation finds and drops what does not hold up. [R46, R20]

26.4.10 Fix validation stays at medium: it checks a fix against a cause already settled. [R46]

26.4.11 Left to the builder: the labeller's effort, as the measured raw form ran it (`trust/label_raw.py`). [Claude's sort, B1]

### 26.5 The roster

26.5.1 The workflows' agents shrink with the loops, from 34 to about 20:
- the builder;
- the reviewer, one agent run as a pair at all three reviews, with a template for each (§13; 6.5);
- the consolidation agent, today's, which reads a phase's notes for later (§13);
- the review phase's test-surface agent (§14);
- the task writer;
- the deep dive;
- discussion's perspective and review agents (§9);
- synthesis;
- the closing-pass reader, which also carries the gap analysis at a topic's close;
- the spec reviewer;
- investigation's two validators, root cause and fix (§19);
- the product researcher (§8);
- the migration's verifier (§21);
- an agent that assembles the spec from the ledger;
- an agent that writes the phase cut;
- an agent that runs the sweep before the spec;
- an agent that writes experiment write-ups;
- the plain-search helper (§22).

The names of the five added last are the builder's. [plan 6.5; Claude's; R20, R46; Claude's derivation, O1]

26.5.2 The analysis agents, the planning agents and the review phase's finding agents go. [plan 6.5; Claude's]

26.5.3 Every agent on the roster fixes its model and effort in its own definition: Opus at medium, except investigation's root-cause validation at extra-high (26.4.7). [R46; Claude's derivation, O2]

## 26-S. Scenarios for §26

26.S1 Given the workflows' agent definitions, when each agent that writes a prescribed artifact is read, then its definition fixes its model and effort, Opus at medium. (26.1.1, 26.1.2, 26.4.1)

26.S2 Given a main session running at extra-high, when the orchestrator dispatches the task writer, then the task writer runs at the medium its definition fixes. (26.1.2, 26.2.7, 26.4.2)

26.S3 Given an agent writing its artifact, when it makes a decision, then the decision comes back to the orchestrator and takes the trust matrix's route. (26.1.4)

26.S4 Given a session whose effort is below medium, when `workflow-start` runs, then it says once that the session runs below the recommended minimum, medium, and carries on without a gate. (26.2.2, 26.2.3, 26.2.4)

26.S5 Given a session at medium or above, when `workflow-start` runs, then no effort notice shows. (26.2.3)

26.S6 Given a project after the release is installed, when its `.claude/settings.json` is read, then the workflows have written no top-level `effortLevel` there. (26.2.5)

26.S7 Given a build, when its builders, reviewers and task writer are dispatched, then each runs Opus at medium, and no higher-effort variant exists for Claude to pick by a slice's complexity or a phase's size. (26.3.1, 26.4.1, 26.4.2, 26.4.3)

26.S8 Given a review in the build, when it runs, then no Sonnet reviewer and no outside model takes part. (26.3.4)

26.S9 Given the trust layer labelling a kind, when the labeller runs, then it runs on Sonnet as a raw call the engine makes. (26.3.2)

26.S10 Given a bugfix's investigation, when its validations run, then the root-cause validation runs at extra-high from its definition and fix validation at medium, and Claude acts on what the root-cause validation finds and drops what does not hold up. (26.4.7, 26.4.8, 26.4.9, 26.4.10)

26.S11 Given a build reaching a phase's end or its end, when the reviews run, then no extra-high reviewer runs. (26.4.6)

26.S12 Given any phase, when it runs, then no gap-checker agent runs at the phase. (26.4.5)

26.S13 Given the release's agent definitions, when they are listed, then the roster holds the builder, the reviewer, the consolidation agent, the test-surface agent, the task writer, the deep dive, discussion's perspective and review agents, synthesis, the closing-pass reader, the spec reviewer, investigation's two validators, the product researcher, the migration's verifier, and agents for the spec's assembly, the phase cut, the sweep before the spec, experiment write-ups and plain search, and no analysis, planning or review-phase finding agent exists. (26.1.1, 26.5.1, 26.5.2)

26.S14 Given any agent on the roster, when its definition is read, then it fixes its model and effort: Opus at medium, except investigation's root-cause validation at extra-high. (26.5.3)

26.S15 Given a topic reaching its close, when the closing pass runs, then the closing-pass reader carries the gap analysis. (26.1.1, 26.5.1)

## 27. Out of the release

### 27.1 Fast follows

27.1.1 What is not integral to the release comes as a fast follow straight
after it, never as a partial product. [plan 1.3; the person, 2026-10-19]

27.1.2 The person's review marks feed the trust matrix after the release: what
they approve and what they change at the spec, read against the calls behind
those lines (11.11.10). [ruled by the person 2026-10-22; as a fast follow,
Claude's proposal]

### 27.2 Not built in this release

27.2.1 Importing an existing user's transcripts is not built in this
release. A user of today's workflows starts with an empty trust log, as
everyone does. The import is added only if the first weeks of asking prove
heavy. [plan 11.6, R25; ruled by the person 2026-10-18]

27.2.2 Splitting a kind of question along the labeller's twelve stored
answers is not built in this release. It is parked by the person, to come
back to: whether and how it is built is not decided. Every label still stores
all twelve answers in the release (§16 §16). [plan 12.2, 4.5, R25;
parked by the person 2026-10-19]

27.2.3 Uninstalling and reinstalling is not built in this release. It is
parked by the person for a proper conversation, nothing about it is
decided, and it is raised with the person when the work reaches install.
[plan 12.3, Open; parked by the person 2026-10-13]

27.2.4 The conversation on uninstalling and reinstalling starts from what
was raised, none of it decided:
- removing the workflows with agntc leaves the hooks and the rest of what
  the migrations put in place;
- the workflows need a way to uninstall: remove the hooks, then either tell
  the user how to remove the skills or run agntc's remove itself;
- removing the skills is agntc's job, and agntc is being changed so the
  workflows can call its remove, which is why this waits;
- install runs through migrations at boot, on a new or an existing project;
- removal keeps `.workflows/`, the work and the migrations ledger with it,
  so a later reinstall would find the ledger and not rerun the migrations
  that put the hooks in place; deleting `.workflows/` takes the ledger, and
  everything reinstalls;
- a better install process may be worth a look, or migrations may be fine.

[Open, Uninstalling and reinstalling; raised by the person 2026-10-13]

27.2.5 The mailbox fallback is not built in this release: a fresh subagent
that loads the target topic, writes the message's item in the target's
terms, takes the person's answer and lands it. It comes in only if the
one-command open of a topic still feels clunky. A forked agent is rejected
for it, since it carries the sender's lens. [plan 12.4, R13; ruled by the
person 2026-10-16]

27.2.6 A folder for product conversations is not built in this release; one
is added only if it is ever wanted. [plan 12.5, R22]

27.2.7 A questions page as a workflows surface is not built in this release:
a batch of questions worked through at the person's own pace, commented on
and submitted, round after round to zero. It is the person's idea, parked
for discussion. [plan 12.6, Where things stand; parked 2026-10-19]

27.2.8 An extra-high reviewer at prescribed points, such as the end or each
phase's end, is not built in this release. It is parked by the person until
data says it adds something. If it ever comes in, it is prescribed, never
Claude's pick. [plan 12.7, 3.7, Reviews in the build; parked by the person
2026-10-19]

27.2.9 The workflows board is not out of the release. Plan 12 listed the
rest of it, and it moved into the release: its This session tab follows the
session into every phase, so every phase's view ships with the panel, each
spiked first (§20 §20). [plan 12.1, Open, The workflows
board; agreed by the person 2026-10-21]

27.2.10 A view of the calls made — the same calls a task's page lists,
grouped by kind across a unit and then the project — as a way into the trust
matrix is not built in this release. It is the person's idea, parked on
2026-10-21 to come back to with the board's unit and project tabs. [the
person 2026-10-21]

## 27-S. Scenarios for §27

27.S1 Given a user of today's workflows upgrading to the release, then their
trust log starts empty and no transcript import is offered. (27.2.1)

27.S2 Given a labelled question, then its label stores all twelve answers,
and no kind is split along them. (27.2.2)

27.S3 Given the release, then no uninstall verb or uninstall flow exists.
(27.2.3)

27.S4 Given a message sent to another topic, then the send's report ends with
the command that opens the target topic, and no subagent answers the message
in the target's terms. (27.2.5, 10.3.3)

27.S5 Given the release's layout on disk, then it holds no folder for
product conversations. (27.2.6)

27.S6 Given the release, then no questions-page surface exists. (27.2.7)

27.S7 Given any review in the build, then both reviewers run at Opus medium
and no extra-high reviewer runs. (27.2.8, 26.4.3)

27.S8 Given a session in any phase with the board open, then its This
session tab shows that phase's view. (27.2.9)

27.S9 Given the release with the board open, then no tab shows the calls made
grouped by kind across a unit or the project; a task's page still lists the
calls that task made. (27.2.10)

## 28. Open

### 28.1 The product's name

28.1.1 The product's name is undecided. It was explored with the person on
2026-10-20, and every option with the person's reaction is recorded in
`design/name-exploration.md`. Nothing is off the table, and the product may
stay "the workflows". [Open, The product's name; Where things stand]

28.1.2 How deep the rename goes is decided with the name. The product, the
repository, the docs and help are cheap to rename; the `workflow-*` skill
names and the `.workflows/` folder are a migration. [Open, The product's
name]

### 28.2 Per-phase task writing in the task driver

28.2.1 How the task driver carries per-phase task writing, open in the
record, is settled by plan 10.7: the tracker holds only the phases whose
tasks are written, and the views draw the rest from the phase cut, which
lives at the end of `spec.md` (§7 §7).
[Open, R35, Layout on disk, plan 10.7; Claude's derivation, O91]

### 28.3 Uninstalling and reinstalling

28.3.1 Uninstalling and reinstalling is undecided and parked (27.2.3,
27.2.4). [Open; parked by the person 2026-10-13]

## 28-S. Scenarios for §28

28.S1 Given a build whose later phases' tasks are not yet written, when the
tracker is read, then it holds only the written phases, and the views draw
the rest from the phase cut at the end of `spec.md`. (28.2.1)

§28.1 and §28.3 state only what is undecided, and have no scenarios.

## 29. The phase cut

### 29.1 Where the work lands

29.1.1 The reshape is built on one long-lived branch cut from `main`. [plan 11.1; Claude's proposal]

29.1.2 Each step lands on the reshape branch as a stack, reviewed as usual. [plan 11.1; Claude's proposal]

29.1.3 The design record and the plan stay on PR #1480 until the end. [plan 11.1; Claude's proposal]

29.1.4 `main` takes fixes only while the reshape is built, and each fix is merged into the reshape branch as it lands. [plan 11.1; Claude's proposal]

29.1.5 A new migration on `main` moves the shape the reshape migrates from, so the reshape's migration is rebased onto it. [plan 11.1; Claude's proposal]

29.1.6 The reshape branch merges into `main` once every condition of 1.4 holds, and the person releases (29.20). [plan 11.1; Claude's proposal]

29.1.7 The build runs in four steps, its phases in the order numbered here: step 1, the foundations (29.2 to 29.8); step 2, the restructure with verification alongside (29.9 to 29.18); step 3, the ask rule (29.19); step 4, rehearsal and the release (29.20). What comes later is 29.21. [plan 11.2–11.6; Claude's proposal]

29.1.8 Each phase lists the sections it draws on, the earlier phases it relies on and the scenarios that prove it. Whoever writes a phase's tasks reads the sections it draws on in full, and reads further wherever they meet a seam. [R14; plan 3.5]

29.1.9 A phase lands with the tests of the scenarios it lists, passing. [R14, R33; plan 11.2, 11.3]

29.1.10 Every scenario of §1 to §28 is proven by exactly one phase: the phase that builds what it observes. A scenario observing what two phases build is proven by the later of the two, where both exist. [R14; Claude's derivation]

### 29.2 State on its own branch

29.2.1 Step 1 is the foundations: engine and mod only, with no skill prose. Each of its seven parts (29.2 to 29.8) lands with its tests. [plan 11.2; Claude's proposal]

29.2.2 The engine's phase tables carry the merged phase's name, discussion, from this first step. [plan 11.2; R9, ruled 2026-10-20]

29.2.3 This part puts the state on its own branch: the state worktree, the lock, commit and push, and the second clone's merge (§4). [plan 11.2; Claude's proposal]

29.2.4 It carries section 10's defaults for the state: finding the state, git inside the state worktree, the branch's name, a bare repository with worktrees, a fresh clone, and manifests in a second clone's merge (4.2, 4.5 to 4.9). [plan 11.2, plan 10.1–10.6; Claude's proposal]

29.2.5 Boot adds the state worktree on a fresh clone, locked, and checks the state worktree and the state branch on every run (22.1.2). [plan 9.2, plan 10.5, plan 4.2; Claude's proposal]

29.2.6 The weight check is made against the assembled spec before this first phase starts, and each cut it finds is brought to the person (1.6). [plan 1.6; Claude's derivation]

29.2.7 Draws on: §1.6, §4.1 to §4.9, §22.1. [R14; Claude's derivation]

29.2.8 Relies on: none. [R14; Claude's derivation]

29.2.9 Proven by: 1.S10, 1.S14, 4.S1, 4.S3, 4.S4, 4.S5, 4.S6, 4.S8, 4.S9, 4.S10, 4.S11, 4.S12, 4.S13, 4.S15, 4.S17, 4.S18, 4.S19, 4.S29, 4.S30, 22.S2, 22.S3 (21). [R14; Claude's derivation]

### 29.3 The ledger

29.3.1 Step 1's second part builds the ledger: the events and their schemas, ids, the append-only check, the write hook, and the projections — the record, the map, the product record, "since you last looked", the entries a replacement affects, and the verdict queue (§5). [plan 11.2; Claude's proposal]

29.3.2 It builds the one-thing-per-entry check, judged by a separate Claude call as an entry is written (5.5, 16.19). [plan 11.2, plan 4.8; Claude's proposal]

29.3.3 The `ledger` verbs are its door (6.1.4). [plan 6.1; Claude's proposal]

29.3.4 When a topic's entries change, the engine renders the topic's record into `.workflows/.knowledge/` and the knowledge base indexes it, and the product record is rendered beside it (5.8.12, 5.8.13, §22.6). [R23, R44]

29.3.5 Draws on: §5, §2.9, §2.13, §4.1, §4.7, §4.11, §8.9, §16.19, §22.6. [R14; Claude's derivation]

29.3.6 Relies on: 29.2. [R14; Claude's derivation]

29.3.7 Proven by: 2.S11, 4.S14, 4.S16, 4.S24, 4.S25, 5.S1, 5.S2, 5.S3, 5.S4, 5.S5, 5.S6, 5.S7, 5.S8, 5.S9, 5.S10, 5.S12, 5.S13, 5.S14, 5.S15, 5.S16, 5.S17, 5.S18, 5.S19, 5.S20, 5.S21, 5.S22, 5.S24, 5.S25, 5.S28, 5.S29, 5.S31, 5.S32, 8.S26, 22.S16, 22.S18, 22.S19, 22.S20, 22.S24, 22.S36 (39). [R14; Claude's derivation]

### 29.4 The trust log and logging

29.4.1 Step 1's third part builds the trust log, in the user-level workflows config directory, and logs into it the raises, the calls, the departures, the gate answers from the mod, and the position switches (§16.13). [plan 11.2, plan 4.5; Claude's proposal]

29.4.2 The `gate` verb takes the person's answer at any gate, logs it under the gate's name with the mod running or not, and returns what happens next (§6.6). [plan 6.1, plan 6.6; Claude's proposal]

29.4.3 Draws on: §16.12, §16.13, §6.6, §3.2, §3.3, §4.11. [R14; Claude's derivation]

29.4.4 Relies on: 29.3. [R14; Claude's derivation]

29.4.5 Proven by: 3.S6, 6.S18 (2). [R14; Claude's derivation]

### 29.5 The decision point

29.5.1 Step 1's fourth part builds the decision point: the `raise` verb and its three answers, ask, proceed and ask blind (§16.2, 6.1.5). [plan 11.2; Claude's proposal]

29.5.2 Until the ask rule is built (29.19), the decision point asks every call Claude has a lean on, so the phases can be built and walked against it. [plan 11.2; Claude's proposal]

29.5.3 A raise is drawn by an engine command, and one command records its answer, "I don't follow" included, in the ledger and the trust log (16.9, 16.13). [plan 4.4, plan 6.1; Claude's proposal]

29.5.4 Draws on: §16.1, §16.2, §16.3, §16.9, §16.12, §16.13, §5.1, §5.3, §6.1. [R14; Claude's derivation]

29.5.5 Relies on: 29.3, 29.4. [R14; Claude's derivation]

29.5.6 Proven by: 16.S30, 16.S41, 16.S44 (3). [R14; Claude's derivation]

### 29.6 The drivers

29.6.1 Step 1's fifth part builds the task verbs, the Tick driver and their conformance suite (7.1, 7.3). [plan 11.2, plan 6.7; Claude's proposal]

29.6.2 It builds the landing verbs, GitHub's driver and the local driver, and their conformance suite (7.2, 7.3). [plan 11.2, plan 6.7; Claude's proposal]

29.6.3 It carries section 10's defaults for the tracker: a phase not yet written, and the tracker's state on the state branch (7.4, 7.5). The plan lists section 10's defaults under the state (plan 11.2); these two need the tracker's driver, which this part builds. [plan 10.7, plan 10.8, plan 11.2; Claude's derivation]

29.6.4 Draws on: §7, §4.1. [R14; Claude's derivation]

29.6.5 Relies on: 29.2. [R14; Claude's derivation]

29.6.6 Proven by: 4.S2, 7.S4, 7.S5, 7.S11, 7.S15, 7.S17, 7.S19 (7). [R14; Claude's derivation]

### 29.7 Briefs

29.7.1 Step 1's sixth part builds the brief templates, the fill verb, `brief`, and the dispatch hook (§6.5). [plan 11.2; Claude's proposal]

29.7.2 Draws on: §6.5, §13.11, §13.9. [R14; Claude's derivation]

29.7.3 Relies on: 29.3, 29.6. [R14; Claude's derivation]

29.7.4 Proven by: 6.S15, 6.S16, 6.S17, 13.S20 (4). [R14; Claude's derivation]

### 29.8 The doors

29.8.1 Step 1's seventh part builds the layout hook, the commit door's task check, and the checklists (6.2, 6.3, 6.4). [plan 11.2; Claude's proposal]

29.8.2 It builds the remaining door verbs of section 6 (6.1). [plan 11.2; Claude's proposal]

29.8.3 Draws on: §6, §2.2, §2.3, §4.4, §4.9, §4.11, §27.2, §21.9. [R14; Claude's derivation]

29.8.4 Relies on: 29.2 to 29.7. [R14; Claude's derivation]

29.8.5 Proven by: 2.S1, 2.S2, 4.S7, 4.S20, 6.S4, 6.S5, 6.S6, 6.S7, 6.S8, 6.S9, 6.S11, 6.S13, 6.S14, 6.S21, 6.S22, 6.S24, 6.S25, 6.S26, 6.S27, 6.S28, 6.S29, 6.S30, 27.S3 (23). [R14; Claude's derivation]

### 29.9 The model check

29.9.1 Step 2 is the restructure, with verification alongside: prose and engine surfaces, phase by phase (29.9 to 29.18). Each phase lands with its prose-test cases, its walks and its share of the pipeline simulation. [plan 11.3; Claude's proposal]

29.9.2 The model check is Claude's, promised 2026-10-12: a one-time table of every part of the plan with its layer and what changes when the next model lands. [plan 11.3; Claude's proposal]

29.9.3 Anything whose answer is an engine or structure change is moved, or brought to the person. [plan 11.3; Claude's proposal]

29.9.4 Draws on: §1 to §28, each read for its layer; §2.4. [R14; Claude's derivation]

29.9.5 Relies on: none. [R14; Claude's derivation]

29.9.6 Proven by: no scenario of its own; what it moves is proven by the phases that build it. [R14; Claude's derivation]

### 29.10 CONVENTIONS.md

29.10.1 CONVENTIONS.md is rewritten for the new shape: what a phase skill holds — its goal, its done-condition, its guidance, the verbs it names, and its checklist. [plan 11.3; Claude's proposal]

29.10.2 The sort of every rule into contract, required procedure or how-to (2.2) is then done skill by skill, as each skill is rewritten in the phases after this one. [plan 11.3; R2]

29.10.3 Draws on: §2.1, §2.2, §2.3, §2.10, §6.1, §6.4. [R14; Claude's derivation]

29.10.4 Relies on: 29.8. [R14; Claude's derivation]

29.10.5 Proven by: no scenario of its own; the skills it shapes are proven by the phases that rewrite them, 29.11 to 29.18. [plan 11.3; R14; Claude's derivation]

### 29.11 Discussion

29.11.1 Discussion is rewritten first, with the record-and-log split, as the record's Sequence step 4 orders (§9). [plan 11.3; record: Sequence step 4]

29.11.2 Its migration steps land with it: the move and the records directive, with the directive machinery the records directive runs under (21.5, 21.6, 21.10). [plan 11.3; Claude's proposal]

29.11.3 The mailboxes between topics come with it (§10). [plan 3.4]

29.11.4 As the first phase rewritten and walked, it brings the prose-test harness's adaptation: worlds holding the state branch as a worktree, invariants over the ledger, and each walk's context before its first question recorded against the phase's budget (25.1, 25.3, 2.10). [plan 9.5, plan 11.3; Claude's derivation]

29.11.5 Draws on: §9, §10, §2.2, §2.4, §2.5, §2.10, §2.12, §3.1, §3.2, §5.6, §5.9, §6.1, §6.4, §6.6, §8.9, §16.2, §16.3, §16.9, §16.10, §16.11, §17.1, §17.2, §21.5, §21.6, §21.7, §21.10, §21.12, §22.6, §24.1, §24.2, §25.1, §25.3, §26.1, §26.5, §27.2, §16.12, §16.4, §16.7. [R14; Claude's derivation]

29.11.6 Relies on: 29.2 to 29.8, 29.10. [R14; Claude's derivation]

29.11.7 Proven by: 2.S5, 2.S12, 2.S13, 2.S14, 2.S15, 2.S16, 2.S17, 3.S2, 5.S11, 5.S26, 6.S1, 6.S2, 6.S12, 6.S20, 8.S25, 9.S1, 9.S2, 9.S3, 9.S4, 9.S5, 9.S6, 9.S7, 9.S8, 9.S9, 9.S10, 9.S11, 9.S12, 9.S13, 9.S14, 9.S15, 9.S16, 9.S17, 9.S18, 9.S19, 9.S22, 9.S25, 9.S26, 9.S27, 9.S28, 9.S29, 9.S30, 9.S31, 9.S32, 9.S33, 9.S34, 9.S35, 9.S36, 9.S37, 9.S38, 9.S40, 9.S41, 9.S42, 9.S43, 9.S44, 9.S46, 9.S48, 9.S49, 9.S50, 9.S51, 9.S52, 9.S53, 9.S55, 9.S56, 9.S58, 9.S59, 9.S60, 9.S61, 9.S62, 9.S63, 9.S64, 9.S65, 10.S1, 10.S2, 10.S3, 10.S4, 10.S6, 10.S7, 10.S8, 10.S9, 10.S10, 10.S12, 16.S4, 16.S6, 16.S7, 16.S8, 16.S9, 16.S10, 16.S31, 16.S32, 16.S33, 16.S34, 16.S69, 17.S5, 21.S10, 21.S11, 21.S12, 21.S13, 21.S14, 21.S15, 21.S16, 21.S17, 21.S19, 21.S20, 21.S21, 21.S22, 21.S23, 21.S25, 21.S34, 21.S35, 21.S36, 21.S37, 21.S43, 21.S44, 21.S45, 21.S46, 22.S23, 24.S9, 24.S10, 24.S11, 24.S18, 25.S2, 25.S3, 25.S4, 25.S9, 25.S13, 26.S3, 27.S4 (127). [R14; Claude's derivation]

### 29.12 Discovery

29.12.1 Discovery is rewritten as one phase at whatever level the conversation reaches (§8). [plan 11.3; R10]

29.12.2 The baseline is folded in: the roadmap's "plan the product" opens with the baseline's research when the code predates the workflows, and the baseline skill goes (8.12). [plan 11.3, plan 9.1; ruled by the person 2026-10-22]

29.12.3 Draws on: §8, §4.11, §9.3, §9.7, §9.10, §10.1, §16.7, §16.13, §24.1, §26.1, §26.5, §27.2, §24.2. [R14; Claude's derivation]

29.12.4 Relies on: 29.2 to 29.8, 29.11. [R14; Claude's derivation]

29.12.5 Proven by: 4.S26, 8.S1, 8.S2, 8.S3, 8.S4, 8.S5, 8.S6, 8.S7, 8.S10, 8.S13, 8.S14, 8.S15, 8.S16, 8.S17, 8.S19, 8.S21, 8.S23, 8.S24, 8.S27, 8.S28, 8.S29, 8.S31, 8.S32, 8.S35, 8.S36, 8.S37, 8.S40, 8.S42, 8.S44, 8.S45, 8.S46, 8.S47, 8.S48, 8.S49, 8.S52, 8.S53, 8.S54, 8.S55, 8.S56, 8.S57, 8.S58, 8.S59, 8.S60, 9.S39, 10.S11, 24.S1, 24.S2, 24.S15, 24.S19, 26.S15, 27.S5 (51). [R14; Claude's derivation]

### 29.13 Specification and the phase cut

29.13.1 The specification is rewritten: one spec per work unit, written once every topic is decided, cancelled or postponed, in sections by area assembled from the records, ending with the phase cut (§11, §18.5). [plan 11.3, plan 3.5; Claude's proposal]

29.13.2 Ready to build is its gate, once per spec, showing the short outline and the phase cut and offering the build's position (11.8, 3.3). [plan 3.5]

29.13.3 The sweep across every record before the spec is written comes with it (8.10.3, 8.10.4, 8.10.8, 8.10.9). [plan 3.3]

29.13.4 Draws on: §11, §18.5, §3.3, §8.8, §8.10, §24.1, §26.5. [R14; Claude's derivation]

29.13.5 Relies on: 29.2 to 29.8, 29.11, 29.12. [R14; Claude's derivation]

29.13.6 Proven by: 3.S18, 8.S33, 8.S43, 8.S50, 11.S1, 11.S2, 11.S3, 11.S4, 11.S5, 11.S7, 11.S8, 11.S9, 11.S11, 11.S12, 11.S13, 11.S15, 11.S16, 11.S18, 11.S20, 11.S21, 11.S22, 11.S23, 11.S24, 11.S25, 11.S26, 11.S27, 18.S21, 24.S3 (28). [R14; Claude's derivation]

29.13.7 The person's review of the spec, offered at ready to build, comes with it (11.11). [ruled by the person 2026-10-22]

### 29.14 The build and the review phase

29.14.1 The build and the review phase are rewritten together, with verification inside them (§12 to §15). [plan 11.3; Claude's proposal]

29.14.2 The live panel comes with them, with every phase's view, built to the design locked in its spike before the specification (§20). [plan 11.3; Claude's proposal]

29.14.3 The task accounts come with them (12.14). [plan 11.3, plan 3.6; Claude's proposal]

29.14.4 Draws on: §12, §13, §14, §15, §20, §26, §2.2, §2.4, §2.6, §3.1, §3.2, §3.3, §4.10, §4.11, §5.8, §6.4, §7.1, §7.2, §7.4, §9.5, §11.3, §11.5, §11.10, §16.10, §16.17, §17.1, §17.2, §22.6, §24.1, §24.2, §25.1, §25.2, §27.2, §28.2, §19.5, §21.10. [R14; Claude's derivation]

29.14.5 Relies on: 29.2 to 29.8, 29.11 to 29.13. [R14; Claude's derivation]

29.14.6 Proven by: 2.S3, 2.S4, 2.S6, 2.S8, 2.S9, 3.S3, 3.S10, 3.S12, 3.S16, 3.S17, 3.S19, 4.S21, 4.S22, 4.S28, 5.S30, 6.S23, 7.S3, 7.S7, 7.S8, 7.S9, 7.S10, 7.S12, 7.S13, 9.S57, 11.S6, 11.S17, 12.S1, 12.S2, 12.S3, 12.S4, 12.S5, 12.S6, 12.S7, 12.S8, 12.S9, 12.S10, 12.S11, 12.S12, 12.S13, 12.S14, 12.S15, 12.S16, 12.S17, 12.S19, 12.S20, 12.S21, 12.S22, 12.S23, 12.S24, 12.S25, 12.S26, 12.S27, 12.S28, 12.S29, 12.S30, 12.S32, 12.S33, 12.S34, 12.S35, 12.S36, 12.S37, 12.S38, 12.S39, 12.S40, 12.S41, 12.S42, 12.S43, 12.S44, 12.S45, 12.S46, 12.S47, 12.S49, 12.S50, 12.S51, 13.S1, 13.S2, 13.S3, 13.S4, 13.S5, 13.S6, 13.S7, 13.S8, 13.S9, 13.S10, 13.S11, 13.S12, 13.S13, 13.S14, 13.S16, 13.S17, 13.S19, 14.S1, 14.S2, 14.S3, 14.S4, 14.S5, 14.S6, 14.S7, 14.S8, 14.S9, 14.S10, 14.S12, 14.S13, 15.S1, 15.S2, 15.S4, 15.S5, 15.S6, 15.S7, 15.S9, 15.S10, 15.S11, 15.S12, 15.S13, 15.S15, 15.S17, 15.S18, 15.S21, 15.S22, 16.S35, 16.S61, 17.S2, 17.S3, 20.S1, 20.S2, 20.S3, 20.S4, 20.S5, 20.S6, 20.S7, 20.S8, 20.S10, 20.S11, 20.S12, 20.S13, 20.S14, 20.S15, 20.S16, 20.S21, 22.S17, 24.S4, 24.S6, 24.S7, 24.S12, 24.S13, 25.S1, 25.S8, 26.S2, 26.S7, 26.S8, 26.S11, 26.S12, 27.S6, 27.S7 (154). [R14; Claude's derivation]

### 29.15 The work types

29.15.1 The work types are rebuilt: feature, bugfix and quick-fix (19.3 to 19.5). [plan 11.3; Claude's proposal]

29.15.2 Cross-cutting goes as a type (19.6). [plan 11.3; Claude's proposal]

29.15.3 Draws on: §19, §1.5, §3.1, §3.2, §4.11, §6.1, §6.3, §8.5, §8.8, §9.7, §11.1, §11.8, §15.5, §16.10, §17.1, §17.3, §18.3, §20.12, §20.14, §22.6, §24.1, §26.4, §27.2. [R14; Claude's derivation]

29.15.4 Relies on: 29.2 to 29.8, 29.11 to 29.14. [R14; Claude's derivation]

29.15.5 Proven by: 1.S9, 3.S1, 3.S5, 4.S23, 6.S10, 8.S9, 8.S18, 9.S23, 11.S14, 11.S19, 15.S8, 15.S20, 16.S36, 17.S4, 17.S6, 19.S1, 19.S5, 19.S6, 19.S7, 19.S8, 19.S9, 19.S10, 19.S11, 19.S12, 19.S13, 19.S14, 19.S15, 19.S16, 19.S18, 19.S20, 19.S21, 19.S22, 19.S23, 19.S24, 19.S26, 19.S28, 19.S29, 19.S30, 19.S31, 19.S32, 19.S33, 19.S34, 19.S35, 19.S36, 19.S37, 20.S18, 20.S19, 20.S20, 20.S23, 22.S21, 22.S22, 24.S8, 24.S17, 26.S10, 27.S8 (55). [R14; Claude's derivation]

### 29.16 The tracking layer

29.16.1 The tracking layer is rebuilt: the start menu, the epic menu, the inbox, triage and the roadmap (§18). [plan 11.3; Claude's proposal]

29.16.2 Help reaches every menu, each menu's help an engine content file beside the menu's projection (23.2). [plan 11.3, plan 9.3; Claude's proposal]

29.16.3 Draws on: §18, §23.2, §1.4, §5.8, §7.4, §8.1, §8.5, §8.6, §8.8, §8.10, §8.12, §9.2, §9.5, §10.1, §10.4, §12.13, §12.15, §19.1, §19.3, §19.5, §19.6, §22.6, §24.1, §25.2, §6.1, §14.6, §19.2, §20.3, §20.8, §20.11, §20.13, §20.14, §28.2, §9.7, §27.2, §10.2. [R14; Claude's derivation]

29.16.4 Relies on: 29.2 to 29.8, 29.11 to 29.15. [R14; Claude's derivation]

29.16.5 Proven by: 1.S8, 5.S23, 6.S3, 7.S16, 8.S8, 8.S11, 8.S12, 8.S20, 8.S30, 8.S34, 8.S39, 8.S41, 9.S20, 9.S54, 10.S5, 10.S13, 12.S31, 12.S48, 14.S11, 18.S1, 18.S2, 18.S3, 18.S4, 18.S5, 18.S6, 18.S7, 18.S8, 18.S9, 18.S10, 18.S11, 18.S12, 18.S13, 18.S14, 18.S15, 18.S16, 18.S18, 18.S19, 18.S20, 18.S22, 18.S23, 18.S24, 18.S25, 18.S26, 18.S27, 18.S28, 18.S29, 18.S30, 18.S31, 18.S32, 18.S33, 18.S34, 18.S35, 18.S36, 18.S37, 18.S38, 18.S39, 18.S42, 18.S43, 18.S44, 18.S45, 18.S46, 18.S47, 18.S48, 18.S49, 18.S50, 18.S51, 18.S52, 18.S53, 18.S54, 18.S55, 18.S56, 18.S57, 18.S58, 18.S59, 18.S60, 18.S61, 18.S62, 18.S63, 18.S64, 18.S65, 18.S66, 19.S2, 19.S3, 19.S4, 19.S19, 19.S25, 19.S27, 20.S9, 20.S17, 20.S22, 20.S24, 22.S30, 23.S4, 23.S5, 23.S7, 24.S5, 24.S16, 25.S7, 27.S9, 28.S1 (100). [R14; Claude's derivation]

### 29.17 The rest of the migration

29.17.1 The rest of the migration is built: the guard, the legacy split, the cut and the merges, and the finish, which with the move and the records directive (29.11) make the one sequence (§21). [plan 11.3, plan 5.2; Claude's proposal]

29.17.2 The knowledge eval is re-made by migrating its three frozen projects, once the whole sequence can migrate them (25.5). [plan 9.5; Claude's derivation]

29.17.3 Draws on: §21, §2.8, §7.1, §8.12, §13.11, §19.6, §25.5, §26.1, §26.4, §26.5, §27.2, §22.6. [R14; Claude's derivation]

29.17.4 Relies on: 29.2 to 29.8, 29.11 to 29.16. [R14; Claude's derivation]

29.17.5 Proven by: 2.S10, 7.S6, 8.S51, 13.S15, 21.S1, 21.S2, 21.S3, 21.S4, 21.S5, 21.S6, 21.S7, 21.S8, 21.S9, 21.S18, 21.S24, 21.S26, 21.S27, 21.S28, 21.S29, 21.S30, 21.S31, 21.S32, 21.S33, 21.S38, 21.S47, 21.S48, 25.S11, 25.S12, 26.S1, 26.S13, 26.S14, 27.S1 (32). [R14; Claude's derivation]

### 29.18 Setup, help, the glossary, the brief-quality measurement and the docs

29.18.1 Setup is rebuilt: boot, start's setup gates, the drivers' defaults and their checks, and the per-project environment setup (22.1 to 22.5), apart from boot's state checks and setup's state-branch steps (22.1.2; 4.4.6, 4.4.7, 4.9.2), built with the state (29.2). [plan 11.3, plan 9.2; Claude's proposal]

29.18.2 Help and the glossary are rewritten (23.1, 23.3). [plan 11.3, plan 9.3; Claude's proposal]

29.18.3 The brief-quality measurement runs, with the habit hook and the task-size test alongside it on the same slices (13.12, 15.7, 17.4). [plan 11.3, plan 8.4; Claude's proposal]

29.18.4 Then the user docs are rewritten (23.4), and the CLAUDE.md map. [plan 11.3, plan 9.4; Claude's proposal]

29.18.5 Draws on: §22.1 to §22.5, §23, §13.12, §15.7, §17.4, §2.7, §7.1, §7.2, §12.7, §15.2, §15.9, §18.9, §24.2, §25.2, §25.4, §26.2, §28.1, §2.4, §8.12. [R14; Claude's derivation]

29.18.6 Relies on: 29.2 to 29.8, 29.12 to 29.17. [R14; Claude's derivation]

29.18.7 Proven by: 2.S7, 7.S1, 7.S2, 7.S14, 7.S18, 8.S38, 8.S61, 12.S18, 13.S18, 15.S3, 15.S14, 15.S16, 17.S7, 18.S40, 22.S1, 22.S4, 22.S5, 22.S6, 22.S7, 22.S8, 22.S9, 22.S10, 22.S11, 22.S12, 22.S13, 22.S14, 22.S15, 22.S25, 22.S26, 22.S27, 22.S28, 22.S29, 22.S31, 22.S32, 22.S33, 22.S34, 22.S35, 23.S1, 23.S2, 23.S3, 23.S6, 23.S8, 23.S9, 23.S10, 23.S11, 23.S12, 23.S13, 23.S14, 23.S15, 23.S16, 23.S17, 24.S14, 25.S5, 25.S6, 25.S10, 26.S4, 26.S5, 26.S6 (58). [R14; Claude's derivation]

### 29.19 The ask rule

29.19.1 Step 3 builds the ask rule: the arithmetic, the labeller as a raw call (16.19), the verdict page, blind questions, convergence, the matrix screen, replay tuning, and the record of the person with its care entries (§16). [plan 11.4; Claude's proposal]

29.19.2 From here the decision point asks by the rule, no longer every call Claude has a lean on (29.5.2). [plan 11.2, plan 11.4; Claude's proposal]

29.19.3 The rule ships calibrated to ask what is asked today, and loosens only as evidence supports (1.3.4). [plan 1.3]

29.19.4 Draws on: §16, §17.1 to §17.3, §1.3, §2.11, §3.2, §3.3, §4.11, §5.1, §6.6, §8.8, §9.6, §9.8, §11.7, §15.12, §18.4, §19.4, §26.3, §27.2, §5.3, §9.7, §18.10, §5.5, §12.9, §12.15. [R14; Claude's derivation]

29.19.5 Relies on: 29.3 to 29.5, 29.8, 29.11 to 29.18. [R14; Claude's derivation]

29.19.6 Proven by: 1.S2, 1.S3, 3.S4, 3.S7, 3.S8, 3.S9, 3.S11, 3.S13, 3.S14, 3.S15, 4.S27, 5.S27, 6.S19, 8.S22, 9.S21, 9.S24, 9.S45, 9.S47, 11.S10, 15.S19, 16.S1, 16.S2, 16.S3, 16.S5, 16.S11, 16.S12, 16.S13, 16.S14, 16.S15, 16.S16, 16.S17, 16.S18, 16.S19, 16.S20, 16.S21, 16.S22, 16.S23, 16.S24, 16.S25, 16.S26, 16.S27, 16.S28, 16.S29, 16.S37, 16.S38, 16.S39, 16.S40, 16.S42, 16.S43, 16.S45, 16.S46, 16.S47, 16.S48, 16.S49, 16.S50, 16.S51, 16.S52, 16.S53, 16.S54, 16.S55, 16.S56, 16.S57, 16.S58, 16.S59, 16.S60, 16.S62, 16.S63, 16.S64, 16.S65, 16.S66, 16.S67, 16.S68, 16.S70, 16.S71, 16.S72, 17.S1, 17.S8, 18.S17, 18.S41, 19.S17, 26.S9, 27.S2 (82). [R14; Claude's derivation]

### 29.20 Rehearsal and the release

29.20.1 Step 4 runs the rehearsal on copies of all 13 projects and their variants, adjusting the migration until every copy migrates cleanly (21.12). [plan 11.5; R39]

29.20.2 Then the test project's run (1.4.6), the merge into `main`, and the person's release (1.7.6). [plan 11.5; Claude's proposal; ruled by the person 2026-10-22]

29.20.3 Draws on: §1.2 to §1.4, §1.7, §21.12, §26.2. [R14; Claude's derivation]

29.20.4 Relies on: 29.2 to 29.19. [R14; Claude's derivation]

29.20.5 Proven by: 1.S1, 1.S4, 1.S5, 1.S6, 1.S7, 1.S11, 1.S12, 1.S13, 1.S15, 21.S39, 21.S40, 21.S41, 21.S42 (13). [R14; Claude's derivation]

### 29.21 Later

29.21.1 Importing an existing user's transcripts comes later, only if the first weeks of asking prove heavy. It is not in the release (27.2.1). [plan 11.6; R25]

## 29-S. Scenarios for §29

29.S1 Given the cut, when the release is built, then its phases are built in the order 29.2 to 29.20, and no phase starts before the phases it relies on are built. (29.1.7, 29.1.8)

29.S2 Given the scenarios of §1 to §28, when the cut's lists are read, then each scenario appears under exactly one phase, and the 722 listed are the 722 in §1 to §28. (29.1.10)

29.S3 Given a scenario observing what two phases build, when the cut places it, then it is listed under the later of the two. (29.1.10)

29.S4 Given step 1 landed on the reshape branch, when its changes are read, then they touch the engine and the mod and no skill prose. (29.2.1)

29.S5 Given a phase of the cut, when its tasks are written, then the writer reads in full the sections the phase draws on, and reads further wherever it meets a seam. (29.1.8)
