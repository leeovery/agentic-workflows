# Local Markdown: Authoring

## Task Storage

Each task is written to `.workflows/{work_unit}/planning/tasks/{task-id}.md` — a markdown file with frontmatter and a description body.

```markdown
---
id: {topic}-{phase}-{seq}
phase: {phase-number}
status: pending
created: YYYY-MM-DD
---

# {Task Title}

{Task description content}
```

**Required**: title (`# {Task Title}`) and description (body content). Everything else supports the format's storage mechanics.

## Task Properties

### Status

Stored in frontmatter. Defaults to `pending` if omitted.

| Status | Meaning |
|--------|---------|
| `pending` | Task has been authored but not started |
| `in-progress` | Task is currently being worked on |
| `completed` | Task is done |
| `skipped` | Task was deliberately skipped |
| `cancelled` | Task is no longer needed |

### Phase Grouping

Phases are encoded in the task ID: `{topic}-{phase}-{seq}`. The `phase` frontmatter field also stores the phase number for querying.

### Labels / Tags (optional)

Add a `tags` field to frontmatter if additional categorisation is needed:

```yaml
tags: [edge-case, needs-info]
```

## Flagging

In the task file, add a **Needs Clarification** section:

```markdown
**Needs Clarification**:
- What's the rate limit threshold?
- Per-user or per-IP?
```

## Cleanup (Restart)

Delete the tasks directory — preserves `planning.md` (the Plan Index) and any review tracking files:

```bash
rm -rf .workflows/{work_unit}/planning/tasks/
```
