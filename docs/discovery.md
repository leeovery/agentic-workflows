# Discovery

Discovery is where you talk the product through and the work takes shape before anything is committed to. Nothing is decided here. What you say is input: your leans, the paths you rejected and why, the questions still open. It is carried forward in the log and in each topic's brief, to the [discussion](discussion.md) that decides it.

It runs at two levels, each one conversation carried on across as many sessions as you like:

- **The product's conversation** is about everything not yet committed to as work: what the product is, who it serves, where it is going, what the market showed. It is where new work starts, and its other output is the [roadmap](tracking.md). The start menu's `p/product` row carries it on, and `s/start` brings it a new piece of work.
- **An epic's discovery** is about the epic as a whole: what it covers, how its topics fit together, their order. It is where the epic's map is drawn and later changed, reached from the epic's menu by `d/discovery`.

## The conversation

Claude takes part as a senior engineer and product partner. The stance is two engineers throwing an idea around: opinionated, willing to disagree, ready to offer a sharper framing, pushing where it matters. Who the user is at each point, the flows, the surfaces nobody named, the edges between parts, what breaks if a position you take is wrong. It follows you as deep as you go, into designs and draft code, or stays high level where you keep it, one thread at a time, with no barrage of questions.

Where seeing or running something would tell more than talk, such as a provider whose behaviour is in doubt, a risk the whole idea rests on, or how a flow feels, Claude suggests a spike in a line, and your yes runs it. Research online, surveys of what exists and earlier work's records found through the [knowledge base](knowledge-base.md) feed the conversation the same way, logged with their sources. A file you share, such as notes, a design document, a screenshot or an error report, is kept with the work as an asset; a folder you share is kept whole, its files and their names as they were, so the links between them still work; a `CLAUDE.md` or `AGENTS.md` in it is kept under a name Claude Code never loads as instructions. One you share for reference, or one Claude judges is, such as a transcript, a raw export or a long chat log, is a **reference file**: Claude says in a line that it took it that way, lists it with a line on what it holds where a later session finds it, in the product picture or an epic's log, as it does each file still to read, and carries it to each brief it bears on, and searches it when a point needs it rather than reading it whole, and you can have it read properly at any time. A file read is read when the talk needs it, the ones that carry the shape at once and the rest as the conversation reaches their area, so research is never read whole as it lands. A file shared with something to look for, such as "check it for decisions on pricing", is read for that, then kept as reference. The same holds wherever you share a file.

Discovery is never rushed. When the talk converges, circling back and confirming rather than breaking new ground, Claude says once, in passing, that the work can move on whenever you want, and keeps exploring.

### What you bring from before

Work shaped before it came to Ledger, such as notes, a decision log, a model of the product or research, comes in as the **record from before**, and its points as **the points from before**: where you had got to, cited by its own ids and files, its own open questions still open. A point of it becomes your view only once you take it up in the conversation, restating it, changing it or dropping it; one you drop goes to the directions not taken, with why. Taken up or not, it is carried through: each topic's brief carries the points from before that bear on it, marked as such, and the topic's discussion puts each on its map as an open question, with the answer from before as Claude's lean, so most are a quick yes. When an epic starts, however it was started, the points from before and the shared files that bear on it are kept with the epic, in its discovery's `from-before.md`, for its discovery to read, joined by each point from before its discovery meets; start this work's screen lists them, its first session tells you in a line or a short list what came across, each point by its id, and the map's approval names any point nothing places yet: no brief, park, direction not taken, message or question citing it. A quick-fix's are put to you as it starts.

## The product's conversation

There is one product and one conversation about it. Capabilities come at the grain you would move around a real roadmap, each one thing you could start on its own. Staging you voice in your own words, "for launch we just need", "once we have revenue", becomes the roadmap's horizons, which are always yours.

When a session ends, the capabilities it named that are not on the roadmap yet are proposed as roadmap items on one screen, each on a horizon you name. Nothing reaches the roadmap without your yes, and with nothing to propose there is no screen.

The conversation keeps one **product picture**: where the product stands now, rewritten in place as the talk moves on and never appended to, while the log keeps the journey there. Each point in it is your view, linked to where you said it; a point from before, with its id and file; an open question, with the leans on it; or, once a discussion has decided it, a pointer to the product record. A section of its own lists the shared files not read in full. It decides nothing and holds the product's level, what no started work holds yet, and it thins as work starts: a piece of work's own detail goes to the work through its brief, and the picture points there. Every way into the product's conversation reads it, a return with the last session's closing line and the work started since, Claude re-reads it after a compaction, briefs are drafted from it, and you can ask to see it at any time. A record from before's model of the product becomes its first version.

On a codebase that was built before Ledger arrived, and if you asked for it at setup, the first session opens with a read of the existing code. A researcher agent reads it and puts what the code shows on the ledger as findings, so every topic opened later starts from them; the questions it leaves open, such as the intent behind a choice or what a name means, are yours to talk through, and what still stands at the session's end is proposed for the roadmap. Until the read has run, the start menu's product row says the research is owed.

## Starting a piece of work

When the talk settles on a piece of work, something to build, fix or change, discovery works out its kind. Settling the kind is the last step of shaping it, never a reason to cut the shaping short. Until it is read, Claude describes the work in plain words, "several connected things", "something broken we're fixing", never by a kind's name.

Work you bring straight to it, asked for in an ordinary conversation, picked at Start, or taken from the inbox or the roadmap, takes this call on its own, outside the product's conversation: it reads the roadmap, the inbox and earlier work, and of the product's sessions only the parts a roadmap item it starts from points at, and keeps no log of its own. So a fix asked for in one window never stops, reads or ends the product talk going on in another. Talk at Start about the product itself carries the product's conversation on.

As the work takes shape, it is matched against what already waits: the roadmap's items and the inbox. A match earns one question offering to take the item in, so the new work starts from it rather than beside it; a miss earns silence. Work you started from inbox or roadmap items, its **seeds**, opens on one sketch across them all. The largest kind among them decides the shape: where ideas are among them they carry it, and a bug or a quick-fix rides along as material, never enlarging it. A bug riding into a feature or an epic is named in the read, since it skips the investigation it would have had as a bugfix.

When the signals agree and have held, and the next question would only go deeper, Claude says its read, the kind and the signals that drove it, concretely enough that you can challenge one. Then the **start this work** gate:

- **Your yes creates the work.** It gets a name, derived from yours or from the description, never asked. The seeds move into it as its record of origin, the parts of the product's logs that shaped it are linked, and a feature or a bugfix gets the brief its one topic will open from. Started in the product's conversation, a feature, a bugfix or an epic ends that session as the work leaves it, unless another window is still in it, as a window in the middle of a quick-fix is; a quick-fix never ends it, so fixes asked for along the way never split the talk across logs. Started on its own, any work leaves the product's conversation as it was. Until this yes nothing exists on disk: an abandoned exploration leaves no half-made work behind.
- **Keep shaping** takes your word back into the conversation.

Then the work moves on by its kind. A feature goes into its discussion and a bugfix into its investigation, each a handoff into a fresh conversation. An epic carries straight on in this conversation into its own discovery, to shape its topics. A quick-fix carries straight on into its fixes.

## An epic's discovery

The epic's discovery is about the whole of it, because its parts share decisions: a choice about accounts constrains billing, and a decision made twice is a decision made differently. It looks at each topic's subject from outside that topic's frame, and at spikes across the epic. Topics are never named while the conversation explores; naming them early would tunnel the talk onto one before the whole shape is clear.

**Approve the map** comes when you call for it. The topics are drawn from the whole of what was explored, the log, the conversation and the map as it stands, never from the order things were said. A topic is the unit of a future discussion, never of the build, and the map need not be exhaustive: it grows as the work goes. The topics are ordered by what depends on what, foundations first. Each carries a one-line summary in the product's terms, a short description of what it covers and why it surfaced, and a brief. What the shaping put beyond the epic, because you placed it later or the log reads that way, is proposed for the roadmap beside the map rather than as a topic, on a horizon you name. A bug or a quick-fix the epic started with is never a topic: it is material for the topics it bears on.

Your yes lands the map, the briefs and the parks together, and the epic's menu takes over: each topic is talked through in a [discussion](discussion.md) of its own.

### Briefs

A **brief** is a short view written for each topic as it lands on the map; a feature's or a bugfix's one topic gets its brief at start this work. It carries what was explored about the topic: your leans, the paths rejected and why, the open questions, the detail explored and what a spike showed, each point linking the part of the log it came from. Nothing in it is a decision, and it is not a list of what you will be asked. The topic's first conversation reads it in full.

Briefs are why a wide conversation is not wasted on a narrow one. The rejected paths especially, with their reasons, mean a discussion inherits the thinking instead of re-deriving it and walking the same dead ends.

### Changing the map

Come back to the epic's discovery and you can change the map in your own words, until the specification is first written: a new topic, a rename, a reworded summary, a new order, a topic removed, cancelled, postponed to the roadmap, pulled forward from it, brought back, or a decided topic reopened. A change you ask for is made as you asked and reported in a line, with no confirm; only a cancel asks first. A change Claude would make on its own, such as a topic split, merged or reordered beyond what you asked, goes onto approve the map instead, never straight onto the map.

A topic that has started is never changed under its conversation. What bears on it reaches it as a **message**, decided there in its own frame rather than by a rewritten brief, and a message is also how a decided topic is reopened: it carries why, and the topic goes back to in progress, its row on the epic's menu showing *mail waiting*. Removing is for a topic that should never have been on the map; a topic you are not going to do is cancelled, which keeps its record, and one you are not going to do yet is postponed to the roadmap. [Lifecycle operations](lifecycle-operations.md) covers each.

## Putting something aside

Mid-conversation you can put something off: "roadmap it", "that's a v2 thing", "not now". A tangent that does not fit what is taking shape gets the same offer. Placed on the timeline, it goes on the roadmap at once, on the horizon you named. Left undecided, it goes into the inbox as an idea, a bug or a quick-fix. Where your words don't say which, Claude asks, and never chooses; where you name no horizon, you pick one. Either way it lands immediately, so the thought survives even if the session ends.

## Moving between levels

The conversation goes where the talk goes. The product's conversation can move into an epic whose map is still open, and an epic's discovery can widen out to the product, in the same session. Claude says so in a line and brings the log up to date before it moves.

## The log

Every discovery session keeps a log, and nothing talked about is lost. It holds what was explored at whatever depth, your leans, the false paths and why they were dropped, the open questions, the research with its sources, and a link to every spike and file. It is written in sections named for what they cover, so a brief, a roadmap item or a new piece of work can point at the part that shaped it. Three sections are kept by the engine, in an epic's discovery and the product's conversation alike: the directions not taken and why, what you said of the product as a whole, and what each spike showed. The product's take a line from any conversation in the project, so a view you state while fixing a bug is kept there too, and every topic's opening reads them.

Each session ends on a line saying where the conversation got to, and the next session opens on it: a short account of the threads it was circling, your leans and what was left open, then a question about where you want to take it. A return to an epic's discovery reads the two latest sessions that hold talk, so a session opened and left with nothing said never pushes the real talk out of it; the product's conversation reads its picture and the last closed session's closing line instead, and a session left open that it carries on in full, or the two latest sessions until its picture is first written. Several windows can talk in the product's conversation at once, none asked about the others: ending the session in one leaves it open for the rest, and the last one out ends it.
