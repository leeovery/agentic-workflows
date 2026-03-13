# Linear: Updating

## Status Transitions

Update the issue state in Linear via MCP:

| Transition | How |
|------------|-----|
| Complete | Set state to the team's "Done" workflow state |
| Skipped | Set state to "Cancelled" + add comment explaining why |
| Cancelled | Set state to "Cancelled" |
| In Progress | Set state to "In Progress" |

```
linear_updateIssue(issueId: "{id}", stateId: "{state_id}")
```

## Updating Task Content

Update issue properties via MCP:

- **Title**: `linear_updateIssue(issueId: "{id}", title: "{new title}")`
- **Description**: `linear_updateIssue(issueId: "{id}", description: "{new description}")`
- **Priority**: `linear_updateIssue(issueId: "{id}", priority: {level})`
- **Labels**: `linear_updateIssue(issueId: "{id}", labelIds: ["{label_id}", ...])`
