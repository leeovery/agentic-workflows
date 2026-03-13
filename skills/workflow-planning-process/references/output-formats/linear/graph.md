# Linear: Task Graph

Linear natively supports both priority levels and blocking relationships between issues. Both are used to determine execution order.

This file is used by the graphing agent after all tasks have been authored. The agent receives the complete plan and establishes priority and dependencies across tasks.

## Priority

Linear uses fixed numeric priority values (0–4). The API normalises these to the workspace's display labels.

| Value | Level |
|-------|-------|
| `1` | Urgent |
| `2` | High |
| `3` | Medium |
| `4` | Low |
| `0` | No priority |

Lower number = higher priority. `0` means unset.

### Setting Priority

```
linear_updateIssue(
  issueId: "{issue_id}",
  priority: {priority_level}
)
```

### Removing Priority

```
linear_updateIssue(
  issueId: "{issue_id}",
  priority: 0
)
```

## Dependencies

### Adding a Dependency

To declare that one task depends on another (is blocked by it):

```
linear_createIssueRelation(
  issueId: "{dependent_issue_id}",
  relatedIssueId: "{blocking_issue_id}",
  type: "blocks"
)
```

A task can have multiple dependencies. Call `linear_createIssueRelation` for each one.

### Removing a Dependency

Delete the issue relation via MCP:

```
linear_deleteIssueRelation(issueRelationId: "{relation_id}")
```

To find the relation ID, query the issue's relations first:

```
linear_getIssue(issueId: "{issue_id}")
# Look for the relation in the issue's relations list
```
