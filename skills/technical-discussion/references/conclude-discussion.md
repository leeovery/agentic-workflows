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
   # Feature/bugfix (flat phase):
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.discussion.status concluded

   # Epic (item within phase):
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.discussion.items.{topic}.status concluded
   ```
2. Final commit
3. Read work_type from manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.work_type
   ```

**If work_type is set** (feature, bugfix, or epic):

This discussion is part of a pipeline. Invoke the `/workflow-bridge` skill:

```
Pipeline bridge for: {work-unit}
Work type: {work_type from manifest}
Completed phase: discussion

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**If work_type is not set and other in-progress discussions exist:**

> *Output the next fenced block as a code block:*

```
Discussion concluded: {topic}

Remaining in-progress discussions:
  • {topic-1}
  • {topic-2}

To continue, clear your context and run /start-discussion to pick up the next topic.
```

**If work_type is not set and no in-progress discussions remain:**

> *Output the next fenced block as a code block:*

```
Discussion concluded: {topic}

All discussions are now concluded.
```

**Do not offer to continue with another discussion in this session.** Each discussion benefits from a fresh context — continuing risks compaction-related information loss and reduced attention. Always advise the user to clear context first.
