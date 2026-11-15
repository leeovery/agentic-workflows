# Glossary

*Shared reference. Loaded by `answering-how-it-works.md`, by any session answering a question about how Leeway works.*

*The canonical vocabulary of Leeway. One word per concept, chosen once; the walkthrough's screens, the reference cards, the menus and every answer about how the system works adhere to it. Definitions say what a thing is, in one or two sentences, and use the glossary's own terms. Where the docs or an older surface use another word, it is listed beneath as an alias to avoid.*

---

## The whole

**Leeway**:
The system as a whole: a phased process for each piece of work, a record of every question, finding and decision that outlives the session, and the knowledge base that remembers them. Everything begins and resumes at the start menu.
_Avoid_: the workflows, the pipeline (as a name for the whole), the engine, the skills

**start menu**:
Where every piece of work begins and resumes: every piece of work in flight, with where it has got to, the ones waiting on the person first. The `/leeway` command opens it; a change the person asks Claude for mid-conversation is taken into Leeway the same way, going straight to the work the words name.
_Avoid_: workflow start, the entry skill, the front door

**session**:
One conversation inside Leeway: a topic's discussion, a build, a quick-fix. A session stops whenever a decision is the person's, and everything it produces is committed as it goes, so it can end at any moment and the next one carries on from where it stood.

**knowledge base**:
Leeway's memory across pieces of work: each topic's current decisions, a bug's cause and fix and a quick-fix's short record, kept searchable inside the project so later work finds them by meaning. A replaced answer drops out of search the moment it is replaced; conversation logs, the specification and code are never kept.
_Avoid_: the memory (fine as a description, never as the name), the KB, the store

## Kinds of work

**kind of work**:
The shape a piece of work takes, which decides the phases it goes through. There are four: epic, feature, bugfix and quick-fix. The person never has to pick one; discovery settles it from how the work is described, and asks before anything is created.
_Avoid_: work type (the docs' word), type, category

**work unit**:
One named piece of work of one kind, with its own record. "A piece of work" is the plain phrase; work unit is the formal one.
_Avoid_: unit, project, ticket

**epic**:
A piece of work that is several distinct things wearing one name. Its parts become topics, each talked through on its own, held together by the epic's map and lived through its menu.

**feature**:
One coherent thing to build. It runs the full journey from discussion to review as a single topic.

**bugfix**:
Something that used to work and now doesn't. An investigation finds the cause in place of a discussion, and the bug is proven with a failing test before it is fixed; then specification, the build and review.

**quick-fix**:
Settled work of any size, a tweak or an update needing no decision beyond a quick call. It goes from discovery straight to its fixes, each built and reviewed like a task, from the first fix to its close in one session, and has a review phase only if the person asks for one at the close. One that turns out to need a real decision moves to a feature or a bugfix.
_Avoid_: small change, mechanical change

**topic**:
One part of an epic, with its own name, its own brief and its own conversation. For every other kind of work the topic is the work itself and the word never appears.

## The journey

**stage**:
One of the three bands the phases group into. Discovery is where the work is explored and decided (discovery, discussion, experiment, investigation); Definition is where it is specified (specification); Delivery is where it is built and verified (implementation, review).
_Avoid_: the three D's

**phase**:
One step of a piece of work's journey: discovery, discussion, experiment, investigation, specification, implementation, review. Which phases a piece of work visits depends on its kind.

**discovery**:
Both the first phase of every piece of work and the name of the first stage. As a phase it settles what the work is, from a conversation where nothing is decided, and never starts solving the problem; it runs at two levels, the product's own conversation, where new work starts and the roadmap is shaped, and an epic's, where its map is drawn. When the two meanings could collide, say "the discovery phase" or "the Discovery stage".

**discussion**:
The deciding phase, one conversation per topic. Research, deep dives, spikes and experiments are its tools, never phases of their own: every question, finding and decision lands on the ledger as it is made, the topic's map shows what is still open, and the topic is decided once nothing of the person's is open.
_Avoid_: research (as a phase), the discussion document

**closing pass**:
The final review of a topic's discussion, run once nothing of the person's is open: a fresh reader goes over the topic's entries and log against the other topics' records and the product record, and the Claude that was in the conversation checks that every decision made in it has an entry. It looks for a question with no answer, a contradiction with another record, and work the decision creates that no topic owns.

**experiment**:
A controlled measurement in its own laboratory, designed before it is run, spawned from a discussion when a decision is about to rest on a number nobody has measured. It is never entered directly; its result goes back to the conversation that asked, as a finding saying it was measured.

**spike**:
Code or design built to be looked at or pressed and never wired into the product — a design board, draft code, a working prototype. What it shows is evidence, kept as an asset of the work.

**investigation**:
The bugfix's route to the cause: gathering symptoms, reading the code, and arriving at the root cause before anything is specified.

**specification**:
The contract: a piece of work's one spec, written from its decided topics (a bugfix's investigation), each statement traced to the entry it comes from, cut into phases and approved at ready to build. Once concluded it is never corrected: a later change replaces the decision itself.
_Avoid_: the golden record (fine as a description)

**spec**:
The short form of specification. The same word.

**phase cut**:
The specification's cut into build phases, in the order they are built, each naming its scenarios and what it relies on from earlier phases. The person approves it with the spec's outline at ready to build, and each phase's tasks are written as that phase starts.
_Avoid_: the plan, planning

**implementation**:
The building phase, which the screens call the build. One conversation runs it across every phase of the cut, and straight into the review phase.

**review phase**:
The last phase: the whole change held up against the specification, area by area, with the product run. Every finding lands as a fix task, built as one more phase, and finish waits for the person.
_Avoid_: review (alone: the review phase, the phase review and the closing pass are three things)

## The build

**builder**:
The agent that builds one task, writing its tests from the task's acceptance criteria. Its calls go to the ledger, and a question for the person parks its task while the rest of the build runs on.
_Avoid_: implementer

**task loop**:
One task's way through the build: a builder builds it, the reviewer pair reads it whole, and every finding but a nit goes back to the same builder, the changed code read again until a round passes with nothing serious and no bug. No count of rounds stops it; Claude fixes a nit itself, and settles a task that looks stuck.

**reviewer pair**:
The two independent reviewer agents, run side by side, that every review in the build is done by: each task's, each phase's, and the review phase's. Fresh to the code, never the builder that wrote it; the same pair reads again after a finding.
_Avoid_: the reviewer (as if there were one)

**phase review**:
The one independent review closing each build phase: a reviewer pair over the phase's whole change, its tasks' criteria, its coherence, and where it meets what earlier phases built. Its fixes land before the phase closes.

**notes for later**:
What a builder or a reviewer noticed that belongs to no task in hand, put down as it arrives. At the phase's end they are read against the finished code, grouped, the ones the code already settled dropped with a reason, and the rest become tasks in the same phase; a quick-fix's are each filed to the inbox or dropped at its close.

**stack**:
A build phase's pull requests, one per task, chained in the order the tasks merged back and merged whole once the phase review passes. Each phase is its own stack; a phase that relies on the one before waits for its merge.

**driver**:
What Leeway works through to reach a tool: the task driver keeps the build's tasks in the person's tracker, and the landing driver lands each task's change in the repository, as pull requests on GitHub or as branches for a project with no remote. Chosen per project, checked at ready to build, and changed from manage only while no build is in flight.

**auto and step**:
The build's two positions, chosen at ready to build, auto first. In auto the build runs on its own, and only the authority gates, danger and the questions that need the person reach them; in step it also stops after each task, with its account, for the person to review and try it. Either can be switched at any time by saying so; no other phase has a position.

## Verification

**verify setup**:
How the project's product is run to prove the work: launch, a health check, drive, evidence and cleanup, with the feature map. It is built by a task the first time a build needs it, counts only once it has run end to end, and shows beside the environment setup in manage, changed only by the task that builds it.

**feature map**:
The part of the verify setup that says how a user reaches each feature, how an agent drives it and what proves it works. The build writes it and proving the work reads it; bugs found after review are grouped by its areas, which steers the checks there. It is not the product record.

**proven and not proven**:
Proven means a phase's acceptance scenarios were performed on the running product, through the path a user takes, or a caller for a product with no interface, and a script checked the result. Claude's account of what happened never counts: a scenario that cannot be driven, or has no tests, is not proven, and that is what the person is told.

## The record

**ledger**:
The project's history of every question, finding and decision, by either side: who made it, why, what the other side would have said, and what happened to it later. It only ever grows: nothing on it is edited, and a change is a new entry replacing the old one. Everything read about the work's decisions is drawn from it.

**entry**:
One question, finding or decision on the ledger, holding one thing, shown by a short id. A decision names the question it answers, why, what it rules out and what it relies on; it is replaced by a new entry giving one of four reasons — a new fact, another topic's decision, a changed mind, or it was wrong.

**record**:
A topic's current decisions, each with its why and what it rules out, the answers it replaced folded beneath it. It is drawn from the ledger, never written by hand, and is what later phases and the knowledge base read first.
_Avoid_: the discussion document, the record of the person (another thing)

**log**:
A conversation's journey: the options weighed, false paths, reversals and why minds changed, one dated heading per session, appended and never rewritten. It points at entries by short id rather than restating them, and names the conversations that wrote it.

**map**:
In a discussion, the topic's list of what is being decided and where each stands: the person's questions beside Claude's calls, the calls made since the person last looked first. An epic's map is its list of topics, which the person approves before any topic starts. When the two could collide, say "the topic's map" or "the epic's map".
_Avoid_: the discovery map, topic map (fine as a description)

**product record**:
The entries marked product-wide, read as one view: what the product is, who it is for, what it values, and the standing rules that cut across topics. Every topic's opening reads it; discussion decides it, and the product's own conversation only feeds it.
_Avoid_: CLAUDE.md (the person's own file)

**brief**:
A short per-topic view written when an epic's map is approved: the soft decisions reached, the paths rejected and why, and the open questions. A topic's first conversation reads its brief in full.

**affected**:
An entry whose answer it relies on has been replaced. It is flagged until it is confirmed still holds or is replaced itself, and its topic shows among what waits on the person as "a decision it relies on changed".
_Avoid_: stale, input moved

## Gates and trust

**gate**:
A stop where Leeway shows a menu and waits. There are three kinds: the authority gates always stop — start this work, approve the map, a topic's decision, ready to build and finish; product questions go through the ask rule; and routine process gates are learned, one the person always answers the same way running on its own with a one-line report, until their answers vary. A question typed at a gate sets it aside, and it comes back when the exchange is done.
_Avoid_: checkpoint, approval step, stop (fine as a description)

**menu**:
The list of choices beneath a screen. Each row has a key and a word (`n/next`), and every menu has `h/help`. Where the Claude Code mod runs, menus are drawn as buttons above the prompt — click a row to pick it, click again to send; typing a key or plain words always works.

**lean**:
Claude's own answer to a question it puts to the person, sealed before the person answers so it cannot change, and shown beside the question. An answer that changes Claude's lean is one the person later gives a verdict on.

**the ask rule**:
How Leeway decides whether a call reaches the person, as arithmetic over the person's own answers: a call asks while, for its kind, the pessimistic rate at which Claude's answer would have cost the product a real loss is over the person's threshold, 20% unless they pick another, halved for a call that would be hard to undo. Under it, the call lands on the ledger as Claude's, shown among the calls since the person last looked; danger and a care entry always ask, and Claude's own confidence never decides.

**kind**:
The kind of a question, which keys every count the ask rule reads: process, danger, contract, scope, look, words, behaviour or internals. It is composed from a separate Claude call's answers to twelve narrow yes-or-no questions about what was asked.
_Avoid_: category; kind of work (another thing)

**verdict**:
What Claude's answer would have cost the product, given for each call where the person's answer changed Claude's lean: nothing, a fix later, or a real loss. It is asked on a topic's decided screen, at finish and at a quick-fix's close; a skipped one counts as a real loss until it is given. Verdicts are what the ask rule learns from.

**the verdict queue**:
The verdicts still waiting, reached from the Verdicts row on the start menu or an epic's menu while any wait, and given one at a time, oldest first.

**blind question**:
Now and then, a call Claude would have made without asking is put to the person cold, Claude's answer held back; once they have answered, it shows what Claude would have picked. It keeps the ask rule honest about calls that have gone quiet, and in the build a task built on Claude's call waits for the answer before it lands.

**convergence**:
After eight agreements in a row in a topic, or on the person's word, Claude offers to settle the rest: how many points are open, how many it would settle, and which still come to the person by the rule, by kind. On yes its points go on the ledger, the person's come one at a time, and the topic moves to its decided screen.

**care entry**:
A line in the record of the person naming one project and one kind, such as "Aircon: look". While it stands, that kind always asks in that project, however well Claude's calls have matched; answers to it still count. It never covers every project, and is added or dropped from the matrix's care entries.

**the matrix**:
The project's screen of how the ask rule stands, reached from manage: for each kind, how often the person changed Claude's lean and how often Claude's answer would have cost the product, and whether the kind asks or has gone quiet. A new project starts from the person's answers across their other projects, at most ten answers' worth a kind. The threshold, the threshold mid-build and the care entries are set from it, and a kind or verdict found wrong is corrected in words.

**the record of the person**:
The person's preferences in words, each with its reason and examples, kept across all their projects; the care entries are part of it. Claude proposes an entry when it sees a pattern or the person states a preference, and an entry steers nothing until the person says yes. The screens call it the record of you.
_Avoid_: profile, rules

## The product layer

**roadmap**:
The layer above the pieces of work: everything decided about the product but not yet started — ideas, bugs and quick-fixes — held as items in horizons, shaped in the product's own conversation. An item leaves it once its work starts.

**item**:
One thing on the roadmap, marked as an idea, a bug or a quick-fix: an idea is a capability at the grain the person would move around a real roadmap, a bug or a quick-fix one fix. Each has a one-line summary and a pointer to where it came from.

**horizon**:
A named bucket on the roadmap, in the person's own staging words (launch, v1, someday). Their order is the meaning: first is next up. The horizon is always the person's; Claude never picks one.

**park**:
Putting something on the roadmap from the middle of another conversation by naming where it belongs ("that's a v2 thing", "fix that before launch") — a capability, a bug or a quick-fix. The stated placement is what makes it a park rather than an inbox note; a topic already on an epic's map is never parked — that is a postpone.

**start work on**:
Choosing roadmap items or inbox items to work on now. They go into discovery together as the seeds of one piece of work, which settles its kind, while the rest wait.
_Avoid_: pull (the docs' word), promote

**backlog**:
Putting something aside from any conversation, whichever phase it is in. It covers both homes: a park onto the roadmap when the person has decided to do it, an inbox note when they haven't yet — and they are asked where it should wait when their words leave it open. The roadmap's backlog is whichever horizon they name for it, such as Backlog or Later.

## Everyday

**inbox**:
The place captures wait: ideas, bugs and quick-fixes put down in a line ("log that as an idea") without stopping the work in hand, waiting until they are triaged. The start menu shows it as one line, counted by kind.
_Avoid_: triage (that is the act, not the place)

**triage**:
The act of deciding on what waits in the inbox, from the start menu: pick items, then work on them now as one piece of work, put them on the roadmap on a horizon the person names, or archive them. Archived items can be restored, and a finished piece of work archives the items it resolved, naming them in its finish report.
_Avoid_: the inbox (that is the place)

**seed**:
An inbox or roadmap item a piece of work was started from, kept with the work as its record of origin.

**asset**:
A file shared with or made for a piece of work — notes, a design document, a screenshot, an error report, what a spike showed — kept with the work and linked from the entry it informs.
_Avoid_: import, attachment

**mail**:
The messages waiting for a discussion or investigation: from another topic of the same epic, or from a later phase that met a question only that conversation can settle. Its next session raises each one, and it cannot close while one waits; the menus show it as *mail waiting*.
_Avoid_: triage waiting, triage queue, queue

**message**:
Something a session found that belongs to another discussion or investigation — a point for another topic of the same epic, or a question a later phase needs decided — sent to that topic's mail with everything worked out about it.
_Avoid_: concern, reroute, spawn

**pivot**:
Converting a feature into an epic in place, when it turns out to be several things, before its specification is written.

**absorb**:
Merging a feature into an epic already under way, as one of its topics, before either's specification is written.

**cancel**:
Taking a piece of work, or one topic of an epic, out of active work while keeping its record. Reversible with reactivate.

**reactivate**:
Bringing a cancelled piece of work or topic back into active work.

**postpone**:
Sending one topic of an epic to the roadmap to be done later. The topic leaves whole — nothing deleted, nothing moved — and comes back when its item is started.
_Avoid_: defer

**reopen**:
Opening a finished feature's, bugfix's or quick-fix's decision again, which takes it back into its build with the change; a finished epic is not reopened, and a later change to it is new work. An epic's decided topic is reopened from its discovery row until the spec is first written.

**in session**:
The cue on a topic another conversation is working right now, with how long ago it was last active; its row is struck through, and entering it asks first. Awareness only: it never locks anyone out.

**code session**:
The one build, review phase or quick-fix working in the project's checkout at a time, whichever piece of work it belongs to. Entering another while one holds the code names the session holding it and when it was last active.

**nested repo**:
A git repository of its own inside the project's folder that holds code: a clone, or a submodule. Found every time, never configured — except one inside a git-ignored folder that is not itself a repo, which is never found. A code commit lands in each one it touches, and every read of the change spans them all.
_Avoid_: child repo

**state branch**:
The branch of its own in the project's repository where Leeway keeps its records, checked out in the main checkout and ignored by every code branch. Code branches and pull requests never carry it; every session writes the one copy, and each action commits what it wrote.

**lens**:
The perspective a report is told from. Reports arrive in the product's terms first; the code's retelling is one option away. The facts are identical through both.
