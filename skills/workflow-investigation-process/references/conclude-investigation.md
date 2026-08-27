# Conclude Investigation

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

The user has already reviewed findings and agreed on fix direction. This step confirms the investigation is complete and handles pipeline continuation.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render conclude-gate {work_unit}.investigation.{topic}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

#### If keep going

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

#### If `yes`

First check the topic's triage queue — a queued concern must be worked before concluding:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} investigation {topic}
```

**If the response's `files` is non-empty:**

Render the blocker and emit both its sections verbatim per their markers:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render triage-block {work_unit}.investigation.{topic}
```

→ Load **[rerouted-concerns.md](../../workflow-shared/references/rerouted-concerns.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `investigation` — enter **A. Check**.

On return:

→ Return to **[the skill](../SKILL.md)** for **Step 13**.

**If `files` is empty:**

1. Mark the investigation completed — the engine sets the status and indexes the artifact into the knowledge base:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} investigation {topic}
   ```
2. Final commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "investigation({work_unit}): complete {topic} investigation" --topic investigation/{topic} --kb
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
