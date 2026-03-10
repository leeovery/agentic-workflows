# Conclude Discussion

*Reference for **[technical-discussion](../SKILL.md)***

---

When the user indicates they want to conclude:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Conclude discussion and mark as completed
- **Comment** — Add context before concluding
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `comment`

Incorporate the user's context into the discussion, commit, then re-present the sign-off prompt above.

#### If `yes`

1. Set discussion status to completed via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase discussion --topic {topic} status completed
   ```
2. Final commit
3. Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: discussion

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```
