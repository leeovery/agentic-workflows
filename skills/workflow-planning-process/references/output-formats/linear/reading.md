# Linear: Reading

## Identifiers

`{project_id}` is the plan's `external_id` in the manifest; phase and task issue UUIDs are recorded in `task_map` (internal ID → issue UUID):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_id
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} task_map
```

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
3. Filter to sub-issues (tasks) whose state is not "Done" or "Cancelled"
4. Exclude tasks where any blocking issue has a state other than "Done"
5. Process phases in order — complete all tasks in Phase 1 before Phase 2
6. Within a phase, order by priority (Urgent > High > Medium > Low)
7. The first match is the next task
8. If no incomplete tasks remain, all tasks are complete
