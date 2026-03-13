# Tick: Updating

## Status Transitions

Tick uses dedicated commands for each status transition:

| Transition | Command |
|------------|---------|
| Start | `tick start <task-tick-id>` (open → in_progress) |
| Complete | `tick done <task-tick-id>` (in_progress → done) |
| Cancelled | `tick cancel <task-tick-id>` (any → cancelled) |
| Reopen | `tick reopen <task-tick-id>` (done/cancelled → open) |
| Skipped | `tick cancel <task-tick-id>` (no separate skipped status — use cancel) |

`done` and `cancel` set a closed timestamp. `reopen` clears it.

## Updating Task Content

**CRITICAL**: Always pass descriptions as inline quoted strings. See [authoring.md](authoring.md) for constraints.

To update a task's properties:

- **Title**: `tick update <task-tick-id> --title "New title"`
- **Description**: `tick update <task-tick-id> --description "New description"`
- **Priority**: `tick update <task-tick-id> --priority 1`
- **Parent**: `tick update <task-tick-id> --parent <tick-id>` (pass empty string to clear)
- **Type**: `tick update <task-tick-id> --type feature` (clear with `--clear-type`)
- **Tags**: `tick update <task-tick-id> --tags "api,security"` (replaces all tags; clear with `--clear-tags`)
- **Refs**: `tick update <task-tick-id> --refs "spec:caching"` (replaces all refs; clear with `--clear-refs`)
- **Blocks**: `tick update <task-tick-id> --blocks <tick-id,...>` (set task IDs this blocks)
- **Dependencies**: See [graph.md](graph.md)

## Post-Update Verification

After every `tick update`, run `tick show <task-tick-id>` and confirm that the updated fields were set correctly. If any field is empty or wrong, re-run the update.

## Phase / Parent Status (Auto-Cascade)

Tick automatically cascades status changes through the parent/child hierarchy. **Do not manually update phase or topic parent status** — tick handles it.

### How cascading works

| Command | Downward cascade | Upward cascade |
|---------|-----------------|----------------|
| `tick start <tick-id>` | — | Starts any `open` ancestors |
| `tick done <tick-id>` | Marks all non-terminal descendants as `done` | If all siblings are now terminal, auto-completes the parent (recursively upward) |
| `tick cancel <tick-id>` | Cancels all non-terminal descendants | If all siblings are now terminal, auto-completes the parent (`done` or `cancel` as appropriate) |
| `tick reopen <tick-id>` | — | Reopens any `done` ancestors (blocked if parent is `cancelled`) |

This means:
- Starting a task automatically starts its phase and topic parents
- Completing the last task in a phase automatically completes the phase
- Cancelling a task may auto-complete the phase if all siblings are now terminal
- Reopening a task reopens its completed ancestors so the hierarchy stays consistent
