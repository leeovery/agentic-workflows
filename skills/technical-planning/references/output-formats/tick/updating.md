# Tick: Updating

## Status Transitions

Tick uses dedicated commands for each status transition:

| Transition | Command |
|------------|---------|
| Start | `tick start <task-id>` (open → in_progress) |
| Complete | `tick done <task-id>` (in_progress → done) |
| Cancelled | `tick cancel <task-id>` (any → cancelled) |
| Reopen | `tick reopen <task-id>` (done/cancelled → open) |
| Skipped | `tick cancel <task-id>` (no separate skipped status — use cancel) |

`done` and `cancel` set a closed timestamp. `reopen` clears it.

## Updating Task Content

**CRITICAL**: Always pass descriptions as inline quoted strings. See [authoring.md](authoring.md) for constraints.

To update a task's properties:

- **Title**: `tick update <task-id> --title "New title"`
- **Description**: `tick update <task-id> --description "New description"`
- **Priority**: `tick update <task-id> --priority 1`
- **Parent**: `tick update <task-id> --parent <new-parent-id>` (pass empty string to clear)
- **Type**: `tick update <task-id> --type feature` (clear with `--clear-type`)
- **Tags**: `tick update <task-id> --tags "api,security"` (replaces all tags; clear with `--clear-tags`)
- **Refs**: `tick update <task-id> --refs "spec:caching"` (replaces all refs; clear with `--clear-refs`)
- **Blocks**: `tick update <task-id> --blocks <id,...>` (set task IDs this blocks)
- **Dependencies**: See [graph.md](graph.md)

## Post-Update Verification

After every `tick update`, run `tick show <task-id>` and confirm that the updated fields were set correctly. If any field is empty or wrong, re-run the update.

## Phase / Parent Status

Phase tasks are parent tasks in the tick hierarchy. Update their status to reflect child task progress.

### Start Phase

When the first task in a phase begins and the phase parent is still `open`:

```bash
tick start <phase-id>
```

Check the phase parent's status with `tick show <phase-id>`. If status is `open`, start it.

### Complete Phase

When all child tasks in a phase are `done` or `cancelled` (none remain `open` or `in_progress`):

```bash
tick done <phase-id>
```

After completing a task, check: `tick list --parent <phase-id> --status open` and `tick list --parent <phase-id> --status in_progress`. If both return empty, the phase is complete.

### Cancel Phase

If all child tasks are `cancelled` (none `done`):

```bash
tick cancel <phase-id>
```
