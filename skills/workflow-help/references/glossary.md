# Glossary

*Reference for **[workflow-help](../SKILL.md)** — loaded by the walk's closing prompt and by any session answering a question about how the workflows work.*

*The canonical vocabulary of the workflows. One word per concept, chosen once; the walkthrough's screens, the reference cards, the menus and every answer about how the system works adhere to it. Definitions say what a thing is, in one or two sentences, and use the glossary's own terms. Where the docs or an older surface use another word, it is listed beneath as an alias to avoid.*

---

## The whole

**the workflows**:
The system as a whole: a phased process for a piece of work, the documents it produces, and the knowledge base that remembers them. Reached entirely through workflow start.
_Avoid_: the pipeline (as a name for the whole), the engine, the skills

**workflow start**:
The one command, `/workflow-start`, and the menu it opens. It shows every piece of work in flight and is where all work begins and is resumed.
_Avoid_: the entry skill, the front door (a walkthrough metaphor, never a label)

**session**:
One sitting inside a piece of work. A session stops whenever a decision is the person's, and everything it produces is committed as it goes, so a session can end at any moment and the next one carries on from disk.

**document**:
What a phase writes into the repository: a research file, a discussion, a specification, a plan, a review report. Documents are read and approved by the person and are what the next phase is built from.
_Avoid_: artifact, artefact

**knowledge base**:
The system's memory. Finished thinking documents are indexed so later work can find them by meaning, with a note of where each came from. It remembers decisions and reasons, never task lists or diffs, and older material fades as the project moves on, except specifications.
_Avoid_: the memory (fine as a description, never as the name), the KB, the store

**baseline**:
A one-time assessment of a codebase that existed before the workflows did: the code is read, the person is interviewed for what the code cannot show, and the result lands as documents the knowledge base surfaces in every later phase.
_Avoid_: brownfield assessment, archaeology

## Kinds of work

**kind of work**:
The shape a piece of work takes, which decides the phases it goes through. There are five: epic, feature, bugfix, quick-fix and cross-cutting. The person never picks one; discovery settles it from how the work is described.
_Avoid_: work type (the docs' word), type, category

**work unit**:
One named piece of work of one kind, with its own home under `.workflows/` and its own record. "A piece of work" is the plain phrase; work unit is what the menus say.
_Avoid_: unit, project, ticket

**epic**:
A piece of work that is several distinct things wearing one name. Its concerns become topics, each travelling the phases on its own, held together by a map and a dashboard.

**feature**:
One coherent thing to build. It runs the full journey from discussion to review as a single topic.

**bugfix**:
Something that used to work and now doesn't. It replaces discussion with an investigation into why, then continues through specification, planning, implementation and review.

**quick-fix**:
A small, mechanical change with nothing to debate. Its middle is a single scoping pass, then implementation and review.

**cross-cutting**:
A standard, pattern or policy for the codebase to follow, rather than something to ship. It ends at its specification, which becomes a standing document.

**topic**:
One concern inside an epic, with its own name, its own routing and its own trip through the phases. For every other kind of work the topic is the work itself and the word never appears.

## The journey

**phase**:
One step of a piece of work's journey. In order: discovery, research, experiment, discussion, investigation, scoping, specification, planning, implementation, review. Which phases a piece of work visits depends on its kind.

**stage**:
One of the three bands the phases group into, and the top-level divisions of an epic's dashboard. Discovery is where you explore and decide (discovery, research, experiment, discussion, investigation). Definition is where you specify and plan (scoping, specification, planning). Delivery is where it is built and verified (implementation, review).
_Avoid_: the three D's, band (fine as a description of the dashboard)

**discovery**:
Both the first phase of every piece of work and the name of the first stage. As a phase, its only job is to work out what the work is and how big, shape it, save it, and route it onward; it never solves the problem. When the two meanings could collide, say "the discovery phase" or "the Discovery stage".

**research**:
The exploring phase: feasibility, the landscape, early ideas. One file per topic. It carries aids, never an audit, and open questions are a fine way to conclude.

**experiment**:
A controlled measurement, designed before it is run, spawned from research or discussion when a decision is about to rest on a number nobody has measured. It is never entered directly. Its result feeds back into the conversation that asked.
_Avoid_: the laboratory (the docs' image), spike

**discussion**:
The deciding phase: an organic conversation, guided by a live map of what is settled and what is still open, that argues a design through to conclusions and writes them down.

**investigation**:
The bugfix's route to the cause: gathering symptoms, reading the code, and arriving at the root cause before anything is specified.

**scoping**:
The quick-fix's one pass: context, specification and plan written in a single sitting, because there is nothing to debate or diagnose.

**specification**:
The contract. The decisions of a discussion (or the findings of an investigation) written up as a standalone document everything downstream is built from. The one document that never fades from the knowledge base and the only one corrected after the fact.
_Avoid_: the golden record (fine as a description)

**spec**:
The short form of specification. The same word.

**planning**:
The phase that breaks a specification into phases and tasks with acceptance criteria, and settles the order to build them in. Its plan is written into the task tracker the project chose.

**implementation**:
The building phase. Agents take the plan's tasks one at a time, writing the tests before the code, stopping at gates or running on under `auto`.

**review**:
The verifying phase. The finished work is held up against the specification and the plan, and the verdict is pass or fail, with what must be fixed named.

## Stops and autonomy

**gate**:
A stop where a decision is the person's. The system shows a menu and waits. A gate is never answered on the person's behalf; a stored preference pre-fills a question and never skips it.
_Avoid_: checkpoint, approval step, stop (fine as a description)

**auto**:
The person's choice to hand one particular gate over for the rest of the sitting, so the system proceeds there without asking. It is scoped to that gate and reversible, and some gates never yield to it.

**lens**:
The perspective a report is told from. Reports arrive in the product's terms first; the code's retelling is one option away. The facts are identical through both.

**menu**:
The list of choices beneath a screen. Each row has a key and a word (`n/next`); typing either works, and plain-language answers are always accepted where a prompt row invites them.

## The product layer

**roadmap**:
The layer above the pieces of work: everything shaped about the product but not yet committed to build, held as items in horizons. Born the first time something is put on it.

**item**:
A capability on the roadmap at the grain you would move around a real roadmap, with a one-line summary and a pointer to the conversation that produced it.

**horizon**:
A named bucket on the roadmap, in the person's own staging words (launch, v1, someday). Their order is the meaning: first is next up.

**park**:
Putting a capability on the roadmap from the middle of another conversation by naming where it belongs ("that's a v2 thing"). The stated placement is what makes it a park rather than an inbox note. A capability surfacing as you talk, never a topic already on an epic's map — that is a postpone.

**start work on**:
Choosing roadmap items to build now. Several items usually become an epic, one becomes a feature, and the new piece of work is fenced to exactly those items while the rest wait.
_Avoid_: pull (the docs' word), promote

## Epics

**map**:
An epic's list of topics, each with its routing (research or discussion first) and a lifecycle read from the work that actually exists under its name.
_Avoid_: the discovery map, topic map (fine as a description)

**brief**:
A short per-topic view written when an epic's topics are drawn out: the soft decisions reached, the paths rejected and why, and the open questions. A topic's first phase reads its brief in full.

**dashboard**:
An epic's view: the three stages as bands, the topics and their state beneath them, and a menu that recommends the next move.

**build order**:
A suggested sequence over an epic's specifications for planning and building. Advisory: stepping ahead of it warns and never blocks.

**reroute**:
Sending a concern that came up in one topic's conversation to the topic it belongs to. It waits there as *triage waiting* until that topic's next session raises it.
_Avoid_: triage (as a verb), spawn

**dead end**:
Research that concluded with nothing to carry forward under its own name. The topic stays on the map as the record that it was explored.

## Everyday

**inbox**:
Where thoughts are put down without stopping: ideas, bugs and quick-fixes captured in a line ("log that as an idea"). Items wait there until picked up from workflow start, promoted into a piece of work or archived.

**backlog**:
Putting an idea aside from any conversation, whichever phase you are in. It covers both homes: a park onto the roadmap when you place it, an inbox note when you don't — and you are asked which one when your words leave it open.

**seed**:
The inbox note a piece of work was started from, moved into the work as its permanent record of origin.

**import**:
A file the person shared to inform a piece of work: notes, a design doc, a screenshot, an error report. Kept with the work and linked from the document that discussed it.

**pivot**:
Converting a feature into an epic in place, when it turns out to be several things.

**absorb**:
Merging a standalone feature into an epic already underway, as one of its topics.

**cancel**:
Taking a piece of work, or one topic of an epic, out of active work while keeping its record. Reversible with reactivate.

**postpone**:
Sending one topic of an epic to the roadmap to be done later. The topic leaves whole — nothing deleted, nothing moved — and comes back when you start work on its item.
_Avoid_: defer (the discussion map's word for a subtopic set aside)

**reopen**:
Stepping back into a finished phase to amend it. Whatever was built on it is marked *input moved* until that phase is entered and reconciles the change.

**input moved**:
The cue on a phase whose upstream document changed after it was completed. The phase is not recommended until it has been entered and has taken the change into account.

**in session**:
The cue on a topic another session is working right now. Awareness only: it never locks anyone out.

**code session**:
The one session per checkout allowed to be writing code at a time, since implementation and review change the same tree.
