# Conclude Investigation

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

The user has already reviewed findings and agreed on fix direction. This step confirms the investigation is complete and handles pipeline continuation.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Investigation complete. Ready to conclude?

- **`y`/`yes`** — Conclude investigation
- **Keep going** — Continue discussing to explore further
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If keep going

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

#### If `yes`

1. Set investigation status to completed via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.investigation.{topic} status completed
   ```
2. Final commit
3. Index the completed artifact into the knowledge base:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{work_unit}/investigation/{topic}.md
```

If the index command fails, display the error but do not block — the artifact is already saved:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  The artifact is saved. Indexing can be retried later.
```

4. Display conclusion:

> *Output the next fenced block as a code block:*

```
Investigation completed: {work_unit}

Root cause: {brief summary}
Fix direction: {chosen approach}

The investigation is completed. Root cause and fix direction are documented.
```

5. Closure signpost:

> *Output the next fenced block as markdown (not a code block):*

```
> Investigation complete. The specification phase will formalise
> the fix approach into a document that drives planning.
```

6. Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: investigation

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.
