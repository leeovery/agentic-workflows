# Invoke the Skill

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Before invoking the processing skill, save a session bookmark.

> *Output the next fenced block as a code block:*

```
Saving session state so Claude can pick up where it left off if the conversation is compacted.
```

The output path is `.workflows/{work_unit}/discussion/{topic}.md`.

```bash
.claude/hooks/workflows/write-session-state.sh \
  "{work_unit}" \
  "skills/technical-discussion/SKILL.md" \
  "{output_path}"
```

This skill's purpose is now fulfilled.

Invoke the [technical-discussion](../../technical-discussion/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

---

## Handoff

Construct the handoff based on how this discussion was initiated. Work type is always available (callers always provide it).

#### If source is `research`

```
Discussion session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Output: {output_path}

Research reference:
Source: .workflows/{work_unit}/research/{filename}.md (lines {start}-{end})
Summary: {the 1-2 sentence summary from the research analysis}

Invoke the technical-discussion skill.
```

#### If source is `new-with-research`

```
Discussion session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Output: {output_path}

Research reference:
Source: .workflows/{work_unit}/research/{research_filename}.md
Summary: {the discussion-ready summary from the research file}

Invoke the technical-discussion skill.
```

#### If source is `continue`

```
Discussion session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Source: existing discussion
Output: {output_path}

Invoke the technical-discussion skill.
```

#### If source is `fresh` or `new`

```
Discussion session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Source: fresh
Output: {output_path}

Invoke the technical-discussion skill.
```
