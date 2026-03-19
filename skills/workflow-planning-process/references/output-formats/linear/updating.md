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
update_issue(issueId: "{id}", stateId: "{state_id}")
```

To find available workflow states for a team:

```
list_issue_statuses(teamId: "{team_id}")
```

## Updating Task Content

Update issue properties via MCP:

- **Title**: `update_issue(issueId: "{id}", title: "{new title}")`
- **Description**: `update_issue(issueId: "{id}", description: "{new description}")`
- **Priority**: `update_issue(issueId: "{id}", priority: {level})`
- **Labels**: `update_issue(issueId: "{id}", labelIds: ["{label_id}", ...])`
