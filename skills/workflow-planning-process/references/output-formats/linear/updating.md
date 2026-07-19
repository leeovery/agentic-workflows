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

To find available workflow states for a team — `{team_id}` is the project default persisted during setup:

```
list_issue_statuses(teamId: "{team_id}")
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get project.defaults.linear_team_id
```

## Updating Task Content

Update issue properties via MCP:

- **Title**: `update_issue(issueId: "{id}", title: "{new title}")`
- **Description**: `update_issue(issueId: "{id}", description: "{new description}")`
- **Priority**: `update_issue(issueId: "{id}", priority: {level})`
- **Labels**: `update_issue(issueId: "{id}", labelIds: ["{label_id}", ...])`

## Phase Completion

Phases are parent issues. When every sub-issue of a phase parent is in a "Done" or "Cancelled" state, set the phase parent issue's state to the team's "Done" workflow state:

```
update_issue(issueId: "{phase_issue_id}", stateId: "{done_state_id}")
```
