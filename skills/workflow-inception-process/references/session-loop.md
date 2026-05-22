# Session Loop

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Follow the curatorial moves and hard rules from **[inception-guidelines.md](inception-guidelines.md)** throughout. No background agents, no review cycles, no perspective dispatches.

## A. Open

Read `.workflows/{work_unit}/inception/session-001.md` to load the working list (if any) into context.

#### If **Topics Identified** already has entries

This is a resume. Brief the user with the working list and ask where to pick up:

> *Output the next fenced block as a code block:*

```
Picking up where we left off. Working list so far:

  • {topic-1} — {summary}    [routing: {research|discussion}]
  • {topic-2} — {summary}    [routing: {research|discussion}]

Where do you want to take it from here?
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### If **Topics Identified** is empty and imports exist

Check for imports:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit} imports
```

If `true`, read each file listed under `manifest.imports[]` (paths are relative to `.workflows/{work_unit}/`). Use the import content as the conversation launchpad: reflect what's actually in the seed material, propose tentative topic shapes drawn from it, and ask which to develop first. Don't dump the imports back at the user verbatim — synthesise.

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

Fresh start. The work-unit description has been read silently — don't narrate or summarise it back. Open with this prompt:

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
2. **Surface.** When you hear a distinct shape, reflect it back as a candidate topic with tentative routing inferred from the user's framing. Use the curatorial moves — reflective decomposition, tentative grouping, coarseness check. Multiple topics can come out of one user turn; reflect them as a set if so.
3. **Confirm inline.** Each topic surfaces as *"hearing X — sounds like research, yes?"* — the user agrees, flips routing, merges with another topic, drops it, or renames it. Treat their response as authoritative; don't re-litigate.
4. **Anchor and return** if the conversation tunnels into one item's mechanism. Re-pose the question at the map level: *"want to come back to the rest first?"*
5. **Update the working list.** Add, rename, merge, or drop entries to match what the user just confirmed. The working list lives in two places: conversation memory and the draft `session-001.md`. Manifest writes are **deferred to the confirm-and-persist step** (Step 5 of the backbone, after document review) — do not write inception items to the manifest mid-loop.
6. **Update the draft session log** at natural pauses. Append topics to **Topics Identified**; note dropped items under **Considered and Discarded** with the reason. Write when a topic settles, when the conversation is about to branch, or when context compaction is a realistic risk — not after every exchange. Then commit. If you defer the write, the next context refresh loses the surface state.
7. **Continue.** Stay open. Surface more topics, follow tangents that produce new topics, anchor when the conversation drifts.

Do not push for completeness. The user signals convergence when they've got enough.

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

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to seed this map and start work?

- **`y`/`yes`** — Persist the map and conclude inception
- **Keep going** — Tell me what to adjust (add, drop, rename, re-route, edit summary)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Return to caller.

#### If keep going

→ Return to **B. Session Loop**.
