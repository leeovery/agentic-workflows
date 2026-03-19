# Linear: Reading

## Listing Tasks

To retrieve all tasks for a plan:

```
list_issues(projectId: "{project_id}")
```

Each issue in the response includes: id, title, state (status), priority, parent issue (phase grouping), and blocking relationships.

Phase parent issues have no `parentId` and contain sub-issues. Individual tasks are sub-issues of a phase parent.

## Extracting a Task

Query Linear MCP for the issue by ID:

```
get_issue(issueId: "{issue_id}")
```

The response includes title, description, status, priority, parent, and blocking relationships.

## Next Available Task

To find the next task to implement:

1. Query Linear MCP for project issues: `list_issues(projectId: "{project_id}")`
2. Identify phase parent issues (those without a `parentId`) — order by phase number from their title
3. Filter to sub-issues (tasks) whose state is not "completed" or "cancelled"
4. Exclude tasks where any blocking issue has a state other than "completed"
5. Process phases in order — complete all tasks in Phase 1 before Phase 2
6. Within a phase, order by priority (Urgent > High > Medium > Low)
7. The first match is the next task
8. If no incomplete tasks remain, all tasks are complete
