# Invoke the Skill

*Reference for **[start-implementation](../SKILL.md)***

---

Before invoking the processing skill, save a session bookmark.

> *Output the next fenced block as a code block:*

```
Saving session state so Claude can pick up where it left off if the conversation is compacted.
```

```bash
.claude/hooks/workflows/write-session-state.sh \
  "{work_unit}" \
  "skills/technical-implementation/SKILL.md" \
  ".workflows/{work_unit}/implementation/implementation.md"
```

After completing the steps above, this skill's purpose is fulfilled.

Invoke the [technical-implementation](../../technical-implementation/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

---

## Handoff

```
Implementation session for: {work_unit}
Plan: .workflows/{work_unit}/planning/planning.md
Format: {format}
Plan ID: {plan_id} (if applicable)
Specification: .workflows/{work_unit}/specification/specification.md (exists: {true|false})
Implementation: {exists | new} (status: {in-progress | not-started | completed})

Dependencies: {All satisfied | List any notes}
Environment: {Setup required | No special setup required}

Invoke the technical-implementation skill.
```
