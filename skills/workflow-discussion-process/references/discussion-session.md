# Discussion Session

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

## A. Background Agents

Two types of background agent operate during the discussion, and the topic's triage queue surfaces through a third protocol file. Load their instructions now — they run at the appropriate moments during the session loop.

→ Load **[review-agent.md](review-agent.md)** and follow its instructions as written.

→ Load **[perspective-agents.md](perspective-agents.md)** and follow its instructions as written.

→ Load **[rerouted-concerns.md](../../workflow-shared/references/rerouted-concerns.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `discussion` — a protocol, not a step: the session loop's triage check enters its **A. Check**; nothing runs at load time.

---

## B. Session Loop

The discussion is an organic conversation. The Discussion Map is your tracking backbone — it tells you where you are, what's been decided, what's still open, and where to go next. It is typed state in the manifest (`phases.discussion.items.{topic}.subtopics`): you make every state call, the engine `discussion-map` commands record it, and the adapter renders it (see **E**). Follow this loop:

1. **Check for findings** — anything waiting is surfaced before the conversation moves on.

   Check the triage queue first: follow **A. Check** in **[rerouted-concerns.md](../../workflow-shared/references/rerouted-concerns.md)**. Its offer and raise gates end the turn — the agent checks below wait for a later iteration; an absorb never ends the turn, the protocol itself continues to the next raise.

   Then run the check-for-results logic from the background-agent files loaded above. Each file knows its own rules; follow the named section in each:
   - **Review agent**: follow **B. Check and Surface** in **[review-agent.md](review-agent.md)** — delegates to the shared surfacing protocol for review findings.
   - **Perspective agents**: follow **D. Check and Surface** in **[perspective-agents.md](perspective-agents.md)** — promotes completed perspective sets to synthesis, then delegates to the shared surfacing protocol for synthesis findings.
   
   Both enforce the never-dump rules: two-phase surfacing, one finding at a time, mid-thread protection. **Do not surface findings directly — always go through the agent files, which route to the shared protocol.** Skip only when no agents have been dispatched yet — the store decides, not the iteration count: a resumed session may hold agents from an earlier sitting.

   Last, at a natural break with no screen or raise left open, a non-empty calls queue flushes — follow **J. Flush the Calls Queue**, whose own branches cover the empty case. A resumed session's queue flushes here too.
2. **Discuss** — Engage with the user on the current subtopic or wherever the conversation leads. Challenge thinking, push back, explore edge cases. Participate as an expert architect. A point the record settles is not a question — per **[ask-or-decide.md](../../workflow-shared/references/ask-or-decide.md)**, make the call, queue it (**I. Settled Calls**), and carry on. Follow interesting threads — tangents that surface new concerns are valuable. New subtopics may emerge; record each on the map as it's identified (kebab-case name; new subtopics start `pending`; `--parent` nests under an existing top-level subtopic):

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map add {work_unit} {topic} {subtopic} [--parent {parent}]
   ```

   A concern that doesn't belong under this topic is not a subtopic — route it through **F. Off-Topic Concerns**. A concern the user rules out of scope as it surfaces — settled when the work was shaped, not up for discussion — is neither: no map entry, no reroute; acknowledge and move on. A number about to bear a decision is the laboratory's cue — offer it through **K. The Experiment Offer**.
3. **Navigate** — When a subtopic feels explored or a decision lands, record the transition and guide the user to what's still open:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {subtopic} {state}
   ```

   The command's JSON response carries `all_decided` and `unresolved_count` — no follow-up read needed. Don't force transitions — suggest them. The user can follow your suggestion or go wherever they want.
4. **Document** — At natural pauses, update the discussion file — it holds the knowledge. When a subtopic reaches `decided`, write up its section (Context → Options → Journey → Decision); keep the Summary current. When the session re-decides a decision recorded in an *earlier sitting* — an absorbed triage concern, a review finding, a user reversal — the new decision lands as a dated entry on that block per the template's revision convention, wrapping a plain block first; refining an entry still being written this session edits it in place, no entry. Capture provisional thinking for subtopics still in progress if context compaction is a risk. The live map state lives in the manifest only — never write a map section into the file.
5. **Commit & dispatch check** — Commit after each write. Don't batch. When the write documents an agent finding's engagement, the subject carries `({id} {finding})` — e.g. `discussion({work_unit}/{topic}): decided webhook reconciliation (review-003 F2)` — and the commit carries only the engagement's write; unrelated substance commits separately:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic discussion/{topic} -m "discussion({work_unit}/{topic}): {what changed}"
   ```

   Then immediately evaluate agent dispatch — **CHECKPOINT**: Do not respond to the user until this check is complete. Evaluate the trigger conditions defined in the review agent and perspective agent instructions loaded above. If conditions are met, dispatch before continuing. If not, proceed.
6. **Repeat** — Continue with the next subtopic or follow where the conversation leads.

**A request to see or revisit what's been ruled out** — *"what have I ruled out?"* — reads the topic's dismissed grounds back (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion.{topic} dismissed_grounds`); an entry the user wants back in play comes off with `manifest pull` on the same field, and later reviews stop carrying it.

---

## C. Subtopic Lifecycle

Subtopics move through states as the conversation progresses. The judgment call is yours; recording it is the `discussion-map set` command (session loop step 3):

**pending** → Identified but not yet explored. Sits on the map waiting for attention. New subtopics from tangents, agent findings, or natural discovery start here.

**exploring** → Actively being discussed. Options are surfacing, trade-offs being weighed, edge cases emerging. Only one or two subtopics should be `exploring` at a time — the conversation is linear.

**converging** → Narrowing toward a decision. The options are clear, the trade-offs are understood, and the discussion is honing in on a choice. This signals to both you and the user that a decision is close.

**decided** → Decision reached with rationale. The subtopic section gets written up with the full Context → Options → Journey → Decision structure. Terminal for the map, though a later sitting may re-decide — the re-decision lands as a dated entry on the block's timeline (template revision convention).

**deferred** → Deliberately set aside. Written by the defer gate in **G. Concluding** — and by a triage fold that re-parks previously-`deferred` ground a rerouted concern reopened (the raise showed the user what is being set aside, and the fold writes the Open Threads note itself) — and nowhere else: never set it during the session loop, however plainly the user parks something. When they say a subtopic stays open, leave it in the state the conversation reached and carry on; the defer gate sweeps it at conclusion. Setting it early makes `all_decided` true, so the gate never renders — the user is never shown what is being set aside, and the Open Threads entry the gate writes never lands.

**State transitions are judgement calls.** Move a subtopic to `converging` when the viable options are narrowed and the discussion is heading toward resolution. Move to `decided` when there's a clear outcome with rationale — even if provisional. Don't wait for absolute certainty. Any state can move to any other — judgment may revisit. The one exception is `deferred`: it belongs to the defer gate, not to session judgement.

Child subtopics can exist under parents. A parent might be `exploring` while one of its children is already `decided`. The parent reaches `decided` when all its meaningful children are resolved and the overall concern is addressed.

---

## D. Navigation

You own transitions between subtopics. The goal is natural flow, not rigid sequencing.

**After a decision lands:**

> "That rounds out {subtopic}. We still have {X} and {Y} on the map — {X} is closely related, want to continue there? Or we could pick up {Y}."

**When a tangent surfaces a new concern:**

Record it on the map as `pending` (`discussion-map add`, session loop step 2). If it's closely related to the current subtopic, it might become a child (`--parent`). If it's independent, it sits at the top level. A tangent the user waves out of scope gets no entry — acknowledge and move on.

> "Good catch — I've added {new subtopic} to the map. Let's finish {current} first and we can pick that up after."

**When the user drives:**

The user can jump to any subtopic at any time. Follow their lead and track the state change on the map.

**When circling back:**

If a subtopic was partially explored and the conversation moved on, remember it and suggest returning:

> "We touched on {subtopic} earlier but didn't land a decision — worth circling back now that we've resolved {related subtopic}?"

---

## E. Status Display

At natural breaks — after a decision, when transitioning between subtopics, or when the user asks — render the current Discussion Map. This gives the user visibility into where the discussion stands.

```bash
node .claude/skills/workflow-discussion-process/scripts/gateway.cjs map {work_unit} {topic}
```

The output is one snapshot in two demarcated sections:

- **DATA** — reasoning surface: `counts`, `all_decided`, `unresolved`, `review_arming`. Reason from it; never display or restate it.
- **DISPLAY** — the rendered map. Emit verbatim as a code block. Never redraw, reflow, or trim it.

A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

Don't render the map after every exchange — do it at meaningful transitions. If the user has just seen a similar state, skip it.

---

## F. Off-Topic Concerns

During organic discussion a concern may surface that doesn't belong under the current topic. The heuristic: a detail that informs a decision *within* the current topic is a subtopic — keep it here (session loop step 2). A concern whose home is a *different* topic — one that exists, or one that should — isn't this discussion's to resolve. Example: "How do we handle token refresh?" within an auth discussion is a subtopic (keep). "What's our caching strategy?" surfacing during auth because tokens need caching belongs elsewhere.

When a concern reads as off-topic, hold it with the full context discussed about it, and resolve the work type deterministically:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type
```

#### If `work_type` is `epic`

→ Load **[off-topic-epic.md](../../workflow-shared/references/off-topic-epic.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `discussion`, concern = `{the concern, with its discussed context}`, reason = `off-topic`.

→ On return, proceed as the reference directed.

#### Otherwise

→ Load **[off-topic-non-epic.md](off-topic-non-epic.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, concern = `{the concern, with its discussed context}`.

→ On return, proceed as the reference directed.

---

## G. Concluding

One ceremony, two ways in — enter when either, or both at once, holds:

- **Convergence read** — every subtopic on the Discussion Map is `decided` (or `deferred`), and neither you nor the user can identify new subtopics without breaking scope. Convergence is the natural end state, never a forced conclusion.
- **The user signals conclusion** — *"that covers it"*, *"let's wrap up"*, *"I think we're done"*.

A non-empty calls queue flushes first — follow **J. Flush the Calls Queue**; its empty exit returns here, a pulled call's raise re-enters the conversation first, and conclusion resumes by its standing conditions once the queue drains. An unlanded call is undocumented knowledge.

The topic's waits gate the ceremony next, before anything is deferred — a point blocked on a wait is never written `deferred` by the sweep below, because deferral is a choice and this point is blocked pending input. Fetch the gate (empty when nothing is owed; the engine would refuse the completion anyway):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render wait-gate {work_unit}.discussion.{topic}
```

#### If sections are returned

Emit them verbatim per their markers — the blocker naming what is owed, its guidance, then the menu.

**STOP.** Wait for user response.

**If `pause`:**

Commit any uncommitted session work with the session's cadence commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic discussion/{topic} -m "discussion({work_unit}/{topic}): {what changed}"
```

Then say where the ball sits:

> *Output the next fenced block as markdown (not a code block):*

```
> Paused with the waits queued — the closing ceremony runs once everything this discussion waits on has landed. Run `/clear`, then `/workflow-start`: the menu carries the way in, and this discussion concludes once every wait releases.
```

**STOP.** Do not proceed — terminal condition.

**If `keep`:**

→ Return to **B. Session Loop**.

#### If the output is empty

Nothing blocks the ceremony.

→ Proceed to **H. The Map Gate**.

---

## H. The Map Gate

Run the map call:

```bash
node .claude/skills/workflow-discussion-process/scripts/gateway.cjs map {work_unit} {topic}
```

Its DATA section carries `all_decided` and `unresolved`; while undecided subtopics remain the snapshot also carries a `MENU: defer gate` section. Rendered sections are emitted only where a branch below says so.

#### If `all_decided` is true

> *Output the next fenced block as a code block:*

```
Every subtopic on the Discussion Map is settled — decided or deferred.
```

Load **[closing-gates.md](closing-gates.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.

#### If `all_decided` is false and the user signalled conclusion

Emit the map call's DISPLAY section, then its `MENU: defer gate` section — each verbatim per its marker.

**STOP.** Wait for user response.

**If `yes`:**

Defer every `unresolved` subtopic in one write — the batch form takes uniform pairs:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {subtopic}=deferred [{subtopic}=deferred …]
```

Note them in the Summary → Open Threads section of the discussion file, then commit with a `(deferral)` marker in the subject — `discussion({work_unit}/{topic}): note deferred threads (deferral)`. The marker tells the classifier in **[closing-gates.md](closing-gates.md)** that this write is the conclusion's own bookkeeping, not movement it should weigh.

Load **[closing-gates.md](closing-gates.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.

**If `no`:**

→ Return to **B. Session Loop**.

#### If `all_decided` is false and you read convergence

It isn't convergence — undecided subtopics remain. Keep exploring.

→ Return to **B. Session Loop**.

---

## I. Settled Calls

The conversation's own derivable decisions — points **[ask-or-decide.md](../../workflow-shared/references/ask-or-decide.md)** puts on your side — accumulate in a queue and land through a batch screen at natural breaks (**J. Flush the Calls Queue**): never one-by-one asks, never silent writes.

The moment a call is made, add it to the `items` of `.workflows/.cache/{work_unit}/discussion/{topic}/calls-queue.json` (Write tool; the file is `{"items": […], "pulled": […]}` — create it with the new entry when absent, and always write the whole file back). An entry's `title` states the call as a decision; `detail` is one or two sentences naming the problem and what determined it. The file is the queue's only home — conversation memory does not survive compaction — and it is durable: commits are the record of what landed, the file holds only what hasn't. Then continue the thread. From **G. Concluding** onward, queue nothing — a call made during the closing ceremony is documented as part of the engagement that produced it.

---

## J. Flush the Calls Queue

Entered from the session loop's check (natural break, nothing else open) or from **G. Concluding**, and re-entered after every screen. Route on the queue file:

#### If the file is absent, or `items` and `pulled` are both empty

Nothing is owed. Delete the file if it exists.

**If entered from G. Concluding:**

→ Return to **G. Concluding**.

**Otherwise:**

→ Return to **B. Session Loop**.

#### If `items` is empty and `pulled` holds calls

The screens have landed; each pulled call is owed its raise — one per turn. Raise the first as a plain conversational question, derivation on the table, asking what it missed. Control then belongs to the conversation: when the engagement's outcome is documented and committed (session loop steps 4–5), remove the entry from `pulled` — the loop's next check re-enters here for whatever remains.

→ Return to **B. Session Loop**.

#### Otherwise

Write the first five of `items` as the screen payload with the Write tool — `{"lane": "decide", "items": […], "remaining": N}`, the queued entries as written, `remaining` counting those beyond the screen — to `.workflows/.cache/{work_unit}/discussion/{topic}/calls-batch.json`, then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding-batch {work_unit}.discussion.{topic} --file .workflows/.cache/{work_unit}/discussion/{topic}/calls-batch.json
```

Emit the call's DISPLAY and MENU sections, each verbatim per its marker — except on a re-entry after an answered question that changed nothing, where the list on screen is still current: emit the MENU section alone. A re-entry whose screen did change (a pull left survivors) rewrites the payload and re-renders both sections, renumbered.

**STOP.** Wait for user response.

**If `yes`:**

Document each call in turn — into the subtopic that owns it (the template's full structure where the subtopic has no section yet, a dated revision entry where a decided block exists), the Decision block carrying the template's derivation marker; when no subtopic on the Discussion Map owns it, add one and set it `decided` in the same move (`discussion-map add`, then `discussion-map set … decided`). Each call's write-up is its own edit and its own commit (session loop step 5's dispatch check included) before the next begins — never two calls in one write — then remove the landed items from the queue file's `items`. The dispatch check is evaluated where it falls, at each commit and before that removal: the call just landed is still in the queue at that moment, so the check's calls-queue box holds it quiet.

Confirm in one line total — `All {N} documented.` — never a per-call recap. Nothing is pending, so the turn continues.

→ Return to **J. Flush the Calls Queue** — its branches take the next screen, the pulled raises, or the exit.

**If the user names one to talk through** — the Discuss route, or any answer that rejects a call rather than asking about it (a bare number asks; a pull says the move — *discuss 3* — or rejects the call in words):

Move it from `items` to `pulled` in the queue file — durable until its raise lands. Then check the survivors: any whose derivation rests on the ground the pulled call reopens moves with it. Nothing lands.

→ Return to **J. Flush the Calls Queue**.

**If the user asks about a number:**

Answer it — the derivation in full, what it rests on. Expanding is not objecting; the screen stands.

→ Return to **J. Flush the Calls Queue**.

**If the user moves on without answering** — they bounce to another subtopic or pick up a new thread:

Nothing lands; the queue survives on disk. Follow them — the next natural break re-offers the flush.

→ Return to **B. Session Loop**.

---

## K. The Experiment Offer

When a number is about to bear a decision — a controlled measurement would settle a choice the conversation is weighing, not merely inform it — offer the laboratory. Hands-on sightings short of that bar stay in the session, labelled exploratory.

→ Load **[experiment-spawn.md](../../workflow-shared/references/experiment-spawn.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `discussion`.

→ On return, proceed as the reference directed.
