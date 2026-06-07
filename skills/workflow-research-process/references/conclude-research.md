# Conclude Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

1. **Incoming gate.** Read the `## Incoming` section of `.workflows/{work_unit}/research/{topic}.md`. If it is not exactly `(none)`, the topic has undrained concerns and cannot conclude:

   > *Output the next fenced block as a code block:*

   ```
     ⚑ This research has undrained Incoming concerns.
       Fold them into the research body and resolve them
       before concluding.
   ```

   → Return to **[the skill](../SKILL.md)** for **Step 6**.

   Otherwise the section is `(none)` — continue.

2. Set research status to completed:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research.{topic} status completed
   ```
3. Final commit: `research({work_unit}): complete {topic} research`
4. Index the completed artifact into the knowledge base:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{work_unit}/research/{topic}.md
```

If the index command fails, display the error but do not block — the artifact is already saved:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  The artifact is saved. Indexing can be retried later.
```

Re-indexing a previously-concluded topic is safe — `index` replaces the topic's chunks rather than duplicating them. Re-concluding a topic that an Incoming concern reopened needs no special handling here: the downstream phase already detects a regressed source on re-entry — the bridge re-firing into the epic menu is the designed path.

5. Closure signpost:

> *Output the next fenced block as markdown (not a code block):*

```
> Research complete. The discussion phase will use these findings
> to make decisions about architecture and approach.
```

6. Invoke the `/workflow-bridge` skill:
   ```
   Pipeline bridge for: {work_unit}
   Completed phase: research

   Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
   ```

**STOP.** Do not proceed — terminal condition.
