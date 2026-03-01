# Invoke the Skill (Bridge Mode)

*Reference for **[start-specification](../SKILL.md)***

---

Before invoking the processing skill, save a session bookmark.

> *Output the next fenced block as a code block:*

```
Saving session state so Claude can pick up where it left off if the conversation is compacted.
```

```bash
.claude/hooks/workflows/write-session-state.sh \
  "{topic}" \
  "skills/technical-specification/SKILL.md" \
  ".workflows/specification/{topic}/specification.md"
```

This skill's purpose is now fulfilled.

Invoke the [technical-specification](../../technical-specification/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

---

## Handoff

Construct the handoff based on the work type and verb.

#### If `work_type` is `feature`

```
Specification session for: {topic}
Work type: {work_type}

Source material:
- Discussion: .workflows/discussion/{topic}.md

Topic name: {topic}
Action: {verb} specification

The specification frontmatter should include:
- topic: {topic}
- status: in-progress
- type: feature
- work_type: {work_type}
- date: {today}

Invoke the technical-specification skill.
```

#### If `work_type` is `bugfix`

```
Specification session for: {topic}
Work type: {work_type}

Source material:
- Investigation: .workflows/investigation/{topic}/investigation.md

Topic name: {topic}
Action: {verb} specification

The specification frontmatter should include:
- topic: {topic}
- status: in-progress
- type: feature
- work_type: {work_type}
- date: {today}

Invoke the technical-specification skill.
```
