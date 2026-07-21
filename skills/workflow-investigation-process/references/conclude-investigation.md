# Conclude Investigation

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

The user has already reviewed findings and agreed on fix direction. This step confirms the investigation is complete and handles pipeline continuation.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Investigation complete. Ready to conclude?

- **`y`/`yes`** — Conclude investigation
- **Keep going** — Tell me what else to explore
· · · · · · · · · · · ·
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

If the `complete` response carries `warnings`, display them but do not block — the artifact is already saved:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  The artifact is saved. Indexing can be retried later.
```

3. Display conclusion:

> *Output the next fenced block as a code block:*

```
Investigation completed: {work_unit}

Root cause: {brief summary}
Fix direction: {chosen approach}

The investigation is completed. Root cause and fix direction are documented.
```

4. Closure signpost:

> *Output the next fenced block as markdown (not a code block):*

```
> Investigation complete. The specification phase will formalise
> the fix approach into a document that drives planning.
```

5. Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: investigation

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.
