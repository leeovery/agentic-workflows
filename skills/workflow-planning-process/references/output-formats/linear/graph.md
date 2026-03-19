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
update_issue(
  issueId: "{issue_id}",
  priority: {priority_level}
)
```

### Removing Priority

```
update_issue(
  issueId: "{issue_id}",
  priority: 0
)
```

## Dependencies

> **Note**: Issue relation tools may not be available on all Linear MCP server implementations. Check available tools before proceeding. If relation tools are unavailable, document dependencies in task descriptions and rely on phase ordering and priority for execution order.

### Adding a Dependency

To declare that one task depends on another (is blocked by it):

```
create_issue_relation(
  issueId: "{dependent_issue_id}",
  relatedIssueId: "{blocking_issue_id}",
  type: "blocks"
)
```

A task can have multiple dependencies. Call `create_issue_relation` for each one.

### Removing a Dependency

Query the issue to find its relations, then delete the specific relation:

```
get_issue(issueId: "{issue_id}")
```

Look for the relation in the issue's relations list, then remove it using the relation ID.
