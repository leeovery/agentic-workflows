# Linear: Authoring

Uses the official Linear MCP server (`https://mcp.linear.app/mcp`). Tool names below reflect this server — verify available tools if using a different implementation.

## Plan Structure

Create a Linear project — this is the plan-level entity:

```
create_project(
  name: "{topic:(titlecase)}",
  teamIds: ["{team_id}"],
  description: "Implementation plan for {topic}"
)
```

Returns the project ID — this is the plan's external identifier.

## Phase Structure

Create a parent issue for each phase within the project. Tasks are created as sub-issues of these phase parents.

```
create_issue(
  teamId: "{team_id}",
  title: "Phase {N}: {phase:(titlecase)}",
  description: "{phase goal}",
  projectId: "{project_id}"
)
```

Returns the issue UUID — this is the phase's external identifier.

## Task Storage

Create tasks as sub-issues of their phase parent:

```
create_issue(
  teamId: "{team_id}",
  title: "{task:(titlecase)}",
  description: "{description}",
  parentId: "{phase_issue_id}",
  projectId: "{project_id}"
)
```

Returns the issue UUID — this is the task's external identifier.

## Task Properties

### Status

Linear uses workflow states. Map to these states:

| Status | Linear State |
|--------|-------------|
| Pending | Todo (or Backlog) |
| In Progress | In Progress |
| Completed | Done |
| Skipped | Cancelled (add comment explaining why) |
| Cancelled | Cancelled |

### Phase Grouping

Phases are represented as parent issues. Each task belongs to a phase by being a sub-issue of that phase's parent issue.

### Labels / Tags

Apply optional labels for categorisation:

- `needs-info` — task requires additional information
- `edge-case` — edge case handling task
- `foundation` — setup/infrastructure task
- `refactor` — cleanup task

Create labels with `create_issue_label` if they don't exist:

```
create_issue_label(
  teamId: "{team_id}",
  name: "{label_name}",
  color: "{hex_color}"
)
```

## Flagging

When creating issues, if something is unclear:

1. **Create the issue anyway** — don't block planning
2. **Apply `needs-info` label** — makes gaps visible
3. **Note what's missing** in description — add a **Needs Clarification** section
4. **Continue planning** — circle back later

## Cleanup (Restart)

The official Linear MCP server does not support deletion. Ask the user to delete the Linear project manually via the Linear UI.

> "The Linear project **{project:(titlecase)}** needs to be deleted before restarting. Please delete it in the Linear UI (Project Settings → Delete project), then confirm so I can proceed."

**STOP.** Wait for user response.

### Fallback

If Linear MCP is unavailable:
- Inform the user
- Cannot proceed without MCP access
- Suggest checking MCP configuration or switching to local markdown
