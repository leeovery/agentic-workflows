# Local Markdown: Reading

## Listing Tasks

To retrieve all tasks for a plan:

1. List all `.md` files in `.workflows/{work_unit}/planning/{topic}/tasks/` — every file in this directory is a task file, no filtering needed
2. Read each file's frontmatter to extract: `id`, `phase`, `status`, `priority`, `depends_on`
3. Read the first heading for the task title

This provides the summary-level data needed for graphing, progress overview, or any operation that needs the full task set.

## Extracting a Task

To read a specific task, read the file at `.workflows/{work_unit}/planning/{topic}/tasks/{internal_id}.md`.

The task file is self-contained — frontmatter holds id, phase, and status. The body contains the title and full description.

## Next Available Task

To find the next task to implement:

1. List all `.md` files in `.workflows/{work_unit}/planning/{topic}/tasks/`
2. Filter to tasks where `status` is `pending` or `in-progress` (or missing — treat as `pending`)
3. If any tasks have `depends_on`, check each referenced task's `status` — exclude the task unless all dependencies have `status: completed`
4. Order by phase number (from internal ID: `{topic}-{phase_id}-{task_id}`) — complete all earlier phases first
5. Within a phase, order by `priority` if present (lower number = higher priority), then by task number
6. The first match is the next task
7. If no incomplete tasks remain, all tasks are complete.
