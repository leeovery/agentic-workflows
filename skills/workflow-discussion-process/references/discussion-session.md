# Discussion Session

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

## A. Background Agents

Two types of background agent operate during the discussion. Load their lifecycle instructions now — apply them at the appropriate moments during the session loop.

→ Load **[review-agent.md](review-agent.md)** and follow its instructions as written.

→ Load **[perspective-agents.md](perspective-agents.md)** and follow its instructions as written.

---

## B. Session Loop

The discussion is an organic conversation. The Discussion Map is your tracking backbone — it tells you where you are, what's been decided, what's still open, and where to go next. It is typed state in the manifest (`phases.discussion.items.{topic}.subtopics`): you make every state call, the engine `discussion-map` commands record it, and the adapter renders it (see **E**). Follow this loop:

1. **Check for findings** — Before each conversational turn, run the check-for-results logic from the background-agent files loaded above. Each file knows its own rules; follow the named section in each:
   - **Review agent**: follow **B. Check and Surface** in **[review-agent.md](review-agent.md)** — delegates to the shared surfacing protocol for review findings.
   - **Perspective agents**: follow **D. Check and Surface** in **[perspective-agents.md](perspective-agents.md)** — promotes completed perspective sets to synthesis, then delegates to the shared surfacing protocol for synthesis findings.
   
   Both enforce the never-dump rules: two-phase surfacing, one finding at a time, mid-thread protection. **Do not surface findings directly — always go through the agent files, which route to the shared protocol.** Skip on the first iteration (no agents have been dispatched yet).
2. **Discuss** — Engage with the user on the current subtopic or wherever the conversation leads. Challenge thinking, push back, explore edge cases. Participate as an expert architect. Follow interesting threads — tangents that surface new concerns are valuable. New subtopics may emerge; record each on the map as it's identified (kebab-case name; new subtopics start `pending`; `--parent` nests under an existing top-level subtopic):

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map add {work_unit} {topic} {subtopic} [--parent {parent}]
   ```

   A concern that doesn't belong under this topic is not a subtopic — route it through **F. Off-Topic Concerns**.
3. **Navigate** — When a subtopic feels explored or a decision lands, record the transition and guide the user to what's still open:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {subtopic} {state}
   ```

   The command's JSON response carries `all_decided` and `unresolved_count` — no follow-up read needed. Don't force transitions — suggest them. The user can follow your suggestion or go wherever they want.
4. **Document** — At natural pauses, update the discussion file — it holds the knowledge. When a subtopic reaches `decided`, write up its section (Context → Options → Journey → Decision); keep the Summary current. When the session re-decides a decision recorded in an *earlier sitting* — a drained triage concern, a review finding, a user reversal — the new decision lands as a dated entry on that block per the template's revision convention, wrapping a plain block first; refining an entry still being written this session edits it in place, no entry. Capture provisional thinking for subtopics still in progress if context compaction is a risk. The live map state lives in the manifest only — never write a map section into the file.
5. **Commit & dispatch check** — Commit after each write. Don't batch. When the write documents an agent finding's engagement, the subject carries `({id} {finding})` — e.g. `discussion({work_unit}/{topic}): decided webhook reconciliation (review-003 F2)` — and the commit carries only the engagement's write; unrelated substance commits separately:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discussion({work_unit}/{topic}): {what changed}"
   ```

   Then immediately evaluate agent dispatch — **CHECKPOINT**: Do not respond to the user until this check is complete. Evaluate the trigger conditions defined in the review agent and perspective agent instructions loaded above. If conditions are met, dispatch before continuing. If not, proceed.
6. **Repeat** — Continue with the next subtopic or follow where the conversation leads.

---

## C. Subtopic Lifecycle

Subtopics move through states as the conversation progresses. The judgment call is yours; recording it is the `discussion-map set` command (session loop step 3):

**pending** → Identified but not yet explored. Sits on the map waiting for attention. New subtopics from tangents, agent findings, or natural discovery start here.

**exploring** → Actively being discussed. Options are surfacing, trade-offs being weighed, edge cases emerging. Only one or two subtopics should be `exploring` at a time — the conversation is linear.

**converging** → Narrowing toward a decision. The options are clear, the trade-offs are understood, and the discussion is honing in on a choice. This signals to both you and the user that a decision is close.

**decided** → Decision reached with rationale. The subtopic section gets written up with the full Context → Options → Journey → Decision structure. Terminal for the map, though a later sitting may re-decide — the re-decision lands as a dated entry on the block's timeline (template revision convention).

**deferred** → Deliberately set aside. Applied when concluding with unresolved subtopics (see **G. Concluding**) — each is also noted in Summary → Open Threads.

**State transitions are judgement calls.** Move a subtopic to `converging` when the viable options are narrowed and the discussion is heading toward resolution. Move to `decided` when there's a clear outcome with rationale — even if provisional. Don't wait for absolute certainty. Any state can move to any other — judgment may revisit.

Child subtopics can exist under parents. A parent might be `exploring` while one of its children is already `decided`. The parent reaches `decided` when all its meaningful children are resolved and the overall concern is addressed.

---

## D. Navigation

You own transitions between subtopics. The goal is natural flow, not rigid sequencing.

**After a decision lands:**

> "That rounds out {subtopic}. We still have {X} and {Y} on the map — {X} is closely related, want to continue there? Or we could pick up {Y}."

**When a tangent surfaces a new concern:**

Record it on the map as `pending` (`discussion-map add`, session loop step 2). If it's closely related to the current subtopic, it might become a child (`--parent`). If it's independent, it sits at the top level.

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

- **DATA** — reasoning surface: `counts`, `all_decided`, `unresolved`, `review_cycles`. Reason from it; never display or restate it.
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

→ Load **[off-topic-epic.md](off-topic-epic.md)** with work_unit = `{work_unit}`, topic = `{topic}`, concern = `{the concern, with its discussed context}`.

→ On return, proceed as the reference directed.

#### Otherwise

→ Load **[off-topic-non-epic.md](off-topic-non-epic.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, concern = `{the concern, with its discussed context}`.

→ On return, proceed as the reference directed.

---

## G. Concluding

One ceremony, two ways in — enter when either, or both at once, holds:

- **Convergence read** — every subtopic on the Discussion Map is `decided` (or `deferred`), and neither you nor the user can identify new subtopics without breaking scope. Convergence is the natural end state, never a forced conclusion.
- **The user signals conclusion** — *"that covers it"*, *"let's wrap up"*, *"I think we're done"*.

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

Note them in the Summary → Open Threads section of the discussion file. Commit.

Load **[closing-gates.md](closing-gates.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.

**If `no`:**

→ Return to **B. Session Loop**.

#### If `all_decided` is false and you read convergence

It isn't convergence — undecided subtopics remain. Keep exploring.

→ Return to **B. Session Loop**.
