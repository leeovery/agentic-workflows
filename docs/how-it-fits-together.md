# How it fits together

The system is built from three layers with a strict division of labour, and almost everything about how it behaves falls out of keeping them separate.

The first layer is the **skills** — the markdown instruction files the assistant follows step by step. They own the conversation, the judgment, and the prose documents you read and approve. They never work out the state of your project for themselves. The second is [the engine](engine.md), the deterministic core beneath them that owns everything fully determined by data: the record of your work, the transitions between phases, and the computed displays. Anything that can be calculated is calculated there and handed up, never reconstructed in prose. The third is [the knowledge base](knowledge-base.md), sitting alongside the others as retrieval over completed work, so any phase can pull in what a sibling or a predecessor already settled.

The consequence is blunt and worth holding onto: the assistant decides *what to do*; the engine decides *what is true*. When a skill needs to know where an epic stands, it asks the engine and reads back a structured answer. It does not rummage through your files and form an opinion.

## The skill tiers

The skills are organised into tiers, each with a narrow role, so that a given moment in a session is always handled by the piece built for it.

| Tier | Its job |
|---|---|
| **Entry** | The single thing you type — `/workflow-start`. It boots the system, shows you all your work, and routes you everywhere else. |
| **First phase** | Discovery. Shapes brand-new work, settles its type, and persists it. |
| **Navigation** | The per-type dashboards. They show a work unit's current state and route you to whichever phase comes next. |
| **Phase entry** | Thin intake coordinators. They validate that a phase can start, gather its opening context, and hand off — without ever engaging the subject matter. |
| **Processing** | The phases themselves, where the actual work happens: the conversations, the documents, the loops. |
| **Bridge** | The clean hand-off between one phase and the next. |
| **Capture** | Lightweight [inbox logging](capture-and-inbox.md), sitting outside the pipeline entirely. |
| **Shared** | Protocols loaded by many skills at once — conventions, self-checks, break detection — so they behave identically wherever they apply. |

Two disciplines run through every skill regardless of tier. The first is that a skill produces no chatter — no "proceeding with…", no narration of its own reasoning; its first output is content the instructions explicitly call for. The second is the stop-gate contract described in [the collaboration model](collaboration.md): after presenting a decision to you, the turn ends, and no background directive can talk the system past it. Only your own explicit choice to hand a gate over can skip it.

## A single action, travelling down through the layers

Following one action shows how the layers cooperate. You type `/workflow-start`. The entry skill boots the system — bringing any older project structure up to date and confirming the memory is ready — then asks the engine for a snapshot of all your work and shows it to you. That snapshot is computed, not remembered, which is why the same state always looks the same.

If you start something new, you are routed into discovery, where the work is shaped in conversation and, at the moment you confirm it, written to disk in a single transaction. If you pick up existing work, you are routed into that work type's dashboard instead. Either way you end up inside a **processing** skill, doing the real work of a phase.

When that phase concludes, it does not simply roll into the next one in the same conversation. It goes through the bridge.

## The bridge, and why phases start fresh

Context is a consumable. A phase's conversation fills the working window with detail the next phase does not need — the whole back-and-forth of a discussion is not something a specification should have to wade through. So each phase concludes by handing off cleanly: it works out what comes next, writes that hand-off down where it will survive a context refresh, and lets you start the next phase in a fresh, uncluttered context. Because the hand-off lives in your files and the durable record rather than in conversation memory, it survives even if the session is compacted or killed between phases. The next phase does not re-interview you; its thin entry skill picks up the context that was prepared for it — the description, the discovery notes, an epic topic's [brief](discovery.md) — and gets to work. Its job is preparation, not processing.

For an epic there is no single "next phase," so the hand-off returns you to the epic's dashboard to choose your next move. That dashboard is rendered from one computed snapshot, organised into the three stages of [the work's life](work-types.md) — Discovery, Definition, Delivery — with each topic shown under the phase it currently occupies, and markers noting which move is recommended next and which are blocked by unfinished dependencies. Before it draws, the navigation layer quietly runs its housekeeping: the self-healing analyses that re-read completed work and can surface topics you had not thought to add.

## Where everything lives

All of it lands as ordinary files in your repository, versioned alongside your code. Each work unit gets its own folder, and within it each phase writes its documents in a predictable place — the discovery session logs and topic briefs, the research and discussion files, the investigation, the specification, the plan, the implementation record, the review report — beside the promoted note the work grew from and the reference material it pulled in. Because everything is committed as it goes, with plain, conventional messages, your git history doubles as the workflow's own journal. That is not incidental: the recovery behaviour built into every phase leans on it. When a session needs to work out where it was, it re-reads its instructions, reads the files, and checks the history — because the files and the history are authoritative, and recollection is not.
