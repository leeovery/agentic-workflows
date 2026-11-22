# How it fits together

Ledger is built from a few parts with a strict division of labour, and most of how it behaves falls out of keeping them apart.

The **skills** are the instructions Claude follows: one for the start, one for discovery, one for each phase after it, one that keeps what is said in any conversation where it belongs, and one for the roadmap. They own the conversation and the judgement: what to ask, what to argue, what a finding means, how to word a brief. They never work out the state of your project for themselves. [The engine](engine.md) beneath them owns everything fully determined by data: the ledger and the manifests, every transition between phases, every menu and screen, and the briefs that agents are given. When a skill needs to know where an epic stands, it asks the engine and reads back an answer; it does not rummage through your files and form an opinion. The **agents** are fresh, narrow helpers Claude dispatches for one job each, a builder for one task, a reviewer for one review, a writer for the specification, each working from a brief the engine issues rather than from the conversation; [the agents](agents.md) lists them. The [knowledge base](knowledge-base.md) sits beside all of them as search over what earlier work decided.

The blunt version: Claude decides *what to do*; the engine decides *what is true*.

## One action, travelling down

You type `/ledger`. The start skill runs the engine's boot first, which brings an older project's records up to date, checks what the setup still needs, and decides where the start goes. The bare command opens the start menu, drawn by the engine from your records, so the same state always looks the same. Words, typed after the command or asked of Claude mid-conversation, go straight to the work they name: a new piece of work into discovery, an existing one to where it stands, a short pick where they could name several.

Pick a piece of work and Ledger hands it off to the skill for the phase it is in. That skill enters the phase through the engine, which checks the move is allowed, marks the topic as in session, and answers with what to read: the brief, the topic's record, the log, any mail waiting. Claude reads them, then opens the conversation. As it goes, every question, finding and decision is written through the engine onto the ledger, and every change is committed as it is made. When the phase ends at its gate, your yes is recorded by the engine, and the engine says where the work goes next.

## Handoffs and fresh conversations

A phase's conversation fills the working window with detail the next phase does not need: the whole back-and-forth of a discussion is not something the build should wade through. So each move into a phase is a handoff. Where the [Claude Code mod](configuration.md) runs, it clears the conversation and starts the next phase in a fresh one, with nothing to approve and nothing to type. Nothing crosses but the name of the next step: everything that step needs is already in the records, which is also why a session compacted or killed between phases loses nothing. Where the mod cannot run, the next phase carries on in the same conversation.

Picking work on the start menu or an epic's menu hands off the same way, so the menu's weight never rides into the work. An epic has no single next phase, so a topic's decided gate returns you to the epic's menu, where you choose the next move. A few moves stay in one conversation by design: the build runs straight into the review phase, a quick-fix runs from its first fix to its close and then the conversation carries on, and discovery carries a new epic straight on into shaping its topics and a new quick-fix straight into its fixes.

## The record and the logs

Two kinds of thing are written as the work goes, and they are kept apart on purpose.

The **ledger** is where every entry is written: one file for the project, `.ledger/.ledger.jsonl`, one entry a line, every question, finding and decision by either side. It only ever grows. A topic's **record** is a view drawn from it, the topic's current decisions with their reasons and what they rule out, the answers they replaced folded beneath them; a topic's **map** is another, what is being decided and where each point stands. Later phases, the knowledge base and every screen read the record, never a conversation.

A **log** is the journey: the options weighed, the false paths and why they were dropped, the reversals and what changed a mind. Discovery keeps one per session, each topic keeps one across its sessions, and the build keeps one for itself. A log is appended and never rewritten, and points at ledger entries by their short ids rather than restating them.

A conversation's log, a discovery session's or a topic's, names the conversations that wrote it: a line with the date, the conversation's session id and the path of its transcript, added when a conversation first writes to the log and again whenever it writes after another conversation has, so the log's last such line always names its last writer. The log is the record of the journey; the transcript is a backstop, there for as long as Claude Code keeps it. Ledger never sets, recommends or asks how long that is.

## Where everything lives

Ledger keeps its records in `.ledger/`, in your repository but on a branch of its own, `ledger-state`, checked out as a worktree inside the project's main checkout and ignored by every code branch. Code branches and pull requests never carry it, every session writes the one copy, and each action commits what it wrote. [State and git](state-and-git.md) covers the branch, pushing it, and working from a second machine.

Each piece of work gets a folder of its own, `.ledger/{work-unit}/`, holding its manifest; its discovery session logs; a folder for each topic with its brief, its log, its experiments and its mail; the one specification; the build's log, notes and task reports; the review phase's rounds; the inbox items it started from; and the files shared with it. Above the pieces of work sit the inbox, `.ledger/.inbox/`, and the product's own conversation, `.ledger/.product/`, with its session logs, the roadmap items' notes and the files shared with it. The roadmap and the registry of work live in the project manifest, `.ledger/manifest.json`.

Two folders stay out of git. `.ledger/.cache/` holds the scratch each session keeps so an interrupted one can pick up, and the marks that say which session is working where; nothing in it is the record. `.ledger/.knowledge/` holds the knowledge base's store, rebuilt from the ledger in each copy of the project.

## Working in parallel

You can have several sessions open on one project. For the talking phases that is a good way to work: one session discussing one topic while another talks through a second. Ledger keeps them aware of each other without locking anyone out. A session working a topic leaves a mark on it, and an epic's menu shows a topic another session holds as *in session*, with how long ago it was last active, struck through so you don't pick it by accident. You still can: entering it asks first. The product's conversation is the exception: several sessions talk in it at once, and none is asked about the others.

Code is different. The build runs its tasks side by side, each in a git worktree of its own, and merges them back. But a build and the review phase take turns in the project's checkout, whichever piece of work each belongs to: entering one while another session holds the code names that session and asks before going on. A quick-fix is built in a worktree of its own, so it waits on neither, and your checkout never moves while it is built; its close brings your checkout up where you have out the branch it lands on.

Where the mod runs, a board beside the conversation shows what is happening now, such as the build's tasks, a topic's map or the questions waiting, without reprinting it into the transcript.
