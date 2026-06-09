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

1. **Check for findings** — Before each conversational turn, run the check-for-results logic from the background-agent files loaded above. Each file knows its own rules; follow the named section in each:
   - **Review agent**: follow **B. Check and Surface** in **[review-agent.md](review-agent.md)** — delegates to the shared surfacing protocol for review findings.
   - **Perspective agents**: follow **D. Check and Surface** in **[perspective-agents.md](perspective-agents.md)** — promotes completed perspective sets to synthesis, then delegates to the shared surfacing protocol for synthesis findings.
   
   Both enforce the never-dump rules: two-phase surfacing, one finding at a time, mid-thread protection. **Do not surface findings directly — always go through the agent files, which route to the shared protocol.** Skip on the first iteration (no agents have been dispatched yet).
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

**converging** → Narrowing toward a decision. The options are clear, the trade-offs are understood, and the discussion is honing in on a choice. This signals to both you and the user that a decision is close.

**decided** → Decision reached with rationale. The subtopic section gets written up with the full Context → Options → Journey → Decision structure. This is the terminal state.

**State transitions are judgement calls.** Move a subtopic to `converging` when the viable options are narrowed and the discussion is heading toward resolution. Move to `decided` when there's a clear outcome with rationale — even if provisional. Don't wait for absolute certainty.

Child subtopics can exist under parents. A parent might be `exploring` while one of its children is already `decided`. The parent reaches `decided` when all its meaningful children are resolved and the overall concern is addressed.

---

## D. Navigation

You own transitions between subtopics. The goal is natural flow, not rigid sequencing.

**After a decision lands:**

> "That rounds out {subtopic}. We still have {X} and {Y} on the map — {X} is closely related, want to continue there? Or we could pick up {Y}."

**When a tangent surfaces a new concern:**

Add it to the Discussion Map as `pending`. If it's closely related to the current subtopic, it might become a child. If it's independent, it sits at the top level.

> "Good catch — I've added {new subtopic} to the map. Let's finish {current} first and we can pick that up after."

**When the user drives:**

The user can jump to any subtopic at any time. Follow their lead and track the state change on the map.

**When circling back:**

If a subtopic was partially explored and the conversation moved on, remember it and suggest returning:

> "We touched on {subtopic} earlier but didn't land a decision — worth circling back now that we've resolved {related subtopic}?"

---

## E. Status Display

At natural breaks — after a decision, when transitioning between subtopics, or when the user asks — render the current Discussion Map state. This gives the user visibility into where the discussion stands.

> *Output the next fenced block as a code block:*

```
  Discussion Map — {topic:(titlecase)} ({total} subtopics{state_breakdown})

@foreach(parent in subtopics)
  {parent_branch} {state_glyph} {parent.name:(titlecase)} [{parent.state}]
@foreach(child in parent.children)
  {parent_gutter}{child_branch} {state_glyph} {child.name:(titlecase)} [{child.state}]
@endforeach
@endforeach
```

**Render rules — follow exactly. Do not improvise spacing, glyphs, or branches.**

- **Two-space left indent** on every row (matches the discovery map). Header included.
- **Header**: `Discussion Map — {topic:(titlecase)} ({total} subtopics{state_breakdown})`. Followed by **one blank line** before the first row.
  - `{total}` — count of **all subtopics** (parents + children).
  - `{state_breakdown}` — append ` — {decided} decided · {converging} converging · {exploring} exploring · {pending} pending`, **omitting zero-count categories**. When only one state bucket is non-zero (e.g. every subtopic still `pending`), the breakdown is redundant with the rows; omit it and render just `({total} subtopics)`.
  - Examples: `Discussion Map — Portal Observability Layer (12 subtopics)` · `Discussion Map — Portal Observability Layer (12 subtopics — 3 decided · 2 converging · 1 exploring · 6 pending)`.
- **Parent row**: `{parent_branch} {state_glyph} {name:(titlecase)} [{state}]`. **Single space** between each of the four segments. State label in lowercase, wrapped in square brackets.
  - `{parent_branch}`: `┌─` for the first parent, `└─` for the last parent, `├─` for the rest. **With a single parent, use `└─`** (no upward stroke).
- **Child row**: `{parent_gutter}{child_branch} {state_glyph} {name:(titlecase)} [{state}]`. Single space between segments after the gutter+branch.
  - `{parent_gutter}` governs the continuation tree under the parent:
    - **Parent is not the last parent**: `│  ` — `│` followed by **2 spaces** (3 chars total). The `│` runs continuously down through every child row of that parent so the trunk never breaks.
    - **Parent is the last parent**: `   ` — **3 spaces** (no `│`), so the tree doesn't dangle below `└─`.
  - `{child_branch}`: `├─` for a non-final child, `└─` for the final child. **With a single child, use `└─`**.
  - Children never have grandchildren — the map is two levels deep maximum.
- **State glyphs** — exactly one character before the name. **Do not substitute.**
  - `pending` — `○`
  - `exploring` — `◐`
  - `converging` — `→`
  - `decided` — `✓`
- **Row order** within the map matches the order parents and children appear in the file's Discussion Map section. Do not re-sort.

**Single-row case (one parent, no children):**

```
  Discussion Map — {topic:(titlecase)} (1 subtopic)

  └─ ○ Subsystem Prefix Taxonomy [pending]
```

**Full example (mixed states, nested children):**

```
  Discussion Map — Portal Observability Layer (12 subtopics — 3 decided · 2 converging · 1 exploring · 5 pending)

  ┌─ ✓ Subsystem Prefix Taxonomy [decided]
  ├─ → Decision-Point INFO Line Shape [converging]
  │  ├─ ✓ Field Order [decided]
  │  └─ ◐ Truncation Rules [exploring]
  ├─ → Diagnostic Context Preservation At Boundaries [converging]
  └─ ○ Rollout Sequencing And Scope Bundling [pending]
```

Don't render the map after every exchange — do it at meaningful transitions. If the user has just seen a similar state, skip it.

---

## F. Off-Topic Concerns

During organic discussion a concern may surface that doesn't belong under the current topic — it belongs to a *different* topic entirely.

**Heuristic**: If a concern is a detail that informs a decision within the current topic, it's a subtopic — keep it here. If it belongs to a *different* topic (one that exists, or one that should), it isn't this discussion's to resolve — reroute it to that topic, which picks it up later. Example: "How do we handle token refresh?" within an auth discussion = subtopic (keep). "What's our caching strategy?" surfacing during auth because tokens need caching = different topic (reroute).

#### If work type is not `epic`

Single-topic work types (feature, bugfix, quick-fix) have no other topic to route to — the topic *is* the work unit.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{concern}** is beyond this topic's scope.

- **`l`/`log`** — Capture it as an idea in the inbox for later
- **`p`/`pivot`** — Convert this work to an epic so it can hold the concern as its own topic
- **`i`/`ignore`** — Note it in the Summary and move on
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `log`:**

Capture the concern via the `workflow-log-idea` skill so it lands in the inbox for later triage.

→ Return to **B. Session Loop**.

**If `pivot`:**

Note the concern in the Summary so it isn't lost, then tell the user they can pivot this work to an epic from the manage menu (`p`/`pivot`) and route the concern as a topic from there.

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

   A chosen candidate is the target; `new` means propose a kebab-case name and confirm it. If the resolved target is the current topic (`{topic}`), it's a detail of this discussion, not a reroute — add it to the Discussion Map as a `pending` subtopic and → Return to **B. Session Loop**.

2. Gather the full context discussed about the concern — everything worked out so far, not a one-line summary. The target topic picks this up cold, so it needs the whole thing.

3. Load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{target}`, concern = `{concern and its full context}`, origin = `{topic}`, phase = `discussion`, date = `{today}`. If `result` is `cancelled`, nothing landed — → Return to **B. Session Loop**. Otherwise the concern landed in `{landed_topic}`'s `## Triage`.

4. The current Discussion Map is unchanged — rerouting sends the concern away from this topic, it doesn't mark it. Commit:

   ```bash
   git add -- .workflows/{work_unit}/
   git commit -m "discussion({work_unit}/{topic}): reroute concern to {landed_topic}"
   ```

→ Return to **B. Session Loop**.

**If `keep`:**

Leave it as a subtopic on the map.

→ Return to **B. Session Loop**.

---

## G. Convergence

Convergence is the natural end state — not a forced conclusion. The discussion converges when:

- All subtopics on the Discussion Map are `decided` (or deliberately deferred)
- Neither you nor the user can identify new subtopics without breaking scope
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
