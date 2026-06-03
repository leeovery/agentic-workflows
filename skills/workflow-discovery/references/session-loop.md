# Session Loop

*Reference for **[workflow-discovery](../SKILL.md)***

---

Follow the curatorial moves and hard rules from **[discovery-guidelines.md](discovery-guidelines.md)** throughout. No background agents, no review cycles, no perspective dispatches.

State-driven branches in **A. Open** pick the opening shape; **B. Session Loop** runs pure exploration; **C. Endpoint and Synthesis** detects the endpoint and produces the topic set. When the map already has items, edits to existing items happen in the loop alongside exploration.

## A. Open

Read `discovery_map` and `dismissed` from the most recent discovery output. `imports` was read from the manifest and is already held in conversation memory (Step 8). Read `session_number` and any active file path from the resume state set at Step 6.

#### If `macro_continuation` is set (new epic, just confirmed)

The macro shaping at Step 4 already explored the work enough to confirm it's an epic and surfaced the first topic seeds; the confirm-trigger backfilled that into `session-{session_number}.md`. Don't re-open with a cold prompt — the conversation is already live. Render a brief transition that moves from "what is this" to "what are its topics":

> *Output the next fenced block as a code block:*

```
That's an epic — work unit created. Now let's map its topics. We can
keep pulling on the shape, or synthesise the topics we've already
sketched whenever you're ready.

Anything more to sketch, or shall I synthesise?
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### If a resume was selected at Step 6, or a context refresh recovered a pre-synthesis session (the map is empty and the session log holds Exploration)

The session is picked up from disk — either the user chose `continue` at resume detection, or a context refresh recovered a discovery session that was confirmed but not yet synthesised (e.g. a new epic whose in-memory `macro_continuation` was lost). The active session log on disk is the working state — the highest-numbered `.workflows/{work_unit}/discovery/session-NNN.md`, whose number is `session_number`. Read it to load **Exploration**, **Edits**, and any partially-filled **Topics Identified** into context.

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

- `tier_breakdown` — append ` — {decided} decided · {in_flight} in flight · {ready} ready · {fresh} fresh · {cancelled} cancelled` (omitting zero-count categories) only when more than one tier bucket is non-zero. When only one bucket is non-zero, omit the breakdown and render just `Discovery Map ({total} topics)`.
- `{branch}` — `┌─` for the first row, `└─` for the last, `├─` for the rest. With a single row, use `└─` (no upward stroke).
- Tier ordering — discovery output is already tier-sorted (`→ ◐ ✓ ○ ⊘`, suggested execution order within tier). Render in the order given.
- `lifecycle_label` by tier (wrapped in square brackets per the row template):
  - `→` — `research complete · ready for discussion`
  - `◐` — `researching` or `discussing` (use `topic.current_phase`)
  - `✓` — `decided`
  - `○` — `fresh · routed to {topic.routing}` (omit ` · routed to ...` if `topic.routing` is null)
  - `⊘` — `cancelled`

Then frame the opener:

> *Output the next fenced block as a code block:*

```
You can open a fresh thread — a new area of the work you want
to sketch out — and we'll explore it the same way we did first
time, then synthesise topics at the end. Or you can name changes
to existing items: add, remove, rename, re-route, edit summary,
edit description. Both in one go is fine.

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

No fixed cadence — follow the conversation, not a checklist. **The loop is pure exploration.** Topics are synthesised at endpoint in **C**.

1. **Listen.** Take in what the user just said.
2. **Recognise intent.** The user's message may contain:
   - **Exploration content** — answers to your questions, new surfaces, descriptions of how parts work or connect. Continue the conversation: ask the next exploratory question, follow the thread the user opened. See [discovery-guidelines.md](discovery-guidelines.md) → *Open Exploration — How* for what to ask and where to push.
   - **An edit operation on an existing map item** — *"remove X"*, *"rename X to Y"*, *"edit summary of X"*, etc. Only possible when the map is non-empty. Delegate to [map-operations.md](map-operations.md) — it handles the operation, writes to the **Edits** section, commits.
   - **A request to see the map** — *"show map"*, *"what's on the map"*. Re-render using the opener's render rules. No STOP gate; just render and continue.
   - **A request to see dismissed items** — *"show dismissed"*, *"what was removed"*. Load [show-dismissed.md](show-dismissed.md).
   - **A KB query for prior context** — when a conversational thread would benefit from prior work on this or sibling work units, invoke `knowledge query` with a query derived from the thread (see [contextual-query.md](../../workflow-knowledge/references/contextual-query.md) for the pattern).
   - **An endpoint signal** — *"that covers it"*, *"good enough to start"*, *"let's wrap"*, *"done"*, *"ready to go"*. Route to **C. Endpoint and Synthesis**.

3. **Continue the exploration.** Ask one question at a time. Follow the conversation. See *Mirroring, not challenging* in the guidelines.

4. **Watch for natural endpoint patterns** — Claude-side observations that the picture has been adequately mapped:
   - The conversation circles back to surfaces already covered
   - Several turns produce only confirmation of existing surfaces, no new ground
   - The shape feels mapped to you and to the user

   When you observe these patterns, route to **C. Endpoint and Synthesis** — *propose* endpoint, don't *declare* it. The user confirms or extends.

5. **Document at natural pauses.** Write a strong-summary entry to the **Exploration** section of the session log at:
   - A surface has been adequately explored — capture what was covered
   - Conversation is about to branch to a new area — close out the current thread
   - Context-compaction risk feels real (long conversation, lots of detail accumulating)

   The Exploration entry is **prose, not transcript** — capture what was named, what crystallised, what was decided not to pursue. The log survives context refresh; in-context memory does not.

   The lazy-creation rule applies: this may create the session log file if it doesn't exist yet — see [template.md](template.md) → *Lazy creation and finalisation*, which sets the active-session marker on first creation. After writing, commit:

   ```bash
   git add -- .workflows/{work_unit}/
   git commit -m "discovery({work_unit}): exploration notes — session-{session_number:03d}"
   ```

→ Proceed to **C. Endpoint and Synthesis** when either an endpoint signal is recognised in step 2 or a natural endpoint pattern is observed in step 4. Otherwise loop within **B**.

## C. Endpoint and Synthesis

Reached from B when an endpoint signal arrives from the user or Claude observes natural endpoint patterns.

**Propose endpoint with optional pushback.** First, a one-line read of what got covered, plus zero, one, or two pushback angles if any genuinely unexplored ground comes to mind:

> *Output the next fenced block as a code block:*

```
Feels like we've sketched the shape — {one-line read of what got covered}.

{Optional pushback — one or two angles not yet pulled on. Examples:}
- We didn't talk about how X handles Y — worth a moment?
- Did you want to map Z, or is that scope for later?
```

Pushback is **optional and bounded**. If nothing genuinely unexplored comes to mind, skip the pushback lines entirely. Don't fabricate angles to look thorough.

Then prompt the user:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to synthesise topics?

- **`y`/`yes`** — Synthesise topics now
- **Keep going** — Tell me what else to explore
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

Load **[topic-synthesis.md](topic-synthesis.md)** and follow its instructions as written. It returns a synthesis outcome:

**If the outcome is `confirmed`:**

→ Return to caller.

**If the outcome is `explore`:**

→ Return to **B. Session Loop**.

#### If keep going

→ Return to **B. Session Loop**.
