# Conclude Implementation

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to mark implementation as completed?

- **`y`/`yes`** — Mark as completed
- **`n`/`no`** — Go back and make changes
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

#### If `yes`

Update implementation status via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} status completed
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} analysis_cycle 0
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} fix_attempts 0
```

Commit: `impl({work_unit}): complete implementation`

**Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: implementation

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.
