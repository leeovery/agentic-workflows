# Conclude Discussion

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

When the discussion session returns here (either through natural convergence or user-initiated conclusion):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Conclude this discussion and mark as completed?

- **`y`/`yes`** — Conclude discussion
- **`n`/`no`** — Continue discussing
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

1. **Incoming gate.** Read the `## Incoming` section of `.workflows/{work_unit}/discussion/{topic}.md`. If it is not exactly `(none)`, the topic has undrained concerns and cannot conclude:

   > *Output the next fenced block as a code block:*

   ```
     ⚑ This discussion has undrained Incoming concerns.
       Fold them into the Discussion Map and resolve them
       before concluding.
   ```

   → Return to **[the skill](../SKILL.md)** for **Step 5**.

   Otherwise the section is `(none)` — continue.

2. Ensure the Summary section is populated — Key Insights, Open Threads, Current State
3. Set discussion status to completed via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion.{topic} status completed
   ```
4. Final commit
5. Index the completed artifact into the knowledge base:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{work_unit}/discussion/{topic}.md
```

If the index command fails, display the error but do not block — the artifact is already saved:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  The artifact is saved. Indexing can be retried later.
```

Re-indexing a previously-concluded topic is safe — `index` replaces the topic's chunks rather than duplicating them. Re-concluding a topic that an Incoming concern reopened needs no special handling here: the specification phase already detects a regressed source and surfaces it as `[extracted, reopened]`, offering re-incorporation — the bridge re-firing into the epic menu is the designed path.

6. Invoke the bridge:

> *Output the next fenced block as markdown (not a code block):*

```
> Discussion complete. The specification phase will
> synthesise your decisions into a formal document.
```

```
Pipeline bridge for: {work_unit}
Completed phase: discussion

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.

#### If `no`

→ Return to **[the skill](../SKILL.md)** for **Step 5**.
