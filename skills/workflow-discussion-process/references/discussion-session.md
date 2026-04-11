# Discussion Session

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

## A. Background Agents

Two types of background agent operate during the discussion. Load their lifecycle instructions now — apply them at the appropriate moments during the session loop.

→ Load **[review-agent.md](review-agent.md)** and follow its instructions as written.

→ Load **[perspective-agents.md](perspective-agents.md)** and follow its instructions as written.

---

## B. Session Loop

The discussion is an organic conversation. The Discussion Map is your tracking backbone — it tells you where you are, what's been decided, what's still open, and where to go next. Follow this loop:

1. **Check for findings** — Before each conversational turn, scan the cache directory for pending or acknowledged background-agent files (review agents, synthesis agents). If any are found, delegate handling to the shared surfacing protocol loaded by review-agent.md and perspective-agents.md. The protocol enforces the never-dump rules: two-phase surfacing, one finding at a time, mid-thread protection. **Do not surface findings directly in this step — always go through the shared protocol, which decides whether now is a natural break.** Skip this step on the first iteration (no agents have been dispatched yet).
2. **Discuss** — Engage with the user on the current subtopic or wherever the conversation leads. Challenge thinking, push back, explore edge cases. Participate as an expert architect. Follow interesting threads — tangents that surface new concerns are valuable. New subtopics may emerge; add them to the Discussion Map as `pending`.
3. **Navigate** — When a subtopic feels explored or a decision lands, update the Discussion Map and guide the user to what's still open. Don't force transitions — suggest them. The user can follow your suggestion or go wherever they want.
4. **Document** — At natural pauses, update the discussion file. Update the Discussion Map states. When a subtopic reaches `decided`, write up its section (Context → Options → Journey → Decision). Capture provisional thinking for subtopics still in progress if context compaction is a risk.
5. **Commit & dispatch check** — Git commit after each write. Don't batch. Then immediately evaluate agent dispatch — **CHECKPOINT**: Do not respond to the user until this check is complete. Evaluate the trigger conditions defined in the review agent and perspective agent instructions loaded above. If conditions are met, dispatch before continuing. If not, proceed.
6. **Repeat** — Continue with the next subtopic or follow where the conversation leads.

---

## C. Subtopic Lifecycle

Subtopics move through states as the conversation progresses:

**pending** → Identified but not yet explored. Sits on the map waiting for attention. New subtopics from tangents, agent findings, or natural discovery start here.

**exploring** → Actively being discussed. Options are surfacing, trade-offs being weighed, edge cases emerging. Only one or two subtopics should be `exploring` at a time — the conversation is linear.

**converging** → Narrowing toward a decision. The options are clear, the trade-offs are understood, and the discussion is honing in on a choice. This signals to both Claude and the user that a decision is close.

**decided** → Decision reached with rationale. The subtopic section gets written up with the full Context → Options → Journey → Decision structure. This is the terminal state.

**State transitions are judgement calls.** Move a subtopic to `converging` when the viable options are narrowed and the discussion is heading toward resolution. Move to `decided` when there's a clear outcome with rationale — even if provisional. Don't wait for absolute certainty.

Child subtopics can exist under parents. A parent might be `exploring` while one of its children is already `decided`. The parent reaches `decided` when all its meaningful children are resolved and the overall concern is addressed.

---

## D. Navigation

Claude owns transitions between subtopics. The goal is natural flow, not rigid sequencing.

**After a decision lands:**

> "That rounds out {subtopic}. We still have {X} and {Y} on the map — {X} is closely related, want to continue there? Or we could pick up {Y}."

**When a tangent surfaces a new concern:**

Add it to the Discussion Map as `pending`. If it's closely related to the current subtopic, it might become a child. If it's independent, it sits at the top level.

> "Good catch — I've added {new subtopic} to the map. Let's finish {current} first and we can pick that up after."

**When the user drives:**

The user can jump to any subtopic at any time. Claude follows and tracks the state change on the map.

**When circling back:**

If a subtopic was partially explored and the conversation moved on, Claude remembers and suggests returning:

> "We touched on {subtopic} earlier but didn't land a decision — worth circling back now that we've resolved {related subtopic}?"

---

## E. Status Display

At natural breaks — after a decision, when transitioning between subtopics, or when the user asks — render the current Discussion Map state. This gives the user visibility into where the discussion stands.

> *Output the next fenced block as a code block:*

```
Discussion Map — {topic:(titlecase)}

  {Subtopic A} [decided]
  ├─ {Child} [decided]
  └─ {Child} [decided]

  {Subtopic B} [converging]
  └─ {Child} [exploring]

  {Subtopic C} [pending]

{decided_count} decided · {exploring_count} exploring · {pending_count} pending
```

Don't render the map after every exchange — do it at meaningful transitions. If the user has just seen a similar state, skip it.

---

## F. Topic Elevation

**This section applies to epic work types only.** For features and bugfixes (single-topic), subtopics stay on the map regardless of scope. Note any out-of-scope concerns in the Summary section for the user to consider separately.

During organic discussion, a subtopic may grow beyond the scope of the current topic — it starts needing its own decisions, its own options exploration, its own trade-offs. When this happens, it's a sibling topic, not a subtopic.

**Heuristic**: If a concern would need its own set of decisions, its own perspective agents, its own full exploration — it's a sibling. If it's a detail that informs a decision within the current topic — it's a subtopic. Example: "How do we handle token refresh?" within an auth discussion = subtopic. "What's our caching strategy?" surfacing during auth because tokens need caching = sibling.

**When you identify a potential sibling:**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{concern}** is expanding beyond a subtopic — it has its own decisions and trade-offs.

- **`e`/`elevate`** — Seed as a separate discussion topic
- **`k`/`keep`** — Keep it as a subtopic here
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `elevate`

1. Create a seed discussion file at `.workflows/{work_unit}/discussion/{new-topic}.md` with:
   - Context section capturing what prompted the topic and any initial thinking from the current discussion
   - A Discussion Map with initial subtopics derived from what's been discussed so far
   - No decisions — those happen in the new discussion
2. Register in manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.discussion.{new-topic}
   ```
3. Update the current Discussion Map: replace the subtopic with `→ Elevated: {new-topic}`
4. Commit: `discussion({work_unit}/{topic}): elevate {new-topic} to separate discussion`

→ Return to **B. Session Loop**.

#### If `keep`

Leave it as a subtopic on the map.

→ Return to **B. Session Loop**.

---

## G. Convergence

Convergence is the natural end state — not a forced conclusion. The discussion converges when:

- All subtopics on the Discussion Map are `decided` (or deliberately deferred)
- Neither Claude nor the user can identify new subtopics without breaking scope
- At least one review cycle has completed (see safety net below)

**Before rendering the convergence menu, verify:**

Count review files in `.workflows/.cache/{work_unit}/discussion/{topic}/`.

#### If zero review files exist

> *Output the next fenced block as a code block:*

```
⚑ No review agent has been dispatched during this discussion.
  At least one review cycle is required before concluding.
  Dispatching now.
```

Dispatch a review agent as a foreground task (not background — results are needed before concluding). Follow **A. Dispatch** in review-agent.md but omit `run_in_background`. When results return, delegate to **B. Check and Surface** in review-agent.md — the shared surfacing protocol applies the never-dump rules and presents findings one at a time.

→ Return to **B. Session Loop**.

#### If review files exist

**When convergence is reached:**

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

**First, check the review safety net:** Count review files in `.workflows/.cache/{work_unit}/discussion/{topic}/`.

**If zero review files exist:**

> *Output the next fenced block as a code block:*

```
⚑ No review agent has been dispatched during this discussion.
  At least one review cycle is required before concluding.
  Dispatching now.
```

Dispatch a review agent as a foreground task (not background — results are needed before concluding). Follow **A. Dispatch** in review-agent.md but omit `run_in_background`. When results return, delegate to **B. Check and Surface** in review-agent.md — the shared surfacing protocol applies the never-dump rules and presents findings one at a time. Then continue with the conclusion flow below.

**If review files exist:**

Continue with the conclusion flow below.

#### If there are subtopics still `pending` or `exploring`

Render the Discussion Map and note which subtopics are unresolved.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
There are still {N} subtopics not yet decided:

{list of pending/exploring subtopics}

- **`y`/`yes`** — Conclude anyway (unresolved items noted in Summary)
- **`n`/`no`** — Continue discussing
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

Note unresolved subtopics in the Summary → Open Threads section of the discussion file. Commit.

→ Return to caller.

**If `no`:**

→ Return to **B. Session Loop**.

#### If all subtopics are `decided`

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
