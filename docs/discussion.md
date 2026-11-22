# Discussion

A discussion is one topic, talked through with you until what the product does there is decided. A feature has one; an epic has one for each topic on its map. Claude takes part as a senior engineer and product partner: it brings evidence, challenges, pushes back, and looks for the edges the product's user would meet. Research is one of the conversation's tools, never a phase of its own: a deep dive to learn, a spike to see and feel, an [experiment](experiments.md) to measure. Nothing here plans or builds; code enters only as evidence.

Every question, finding and decision lands on the ledger as it is made. The topic's **record**, its current decisions, and its **map**, what is being decided and where each point stands, are views drawn from it. The topic's **log** keeps the journey.

## The opening

Before it says anything, Claude reads what the topic starts from: its brief, and for a feature the discovery logs and the seeds; the record of every topic decided so far, never their logs; the product record, with what discovery found of the product; each spike; and earlier work in the topic's area, from the [knowledge base](knowledge-base.md). A topic that waited on the roadmap, or a piece of work that moved here from another kind, also reads what it left from before, as input it never changes.

The opening fits the topic: the shape of what has been said, a perspective from the brief or beyond it, what earlier decisions already settle and where from, and the open questions, with Claude's lean on any where a logical one exists. Each open question it names goes on the map. The opening decides nothing.

What you settled on in discovery is working ground, never asked again. It moves when something here contradicts it, or when you reopen it yourself. A point the brief carries from the [record from before](discovery.md#what-you-bring-from-before) is not: it goes on the map as an open question like any other, with the answer from before as Claude's lean.

## The conversation

A discussion is a conversation, never a conveyor belt of decisions. The map tracks what is open but never sets the order: the talk follows where it goes, circles back, throws ideas around.

- **Your decision is yours.** "Your call" hands a point to Claude, and it is recorded as Claude's answer; "don't care" leaves it to whoever builds it. Neither is ever written as yours.
- **An answer that settles part of a question** puts the rest on the map as a question of its own.
- **A changed mind is a replacement, never an edit.** The new decision replaces the old with its cause named: a new fact, another topic's decision, the question a message raised, or simply that you changed your mind. Everything that relied on the old answer is flagged.
- **A decision is never written twice.** A question another topic's current decision already answers merges into it.
- **Nothing waits half-decided.** A question closes by your decision, Claude's call, don't care, a move to another topic, or a place on the roadmap.
- **Signing off with questions open is a pause**, never the end: the log is brought up to date and the topic waits for its next session.

### Facts and findings

A claim about the code, a number or the platform is checked before it is said. What is learnt lands as a finding saying how it is known: read in the code, documented with its source, seen in a spike, measured by an experiment, or exploratory, measured in the conversation without one, with the command and its result. A finding informs a question; only a decision closes one.

### Claude's calls

Until the topic's shape is agreed, what it covers and how it broadly works, Claude makes no call of intent or taste on it alone. Where several ways are open it puts ideas forward and asks what you think; where one way is clear it sets out how it sees it working and invites you to pull it apart.

Once the shape is agreed, Claude fills in the rest. A call it leans on goes on the map as a question and is raised at a natural pause; whether it reaches you is decided by the ask rule, from how often Claude's answers on calls of that kind would have cost the product, read from your verdicts, never by Claude's own confidence. A call that reaches you usually shows Claude's lean beside it, sealed before you answer; now and then one is asked blind, Claude's answer held back until you have given yours. One that does not is recorded on the ledger as Claude's, and shows first on the map the next time you look. A fact only you hold, such as a deadline or an outside constraint, is always asked. [Trust](trust.md) covers the rule.

### The map

Claude draws the map at natural pauses and whenever you ask: your questions beside Claude's calls, the calls made since you last looked first, so you can overrule one when it is made rather than at the end. Ask "what have you decided without me?" and you get each call with the files behind it.

## Research

- **A deep dive** answers in the background what neither of you can answer from the room, when it is worth more than a lookup. Claude offers it, or you ask for one. It surveys how others do it, reads one file against the question, checks whether the platform can do it, maps what exists and what it costs, or holds a claim against sources. It measures nothing: a number a decision would rest on comes back as the measurement it would take. When it lands you hear what was asked, what came back in full, and what it opened.
- **A spike** is anything to look at or press that is never wired into the product: a design board, draft code, a format trial, a prototype to scroll and feel. Spikes are encouraged, because they settle what guessing would not. A spike is evidence only for what you reviewed in it. A design spike ends in a lock: "which design?" is a question on the map, closed by your choice.
- **An experiment** comes in when a number is about to bear a decision. Claude offers it in the conversation with what a dependable answer would take off the table; declined, a quick measurement in the conversation stands in as an exploratory finding. Accepted, the question waits on the experiment, which you run now or later, and its result comes back as a measured finding ([experiments](experiments.md)).

Files, from spikes or shared by you, live with the work and are linked from the entry they inform, as **canonical**, which the specification carries and the build builds to, or **reference**, which a builder consults before re-solving anything it covers. You change a file's status in your own words, any time.

## Reviews

Once the conversation has got going, a background review reads the topic from its record, never from the conversation, with a clean slate, and runs while you talk. Where a decision has two defensible ways and you stay unsettled, Claude offers **perspectives**: two agents each argue one side of the tension, and a third reconciles them, so you hear the tensions rather than two advocates.

What a review finds is taken at a natural pause, never jumped to, and each finding becomes a question. Claude re-derives each from the record before acting on it: one the record or a fact settles is answered; one that hides a real choice goes through the ask rule; one that belongs to another topic goes there as a message. No finding is cut for count.

## Other topics

A detail that informs a decision within this topic stays here: token refresh in an auth topic. A point whose home is another topic, such as the caching strategy that surfaces because tokens need caching, is that topic's to settle. It goes there as a **message**: what this topic found, the reasoning, and what the other is asked to decide. Claude never visits the other topic. The message waits in that topic's **mail**, and its next session raises it before anything else; a topic cannot close while mail waits. The menus show it as *mail waiting*.

A feature has no other topic. A point of its own that needs decisions of its own is offered as a pivot to an epic, and only your yes moves it; anything else goes on the roadmap or into the inbox. Talk that rises past the topic, to the epic as a whole or to the product, can move there on your word, into the epic's discovery or the product's conversation.

## Putting things off

- **Backlogging** — "roadmap it", "push it back": a question of this topic, or work no topic owns, goes on the roadmap on a horizon you name, and the question closes.
- **Postponing** — an epic's topic you want later, this one or another by name, goes to the roadmap whole and comes back when it is pulled forward. A feature's topic is the work itself, so its "not now" is a cancel.
- **Cancelling** — a topic not worth pursuing leaves active work, still listed on the epic's menu as the record that it was raised and declined. Any experiment still running under it is abandoned, and a message waiting for it goes to the inbox.

## Closing a topic

After eight agreements in a row, or on your word, Claude offers to settle the rest: how many points are open, how many it would settle, and which still come to you by the rule, by kind. On yes its points go on the ledger, yours come one at a time, and the topic moves to its close. Declined, the offer waits for the next run of agreements. Where it would settle none of the open points, no offer is made.

A topic closes once nothing of yours is open on its map, through a **closing pass** with two readers. A fresh agent, unanchored by the conversation, reads the topic's entries and log against the other topics' records and the product record, looking for a question with no answer, a contradiction with another record, and work the decision creates that no topic owns. Claude, who was in the conversation, checks that every decision made in it has its entry, that each replacement holds up against what it replaced, that no two current answers contradict each other, and runs again each measurement a decision rests on. Anything the pass finds lands somewhere, and where it changed what the topic decides, another pass reads what changed, until one changes nothing.

The close also proposes what goes beyond the topic:

- **Product-record lines** — a decision here that is really a rule for the whole product, such as a principle you stated, is proposed as a line of the product record, which every later topic reads first. A line already in the record that should go is proposed for withdrawal.
- **Candidates** — work the decision creates that no topic owns, and that holds a call you would want to make. In an epic it is proposed as a new topic, with a brief; in a feature it is proposed for the roadmap, on a horizon you name.

An epic's topic then stops at its **decided** gate: what it decided, with the ledger in view, the product-record lines and the candidates, any of which you can strike or reword. Before the gate it asks a verdict on each call you changed: what Claude's answer would have cost, nothing, a fix later, or a real loss. Your yes marks the topic decided and returns you to the epic's menu. A feature's topic has no gate of its own: what it decided is shown with the specification at [ready to build](specification.md#ready-to-build), and that yes takes both.

## When a decided topic comes back

A decided topic stays decided until something it relies on moves. When a decision it relied on is replaced, in another topic, at the specification or in the build, the entries resting on it, but the replacement's own cause, are flagged as **affected**, and the topic shows among what waits on you, as "a decision it relies on changed". Entering it then is for those entries alone: each is confirmed as still holding, or replaced, and the topic stays decided. A message sent to a decided topic reopens it instead, and it closes again through a fresh pass.

## The log

The topic's log, `topics/{topic}/log.md`, is its journey: the options weighed, the false paths, the reversals, your thinking and why minds changed. It is written as the conversation goes, appended and never rewritten, enough for a fresh session to carry on alone, and it points at entries by their short ids rather than restating them. [How it fits together](how-it-fits-together.md#the-record-and-the-logs) says how a log names the conversations that wrote it.
