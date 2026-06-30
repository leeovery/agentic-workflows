# Session Loop

*Reference for **[workflow-discovery](../SKILL.md)***

---

Follow the curatorial moves and hard rules from **[discovery-guidelines.md](discovery-guidelines.md)** throughout. No background agents, no review cycles, no perspective dispatches.

State-driven branches in **A. Open** pick the opening shape; **B. Session Loop** runs the exploration and surfaces the ambient harvest nudge at convergence; **C. Harvest** is the user-pulled synthesis that produces the topic set. When the map already has items, edits to existing items happen in the loop alongside exploration.

## A. Open

Read `discovery_map` and `dismissed` from the most recent discovery output. `imports` was read from the manifest and is already held in conversation memory (Step 8). Read `session_number` and any active file path from the resume state set at Step 6.

#### If `macro_continuation` is set (new epic, just confirmed)

The macro shaping at Step 4 already explored the work enough to confirm it's an epic and surfaced the first leanings; the confirm-trigger backfilled that into `session-{session_number}.md`. Don't re-open with a cold prompt — the conversation is already live. Render a brief transition that moves from "what is this" into open exploration of the whole:

> *Output the next fenced block as a code block:*

```
That's an epic — work unit created. Now let's keep pulling on it —
the shape, the tensions, the leanings — the same way we started.
Topics fall out at the end, whenever you want to pull them; just say
when.

What do you want to pull on next?
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### If a resume was selected at Step 6, or a context refresh recovered a pre-synthesis session (the map is empty and the session log holds Exploration)

The session is picked up from disk — either the user chose `continue` at resume detection, or a context refresh recovered a discovery session that was confirmed but not yet synthesised (e.g. a new epic whose in-memory `macro_continuation` was lost). The active session log on disk is the working state — the highest-numbered `.workflows/{work_unit}/discovery/sessions/session-NNN.md`, whose number is `session_number`. Read it to load **Exploration**, **Edits**, and any partially-filled **Topics Identified** into context.

Brief the user with the working state and ask where to pick up:

> *Output the next fenced block as a code block:*

```
Picking up where we left off.

  Exploration so far:
  {one-line summary of the Exploration narrative — or "no exploration yet" if empty}

  Edits applied:
  • {operation} {target}
  • ...

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

No fixed cadence — follow the conversation, not a checklist. **The loop explores — substance included; topics are not named here.** They are synthesised only when the user pulls a harvest in **C**.

1. **Listen.** Take in what the user just said.
2. **Recognise intent.** The user's message may contain:
   - **Exploration content** — answers to your questions, new surfaces, descriptions of how parts work or connect, leanings and tensions. Continue the conversation: spar on the thread the user opened, surface the next tension, ask the next exploratory question. See [discovery-guidelines.md](discovery-guidelines.md) → *Open Exploration — How* for what to push on and how to challenge.
   - **An edit operation on an existing map item** — *"remove X"*, *"rename X to Y"*, *"edit summary of X"*, etc. Only possible when the map is non-empty. Delegate to [map-operations.md](map-operations.md) — it handles the operation, writes to the **Edits** section, commits.
   - **A request to see the map** — *"show map"*, *"what's on the map"*. Re-render using the opener's render rules. No STOP gate; just render and continue.
   - **A request to see dismissed items** — *"show dismissed"*, *"what was removed"*. Load [show-dismissed.md](show-dismissed.md).
   - **A KB query for prior context** — when a conversational thread would benefit from prior work on this or sibling work units, invoke `knowledge query` with a query derived from the thread (see [contextual-query.md](../../workflow-knowledge/references/contextual-query.md) for the pattern).
   - **A harvest pull** — the user signals they want to pull topics out and move forward: *"let's pull topics"*, *"synthesise"*, *"that covers it"*, *"good enough to start"*, *"done"*, *"ready to go"*. Route to **C. Harvest**.

3. **Continue the exploration.** One thread at a time; follow the conversation. See *Collaborative challenge — sparring, not mirroring* in [discovery-guidelines.md](discovery-guidelines.md) B.

4. **Read the arc.** When the conversation may be converging — circling back to covered ground, turns that only confirm, the picture settling — → Load [harvest-nudge.md](harvest-nudge.md). It reads the arc and, only if the conversation has truly converged, weaves an ambient harvest nudge into your turn; otherwise no nudge. Either way you stay in **B** — the nudge is an offer, not a route to synthesis. Synthesis happens only on a user pull (step 2).

5. **Document at natural pauses.** Write a **medium-fidelity narrative** entry to the **Exploration** section of the session log at:
   - A thread has been adequately explored — capture how it moved and where it landed
   - Conversation is about to branch to a new area — close out the current thread
   - Context-compaction risk feels real (long conversation, lots of detail accumulating)

   The entry captures the **reasoning-moves** — ideas, objections, pivots, soft-landings, and the dead-ends and rejected paths (what was set aside and why). Not verbatim, not a strong summary. Append-forward: depth accrues by layering down new entries, never by editing earlier ones. The log survives context refresh; in-context memory does not.

   The lazy-creation rule applies: this may create the session log file if it doesn't exist yet — see [template.md](template.md) → *Lazy creation and finalisation*, which sets the active-session marker on first creation. After writing, commit:

   ```bash
   git add -- .workflows/{work_unit}/
   git commit -m "discovery({work_unit}): exploration notes — session-{session_number:03d}"
   ```

→ Proceed to **C. Harvest** when a harvest pull is recognised in step 2. Otherwise loop within **B** — including after surfacing the nudge in step 4.

## C. Harvest

Reached from B when the user pulls a harvest. Synthesis is theirs to trigger — there is no Claude-proposed endpoint and no readiness gate here. The user has asked to pull topics out, so go straight to synthesis.

Load **[topic-synthesis.md](topic-synthesis.md)** and follow its instructions as written. It owns the proposal and the confirmation gate, and returns a synthesis outcome:

#### If the outcome is `confirmed`

→ Return to caller.

#### If the outcome is `explore`

→ Return to **B. Session Loop**.
