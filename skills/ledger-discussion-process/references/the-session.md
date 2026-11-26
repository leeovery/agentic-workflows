# The Session

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

## The Loop

The discussion is an organic conversation. The map is your tracking backbone — it tells you where you are, what's been decided, what's still open, and where to go next. It is drawn from the ledger: each point on it is a question, open until a decision answers it. Follow this loop:

1. **Check for what's waiting** — anything waiting is taken up before the conversation moves on, at a natural break ([natural-breaks.md](../../ledger-shared/references/natural-breaks.md), in context). Each check below reads fresh every iteration — an answer from an earlier read, the entry's included, is not this iteration's.

   Check the mail first, `topic mailbox {work_unit} {topic}`: a message waiting is the skill's **Mail**. Then the background agents, `agent scan {work_unit} discussion {topic}`: a report landed is taken in as the skill's **Tools** says. Never skip it on memory of what was dispatched: the scan answers that, and a resumed session may hold agents from an earlier sitting.

   Last, at a natural break with nothing else open, a call you made while the talk ran on is raised now (step 2).
2. **Discuss** — Engage with the person on the current point or wherever the conversation leads. Challenge thinking, push back, explore edge cases. Participate as an expert architect. A point the record settles is not a question — once the topic's shape is agreed, make the call, its question on the map, carry on, and raise it at the next natural break, never mid-thread. Follow interesting threads — tangents that surface new questions are valuable. New points may emerge; record each on the map as it's identified, a question (`ledger ask`), `--part-of` nesting it under another.

   A point that doesn't belong under this topic is not a point of the map — take it through **What Belongs to Another Topic**. A point the person rules out of scope as it surfaces — settled when the work was shaped, not up for discussion — is neither: no map entry, no message; acknowledge and move on. A number about to bear a decision is the laboratory's cue — offer it, as the skill's **Tools** says of an experiment. A path the person offers — a screenshot, a document, a diagram — lands before the conversation moves on: the skill's **A Shared File**. A topic the person calls off is none of these — the skill's **Cancelling the Topic**.
3. **Navigate** — When a point feels explored or a decision lands, guide the person to what's still open (**Navigation**) — don't force transitions, suggest them; the person can follow your suggestion or go wherever they want. Where no question is open on the map and the talk has come to rest, the skill's **Closing** says what follows.
4. **Document** — At natural pauses, write the log — it holds the knowledge. When a point reaches decided, its decision lands (`ledger decide`), its own line holding the answer and its why, and the log carrying its Context → Options → Journey. When the session re-decides a decision recorded in an earlier sitting — a message, a review finding, the person's reversal — the new decision replaces it (`ledger replace`), never an edit. Capture provisional thinking for points still in progress if context compaction is a risk. The map is drawn from the ledger only — never write a map into the log.
5. **Dispatch check** — After each write, evaluate the background review's dispatch: `agent scan`'s `review_arming`. Where it is armed and the review is not held back (the skill's **Tools**, the background review), dispatch before continuing. If not, proceed. Do not respond to the person until this check is complete.
6. **Repeat** — Continue with the next point or follow where the conversation leads.

## The States a Point Moves Through

Points move through states as the conversation progresses. The judgment call is yours; the engine holds only whether a point's question is open or answered, so the states are how you follow the talk, and what the log says of each:

**pending** → Identified but not yet explored. Sits on the map waiting for attention. New points from tangents, agent findings, or natural discovery start here.

**exploring** → Actively being discussed. Options are surfacing, trade-offs being weighed, edge cases emerging. Only one or two points should be exploring at a time — the conversation is linear.

**converging** → Narrowing toward a decision. The options are clear, the trade-offs are understood, and the discussion is honing in on a choice. This signals to both you and the person that a decision is close.

**decided** → Decision reached with rationale. The decision lands on the ledger, and the log carries the full Context → Options → Journey. Terminal for the map, though a later sitting may re-decide — the re-decision is a replacement, its cause named.

**State transitions are judgement calls.** Move a point to converging when the viable options are narrowed and the discussion is heading toward resolution. Move to decided when there's a clear outcome with rationale — even if provisional. Don't wait for absolute certainty. Any state can move to any other — judgment may revisit.

A point can sit under another (`--part-of`). A parent might be exploring while one of its children is already decided. The parent reaches decided when all its meaningful children are resolved and the overall concern is addressed.

## Navigation

You own transitions between points. The goal is natural flow, not rigid sequencing.

**After a decision lands and points remain:**

> "That rounds out {point}. We still have {X} and {Y} on the map — {X} is closely related, want to continue there? Or we could pick up {Y}."

**When the last point settles:**

No template — the skill's **Closing** says what follows.

**When a tangent surfaces a new question:**

Record it on the map (`ledger ask`). If it's closely related to the current point, it might sit under it (`--part-of`). If it's independent, it sits at the top level. A tangent the person waves out of scope gets no entry — acknowledge and move on.

> "I've added {new point} to the map. Let's finish {current} first and we can pick that up after."

**When the person drives:**

The person can jump to any point at any time. Follow their lead.

**When circling back:**

If a point was partially explored and the conversation moved on, remember it and suggest returning:

> "We touched on {point} earlier but didn't land a decision — worth circling back now that we've resolved {related point}?"

## Showing the Map

At natural breaks — after a decision, when transitioning between points, or when the person asks — draw the current map, `render map {work_unit}.{topic}`. This gives the person visibility into where the discussion stands, your calls since they last looked first.

Don't draw the map after every exchange — do it at meaningful transitions. If the person has just seen a similar state, skip it.

## What Belongs to Another Topic

During organic discussion a point may surface that doesn't belong under the current topic. The heuristic: a detail that informs a decision *within* the current topic is a point of its map — keep it here (**The Loop**, step 2). A point whose home is a *different* topic — one that exists, or one that should — isn't this discussion's to resolve. Example: "How do we handle token refresh?" within an auth discussion is a point of its map (keep). "What's our caching strategy?" surfacing during auth because tokens need caching belongs elsewhere.

When a point reads as another topic's, hold it with the full context discussed about it, and send it as the skill's **A message** says.
