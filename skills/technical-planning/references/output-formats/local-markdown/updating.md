# Local Markdown: Updating

## Status Transitions

Update the `status` field in the task file frontmatter at `.workflows/{work_unit}/planning/tasks/{task-id}.md`:

| Transition | Value |
|------------|-------|
| Complete | `status: completed` |
| Skipped | `status: skipped` |
| Cancelled | `status: cancelled` |
| In Progress | `status: in-progress` |

## Updating Task Content

Edit the task file directly:

- **Title**: Change the `# {Title}` heading in the body
- **Description**: Edit the body content below the title
- **Priority**: Set or change the `priority:` field in frontmatter
- **Tags**: Set or change the `tags:` field in frontmatter
- **Dependencies**: See [graph.md](graph.md)
