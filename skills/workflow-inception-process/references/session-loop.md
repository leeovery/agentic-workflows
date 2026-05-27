# Session Loop

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Follow the curatorial moves and hard rules from **[inception-guidelines.md](inception-guidelines.md)** throughout. No background agents, no review cycles, no perspective dispatches.

The loop is the same in every session — first or Nth. State-driven branches in **A. Open** pick the opening shape; **B. Session Loop** runs pure exploration; **C. Endpoint and Synthesis** detects the endpoint and produces the topic set. When the map already has items, edits to existing items are also available during the loop — they don't change the exploration→synthesis arc, they just record edits to the existing map alongside.

## A. Open

Read `discovery_map`, `dismissed`, and `imports` from the most recent discovery output. Read `session_number` and any active file path from the resume state set at Step 0.

#### If a resume was selected at Step 0

The user chose `continue` at resume detection — the active session log on disk is the working state. Read `.workflows/{work_unit}/inception/session-{session_number}.md` to load **Exploration**, **Edits**, and any partially-filled **Topics Identified** into context.

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

This is a continuing inception session — the map exists, so editing existing items is on the table alongside exploring new areas. Render the map as an anchor using the discovery output from Step 1, then open the conversation:

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
to sketch out — and we'll explore it the same way we did first
time, then synthesise topics at the end. Or you can name changes
to existing items: add, remove, rename, re-route, edit summary,
edit description. Both in one go is fine.

Say "show map" anytime to pull the map back up.
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### If `discovery_map` is empty and imports exist

Fresh first-session with seed material. Read each file listed under `imports[]` (paths are relative to `.workflows/{work_unit}/`). Use the import content as the conversation launchpad: reflect what's actually in the seed material, ask exploratory questions about what's there. Don't dump the imports back at the user verbatim — synthesise.

> *Output the next fenced block as a code block:*

```
Read your import(s). Here's the shape I'm picking up:

  {one-line summary of what the imports describe}

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

No fixed cadence — follow the conversation, not a checklist. **The loop is pure exploration.** Topics are not surfaced during the loop; they are synthesised at endpoint in **C**.

1. **Listen.** Take in what the user just said.
2. **Recognise intent.** The user's message may contain:
   - **Exploration content** — answers to your questions, new surfaces, descriptions of how parts work or connect. Continue the conversation: ask the next exploratory question, follow the thread the user opened. See [inception-guidelines.md](inception-guidelines.md) → *Open Exploration — How* for what to ask and where to push.
   - **An edit operation on an existing map item** — *"remove X"*, *"rename X to Y"*, *"edit summary of X"*, etc. Only possible when the map is non-empty. Delegate to [map-operations.md](map-operations.md) — it handles the operation, writes to the **Edits** section, commits.
   - **A request to see the map** — *"show map"*, *"what's on the map"*. Re-render using the opener's render rules. No STOP gate; just render and continue.
   - **A request to see dismissed items** — *"show dismissed"*, *"what was removed"*. Load [show-dismissed.md](show-dismissed.md).
   - **A KB query for prior context** — when a conversational thread would benefit from prior work on this or sibling work units, invoke `knowledge query` with a query derived from the thread (see [contextual-query.md](../../workflow-knowledge/references/contextual-query.md) for the pattern).
   - **An endpoint signal** — *"that covers it"*, *"good enough to start"*, *"let's wrap"*, *"done"*, *"ready to go"*. Route to **C. Endpoint and Synthesis**.

3. **Continue the exploration.** Ask one question at a time. Follow the conversation. Stay in *open exploration* mode — don't decompose into topics inline. See *Mirroring, not challenging* in the guidelines.

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

   The lazy-creation rule applies: this may create the session log file if it doesn't exist yet — see [template.md](template.md) → *Lazy creation and finalisation*. After writing, set the active-session marker (idempotent) and commit:

   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception active_session "{session_number:03d}"
   git add -- .workflows/{work_unit}/
   git commit -m "inception({work_unit}): exploration notes — session-{session_number:03d}"
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

Load **[topic-synthesis.md](topic-synthesis.md)** and follow its instructions as written.

When `topic-synthesis.md` returns:

→ Return to caller.

#### If keep going

→ Return to **B. Session Loop**.
