# Topic Synthesis

*Reference for **[workflow-discovery](../SKILL.md)***

---

The endpoint ceremony. Analyse the session's exploration as a whole, produce a topic set, and confirm it with the user. Loaded by [session-loop.md](session-loop.md) C when the user confirms ready to synthesise.

## A. Gather Source Material

You have three sources of truth:

1. **The Exploration section** of the active session log at `.workflows/{work_unit}/discovery/session-{session_number:03d}.md`. Read it now if you haven't recently — your in-context memory might be stale.
2. **In-context memory of the conversation.** When not compacted, this carries detail the Exploration summary may have skipped.
3. **The existing discovery map** from Step 7's discovery output. Continuing sessions add to it; first sessions seed it.

Cross-reference all three. The Exploration section is durable; conversation memory is richer-but-volatile; the existing map is the anchor for continuing sessions.

→ Proceed to **B. Identify Surfaces**.

## B. Identify Surfaces

Read out the **distinct surfaces** the exploration named — the parts of the product that have their own user interaction, own decision space, own boundary. These are the candidates for topic-ness; they're not topics yet.

A surface is something like *menu-management*, *kitchen-printers*, *operator-analytics*. It has a clear name, a clear edge, and would warrant its own future research or discussion.

If the exploration touched on a surface only in passing and didn't develop it, note it but don't force it into a topic. Let it surface in a later session if it grows.

→ Proceed to **C. Apply Granularity Rules**.

## C. Apply Granularity Rules

→ Load **[topic-granularity.md](../../workflow-shared/references/topic-granularity.md)** and follow its instructions as written.

Apply the independence test and anti-patterns. Two surfaces that share a domain, data model, user journey, or decision space should merge into one topic. One surface that has independent stakeholders or genuinely separate concerns can split — but resist splitting one product surface into its implementation concerns. The map item is the unit of *future research or discussion*, not the unit of *implementation*.

For continuing sessions, also check: does any new candidate overlap with an existing map item? If so, the exploration likely belongs *inside* that item's future discussion or research, not as a new sibling.

→ Proceed to **D. Infer Routing**.

## D. Infer Routing

→ Load **[routing-inference.md](routing-inference.md)** and follow its instructions as written.

For each topic in the synthesised set, propose `research` or `discussion` based on cues from how the user framed it during exploration. The proposal is tentative — the user can flip it at the confirmation gate in **E**.

→ Proceed to **E. Render Proposal**.

## E. Render Proposal

> *Output the next fenced block as a code block:*

```
Synthesised Discovery Map — {work_unit:(titlecase)}

@foreach(topic in proposed_set)
  • {topic.name} — {one-line summary}    [routing: {research|discussion}]
@endforeach

{N} topic(s). One-line summary per topic comes from the exploration;
routing is my read of where each one goes next.
```

For continuing sessions, mark new items with `(new this session)` and include existing map items below unchanged so the full picture is visible.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Confirm to commit, or tell me what to adjust.

- **`y`/`yes`** — Commit these topics and conclude
- **`e`/`explore`** — Go back to exploration; not ready to commit yet
- **Adjust** — Tell me what to change (split, merge, rename, re-route, edit summary)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

The topic set is confirmed. Hold it in conversation memory as the **working list** for Step 12 confirm-and-persist. Do not write Topics Identified to the log yet — Step 12 writes the manifest items and the log section together. Synthesis outcome: `confirmed`.

→ Return to caller.

#### If `explore`

The user isn't ready to commit — no working list is produced. Synthesis outcome: `explore`.

→ Return to caller.

#### If adjust

Apply the named adjustments to the working set:

- **Split** *"X is really two things — A and B"* — replace the topic with two
- **Merge** *"X and Y are one"* — combine into one topic; propose a unifying name
- **Rename** *"X should be called Z"* — swap the name
- **Re-route** *"Y should be research"* — flip routing
- **Edit summary** *"Y's summary should be ..."* — replace the summary line
- **Drop** *"Forget Z entirely"* — remove from set (note: this means Claude misread the exploration; reflect on what was overweighted)

After applying, re-render the proposal (back to the top of **E**) and ask again. Loop until confirmed or `explore` is chosen.

→ Return to **E. Render Proposal**.
