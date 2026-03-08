# Conclude Discussion

*Reference for **[technical-discussion](../SKILL.md)***

---

When the user indicates they want to conclude:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Conclude discussion and mark as concluded
- **Comment** — Add context before concluding
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `comment`

Incorporate the user's context into the discussion, commit, then re-present the sign-off prompt above.

#### If `yes`

1. Set discussion status to concluded via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase discussion --topic {topic} status concluded
   ```
2. Final commit
3. Read work_type from manifest and invoke the bridge:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} work_type
   ```

```
Pipeline bridge for: {work_unit}
Work type: {work_type from manifest}
Completed phase: discussion

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```
