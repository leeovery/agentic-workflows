# Tick: Task Graph

Tick has native support for priority and blocking dependencies with cycle detection. This file is used by the graphing agent after all tasks have been authored.

**Natural ordering principle**: Tasks execute in natural order (by priority, then creation date) when no dependencies override it. The dependency grapher only adds edges that change execution order — if tasks are already in the right sequence, explicit dependencies add noise without value. See also the dependency grapher agent's "When NOT to add a dependency" rules.

## Priority

| Level | Name | Value |
|-------|------|-------|
| 0 | Critical | Highest priority |
| 1 | High | |
| 2 | Medium | Default |
| 3 | Low | |
| 4 | Backlog | Lowest priority |

Lower number = higher priority. Tasks are created with priority `2` (medium) by default.

### Setting Priority

```bash
tick update <task-tick-id> --priority 1
```

### Removing Priority

Reset to the default medium priority:

```bash
tick update <task-tick-id> --priority 2
```

Tick does not support unsetting priority — every task has a priority level. Use `2` (medium) as the neutral default.

## Dependencies

Tick validates all dependency changes: prevents cycles, self-references, and children blocked by their own parent.

### Adding a Dependency

Declare that a task is blocked by another task:

```bash
tick dep add <task-tick-id> <tick-id>
```

Example — task `tick-e5f6` depends on `tick-a1b2`:

```bash
tick dep add tick-e5f6 tick-a1b2
```

To add multiple dependencies to a single task, run the command for each:

```bash
tick dep add tick-e5f6 tick-a1b2
tick dep add tick-e5f6 tick-c3d4
```

**Note**: Dependencies can also be set at creation time via `--blocked-by <tick-id,...>` and `--blocks <tick-id,...>` on `tick create`. This is useful when the blocking relationship is known upfront, but the typical workflow authors all tasks first, then adds dependencies in a separate graphing pass.

### Removing a Dependency

```bash
tick dep rm <task-tick-id> <tick-id>
```
