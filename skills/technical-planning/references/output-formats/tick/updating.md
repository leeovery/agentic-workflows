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

## Phase / Parent Status (Auto-Cascade)

Tick automatically cascades status changes through the parent/child hierarchy. **Do not manually update phase or topic parent status** — tick handles it.

### How cascading works

| Command | Downward cascade | Upward cascade |
|---------|-----------------|----------------|
| `tick start <id>` | — | Starts any `open` ancestors |
| `tick done <id>` | Marks all non-terminal descendants as `done` | If all siblings are now terminal, auto-completes the parent (recursively upward) |
| `tick cancel <id>` | Cancels all non-terminal descendants | If all siblings are now terminal, auto-completes the parent (`done` or `cancel` as appropriate) |
| `tick reopen <id>` | — | Reopens any `done` ancestors (blocked if parent is `cancelled`) |

This means:
- Starting a task automatically starts its phase and topic parents
- Completing the last task in a phase automatically completes the phase
- Cancelling a task may auto-complete the phase if all siblings are now terminal
- Reopening a task reopens its completed ancestors so the hierarchy stays consistent
