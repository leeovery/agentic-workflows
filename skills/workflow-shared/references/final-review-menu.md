# Final Review Menu

*Shared reference for end-of-phase final reviews (research, discussion). Wraps the background-agent-surfacing protocol with phase-conclusion menu wording.*

---

This reference is loaded at phase conclusion when a final-review agent has produced a report. It renders a two-option menu (review / skip) and delegates the raise-one-finding loop to the shared surfacing protocol. Lifecycle state lives in the engine's agent store.

**Parameters** (provided by caller via Load directive):

- `work_unit`, `phase`, `topic` — the agent store address

The **never-dump rules apply in full**. Findings are raised one at a time.

## A. Check Review State

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} {phase} {topic}
```

Take the highest-numbered row of kind `review`.

#### If it is `incorporated` (or no review row exists)

→ Return to caller.

#### If it is `pending`

Read the content file completely — `.workflows/.cache/{work_unit}/{phase}/{topic}/{id}.md` — and collect its finding ids (the `## {ID}` section headings).

**If the report has no findings:**

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent ack {work_unit} {phase} {topic} {id} --clean
```

> *Output the next fenced block as a code block:*

```
Background review returned — nothing new beyond what we've already covered.
```

→ Return to caller.

**Otherwise:**

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent ack {work_unit} {phase} {topic} {id} --findings {F1,F2,…}
```

→ Proceed to **B. Decide Action** with the response's row.

#### If it is `acknowledged`

→ Proceed to **B. Decide Action** with the row.

## B. Decide Action

#### If the row's `remaining` is empty

The engine has already incorporated it.

→ Return to caller.

#### If the row's `remaining` is non-empty

Conclusion is a decision point every time — whether the drain started mid-session or at a prior conclusion attempt, the user chooses between continuing the walk-through and concluding with the rest on record.

→ Proceed to **C. Render Menu**.

## C. Render Menu

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Final review: {N} area(s) still unreviewed.

- **`r`/`review`** — Walk through them one at a time
- **`s`/`skip`** — Acknowledge and conclude the topic
· · · · · · · · · · · ·
```

Record the announce:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent announce {work_unit} {phase} {topic} {id}
```

**STOP.** Wait for user response.

#### If `review`

Apply the raise-one-finding step inline this turn (do not re-prompt):

1. Pick the single most contextually relevant finding from the row's `remaining`. Contextual relevance outranks the list order. If nothing is particularly relevant, pick the one with the broadest implications.
2. Record it — raising the last finding incorporates the row automatically:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs agent surface {work_unit} {phase} {topic} {id} {finding}
   ```
3. Reframe the finding as one concrete concern tied to the current context, phrased as a single question. Do not read it out verbatim.
4. Raise it in the current turn. One question, no lists, no bundled follow-ups, no menu.

→ Return to caller.

#### If `skip`

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent incorporate {work_unit} {phase} {topic} {id}
```

The declined ids stay recorded unsurfaced, and the content file is preserved on disk for the record.

→ Return to caller.

## Never-Dump Checklist

Before producing any surfacing output, verify:

- □ Raising AT MOST one finding this turn
- □ Asking AT MOST one question this turn
- □ No bulleted list of gaps
- □ Not reading the content file verbatim

If any box is unchecked, stop and reframe.
