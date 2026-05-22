# Inception Session Log Template

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Structure for `.workflows/{work_unit}/inception/session-001.md`. Keep all section headings — write `(none)` under any that have no content rather than removing the section. The empty section is a positive signal it was considered, not missed. Two paragraphs of prose are fine for a light session; a handful of short sections for a heavy one.

## Template

```markdown
# Inception Session 001 — Initial Framing

Date: {YYYY-MM-DD}
Work unit: {work_unit}

## Description (as of session)

{The work-unit description at session time — captured because the
description can evolve, and we want to know what framing the
session worked from.}

## Imports

- imports/{filename}.md
- ...

## Topics Identified

### {topic-name}

- Routing: {research|discussion}
- Why: {one-line rationale — what cue drove the routing}

### {topic-name}

- Routing: {research|discussion}
- Why: ...

## Considered and Discarded

- {item} — {reason}

## Conclusion

{N} topics seeded. {Optional: suggested first stop with reasoning.}
```

## Anti-patterns

- No transcript-style content. The log is rationale, not dialogue.
- No decisions or option weighing. That belongs in discussion. The "Why" line is one sentence per topic — what cue drove the routing.
- No investigation. The log records what was framed, not what was uncovered.

→ Return to caller.
