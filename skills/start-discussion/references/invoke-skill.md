# Invoke the Skill

*Reference for **[start-discussion](../SKILL.md)***

---

Before invoking the processing skill, save a session bookmark.

> *Output the next fenced block as a code block:*

```
Saving session state so Claude can pick up where it left off if the conversation is compacted.
```

```bash
.claude/hooks/workflows/write-session-state.sh \
  "{topic}" \
  "skills/technical-discussion/SKILL.md" \
  ".workflows/discussion/{topic}.md"
```

This skill's purpose is now fulfilled.

Invoke the [technical-discussion](../../technical-discussion/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

---

## Handoff

Construct the handoff based on how this discussion was initiated.

#### If source is `research`

**If work_type is available** (from Step 2), add the Work type line:

```
Discussion session for: {topic}
Work type: {work_type}
Output: .workflows/discussion/{topic}.md

Research reference:
Source: .workflows/research/{filename}.md (lines {start}-{end})
Summary: {the 1-2 sentence summary from the research analysis}

Invoke the technical-discussion skill.
```

#### If source is `research-bridge`

```
Discussion session for: {topic}
Work type: {work_type}
Research source: .workflows/research/{topic}.md
Output: .workflows/discussion/{topic}.md

Research reference:
Source: .workflows/research/{topic}.md
Summary: {the discussion-ready summary from the research file}

Invoke the technical-discussion skill.
```

#### If source is `continue`

Read work_type from the existing discussion frontmatter.

```
Discussion session for: {topic}
Work type: {work_type}
Source: existing discussion
Output: .workflows/discussion/{topic}.md

Invoke the technical-discussion skill.
```

#### If source is `fresh`

**If work_type is available** (from Step 2), add the Work type line:

```
Discussion session for: {topic}
Work type: {work_type}
Source: fresh
Output: .workflows/discussion/{topic}.md

Invoke the technical-discussion skill.
```

#### If source is `bridge`

```
Discussion session for: {topic}
Work type: {work_type}
Source: fresh
Output: .workflows/discussion/{topic}.md

Invoke the technical-discussion skill.
```
