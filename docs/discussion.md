# Discussion

A discussion is one topic, talked through with you until what the product does there is decided. A feature has one; an epic has one for each topic on its map. Claude takes part as a senior engineer and product partner: it brings evidence, challenges, pushes back, and looks for the edges the product's user would meet. Research is one of the conversation's tools, never a phase of its own: a deep dive to learn, a spike to see and feel, an [experiment](experiments.md) to measure. Nothing here plans or builds; code enters only as evidence.

Every question, finding and decision lands on the ledger, every answer you give among them. The topic's **record**, its current decisions, and its **map**, what is being decided and where each point stands, are views drawn from it. The topic's **log** keeps the journey.

## The opening

The topic starts from its brief, and for a feature the discovery logs and the seeds; the record of every topic decided so far, never their logs; the product record, with what discovery found of the product; each spike; and earlier work in the topic's area, searched in the [knowledge base](knowledge-base.md) each time the topic opens: an earlier decision that still holds is built on, and one that must change is replaced, never decided a second time beside it. A topic that waited on the roadmap, or a piece of work that moved here from another kind, also has the record it left in its first place, as input it never changes. Claude reads what the work needs of it.

Only a question on the map holds the topic's close, so a question the talk leaves open goes there.

What you settled on in discovery is working ground, never asked again; what the brief leaves open is still open. Settled ground moves when something here contradicts it, or when you reopen it yourself. A point the brief carries from the [record from before](discovery.md#what-you-bring-from-before) is not: it goes on the map as an open question, with the answer from before as Claude's lean, and always comes to you, however quiet its kind.

## The conversation

A discussion is a conversation, never a conveyor belt of decisions. The map tracks what is open but never sets the order: the talk follows where it goes, circles back, throws ideas around.

- **Your decision is yours.** Said in the talk, "your call" hands a point to Claude, and it is recorded as Claude's answer; "don't care" leaves it to whoever builds it. Said at a question Claude has put on screen, either is that question's "don't care": Claude's lean lands as Claude's decision. Neither is ever written as yours.
- **An answer that settles part of a question** puts the rest on the map as a question of its own.
- **A changed mind is a replacement, never an edit.** The new decision replaces the old with its cause named: a new fact, another topic's decision, the question a message raised, or simply that you changed your mind. Changing a decision of your own, or overruling a call Claude made, is yours to do at any time, and is recorded as yours; where the old answer was Claude's call or Claude's lean, it counts as a reversal in the [trust](trust.md) evidence. Claude never replaces a decision of yours itself: it asks. Everything that relied on the old answer is flagged.
- **A decision is never written twice.** A question a current decision already answers, another topic's or an earlier piece of work's, merges into it.
- **Nothing waits half-decided.** A question closes by your decision, Claude's call, don't care, a move to another topic, or a place on the roadmap.
- **Signing off with questions open is a pause**, never the end: the log is brought up to date and the topic waits for its next session.

### Facts and findings

A claim about the code, a number or the platform is checked before it is said. What is learnt lands as a finding saying how it is known: read in the code, documented with its source, seen in a spike, measured by an experiment, or exploratory, measured in the conversation without one, with the command and its result. A finding informs a question; only a decision closes one. A question the code or a run answers outright is closed by Claude, stating what was found.

### Claude's calls

A discussion is a conversation. Claude puts its view with its reasons, you say what you think, and what you settle between you is recorded as yours as it is said. Where you hand a point over, with "your call" or "go ahead and decide these", Claude decides it and it is recorded as Claude's, handed over by you.

A call Claude makes on its own, on a point you have not weighed in on, goes through the ask rule: whether it reaches you is decided from how often Claude's answers on calls of that kind would have cost the product, read from your verdicts, never by Claude's own confidence. A call that reaches you usually shows Claude's lean beside it, sealed before you answer; now and then one is asked blind, Claude's answer held back until you have given yours. One that does not is recorded on the ledger as Claude's, and shows first on the map the next time you look. A fact only you hold, such as a deadline or an outside constraint, is always asked. [Trust](trust.md) covers the rule.

### The map

Claude draws the map whenever you ask: your questions beside Claude's calls, the calls made since you last looked first, so you can overrule one when it is made rather than at the end. Ask "what have you decided without me?" and you get each call with the files behind it.

## Research

- **A deep dive** answers in the background what neither of you can answer from the room, when it is worth more than a lookup. Claude offers it, or you ask for one. It surveys how others do it, reads one file against the question, checks whether the platform can do it, maps what exists and what it costs, or holds a claim against sources. It measures nothing: a number a decision would rest on comes back as the measurement it would take. When it lands you hear what was asked, what came back in full, and what it opened.
- **A spike** is anything to look at or press that is never wired into the product: a design board, draft code, a format trial, a prototype to scroll and feel. Spikes are encouraged, because they settle what guessing would not. A spike is evidence only for what you reviewed in it. A design spike ends in a lock: "which design?" is a question on the map, closed by your choice.
- **An experiment** comes in when a number is about to bear a decision. Unless you asked for it, Claude offers it in the conversation first, with a quick measurement there as the alternative, since an experiment keeps the topic from closing until it reports or is abandoned; declined, that measurement stands in as an exploratory finding. Accepted, the question waits on the experiment, which you run now or later, and its result comes back as a measured finding ([experiments](experiments.md)).

Files, from spikes or shared by you, live with the work and are linked from the entry they inform, as **canonical**, which the specification carries and the build builds to, or **reference**, which a builder consults before re-solving anything it covers. You change a file's status in your own words, any time.

## Reviews

Once the conversation has got going, a background review reads the topic from its record and its log, never from the conversation, with a clean slate, and runs while you talk. It comes round again as the topic moves on: each further review waits until enough has changed since the last. Where a decision has two defensible ways and you stay unsettled, Claude offers **perspectives**: two agents each argue one side of the tension, and a third reconciles them, so you hear the tensions rather than two advocates.

Each finding of a review that the topic takes up becomes a question. Claude re-derives each from the record before acting on it: one a decision already answers merges into that decision; one the code or a run answers is answered from what was found; one that hides a real choice, a single defensible answer included, goes through the ask rule; one that belongs to another topic goes there as a message. No finding is cut for count.

The review is there to find the gaps while they are cheap to answer, so it hunts widely, for:

- **Coverage** — ground the topic set out to cover and has not touched, and the concerns beside it: security, error handling, scale, observability, migration, rollback.
- **Each decision** — its why, the alternatives weighed, the trade-offs it accepts, and whether it is surer than what it rests on. Never which option you chose.
- **Each decided mechanism, at its edges** — an empty or malformed input, a dependency that is down, a limit reached, the mechanism itself failing, a default nobody stated.
- **What nobody said** — an assumption nothing checked, an outside dependency never named, the question you should both be asking.

What counts as a finding follows how far the topic has come: early on the review offers things to pull on; once most is decided, it keeps what a spec built from the record would get wrong or stall on. A real decision about what the product does counts at any stage, however small. A nit, a preference or a mechanism the builder would settle is noted in the report and never raised. The review holds no finding back to spare you: the gaps get found, and the [ask rule](trust.md#the-ask-rule) decides which of them come to you.

## Other topics

A detail that informs a decision within this topic stays here: token refresh in an auth topic. A point whose home is another topic, such as the caching strategy that surfaces because tokens need caching, is that topic's to settle. It goes there as a **message**: what this topic found, the reasoning, and what the other is asked to decide. Claude never visits the other topic. The message waits in that topic's **mail**, and its next session raises it before anything else, a session already in the topic as it goes; a topic cannot close while mail waits. The menus show it as *mail waiting*.

A feature has no other topic. A point of its own that needs decisions of its own is offered as a pivot to an epic, and only your yes moves it; anything else goes on the roadmap or into the inbox. Talk that rises past the topic, to the epic as a whole or to the product, can move there on your word, into the epic's discovery or the product's conversation.

## Putting things off

- **Backlogging** — "roadmap it", "inbox it", "push it back": a question of this topic goes on the roadmap on a horizon you name, and closes; work no topic owns goes on the roadmap or into the inbox, as you say.
- **Postponing** — an epic's topic you want later, this one or another by name, goes to the roadmap whole and comes back when it is pulled forward. A feature's topic is the work itself, so its "not now" is a cancel.
- **Cancelling** — a topic not worth pursuing leaves active work, still listed on the epic's menu as the record that it was raised and declined. Any experiment still running under it is abandoned, and a message waiting for it goes to the inbox.

## Closing a topic

Tell Claude to decide what is left and it does: each lands as Claude's, handed over by you, and none comes back to you. After eight agreements in a row, Claude offers to settle the rest: how many points are open, how many it would settle, and which still come to you by the rule, by kind. On yes its points go on the ledger, yours come one at a time, and once each is answered the topic closes. Declined, the offer waits for the next run of agreements. Where it would settle none of the open points, no offer is made.

On your yes, your yes to settling the rest, or when you ask for it, the topic closes through a **closing pass** with two readers; each question still open is answered first. A fresh agent, unanchored by the conversation, reads the topic's entries and log against the other topics' records and the product record, looking for a question with no answer, a contradiction with another record, a replacement that does not hold up against what it replaced, and work the decision creates that no topic owns. Claude, who was in the conversation, checks that every decision made in it has its entry and that no two current answers contradict each other, and runs again each measurement a decision rests on. Anything the pass finds lands somewhere, and where it changed what the topic decides, another pass reads what changed, until one changes nothing.

Where no review has read the topic since its last decision, as on a quick topic whose background review never started, the fresh reader carries the gap review too: the same hunt as under [Reviews](#reviews), held to what a spec built from the record would get wrong or stall on.

The close also proposes what goes beyond the topic:

- **Product-record lines** — a decision here that is really a rule for the whole product, such as a principle you stated, is proposed as a line of the product record, which every later topic reads first. A line already in the record that should go is proposed for withdrawal.
- **Candidates** — work the decision creates that no topic owns, and that holds a call you would want to make. In an epic it is proposed as a new topic, with a brief; in a feature it is proposed for the roadmap, on a horizon you name.

An epic's topic then stops at its **decided** gate: what it decided, with the ledger in view, the product-record lines and the candidates, any of which you can strike or reword. Before the gate it asks a verdict on each call you changed: what Claude's answer would have cost, nothing, a fix later, or a real loss. Your yes marks the topic decided and returns you to the epic's menu. A feature's topic has no gate of its own: what it decided is shown with the specification at [ready to build](specification.md#ready-to-build), and that yes takes both.

## When a decided topic comes back

A decided topic stays decided until something it relies on moves. When a decision it relied on is replaced, in another topic, at the specification or in the build, the entries resting on it, but the replacement's own cause, are flagged as **affected**, and the topic shows among what waits on you, as "a decision it relies on changed". Entering it then is for those entries alone: each is confirmed as still holding, or replaced, and the topic stays decided. A message sent to a decided topic reopens it instead, and it closes again through a fresh pass.

## The log

The topic's log, `topics/{topic}/log.md`, is its journey: the options weighed, the false paths, the reversals, your thinking and why minds changed. It is written as the conversation goes, appended and never rewritten, enough for a fresh session to carry on alone, and it points at entries by their short ids rather than restating them. [How it fits together](how-it-fits-together.md#the-record-and-the-logs) says how a log names the conversations that wrote it.
