# Conclude Investigation

*Reference for **[technical-investigation](../SKILL.md)***

---

The user has already reviewed findings and agreed on fix direction. This step confirms the investigation is complete and handles pipeline continuation.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Investigation complete. Ready to conclude?

- **`y`/`yes`** — Conclude investigation
- **Comment** — Add context before concluding
- **`r`/`reopen`** — Reopen investigation (more analysis needed)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `reopen`

Ask what aspects need more analysis.

→ Return to **[the skill](../SKILL.md)** for **Step 3**.

#### If `comment`

Incorporate the user's context into the investigation file and commit. Re-present the same conclusion prompt.

#### If `yes`

1. Set investigation status to completed via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase investigation --topic {topic} status completed
   ```
2. Final commit
3. Display conclusion:

> *Output the next fenced block as a code block:*

```
Investigation completed: {work_unit}

Root cause: {brief summary}
Fix direction: {chosen approach}

The investigation is completed. Root cause and fix direction are documented.
```

4. Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: investigation

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```
