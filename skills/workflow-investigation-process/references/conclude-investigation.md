# Conclude Investigation

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

The user has already reviewed findings and agreed on fix direction. This step confirms the investigation is complete and handles pipeline continuation.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ Investigation complete. Ready to conclude?`**

**`y/yes`**      → Conclude investigation
**Keep going** → Tell me what else to explore
```

**STOP.** Wait for user response.

#### If keep going

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

#### If `yes`

1. Mark the investigation completed — the engine sets the status and indexes the artifact into the knowledge base:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} investigation {topic}
   ```
2. Final commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "investigation({work_unit}): complete {topic} investigation"
   ```

   When the `complete` response's `warnings` is non-empty, fetch and emit the `DISPLAY: kb warning` advisory — the warning never blocks:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs render topic-receipt {work_unit}.investigation.{topic} --verb complete --warn
   ```

3. Closing recap:

   → Load **[closing-recap.md](../../workflow-shared/references/closing-recap.md)** with phase = `investigation`, work_unit = `{work_unit}`, topic = `{topic}`.

4. Closure signpost:

> *Output the next fenced block as markdown (not a code block):*

```
> Investigation complete. The specification phase will formalise the fix approach into a document that drives planning.
```

5. Invoke `/workflow-bridge {work_unit} investigation`.
