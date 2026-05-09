# Session Loop

*Reference for **[workflow-inception-process](../SKILL.md)***

---

The inception session is an organic conversation. The working list of surfaced topics — held in conversation memory and mirrored to the draft `session-001.md` — is your tracking backbone. Follow the curatorial moves and hard rules from **[inception-guidelines.md](inception-guidelines.md)** throughout.

No background agents, no review cycles, no perspective dispatches.

## A. Open

Greet the user briefly and invite them to describe what they want to build, with no framework imposed. The work-unit description has already been read silently — do not narrate or summarise it back unless they ask.

> *Output the next fenced block as a code block:*

```
Tell me about what you want to build. Don't worry about
structure — describe it the way you would to a colleague
who needs to understand the rough shape.
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

## B. Session Loop

The loop runs until the user signals convergence. It has no fixed cadence — follow the conversation, not a checklist.

1. **Listen.** Take in what the user just said.
2. **Surface.** When you hear a distinct shape, reflect it back as a candidate topic with tentative routing inferred from the user's framing. Use the curatorial moves — reflective decomposition, tentative grouping, coarseness check. Multiple topics can come out of one user turn; reflect them as a set if so.
3. **Confirm inline.** Each topic surfaces as *"hearing X — sounds like research, yes?"* — the user agrees, flips routing, merges with another topic, drops it, or renames it. Treat their response as authoritative; don't re-litigate.
4. **Anchor and return** if the conversation tunnels into one item's mechanism. Re-pose the question at the map level: *"want to come back to the rest first?"*
5. **Update the working list.** Add, rename, merge, or drop entries to match what the user just confirmed.
6. **Update the draft session log** at natural pauses. Append topics to **Topics Identified**; note dropped items under **Considered and Discarded** with the reason. Do not write after every exchange — write when a topic settles, when the conversation is about to branch, or when context compaction is a realistic risk. Then commit.
7. **Continue.** Stay open. Surface more topics, follow tangents that produce new topics, anchor when the conversation drifts.

Do not push for completeness. The user signals convergence when they've got enough.

→ Proceed to **C. Convergence Signal**.

## C. Convergence Signal

Convergence is the natural end state — not a forced conclusion. Watch for:

- The user explicitly says they're done (*"that covers it"*, *"good enough to start"*, *"let's wrap"*).
- The conversation has stalled — no new shapes are surfacing and the user has gone quiet on prompts.
- The user keeps re-framing items already on the map rather than naming new ones.

When you see a signal, render the proposed map and offer to conclude.

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
- **Keep going** — Stay in the session and refine further
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Return to caller.

#### If keep going

The user wants to refine — adjust, add, drop, re-route, rename. Stay in the loop and apply changes inline as they come. Update the draft session log when items settle. When the user signals convergence again, re-render the map.

→ Return to **B. Session Loop**.

## D. Working List Discipline

The working list lives in **two places** during the session:

1. **Conversation memory** — the active state you reference when surfacing or anchoring.
2. **Draft `session-001.md` on disk** — the recovery surface for context refresh.

These must stay in sync at natural pauses. After a topic settles (added, merged, renamed, routed, dropped), append or update the draft and commit. If you defer the write, the next context refresh loses the surface state.

Manifest writes are **not** part of the session loop — they are deferred to the confirm-and-persist gate (Step 4 of the backbone). During the session, the manifest holds zero inception items. This is intentional: a wrong addition is a one-action removal at the gate, and one batched commit captures the entire framing decision.

→ Return to caller.
