# Conclude Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

1. Set research status to completed:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research.{topic} status completed
   ```
2. Final commit: `research({work_unit}): complete {topic} research`
3. Index the completed artifact into the knowledge base:

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

4. Closure signpost:

> *Output the next fenced block as markdown (not a code block):*

```
> Research complete. The discussion phase will use these findings
> to make decisions about architecture and approach.
```

5. Invoke the `/workflow-bridge` skill:
   ```
   Pipeline bridge for: {work_unit}
   Completed phase: research

   Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
   ```

**STOP.** Do not proceed — terminal condition.
