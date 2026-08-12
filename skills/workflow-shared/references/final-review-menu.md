# Final Review Menu

*Shared reference for end-of-phase final reviews (research, discussion). Wraps the background-agent-surfacing protocol with phase-conclusion menu wording.*

---

This reference is loaded at phase conclusion when a final-review agent has produced a report. It renders a two-option menu (review / skip) and delegates the lane routing to the shared surfacing protocol. Lifecycle state lives in the engine's agent store.

**Parameters** (provided by caller via Load directive):

- `work_unit`, `phase`, `topic` — the agent store address

The **never-dump rules apply in full** — they live with the surfacing itself, in **[background-agent-surfacing.md](background-agent-surfacing.md)**, and this reference never restates them.

## A. Check Review State

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} {phase} {topic}
```

Take the highest-numbered row of kind `review`.

#### If it is `incorporated` (or no review row exists)

→ Return to caller.

#### If it is `in-flight`

The watched agent hasn't returned — nothing to drain yet.

→ Return to caller.

#### If it is `pending`

Read the content file completely — `.workflows/.cache/{work_unit}/{phase}/{topic}/{id}.md`. The finding ids come from the agent's returned status block (its `FINDINGS:`/`TENSIONS:` line — the author's own declaration); when that message is no longer in context, fall back to the file's `### {ID}:` section headings. Cross-check the count either way.

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

→ Proceed to **B. Render Menu** with the response's row.

#### If it is `acknowledged`

→ Proceed to **B. Render Menu** with the row.

## B. Render Menu

Conclusion is a decision point every time — whether the drain started mid-session or at a prior conclusion attempt, the user chooses between continuing the walk-through and concluding with the rest on record.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ Final review: {N} area(s) still unreviewed.`**

**`r/review`** → Work through them now
**`s/skip`**   → Acknowledge and conclude the topic
```

Record the announce:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent announce {work_unit} {phase} {topic} {id}
```

**STOP.** Wait for user response.

#### If `review`

Surface inline this turn — do not re-prompt, and do not re-enter the protocol at its **A**: this reference has already scanned, acknowledged, and announced the row. First read each finding's lane from the report and re-classify as **B. First Read** in the protocol prescribes — the report was written cold, and at conclusion the document has moved furthest from it. Then what the user sees is whichever lane comes first: a batch screen, or one raised finding. The protocol's parameters here are agent_type = `review`, work_unit = `{work_unit}`, phase = `{phase}`, topic = `{topic}`.

Follow **D. Route by Lane** in **[background-agent-surfacing.md](background-agent-surfacing.md)**.

→ Return to caller.

#### If `skip`

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent incorporate {work_unit} {phase} {topic} {id}
```

The declined ids stay recorded unsurfaced, and the content file is preserved on disk for the record.

→ Return to caller.
