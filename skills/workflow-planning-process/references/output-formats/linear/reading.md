# Linear: Reading

## Listing Tasks

To retrieve all tasks for a plan:

```
linear_getIssues(projectId: "{project_id}")
```

Each issue in the response includes: id, title, state (status), priority, labels (phase grouping), and blocking relationships (`blockedByIssues`, `blockingIssues`).

Use label filters to narrow by phase, or priority/state filters to scope the query further — Linear's API supports these natively.

## Extracting a Task

Query Linear MCP for the issue by ID:

```
linear_getIssue(issueId: "{issue_id}")
```

The response includes title, description, status, priority, labels, and blocking relationships.

## Next Available Task

To find the next task to implement:

1. Query Linear MCP for project issues: `linear_getIssues(projectId: "{project_id}")`
2. Filter to issues whose state is not "completed" or "cancelled"
3. Exclude issues where any `blockedByIssues` entry has a state other than `completed`
4. Filter by phase label — complete all `phase-1` issues before `phase-2`
5. Within a phase, order by priority (Urgent > High > Medium > Low)
6. The first match is the next task
7. If no incomplete issues remain, all tasks are complete.
