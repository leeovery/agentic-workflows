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
3. **Navigate** — When a subtopic feels explored or a decision lands, record the transition and guide the user to what's still open:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {subtopic} {state}
   ```

   The command's JSON response carries `all_decided` and `unresolved_count` — no follow-up read needed. Don't force transitions — suggest them. The user can follow your suggestion or go wherever they want.
4. **Document** — At natural pauses, update the discussion file — it holds the knowledge. When a subtopic reaches `decided`, write up its section (Context → Options → Journey → Decision); keep the Summary current. Capture provisional thinking for subtopics still in progress if context compaction is a risk. The live map state lives in the manifest only — never write a map section into the file.
5. **Commit & dispatch check** — Commit after each write. Don't batch:

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

**decided** → Decision reached with rationale. The subtopic section gets written up with the full Context → Options → Journey → Decision structure. This is the terminal state.

**deferred** → Deliberately set aside. Applied at conclude-anyway time (see **H**) to subtopics still unresolved — each is also noted in Summary → Open Threads.

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
node .claude/skills/workflow-discussion-process/scripts/discovery.cjs map {work_unit} {topic}
```

The output is one snapshot in two demarcated sections:

- **DATA** — reasoning surface: `counts`, `all_decided`, `unresolved`, `review_cycles`. Reason from it; never display or restate it.
- **DISPLAY** — the rendered map. Emit verbatim as a code block. Never redraw, reflow, or trim it.

A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

Don't render the map after every exchange — do it at meaningful transitions. If the user has just seen a similar state, skip it.

---

## F. Off-Topic Concerns

During organic discussion a concern may surface that doesn't belong under the current topic — it belongs to a *different* topic entirely.

**Heuristic**: If a concern is a detail that informs a decision within the current topic, it's a subtopic — keep it here. If it belongs to a *different* topic (one that exists, or one that should), it isn't this discussion's to resolve — reroute it to that topic, which picks it up later. Example: "How do we handle token refresh?" within an auth discussion = subtopic (keep). "What's our caching strategy?" surfacing during auth because tokens need caching = different topic (reroute).

#### If work type is not `epic`

Single-topic work types (feature, cross-cutting) have no other topic to route to — the topic *is* the work unit.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{concern}** is beyond this topic's scope.

- **`l`/`log`** — Capture it as an idea in the inbox for later
@if(work_type == 'feature')
- **`p`/`pivot`** — Convert this work to an epic so it can hold the concern as its own topic
@endif
- **`i`/`ignore`** — Note it in the Summary and move on
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `log`:**

Capture the concern via the `workflow-log-idea` skill so it lands in the inbox for later triage.

→ Return to **B. Session Loop**.

**If `pivot`:**

1. Load **[pivot-to-epic.md](../../workflow-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}`. The work unit is now an epic with this topic on its discovery map.

2. From the context you already have, derive two values: `proposed_name` — a kebab-case topic name for the concern; and `concern` — the concern with the full context discussed about it.

3. Load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{proposed_name}`, concern = `{concern}`, origin = `{topic}`, phase = `discussion`, date = `{today}`. It validates the name against the map and, on a clash, prompts to pick another or cancel. If `result` is `cancelled`, the topic wasn't created — note the concern in the Summary so it isn't lost; otherwise the concern landed as the `{landed_topic}` topic.

4. Commit the conversion and the landing:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discussion({work_unit}/{topic}): pivot to epic"
   ```

> *Output the next fenced block as markdown (not a code block):*

```
> This work is now an epic — continuing here with the current topic.
> The concern is preserved for its own handling later.
```

→ Return to **B. Session Loop**.

**If `ignore`:**

Note the concern in the Summary section for the user to consider separately, and continue.

→ Return to **B. Session Loop**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{concern}** belongs to a different topic, not this one.

- **`r`/`reroute`** — Send it to the topic it belongs to; it picks it up later
- **`k`/`keep`** — Keep it here as a subtopic
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `reroute`:**

1. Identify the topic the concern belongs to. Read the live map:

   ```bash
   node .claude/skills/workflow-discovery/scripts/discovery.cjs {work_unit}
   ```

   Resolve the target. If one topic clearly matches, propose it and confirm with the user. If nothing fits, propose a new kebab-case name and confirm. If several plausible candidates exist — or a near-match you're unsure of — present them and let the user choose:

   > *Output the next fenced block as markdown (not a code block):*

   ```
   · · · · · · · · · · · ·
   Where should "{concern}" land?

   - **`1`** — {candidate} [{state}]
   - **`2`** — {candidate} [{state}]
   - **`n`/`new`** — Create a new topic for it
   · · · · · · · · · · · ·
   ```

   **STOP.** Wait for user response.

   A chosen candidate is the target; `new` means propose a kebab-case name and confirm it. If the resolved target is the current topic (`{topic}`), it's a detail of this discussion, not a reroute — record it as a `pending` subtopic (`discussion-map add`, session loop step 2) and → Return to **B. Session Loop**.

2. Record the concern with the full context discussed about it as `concern` — the target topic picks it up cold.

3. Load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{target}`, concern = `{concern}`, origin = `{topic}`, phase = `discussion`, date = `{today}`. If `result` is `cancelled`, nothing landed — → Return to **B. Session Loop**. Otherwise the concern landed in `{landed_topic}`'s `## Triage`.

4. The current Discussion Map is unchanged — rerouting sends the concern away from this topic, it doesn't mark it. Commit:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discussion({work_unit}/{topic}): reroute concern to {landed_topic}"
   ```

→ Return to **B. Session Loop**.

**If `keep`:**

Leave it as a subtopic on the map.

→ Return to **B. Session Loop**.

---

## G. Convergence

Convergence is the natural end state — not a forced conclusion. The discussion converges when:

- All subtopics on the Discussion Map are `decided` (or `deferred`)
- Neither you nor the user can identify new subtopics without breaking scope
- At least one review cycle has completed (see safety net below)

**Before rendering the convergence menu**, run the map call:

```bash
node .claude/skills/workflow-discussion-process/scripts/discovery.cjs map {work_unit} {topic}
```

Its DATA section carries the convergence facts: `all_decided` and `review_cycles`.

#### If `review_cycles` is 0

> *Output the next fenced block as a code block:*

```
⚑ No review agent has been dispatched during this discussion.
  At least one review cycle is required before concluding.
  Dispatching now.
```

Dispatch a review agent as a foreground task (not background — results are needed before concluding). Follow **A. Dispatch** in review-agent.md but omit `run_in_background`. When results return, delegate to **B. Check and Surface** in review-agent.md — the shared surfacing protocol applies the never-dump rules and presents findings one at a time.

→ Return to **B. Session Loop**.

#### If `review_cycles` is at least 1

**When convergence is reached** (`all_decided` is true):

> *Output the next fenced block as a code block:*

```
All subtopics on the Discussion Map are decided.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Discussion complete. Ready to conclude?

- **`y`/`yes`** — Conclude discussion
- **Keep going** — Continue discussing to explore further
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Return to caller.

**If keep going:**

Continue the discussion. The user may want to revisit a decision, explore an edge case further, or probe for gaps. If new subtopics emerge, add them to the map and continue.

→ Return to **B. Session Loop**.

---

## H. When the User Signals Conclusion

When the user indicates they want to conclude the discussion (e.g., "that covers it", "let's wrap up", "I think we're done") before natural convergence:

**First**, run the map call:

```bash
node .claude/skills/workflow-discussion-process/scripts/discovery.cjs map {work_unit} {topic}
```

Its DATA section carries everything this flow needs: `all_decided`, `unresolved`, `review_cycles`.

**If `review_cycles` is 0:**

> *Output the next fenced block as a code block:*

```
⚑ No review agent has been dispatched during this discussion.
  At least one review cycle is required before concluding.
  Dispatching now.
```

Dispatch a review agent as a foreground task (not background — results are needed before concluding). Follow **A. Dispatch** in review-agent.md but omit `run_in_background`. When results return, delegate to **B. Check and Surface** in review-agent.md — the shared surfacing protocol applies the never-dump rules and presents findings one at a time. Then continue with the conclusion flow below.

**If `review_cycles` is at least 1:**

Continue with the conclusion flow below.

#### If `all_decided` is false

Emit the map call's DISPLAY section verbatim as a code block, then ({N} = the length of `unresolved`):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
There are still {N} subtopics not yet decided:

@foreach(name in unresolved)
- {name:(titlecase)}
@endforeach

- **`y`/`yes`** — Conclude anyway (unresolved items deferred and noted in Summary)
- **`n`/`no`** — Continue discussing
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

Set each `unresolved` subtopic to `deferred`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {subtopic} deferred
```

Note them in the Summary → Open Threads section of the discussion file. Commit.

→ Return to caller.

**If `no`:**

→ Return to **B. Session Loop**.

#### If `all_decided` is true

Check for in-flight agents. If agents are still running:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
There are still {N} background agents working.

- **`w`/`wait`** — Wait for results before concluding
- **`p`/`proceed`** — Conclude now (results will persist in cache for reference)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `wait`:**

Check for agent completion. When all agents have returned, delegate surfacing to the shared protocol loaded by review-agent.md and perspective-agents.md. The protocol applies the never-dump rules: two-phase surfacing, one finding at a time. Treat the current moment as a natural break — we are at phase conclusion, so the break check will pass.

→ Return to **B. Session Loop**.

**If `proceed`:**

→ Return to caller.

**If no agents are in flight:**

→ Return to caller.
