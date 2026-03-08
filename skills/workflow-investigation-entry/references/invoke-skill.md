# Invoke the Skill

*Reference for **[workflow-investigation-entry](../SKILL.md)***

---

Before invoking the processing skill, save a session bookmark.

> *Output the next fenced block as a code block:*

```
Saving session state so Claude can pick up where it left off if the conversation is compacted.
```

```bash
.claude/hooks/workflows/write-session-state.sh \
  "{work_unit}" \
  "skills/technical-investigation/SKILL.md" \
  ".workflows/{work_unit}/investigation/{topic}.md"
```

This skill's purpose is now fulfilled.

Invoke the [technical-investigation](../../technical-investigation/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

---

## Handoff

Construct the handoff based on source.

#### If source is `new`

```
Investigation session for: {work_unit}
Work type: bugfix
Output: .workflows/{work_unit}/investigation/{topic}.md

Bug context:
- Expected behavior: {from user's description}
- Actual behavior: {from user's description}
- Initial context: {error messages, reproduction steps, etc.}

Invoke the technical-investigation skill.
```

#### If source is `continue`

```
Investigation session for: {work_unit}
Work type: bugfix
Source: existing investigation
Output: .workflows/{work_unit}/investigation/{topic}.md

Invoke the technical-investigation skill.
```
