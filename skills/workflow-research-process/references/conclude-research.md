# Conclude Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

First check the `## Triage` section of `.workflows/{work_unit}/research/{topic}.md`.

**If `## Triage` is not `(none)`:**

A concern was rerouted into this topic after drain ran this session. It must be folded before concluding.

> *Output the next fenced block as a code block:*

```
  ⚑ Triage not empty — {N} rerouted concern(s) awaiting fold.
    Returning to the session to drain and explore them before concluding.
```

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

**If `## Triage` is `(none)`:**

1. Mark the research completed — the engine sets the status and indexes the artifact into the knowledge base:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} research {topic}
   ```
2. Final commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "research({work_unit}): complete {topic} research"
   ```

If the `complete` response carries `warnings`, display them but do not block — the artifact is already saved:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  The artifact is saved. Indexing can be retried later.
```

3. Closure signpost:

> *Output the next fenced block as markdown (not a code block):*

```
> Research complete. The discussion phase will use these findings
> to make decisions about architecture and approach.
```

4. Invoke the `/workflow-bridge` skill:
   ```
   Pipeline bridge for: {work_unit}
   Completed phase: research

   Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
   ```

**STOP.** Do not proceed — terminal condition.
