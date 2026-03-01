# Invoke Processing Skill

*Reference for **[start-feature](../SKILL.md)***

---

Save a session bookmark for compaction recovery, then invoke the appropriate processing skill.

> *Output the next fenced block as a code block:*

```
Saving session state for compaction recovery.
```

#### If `phase` is `research`

```bash
.claude/hooks/workflows/write-session-state.sh \
  "{topic}" \
  "skills/technical-research/SKILL.md" \
  ".workflows/research/{topic}.md"
```

→ Load **[invoke-research.md](invoke-research.md)** and follow its instructions.

#### If `phase` is `discussion`

```bash
.claude/hooks/workflows/write-session-state.sh \
  "{topic}" \
  "skills/technical-discussion/SKILL.md" \
  ".workflows/discussion/{topic}.md"
```

→ Load **[invoke-discussion.md](invoke-discussion.md)** and follow its instructions.
