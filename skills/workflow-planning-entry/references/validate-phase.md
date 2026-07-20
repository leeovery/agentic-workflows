# Validate Phase

*Reference for **[workflow-planning-entry](../SKILL.md)***

---

Check whether a plan already exists for this topic.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} status
```

#### If output is empty (plan doesn't exist — fresh start)

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Any additional context since the specification was completed?

- **`c`/`continue`** — Continue with the specification as-is
- **Add context** — Tell me the priorities, constraints, or new considerations
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `continue`:**

Set source="fresh" with no additional context.

→ Return to caller.

**If add context:**

Store the user's response as the additional context for the handoff. Set source="fresh".

→ Return to caller.

#### If status is `completed`

Reopen it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} planning {topic}
```

> *Output the next fenced block as a code block:*

```
Reopening plan: {topic:(titlecase)}
```

Set source="existing".

→ Return to caller.

#### If status is `in-progress`

Set source="existing".

→ Return to caller.
