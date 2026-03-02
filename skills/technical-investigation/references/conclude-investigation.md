# Conclude Investigation

*Reference for **[technical-investigation](../SKILL.md)***

---

The user has already reviewed findings and agreed on fix direction. This step confirms the investigation is complete and handles pipeline continuation.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Investigation complete. Ready to conclude?

- **`y`/`yes`** — Conclude investigation and proceed to specification
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

1. Set investigation status to concluded via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.investigation.status concluded
   ```
2. Final commit
3. Display conclusion:

> *Output the next fenced block as a code block:*

```
Investigation concluded: {topic}

Root cause: {brief summary}
Fix direction: {chosen approach}

The investigation is ready for specification. The specification will
detail the exact fix approach, acceptance criteria, and testing plan.
```

4. Read work_type from manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.work_type
   ```

**If work_type is set** (bugfix):

This investigation is part of a pipeline. Invoke the `/workflow-bridge` skill:

```
Pipeline bridge for: {work-unit}
Work type: bugfix
Completed phase: investigation

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**If work_type is not set:**

The session ends here. The investigation document can be used as input to `/start-specification`.
