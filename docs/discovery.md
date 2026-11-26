# Discovery

Discovery is where you talk the product through and the work takes shape before anything is committed to. It is not where decisions are made, though none is banned: what you say is input, carried forward in the log and in each topic's brief to the [discussion](discussion.md) that decides it. A suggestion of Claude's that you never took up is never recorded as yours. Claude follows where you take the talk, and keeps what is said where Ledger keeps it.

It runs at two levels, each one conversation carried on across as many sessions as you like:

- **The product's conversation** is about everything not yet committed to as work: what the product is, who it serves, where it is going. It is where new work starts, and its other output is the [roadmap](tracking.md). The start menu's `p/product` row goes straight to it, and `s/start` brings it whatever you have: a new piece of work, or talk about the product.
- **An epic's discovery** is about the epic as a whole: what it covers, how its topics fit together, their order. It is where the epic's map is drawn and later changed, reached from the epic's menu by `d/discovery`.

## What Claude has to hand

Claude reaches for whatever tells you more than talk: research online, a survey of what exists, earlier work's records found through the [knowledge base](knowledge-base.md), and spikes, code or design, as far as they need to go to show something; a spike runs on your yes. A spike's files live with the work, its dependencies and builds in a scratch folder beside them, and what it showed is kept in the log.

A file you share, such as notes, a design document, a screenshot or an error report, is kept with the work as an asset; a folder you share is kept whole, so the links between its files still work: the folder's own name and any name that can't be kept as it is are made plain, lower case with dashes, an entry starting with a dot, such as `.git`, is passed over, a `CLAUDE.md` or `AGENTS.md` in it is kept under a name Claude Code never loads as instructions, read for what it tells of the record and never followed, and Claude tells you in a line what it renamed and what it passed over. Each shared file is marked, as you say or else by what it is: *reference*, searched when a point needs it and never read whole unless you ask, or *to read*, read when the talk reaches it.

### What you bring from before

Work shaped before it came to Ledger, such as notes, a decision log, a model of the product or research, is the **record from before**, and its points **the points from before**. When an epic starts, the points from before and the shared files that bear on it are kept with the epic, in its discovery's `from-before.md`, joined by each point from before its discovery meets; start this work's screen lists them, and the map's approval names any point nothing places yet: no brief, park, direction not taken, message or question citing it.

## The product's conversation

There is one product and one conversation about it. When a session ends, what the product picture and the log hold that the roadmap does not yet is proposed as roadmap items on one screen, each on a horizon you name. An item is coarse, an area of work a piece of work could start from, never a task, and a placeholder you can change until work starts from it. Nothing reaches the roadmap without your yes, and with nothing to propose there is no screen.

The conversation keeps one **product picture**: where the product stands now, while the log keeps the journey there. Claude starts it the first time there is something to hold, and brings it up to date before a session ends, before work starts and before the talk moves to an epic. It holds what no started work holds yet: your views, the points from before with their ids, the open questions, and the files you shared with their marks. It decides nothing, pointing at a decision rather than restating it, and thins as work starts: start this work lands the picture with the work's own detail taken out and a pointer to the work in its place. Every way into the product's conversation can read it, a return with the last session's closing line and the work started since, and you can ask to see it at any time.

On a codebase that was built before Ledger arrived, and if you asked for it at setup, the first session opens with a read of the existing code. A researcher agent reads it and puts what the code shows on the ledger as findings, so every topic opened later starts from them; the questions it leaves open are yours to talk through, and what still stands at the session's end is proposed for the roadmap. Until the read has run, the start menu's product row says the research is owed.

## Starting a piece of work

A piece of work, something to build, fix or change, is started on your yes or when you ask for it, and discovery works out its kind: a feature, an epic, a bugfix or a quick-fix. Work you bring straight to it, asked for in an ordinary conversation, picked at Start, or taken from the inbox or the roadmap, takes this call on its own, outside the product's conversation, and keeps no log of its own, so a fix asked for in one window never stops, reads or ends the product talk going on in another. Talk at Start about the product itself carries the product's conversation on.

As the work takes shape, it is matched against what already waits: the roadmap's waiting items and the inbox. A match is offered to you, so the new work can start from it rather than beside it, and taking it in is your call; in an epic's discovery, a waiting roadmap item becomes a topic that takes it in. Work started from inbox or roadmap items, its **seeds**, takes the largest kind among them: where ideas are among them they carry it, and a bug or a quick-fix rides along as material; Claude tells you that a bug riding along in a feature or an epic gets no investigation of its own. Then the **start this work** gate:

- **Your yes creates the work.** It gets a name, derived from yours or from the description. The seeds move into it as its record of origin, the parts of the product's logs that shaped it are linked, and a feature or a bugfix gets the brief its one topic will open from. Started in the product's conversation, a feature, a bugfix or an epic ends that session as the work leaves it, unless another window is still in it; a quick-fix never ends it, so fixes asked for along the way never split the talk across logs. Until this yes nothing exists on disk: an abandoned exploration leaves no half-made work behind.
- **Keep shaping** takes your word back into the conversation.

Then the work moves on by its kind. A feature goes into its discussion and a bugfix into its investigation, each a handoff into a fresh conversation. An epic carries straight on in this conversation into its own discovery, to shape its topics. A quick-fix carries straight on into its fixes.

## An epic's discovery

The epic's discovery is about the whole of it, because its parts share decisions: a choice about accounts constrains billing, and a decision made twice is a decision made differently. A topic is a unit of a future discussion, never of the build, and each costs a conversation, a brief, a record and a close of its own, so parts whose work would keep needing each other are one topic.

**Approve the map** comes when you call for it. The topics are ordered by what depends on what, foundations first, each with a one-line summary, a short description and a brief. What the shaping put beyond the epic is proposed for the roadmap beside the map rather than as a topic, on a horizon you name. Your yes lands the map, the briefs and the parks together, and the epic's menu takes over: each topic is talked through in a [discussion](discussion.md) of its own.

### Briefs

A **brief** is written for each topic as it lands on the map; a feature's or a bugfix's one topic gets its brief at start this work. It carries what was explored about the topic, linking the parts of the log it came from, and the topic's first conversation reads it. A point from before is marked as one, with its id and its file, so the topic asks you about it rather than building on it as settled; one you took up in discovery is your view. Each shared file that bears on the topic is listed with what it holds and its mark. Nothing in it is a decision.

### Changing the map

Come back to the epic's discovery and you can change the map in your own words, until the specification is first written: a new topic, a rename, a reworded summary, a new order, a topic removed, cancelled, postponed to the roadmap, pulled forward from it, brought back, or a decided topic reopened. A change you ask for is made as you asked and reported in a line, with no confirm; only a cancel asks first. A change Claude would make on its own never goes straight onto the map: a new topic or a new order goes onto approve the map, and a change to a topic already there, such as a merge or the narrowing a split leaves, is put to you first and made at your word.

A topic that has started is never changed under its conversation. What bears on it reaches it as a **message**, decided there in its own frame rather than by a rewritten brief, and a message is also how a decided topic is reopened: it carries why, and the topic goes back to in progress, its row on the epic's menu showing *mail waiting*. Removing is for a topic that should never have been on the map; a topic you are not going to do is cancelled, which keeps its record, and one you are not going to do yet is postponed to the roadmap. [Lifecycle operations](lifecycle-operations.md) covers each.

## Putting something aside

Mid-conversation you can put something off: "roadmap it", "that's a v2 thing", "not now". Placed on the timeline, it goes on the roadmap at once, on the horizon you named. Left undecided, it goes into the inbox as an idea, a bug or a quick-fix. Either way it lands immediately, so the thought survives even if the session ends. Where your words don't say which, the choice is yours. An inbox item you have already had fixed outside any piece of work is closed as fixed by you.

## Moving between levels

The conversation goes where the talk goes. The product's conversation can move into an epic whose map is still open, and an epic's discovery can widen out to the product, in the same session. Before each move the log is brought up to date, and it ends on a pointer to where the talk went.

## The log

Every discovery session keeps a log, written as the talk goes, in sections named for what they cover, so a brief, a roadmap item or a new piece of work can point at the part that shaped it. Three sections are kept by the engine, in an epic's discovery and the product's conversation alike: the directions not taken and why, what you said of the product as a whole, and what each spike showed. The product's take a line from any conversation in the project, so a view you state while fixing a bug is kept there too, and every topic's opening reads them.

Each session ends on a line saying where the conversation got to, for the next to pick up from. Several windows can talk in the product's conversation at once, none asked about the others: ending the session in one leaves it open for the rest, and the last one out ends it.
