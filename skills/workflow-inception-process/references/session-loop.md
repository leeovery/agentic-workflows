# Session Loop

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Follow the curatorial moves and hard rules from **[inception-guidelines.md](inception-guidelines.md)** throughout. No background agents, no review cycles, no perspective dispatches.

The loop is the same in every session — first or Nth. State-driven branches in **A. Open** pick the opening shape; the conversational loop in **B** runs the same way regardless. When the map already has items, edits to existing items are also available moves — see **B. Session Loop** → *Map-operation moves*.

## A. Open

Read `discovery_map`, `dismissed`, and `imports` from the most recent discovery output. Read `session_number` and any active file path from the resume state set at Step 0.

#### If a resume was selected at Step 0

The user chose `continue` at resume detection — the active session log on disk is the working state. Read `.workflows/{work_unit}/inception/session-{session_number}.md` to load **Topics Identified** and **Changes** into context.

Brief the user with the working state and ask where to pick up:

> *Output the next fenced block as a code block:*

```
Picking up where we left off. Working state:

  Topics surfaced this session:
  • {topic-1} — {summary}    [routing: {research|discussion}]
  • ...

  Changes applied this session:
  • {operation} {target}
  • ...

Where do you want to take it from here?
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### If `discovery_map` is non-empty (map already populated)

This is a continuing inception session — the map exists, so editing existing items is on the table alongside surfacing new ones. Render the map as an anchor using the discovery output from Step 1, then open the conversation:

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Inception — {work_unit:(titlecase)}
●───────────────────────────────────────────────●

  Discovery Map ({map_summary})

@foreach(topic in discovery_map)
  @if(not last_topic) ├─ @else └─ @endif {topic.tier}  {topic.name:(titlecase)}  {lifecycle_label}
@endforeach
```

Render rules:

- `map_summary` — `{total} topics — {decided} decided · {in_flight} in flight · {ready} ready · {fresh} fresh · {cancelled} cancelled`. Omit zero-count categories from the dot-separated tail. Always include `{total} topics`.
- Tier ordering — discovery output is already tier-sorted (`→ ◐ ✓ ○ ⊘`, alphabetical within tier). Render in the order given.
- `lifecycle_label` by tier:
  - `→` — `research complete · ready for discussion`
  - `◐` — `researching` or `discussing` (use `topic.current_phase`)
  - `✓` — `decided`
  - `○` — `fresh · routed to {topic.routing}` (omit ` · routed to ...` if `topic.routing` is null)
  - `⊘` — `cancelled`

Then frame the opener:

> *Output the next fenced block as a code block:*

```
What's on your mind for this map?

You can open a fresh thread — a new area of the work you want
to sketch out — and we'll surface topics for it the same way
we did first time. Or you can name changes to existing items:
add, remove, rename, re-route, edit summary, edit description.
Both in one go is fine.

Say "show map" anytime to pull the map back up.
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### If `discovery_map` is empty and imports exist

Fresh first-session with seed material. Read each file listed under `imports[]` (paths are relative to `.workflows/{work_unit}/`). Use the import content as the conversation launchpad: reflect what's actually in the seed material, propose tentative topic shapes drawn from it, and ask which to develop first. Don't dump the imports back at the user verbatim — synthesise.

> *Output the next fenced block as a code block:*

```
Read your import(s). Here's what I'm picking up so far:

  • {tentative-topic-1} — {one-line shape inferred from seed}
  • {tentative-topic-2} — {one-line shape inferred from seed}

These are openers, not commitments. Which would you like
to develop first, or is there something else in there I
should be reading differently?
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### Otherwise

Fresh first-session, no map, no imports. The work-unit description has been read silently — don't narrate or summarise it back. Open with this prompt:

> *Output the next fenced block as a code block:*

```
Tell me about what you want to build. Don't worry about
structure — describe it the way you would to a colleague
who needs to understand the rough shape.
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

## B. Session Loop

No fixed cadence — follow the conversation, not a checklist. The loop runs until the user signals convergence.

1. **Listen.** Take in what the user just said.
2. **Recognise intent.** The user's message may contain:
   - **New topic shapes** — surface as candidates with tentative routing inferred from framing (see *New-topic moves* below).
   - **Map-operation moves** — edit summary, edit description, remove, rename, change routing on existing items (see *Map-operation moves* below). Only relevant when the map is non-empty.
   - **A request to see the map** — *"show map"*, *"what's on the map"*, *"pull up the map"*. Re-render using the opener's render rules. No STOP gate; just render and continue the loop.
   - **A request to see dismissed items** — *"show dismissed"*, *"what was removed"*. Load [show-dismissed.md](show-dismissed.md).
   - **A KB query for prior context** — when a conversational thread would benefit from prior work on this or sibling work units (e.g. *"didn't we already discuss something like this?"*), invoke `knowledge query` with a query derived from the thread (see [contextual-query.md](../../workflow-knowledge/references/contextual-query.md) for the pattern). Not a pre-loaded primer — a tool to reach for when it would help.
   - **A signal to converge** — *"that covers it"*, *"good enough to start"*, *"let's wrap"*, *"done"*.

3. **Surface and confirm inline.** Each candidate (new topic or proposed edit) reflects back with the routing or operation inferred from framing. The user agrees, flips, merges, drops, or renames. Treat their response as authoritative; don't re-litigate.

4. **Anchor and return** if the conversation tunnels into one item's mechanism. Re-pose the question at the map level: *"want to come back to the rest first?"*

5. **Update the working state.** New topics: add to the in-conversation working list and append to the draft session log under **Topics Identified** at natural pauses. Edits to existing items: delegated to map-operations (see below) which handles its own persistence and logging.

6. **Continue.** Stay open. Surface more topics, follow tangents that produce new topics, anchor when the conversation drifts.

Do not push for completeness. The user signals convergence when they've got enough.

**New-topic moves:** When a new topic surfaces, confirm inline (*"hearing {topic} — sounds like research, yes?"*). After confirmation, the topic enters the in-conversation working list. At a natural pause (topic settled, conversation about to branch, context-compaction risk), write the working list to the draft session log. This may create the file if it doesn't exist yet — see [template.md](template.md) → *Lazy creation and finalisation*. After writing, set the active-session marker (idempotent) and commit:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception active_session "{session_number:03d}"
git add -- .workflows/{work_unit}/
git commit -m "inception({work_unit}): draft session-{session_number:03d} — surfaced topics"
```

Manifest writes for new items are **deferred to Step 6 confirm-and-persist** — do not write inception items to the manifest mid-loop. The `active_session` marker is the only manifest write that happens here.

**Map-operation moves:** When the user names an edit to an existing map item, delegate to [map-operations.md](map-operations.md) for that operation. Map-operations handles validation, per-item confirmation, manifest write, session-log append (under **Changes**), and commit. It may create the session log file on its first invocation in a session. When it returns, continue the conversation.

**Discarding a raised candidate:** If a topic is raised and then dropped during the loop (the user merges it, decides it's not its own thing, or vetoes the surface), append it to the draft session log under **Considered and Discarded** with a one-line reason at the next natural pause. Same lazy-creation rule applies.

→ Proceed to **C. Convergence Signal**.

## C. Convergence Signal

Watch for these convergence signals:

- The user explicitly says they're done (*"that covers it"*, *"good enough to start"*, *"let's wrap"*).
- The conversation has stalled — no new shapes are surfacing and the user has gone quiet on prompts.
- The user keeps re-framing items already on the map rather than naming new ones.

When you see one, render the proposed map and offer to conclude.

> *Output the next fenced block as a code block:*

```
Proposed Discovery Map — {work_unit:(titlecase)}

  • {topic-1} — {one-line summary}    [routing: {research|discussion}]
  • {topic-2} — {one-line summary}    [routing: {research|discussion}]
  • {topic-3} — {one-line summary}    [routing: {research|discussion}]

{N} topic(s).
```

Include new items from this session's working list **and** existing map items. New items are marked with `(new this session)`.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to seed this map and conclude?

- **`y`/`yes`** — Persist any new items and conclude inception
- **Keep going** — Tell me what to adjust (add, drop, rename, re-route, edit summary)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Return to caller.

#### If keep going

→ Return to **B. Session Loop**.
