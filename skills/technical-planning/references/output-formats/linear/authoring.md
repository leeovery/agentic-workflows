# Linear: Authoring

## Project Setup

Via MCP, create a project with:

- **Name**: Match the topic name
- **Description**: Brief summary + link to specification file
- **Team**: As specified by user

## Phase Labels

Create labels to denote phases (if they don't already exist):

- `phase-1`
- `phase-2`
- etc.

## Task Storage

For each task, create a Linear issue via MCP:

```
linear_createIssue(
  teamId: "{team_id}",
  projectId: "{project_id}",
  title: "{Task title}",
  description: "{Task description content}",
  labelIds: ["{phase_label_id}", ...]
)
```

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

Apply phase labels to issues: `phase-1`, `phase-2`, etc. All issues in a phase share the same label.

### Labels / Tags

Beyond phase labels, apply optional labels for categorisation:

- `needs-info` — task requires additional information
- `edge-case` — edge case handling task
- `foundation` — setup/infrastructure task
- `refactor` — cleanup task

## Flagging

When creating issues, if something is unclear:

1. **Create the issue anyway** — don't block planning
2. **Apply `needs-info` label** — makes gaps visible
3. **Note what's missing** in description — add a **Needs Clarification** section
4. **Continue planning** — circle back later

## Cleanup (Restart)

The official Linear MCP server does not support deletion. Ask the user to delete the Linear project manually via the Linear UI.

> "The Linear project **{project name}** needs to be deleted before restarting. Please delete it in the Linear UI (Project Settings → Delete project), then confirm so I can proceed."

**STOP.** Wait for user response.

### Fallback

If Linear MCP is unavailable:
- Inform the user
- Cannot proceed without MCP access
- Suggest checking MCP configuration or switching to local markdown
