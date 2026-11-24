# Glossary

*Shared reference. Loaded by `answering-how-it-works.md`, by any session answering a question about how Ledger works.*

*The canonical vocabulary of Ledger. One word per concept, chosen once, in the words the screens use; the walkthrough's screens, the reference cards, the menus and every answer about how the system works adhere to it. Definitions say what a thing is, in a few sentences, and use the glossary's own terms. Where the docs or an older surface use another word, it is listed beneath as an alias to avoid.*

---

## The whole

**Ledger**:
The system as a whole: a phased process for each piece of work, a record of every question, finding and decision that outlives the session, and the knowledge base that remembers them. Work begins and resumes at the start menu, or straight from a request in words.
_Avoid_: the workflows, the pipeline (as a name for the whole), the engine, the skills

**start menu**:
Where every piece of work begins and resumes: every piece of work in flight, with where it has got to, the ones waiting on the person first. The `/ledger` command opens it; a change the person asks Claude for mid-conversation is taken into Ledger the same way, going straight to the work the words name.
_Avoid_: workflow start, the entry skill, the front door

**session**:
One conversation inside Ledger: a topic's discussion, a build, a quick-fix. A session stops for a decision that is the person's — though in the build, in auto, a question parks only the tasks that depend on it and the rest run on — and everything it produces is committed as it goes, so it can end at any moment and the next one carries on from where it stood.

**knowledge base**:
Ledger's memory across pieces of work: each topic's current decisions, a bug's cause and fix and a quick-fix's short record, kept searchable inside the project — by meaning where an embedding provider is set up, by keyword otherwise. A replaced answer drops out of search the moment it is replaced; conversation logs, the specification and code are never kept.
_Avoid_: the memory (fine as a description, never as the name), the KB, the store

**research owed**:
The note on the start menu's product row while the one-time research of an existing codebase is still to run. The first time the product's conversation opens on that code, a researcher reads it and its findings land on the ledger; until they have, the note stays and the research resumes the next time that conversation opens.

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
Something that used to work and now doesn't. An investigation finds the cause in place of a discussion, then comes the specification; the build's first task proves the bug with a failing test before it is fixed, and review follows.

**quick-fix**:
Settled work of any size, a tweak or an update needing no decision beyond a quick call. It goes from discovery straight to its fixes, each built and reviewed like a task, from the first fix to its close in one session; they are built in a worktree of the quick-fix's own, so the person's checkout never moves while they are built; the close brings it up where it has out the branch the quick-fix lands on. It has a review phase only if the person asks for one at the close. One that turns out to need a real decision moves to a feature or a bugfix.
_Avoid_: a small mechanical change

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
The deciding phase, one conversation per topic. Research, deep dives, spikes and experiments are its tools, never phases of their own: every question, finding and decision lands on the ledger, and the topic's map shows what is still open. Once no question is open and the talk has come to rest, Claude offers the close, which runs on the person's yes. It also runs when the person asks for it, or on the convergence yes, each question still open closed first. The closing pass runs and the topic reaches decided.
_Avoid_: research (as a phase), the discussion document

**closing pass**:
The final review of a topic's discussion, run on the person's yes to the close Claude offers, on their asking for it, or on the convergence yes: a fresh reader goes over the topic's entries and log against the other topics' records and the product record, and the Claude that was in the conversation checks that every decision made in it has an entry. It looks for a question with no answer, a contradiction with another record, a replacement that does not hold up against what it replaced, and work the decision creates that no topic owns.

**decided**:
The authority gate that closes a topic, after its closing pass: the person signs off on what was decided, with the ledger in view, and gives a verdict on each call they changed. A feature's decided shares one screen with its ready to build.

**experiment**:
A controlled measurement in its own laboratory, designed before it is run, spawned from a discussion when a decision is about to rest on a number nobody has measured. It is never started directly, though one waiting can be continued from the epic's menu; its result goes back to the conversation that asked, as a finding saying it was measured.

**spike**:
Code or design built to be looked at or pressed and never wired into the product — a design board, draft code, a working prototype. What it shows is evidence, kept as an asset of the work.

**investigation**:
The bugfix's route to the cause: gathering symptoms, reading the code, and arriving at the root cause before anything is specified. It closes into the specification with no gate of its own: its recap is shown at ready to build, whose yes concludes it.

**specification**:
The contract: a piece of work's one spec, written from its decided topics (a bugfix's investigation), each statement traced to the entry it comes from, cut into phases and approved at ready to build. Once concluded it is never corrected: a later change replaces the decision itself.
_Avoid_: the golden record (fine as a description)

**spec**:
The short form of specification. The same word.

**review page**:
The spec published as a private page, offered at ready to build, where every numbered line can be checked off or commented on, and the lines resting on Claude's calls are marked. Taking it is optional: the person can check all of it, the parts they care about, or none.

**phase cut**:
The specification's cut into build phases, in the order they are built, each naming its scenarios and what it relies on from earlier phases. The person approves it with the spec's outline at ready to build, and each phase's tasks are written as that phase starts.
_Avoid_: the plan, planning

**ready to build**:
The authority gate that closes the specification: one screen showing the spec's outline and its phase cut, where the person approves both and picks the build's position, auto or step. The drivers are checked there, the environment setup is asked for the first time, and verdicts are asked for the calls the person changed in the spec's review. A feature's shares the screen with its decided, a bugfix's with its investigation's recap and verdicts.

**implementation**:
The building phase, which the screens call the build. One conversation runs it across every phase of the cut, and straight into the review phase.

**review phase**:
The last phase: the whole change held up against the specification, area by area, with the product run. Every finding lands somewhere: one below the floor is dropped; one in the change becomes a fix task, built as one more phase; one outside it, and a note for later, is filed to the inbox or dropped, and the report lists what went to the inbox.
_Avoid_: review (alone: the review phase, the phase review and the closing pass are three things)

**finish**:
The authority gate that ends a piece of work, after its review phase: the finish report, a verdict on each call the person changed in the build and the review phase, and the inbox items the work resolved archived and named. A quick-fix's close is its finish.

## The build

**builder**:
The agent that builds one task, writing its tests from the task's acceptance criteria. Its calls go to the ledger, and a question for the person parks its task while the rest of the build runs on.
_Avoid_: implementer

**task loop**:
One task's way through the build: a builder builds it, the reviewers Claude chose for it read it whole, and every finding but a nit goes back to the same builder, the whole task read again until a round passes with nothing serious and no bug. No count of rounds stops it; Claude fixes a nit itself, and settles a task that looks stuck.

**reviewer pair**:
The two independent reviewer agents, run side by side, that each phase's review and the review phase's are done by, and a task's where Claude chooses two. Fresh to the code, never the builder that wrote it; the same pair reads again after a finding.
_Avoid_: the reviewer, for a phase's review or the review phase's (as if there were one)

**phase review**:
The one independent review closing each build phase: a reviewer pair over the phase's whole change, its tasks' criteria, its coherence, and where it meets what earlier phases built. Its fixes land before the phase closes.

**park**:
What a question for the person does in the build: it parks only the tasks that depend on it, while the rest of the build runs on, and each carries on once it is answered. A fact only the person holds parks its tasks the same way.

**notes for later**:
What a builder or a reviewer noticed that belongs to no task in hand, put down as it arrives. At the phase's end they are read against the finished code, grouped, the ones the code already settled dropped with a reason, and the rest become tasks in the same phase; a quick-fix's are each filed to the inbox or dropped at its close.

**stack**:
A build phase's tasks' changes, chained in the order the tasks merged back and merged whole once the phase review passes: on GitHub, a pull request per task; under the local driver, a branch per task merged into the phase's branch. Each phase is its own stack, and a phase that relies on the one before waits for its merge.

**driver**:
What Ledger works through to reach a tool: the task driver keeps the build's tasks in the person's tracker, and the landing driver lands each task's change in the repository — as pull requests on GitHub, or as branches merged locally for a project with no remote or one on another host. Chosen per project, checked at ready to build, and changed from manage only while no build is in flight.

**auto and step**:
The build's two positions, chosen at ready to build, auto first. In auto the build runs on its own, and only the authority gates, danger and the questions that need the person reach them; in step it also stops after each task, with its account, for the person to review and try it. Either can be switched at any time by saying so; no other phase has a position.

**the board**:
A pane the Claude Code mod draws beside the conversation, showing what is happening now — the build's tasks, a topic's map, the questions waiting — without reprinting it into the transcript. It adds to the conversation and never replaces it.

## Verification

**environment setup**:
How the project runs for the work: how to run it and its tests, the steps that prepare its environment, what cannot run at once, and its linters. It is asked at the first ready to build, used once the person confirms it, and changed from manage's setup or, on the person's yes, from any conversation.

**verify setup**:
How the project's product is run to prove the work: launch, a health check, drive, evidence and cleanup, with the feature map. It is built by a task the first time a build needs it, counts only once it has run end to end, and shows beside the environment setup in manage, changed only by the task that builds it.

**feature map**:
The part of the verify setup that says how a user reaches each feature, how an agent drives it and what proves it works. The build writes it and proving the work reads it; bugs found after review are grouped by its areas, which steers the checks there. It is not the product record.

**proven and not proven**:
Proven means a phase's acceptance scenarios were performed on the running product, through the path a user takes, or a caller for a product with no interface, and a script checked the result. Claude's account of what happened never counts: a scenario that cannot be driven, or has no tests, is not proven, and that is what the person is told.

**named, not run**:
The third result beside proven and not proven: a criterion whose tests exist but were all skipped, so nothing ran to prove it.

## The record

**ledger**:
The project's history of every question, finding and decision, by either side: who made it, why, what the other side would have said, and what happened to it later. It only ever grows: nothing on it is edited, and a change is a new entry replacing the old one. Everything read about the work's decisions is drawn from it.

**entry**:
One question, finding or decision on the ledger, holding one thing, shown by a short id. A decision names the question it answers, why, what it rules out and what it relies on; it is replaced by a new entry giving one of four reasons — a new fact, another topic's decision, a changed mind, or it was wrong.

**record**:
A topic's current decisions, each with its why and what it rules out, the answers it replaced folded beneath it. It is drawn from the ledger, never written by hand, and is what later phases and the knowledge base read first. A record the migration wrote from a project's documents from before Ledger says what they decided, the person's decisions among them, never what the code does: where the code does something else, the session records a finding on the decision, and settles which stands only when the work in hand turns on it, as a build that would undo what the code does always does: replacing the decision with what the code does as its own call, where the code plainly stands and that is easy to undo; asking the person, before the code changes, wherever either could stand, the decision looks right and the later code wrong, or the call is hard to undo. Code that does not yet do what was decided, in a part the build has not reached, is work still to do; code that no longer does it, in a part built and changed since, is built otherwise.
_Avoid_: the discussion document, the record of the person (another thing)

**log**:
A conversation's journey: the options weighed, false paths, reversals and why minds changed, one dated heading per session, appended and never rewritten. It points at entries by short id rather than restating them, and names the conversations that wrote it.

**map**:
In a discussion, the topic's list of what is being decided and where each stands: the person's questions beside Claude's calls, the calls made since the person last looked first. An epic's map is its list of topics, which the person approves before any topic starts; the epic's discovery shows it as the Discovery Map. When the two could collide, say "the topic's map" or "the epic's map".

**product record**:
The entries marked product-wide, read as one view: what the product is, who it is for, what it values, and the standing rules that cut across topics. Every topic's opening reads it; discussion decides it, and the product's own conversation only feeds it.
_Avoid_: CLAUDE.md (the person's own file)

**brief**:
A short view written for each topic as it is created: an epic's topics get theirs when the map is approved, and a feature's or a bugfix's one topic at start this work. It carries the soft decisions reached, the paths rejected and why, and the open questions, and the topic's first conversation reads it in full.

**affected**:
An entry whose answer it relies on has been replaced, but the replacement's own cause. It is flagged until it is confirmed still holds or is replaced itself, and its topic shows among what waits on the person as "a decision it relies on changed".
_Avoid_: stale, input moved

**carried over**:
A decision brought into Ledger from a project's documents from before it, where they do not show who made it. It is drawn apart from the person's decisions and Claude's calls and counts as neither.

**record from before**:
A record the person brings from before — notes, a decision log, a model of the product, research. Its points are **the points from before**: where they had got to, cited by its own ids and files, its own open questions still open. A point of it becomes their view only once they take it up in discovery; otherwise each topic's brief carries the points that bear on it, marked as from before, and its discussion puts each on its map as an open question, the answer from before Claude's lean.
_Avoid_: earlier record (a postponed topic's), carried over (the migration's decisions), decisions, for its points before a discussion decides them

## Gates and trust

**gate**:
A stop where Ledger shows a menu and waits. There are three kinds: the authority gates always stop — start this work, approve the map, decided, ready to build and finish; product questions go through the ask rule; and routine process gates are learned, one the person answers the same way nearly every time running on its own with a one-line report, until their answers vary. A gate takes a clear answer in the person's own words as its row, at any point; a question typed there sets it aside while they talk, and their answer, whenever it comes, still answers it.
_Avoid_: checkpoint, approval step, stop (fine as a description)

**menu**:
The list of choices beneath a screen. A command row has a key: a letter with its word (`n/next`), or a number for each item listed; the prompt row, Ask or Comment, has none and takes the person's own words. Every menu screen has `h/help`; a gate and a question put to the person do not. Where the Claude Code mod runs, rows are buttons above the prompt — click to pick, click again to send; typing a key or plain words always works.

**technical**:
The `t/technical` row, which retells a report from the code's side, and on a question put to the person shows the mechanism behind it. Reports and questions arrive in the product's terms first; the facts are the same either way.
_Avoid_: lens

**lean**:
Claude's own answer to a question it puts to the person, sealed before the person answers so it cannot change, and shown beside the question. An answer that changes Claude's lean is one the person later gives a verdict on; answered "don't care", the lean lands as Claude's call, settling that one question.

**the ask rule**:
How Ledger decides whether a call reaches the person, as arithmetic over the person's own answers. Every call Claude would make for the person goes through it, the obvious ones included, but the few a phase names as Claude's own to land; a question the code, the record or a run can answer is no call, and Claude checks it instead. Each kind's rate is the pessimistic bound, the high end of a 95% range on how often Claude's answer would have cost the product; a kind asks until its rate falls under the person's threshold, 20% unless they pick another, then goes quiet, and asks again only once its rate rises over a quarter above it, with half each line where a change would be hard to undo. Danger, a kind under a care entry, and replacing an answer the person gave always ask; Claude's calls with one sensible answer go ahead as its own, on a count of their own, until overrules lift their rate over the threshold. A call that goes ahead lands on the ledger as Claude's, and Claude's own confidence never decides.

**kind**:
A question's kind — process, danger, contract, scope, look, words, behaviour or internals — composed from a separate Claude call's answers to twelve narrow yes-or-no questions about what was asked; the ask rule counts answers by it, apart from Claude's one-answer calls and the learned gates, which are counted on their own. An item's kind, in the inbox or on the roadmap, is idea, bug or quick-fix. When the two could collide, say "the question's kind" or "the item's kind".
_Avoid_: category; kind of work (another thing)

**verdict**:
What Claude's answer would have cost the product, given for each call where the person's answer changed Claude's lean: nothing, a fix later, or a real loss. It is asked where the person signs off — decided, ready to build, finish and a quick-fix's close — and skip leaves it in the verdict queue. Every call not yet judged counts as a real loss until it is; verdicts are what the ask rule learns from.

**the verdict queue**:
The verdicts still waiting, reached from the Verdicts row on the start menu or an epic's menu while any wait, and given one at a time, oldest first.

**blind question**:
Now and then, a call Claude would have made without asking is put to the person cold, Claude's answer held back; once they have answered, it shows what Claude would have picked. It keeps the ask rule honest about calls that have gone quiet, and in the build a task built on Claude's call waits for the answer before it lands.

**convergence**:
After eight agreements in a row in a topic, or on the person's word, Claude offers to settle the rest: how many points are open, how many it would settle, and which still come to the person by the rule, by kind. On yes its points go on the ledger, the person's come one at a time, and the topic moves to its decided screen.

**care entry**:
A line in the record of the person naming one project and one kind, such as "Aircon: look". While it stands, that kind always asks in that project, however well Claude's calls have matched; answers to it still count. It never covers every project. Claude proposes one where the person wants a kind always asked, and proposes dropping it where their answers to it keep being "don't care"; the matrix's care entries add or drop one too.

**the matrix**:
The project's screen of how the ask rule stands: for each kind, how often the person changed Claude's lean, how often Claude's answer would have cost the product, its rate, and whether it asks or has gone quiet, with Claude's one-answer calls on a row of their own. A new project starts from the person's answers across their other projects, at most ten answers' worth a kind. The threshold, the threshold mid-build and the care entries are set from it, and a kind or verdict found wrong is corrected in words.

**the record of the person**:
The person's preferences in words, each with its reason and examples, kept across all their projects; the care entries are part of it. Claude proposes an entry at a natural pause, when the person states a preference outright or their answers keep showing one, and it steers nothing until the person says yes. The screens call it the record of you.
_Avoid_: profile, rules

## The product layer

**roadmap**:
The layer above the pieces of work: everything decided about the product but not yet started — ideas, bugs and quick-fixes — held as items in horizons, shaped in the product's own conversation. Saying where something belongs mid-conversation ("that's a v2 thing") puts it there in one line; an item leaves the roadmap once its work starts.

**item**:
One thing in the inbox or on the roadmap, of one kind: an idea, a bug or a quick-fix. On the roadmap an idea is a capability at the grain the person would move around a real roadmap, never a task, and a bug or a quick-fix one fix; each has a one-line summary and a pointer to where it came from, and stays a placeholder, changeable until work starts from it.

**horizon**:
A named bucket on the roadmap, in the person's own staging words (launch, v1, someday). Their order is the meaning: first is next up. The horizon is always the person's; Claude never picks one.

**start work on**:
Choosing roadmap items or inbox items to work on now. They go into discovery together as the seeds of one piece of work, which settles its kind, while the rest wait.
_Avoid_: promote

**views of the product**:
What the person has said of the product as a whole, in any conversation — a principle, a direction, who it is for, a constraint, a lean — kept as their input beside the directions they dropped, each with why. Every topic's opening reads them beside the product record, which speaks where both do, and a view is decided in the first topic it bears on.

**product picture**:
The product's conversation's one view of where the product stands: the log is the journey, the picture where things stand now. It decides nothing, and thins as work starts; a return to the product's conversation can open from it.
_Avoid_: the current model, the product summary

**backlog**:
Putting something aside from any conversation, whichever phase it is in. It covers both homes: a line on the roadmap, saying where it belongs, when the person has decided to do it, an inbox note when they haven't yet — and they are asked where it should wait when their words leave it open. A topic already on an epic's map is postponed instead. The roadmap's backlog is whichever horizon they name for it, such as Backlog or Later.

## Everyday

**inbox**:
The place captures wait: ideas, bugs and quick-fixes for later, put down in a line as they come up in any conversation, without stopping the work in hand, waiting until they are triaged. The start menu shows it as one line, counted by kind.
_Avoid_: triage (that is the act, not the place)

**triage**:
The act of deciding on what waits in the inbox, from the start menu: pick items, then work on them now as one piece of work, put them on the roadmap on a horizon the person names, or archive them. Archived items can be restored, and a finished piece of work archives the items it resolved, naming them in its finish report.
_Avoid_: the inbox (that is the place)

**seed**:
An inbox or roadmap item a piece of work was started from, kept with the work as its record of origin.

**asset**:
A file shared with or made for a piece of work — notes, a design document, a screenshot, an error report, what a spike showed — kept with the work and linked from the entry it informs.
_Avoid_: import, attachment

**reference file**:
A shared file kept to be searched rather than read: one the person shares for reference, or one Claude judges is, such as a transcript, a raw export or a long chat log. It is read properly whenever the person asks.

**legacy files**:
The files a piece of work had from before Ledger that the migration found no place for — old plans, agent reports, research — kept with the work, or with the product, for Claude to look in when the work needs them.

**mail**:
The messages waiting for a discussion or investigation: from another topic of the same epic, from a later phase that met a question only that conversation can settle, or from a conversation outside the work that found something bearing on it. Its next session raises each one, and it cannot close while one waits; the menus show it as *mail waiting*.
_Avoid_: triage waiting, triage queue, queue

**message**:
Something a session found that belongs to another discussion or investigation — a point for another topic of the same epic, or a question a later phase needs decided — sent to that topic's mail with everything worked out about it.
_Avoid_: concern, reroute, spawn

**manage**:
The start menu's row for changing a piece of work's shape or standing — pivot, absorb, cancel, or bring cancelled work back — and the project's own environment setup and drivers, and the matrix of Claude's calls.

**pivot**:
Converting a feature into an epic in place, when it turns out to be several things, before its specification is written.

**absorb**:
Merging a feature into an epic already under way, as one of its topics, before either's specification is written.

**cancel**:
Taking a piece of work, or one topic of an epic, out of active work while keeping its record. Reversible with reactivate.

**reactivate**:
Bringing a cancelled piece of work or topic back into active work.

**postpone**:
Sending one topic of an epic to the roadmap to be done later. The topic leaves whole — nothing deleted, nothing moved — and comes back when it is pulled forward into an epic whose map is still open: its own, where it returns as it was, or another, where it opens as a fresh topic that reads the earlier record and never changes it.
_Avoid_: defer

**pull forward**:
Bringing a postponed topic back from the roadmap, through an epic's discovery row while that epic's map is open. Into its own epic, the topic returns as it was; into another epic, it opens as a fresh topic that reads the earlier record and never changes it.

**reopen**:
Opening an epic's decided topic again, from its discovery row until the spec is first written. A finished piece of work, of any type, is never reopened: it stays finished, and a later change to it is new work.

**in session**:
The cue on a topic another conversation is working right now, with how long ago it was last active; its row is struck through, and entering it asks first. Awareness only: it never locks anyone out. Code phases are different: a build and the review phase run one at a time in the project's checkout, and entering one while another session is building there names that session and asks before going on. A quick-fix is built in a worktree of its own and waits on neither.
_Avoid_: code session

**nested repo**:
A git repository of its own inside the project's folder that holds code: a clone. Found every time, never configured — except one inside a git-ignored folder that is not itself a repo, which is never found. A code commit lands in each one it touches, and every read of the change spans them all.
_Avoid_: child repo

**state branch**:
The branch of its own in the project's repository where Ledger keeps its records, checked out as a worktree of its own inside the main checkout and ignored by every code branch. Code branches and pull requests never carry it; every session writes the one copy, and each action commits what it wrote.
