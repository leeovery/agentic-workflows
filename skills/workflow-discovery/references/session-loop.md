# Session Loop

*Reference for **[workflow-discovery](../SKILL.md)***

---

Follow the curatorial moves and hard rules from **[discovery-guidelines.md](discovery-guidelines.md)** throughout. No background agents, no review cycles, no perspective dispatches.

State-driven branches in **A. Open** pick the opening shape; **B. Session Loop** runs the exploration; **C. Harvest** synthesises topics when the user pulls. When the map already has items, edits to existing items happen in the loop alongside exploration.

## A. Open

Read `discovery_map` and `dismissed` from the most recent discovery output. `imports` was read from the manifest and is already held in conversation memory (Step 8). Read `session_number` and any active file path from the resume state set at Step 6.

#### If `macro_continuation` is set (new epic, just confirmed)

The macro shaping at Step 4 already explored the work enough to confirm it's an epic and surfaced the first topic seeds; the confirm-trigger backfilled that into `session-{session_number}.md`. Don't re-open with a cold prompt — the conversation is already live. Render a brief transition that moves from "what is this" into exploring the whole:

> *Output the next fenced block as a code block:*

```
That's an epic — work unit created. We've started sketching the shape;
now let's get into it properly. Topics come later — they fall out once
we've thought the whole thing through.

What do you want to dig into first?
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### If a resume was selected at Step 6, or a context refresh recovered a pre-synthesis session (the map is empty and the session log holds Exploration)

The session is picked up from disk — either the user chose `continue` at resume detection, or a context refresh recovered a discovery session that was confirmed but not yet synthesised (e.g. a new epic whose in-memory `macro_continuation` was lost). The active session log on disk is the working state — the highest-numbered `.workflows/{work_unit}/discovery/sessions/session-NNN.md`, whose number is `session_number`. Read it to load **Exploration**, **Edits**, and any partially-filled **Topics Identified** into context.

Brief across the prior sessions, then ask where to pick up:

→ Load **[continuity-load.md](continuity-load.md)** and follow its instructions as written.

> *Output the next fenced block as a code block:*

```
Where do you want to take it from here?
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### If `discovery_map` is non-empty (map already populated)

The map exists; editing existing items is available alongside new exploration. Render the map as an anchor using the discovery output from Step 7, then open the conversation:

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Discovery — {work_unit:(titlecase)}
●───────────────────────────────────────────────●

  Discovery Map ({total} topics{tier_breakdown})

@foreach(topic in discovery_map)
  {branch} {topic.tier} {topic.name:(titlecase)} [{lifecycle_label}]
@endforeach
```

Render rules:

- `tier_breakdown` — append ` — {decided} decided · {in_flight} in flight · {ready} ready · {fresh} fresh · {handled} handled · {cancelled} cancelled` (omitting zero-count categories) only when more than one tier bucket is non-zero. When only one bucket is non-zero, omit the breakdown and render just `Discovery Map ({total} topics)`.
- `{branch}` — `┌─` for the first row, `└─` for the last, `├─` for the rest. With a single row, use `└─` (no upward stroke).
- Tier ordering — discovery output is already tier-sorted (`→ ◐ ✓ ○ ⊙ ⊘`, suggested execution order within tier). Render in the order given.
- `lifecycle_label` by tier (wrapped in square brackets per the row template):
  - `→` — `research complete · ready for discussion`
  - `◐` — `researching` or `discussing` (use `topic.current_phase`)
  - `✓` — `decided`
  - `○` — `fresh · routed to {topic.routing}` (omit ` · routed to ...` if `topic.routing` is null)
  - `⊙` — `handled · research fanned out`
  - `⊘` — `cancelled`

With the map rendered, read the prior sessions to resume the conversation:

→ Load **[continuity-load.md](continuity-load.md)** and follow its instructions as written.

Then frame the opener:

> *Output the next fenced block as a code block:*

```
You can open a fresh thread — a new area of the work you want
to sketch out — and we'll explore it the same way we did first
time, then synthesise topics at the end. Or you can name changes
to existing items: add, remove, rename, re-route, edit summary,
edit description, mark handled. Both in one go is fine.

Say "show map" anytime to pull the map back up.

What's on your mind for this map?
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### If `discovery_map` is empty and seeds or imports exist

Fresh first-session with seed material. Read each file listed under `seeds[]` then `imports[]` (paths are relative to `.workflows/{work_unit}/`) — the seed is the primary launchpad, imports are supporting. Use this content to launch the conversation: reflect what's there, ask exploratory questions about it. Don't dump it back at the user verbatim — synthesise.

> *Output the next fenced block as a code block:*

```
Read your {seed | import(s) | seed and import(s)}. Here's the shape
I'm picking up:

  {one-line summary of what the seed/import material describes}

Before we name topics, let's pull on a few things — {one or two
exploratory questions drawn from the seed material}.
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### Otherwise

Fresh first-session, no map, no imports. The work-unit description has been read silently — don't narrate or summarise it back. Open with this prompt:

> *Output the next fenced block as a code block:*

```
Tell me about what you want to build. Don't worry about
structure — describe it the way it sits in your head right now.

I'll ask some open questions to pull on the idea before we
synthesise topics.
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

## B. Session Loop

No fixed cadence — follow the conversation, not a checklist. **The loop is the exploration.** Topics are synthesised at the harvest in **C**, when the user pulls.

1. **Listen.** Take in what the user just said.
2. **Recognise intent.** The user's message may contain:
   - **Exploration content** — answers to your questions, new surfaces, descriptions of how parts work or connect, positions taken on a decision. Continue the conversation: push on the thread the user opened, counter-frame, follow where it leads. See [discovery-guidelines.md](discovery-guidelines.md) → *The Exploration Stance — How* for the register and where to push.
   - **An edit operation on an existing map item** — *"remove X"*, *"rename X to Y"*, *"edit summary of X"*, etc. Only possible when the map is non-empty. Delegate to [map-operations.md](map-operations.md) — it handles the operation, writes to the **Edits** section, commits.
   - **A request to see the map** — *"show map"*, *"what's on the map"*. Re-render using the opener's render rules. No STOP gate; just render and continue.
   - **A request to see dismissed items** — *"show dismissed"*, *"what was removed"*. Load [show-dismissed.md](show-dismissed.md).
   - **A KB query for prior context** — when a conversational thread would benefit from prior work on this or sibling work units, invoke `knowledge query` with a query derived from the thread (see [contextual-query.md](../../workflow-knowledge/references/contextual-query.md) for the pattern).
   - **A harvest pull** — *"let's pull topics"*, *"that covers it"*, *"good enough to start"*, *"let's wrap"*, *"done"*, *"ready to go"*. Route to **C. Harvest**.

3. **Continue the exploration.** One thread at a time. Follow the conversation. See *The Exploration Stance — How* in the guidelines for the sparring register.

4. **Read the arc for convergence.** Track whether the conversation is diverging, in tension, or converging (see [harvest-nudge.md](harvest-nudge.md) for the arc, and [discovery-guidelines.md](discovery-guidelines.md) → *Reading Convergence* for the proxies). When it converges:

   → Load **[harvest-nudge.md](harvest-nudge.md)** and follow its instructions to surface the ambient nudge, then **stay in B** and keep exploring.

   Convergence cues the nudge; it does **not** trigger synthesis. Only the user's pull (step 2) routes to **C**.

5. **Keep the running record.** The **Exploration** section is a constant running record of the conversation — not verbatim, but **not summarised away; nothing of substance is lost.** Write to it at natural pauses (a thread worked through, the conversation about to branch, detail accumulating, context-compaction risk). Capture the journey: the ideas, the objections, the pivots, the route taken, the **false paths and failed designs** (with why they were dropped), the soft decisions reached, and the **answers to any research or investigation done in-session**. Append-forward — add depth by **layering down**, never by editing earlier entries back. Prose, not transcript; the log survives context refresh, in-context memory does not. Lossiness defeats the point: if the detail of the discovery is lost, the session was wasted.

   The lazy-creation rule applies: this may create the session log file if it doesn't exist yet — see [template.md](template.md) → *Lazy creation and finalisation*, which sets the active-session marker on first creation. After writing, commit:

   ```bash
   git add -- .workflows/{work_unit}/
   git commit -m "discovery({work_unit}): exploration notes — session-{session_number:03d}"
   ```

→ Proceed to **C. Harvest** when the user pulls the harvest (a harvest pull recognised in step 2). Otherwise loop within **B** — convergence (step 4) cues the nudge but stays in the loop.

## C. Harvest

Reached from **B** step 2 when the user pulls the harvest. Synthesis is user-pulled — there is no Claude-side gate here; the user has already asked.

→ Load **[topic-synthesis.md](topic-synthesis.md)** and follow its instructions as written. It owns its own confirmation (`y` / `explore` / `adjust`) and returns a synthesis outcome:

#### If the outcome is `confirmed`

→ Return to caller.

#### If the outcome is `explore`

→ Return to **B. Session Loop**.
