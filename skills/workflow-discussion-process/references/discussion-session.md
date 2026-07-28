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

**deferred** → Deliberately set aside. Applied when concluding with unresolved subtopics (see **H**) — each is also noted in Summary → Open Threads.

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

1. Load **[pivot-to-epic.md](../../workflow-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}`. The work unit is now an epic (conversion committed) with this topic on its discovery map.

2. From the context you already have, derive two values: `proposed_name` — a kebab-case topic name for the concern; and `concern` — the concern with the full context discussed about it.

3. Load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{proposed_name}`, concern = `{concern}`, origin = `{topic}`, phase = `discussion`, date = `{today}`. It validates the name against the map and, on a clash, prompts to pick another or cancel. If `result` is `cancelled`, the topic wasn't created — note the concern in the Summary so it isn't lost; otherwise the concern landed as the `{landed_topic}` topic.

4. Commit the landing:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discussion({work_unit}/{topic}): reroute concern to {landed_topic}"
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
   node .claude/skills/workflow-discovery/scripts/gateway.cjs {work_unit}
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

**Before rendering the convergence menu**, run the map call:

```bash
node .claude/skills/workflow-discussion-process/scripts/gateway.cjs map {work_unit} {topic}
```

Its DATA section carries `all_decided`. The DISPLAY section isn't emitted here — this flow reads DATA only.

Classify the pending closing work by following **J. Closing Probe**, then announce:

> *Output the next fenced block as a code block:*

```
All subtopics on the Discussion Map are decided.
```

#### If the probe classified `due`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Next: a final gap review before concluding — {reason}.
Proceed?

- **`y`/`yes`** — Run the final review
@if(re-review)
- **`s`/`skip`** — Skip the fresh review and move to wrap-up
@endif
- **Keep going** — Tell me what else to explore
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **I. In-Flight Agent Check**.

**If `skip`:**

The fresh review is declined for this conclusion attempt — a prior review has already run and drained, so declining forfeits nothing owed. Step 6 honours the decline and re-derives everything else.

→ Proceed to **I. In-Flight Agent Check**.

**If keep going:**

Continue the discussion. The user may want to revisit a decision, explore an edge case further, or probe for gaps. If new subtopics emerge, add them to the map and continue.

→ Return to **B. Session Loop**.

#### If the probe classified `satisfied`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
The final review is up to date. Begin wrap-up? I'll reconcile the
document against our conversation, then confirm before marking
complete.

- **`y`/`yes`** — Begin wrap-up
- **Keep going** — Tell me what else to explore
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **I. In-Flight Agent Check**.

**If keep going:**

Continue the discussion — revisit decisions, explore edge cases, probe for gaps. If new subtopics emerge, add them to the map and continue.

→ Return to **B. Session Loop**.

---

## H. When the User Signals Conclusion

When the user indicates they want to conclude the discussion (e.g., "that covers it", "let's wrap up", "I think we're done") before natural convergence:

**First**, run the map call:

```bash
node .claude/skills/workflow-discussion-process/scripts/gateway.cjs map {work_unit} {topic}
```

Its DATA section carries everything this flow needs: `all_decided` and `unresolved`.

#### If `all_decided` is false

Classify the pending closing work by following **J. Closing Probe**.

Emit the map call's DISPLAY section verbatim as a code block, then ({N} = the length of `unresolved`):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
There are still {N} subtopics not yet decided:

@foreach(name in unresolved)
- {name:(titlecase)}
@endforeach

@if(review_due)
Next: a final gap review before concluding — {reason}.
@endif

- **`y`/`yes`** — Defer them and @if(review_due) run the final review @else begin wrap-up @endif
@if(re-review)
- **`s`/`skip`** — Defer them and skip the fresh review
@endif
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

→ Proceed to **I. In-Flight Agent Check**.

**If `skip`:**

Set each `unresolved` subtopic to `deferred`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {subtopic} deferred
```

Note them in the Summary → Open Threads section of the discussion file. Commit. The fresh review is declined for this conclusion attempt — Step 6 honours the decline.

→ Proceed to **I. In-Flight Agent Check**.

**If `no`:**

→ Return to **B. Session Loop**.

#### If `all_decided` is true

The map is already settled — the user's signal is convergence arriving by their hand, and the ceremony is the same: classification, then the gate. Nothing proceeds silently.

→ Return to **G. Convergence**.

---

## I. In-Flight Agent Check

The last gate before conclusion, whichever path led here. Run `node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} discussion {topic}` and read the response's `in_flight` list (agents dispatched but not yet returned). An agent dispatched by an earlier session cannot still be running — each row's `created` timestamp tells you which those are; close each (`agent incorporate`), re-scan, and count only this session's. A dead `synthesis` row is the exception: handle it per **D. Check and Surface** in **[perspective-agents.md](perspective-agents.md)** — closed *and* re-dispatched, so the council's tensions aren't lost.

#### If no agents are in flight

→ Return to caller.

#### If agents are still running

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

Watch for `agent scan` to promote each in-flight row to `pending`. When none remain in flight, delegate surfacing to the shared protocol loaded by review-agent.md and perspective-agents.md. The protocol applies the never-dump rules: two-phase surfacing, one finding at a time. Treat the current moment as a natural break — we are at phase conclusion, so the break check will pass.

→ Return to **B. Session Loop**.

**If `proceed`:**

→ Return to caller.

---

## J. Closing Probe

A read-only classification for the conclusion gates — is final-review work still owed (`due`, with a reason) or is the gate `satisfied`? Step 6 (Final Gap Review) is the executor and re-derives state itself — a probe mismatch is cosmetic, never state-corrupting. In-flight rows keep their wait-or-proceed decision at **I. In-Flight Agent Check**.

Read the store:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} discussion {topic}
```

Classify — first match wins:

1. Any `review`, `synthesis`, or `perspective` row is `pending` or `acknowledged` → `due`: "background findings are still to be walked through"
2. Any `review` row is `in-flight` → `due`: "a dispatched review is still running"
3. No `review` row exists → `due`: "no review has run yet"
4. The highest-numbered `review` row is `incorporated` and a meaningful discussion commit landed after its dispatch (`git log --oneline -- .workflows/{work_unit}/discussion/{topic}.md` — a decision documented, a subtopic explored, not typo fixes; discount commits the drain itself produced — engagement writes are not new work) → `due`: "the discussion has moved since the last review". This is the **re-review** classification — the only `due` whose gate offers a skip: a prior review has run and drained, so the user may decline the fresh one.
5. Otherwise → `satisfied`
