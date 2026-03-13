# Tick: Reading

## Listing Tasks

To retrieve all tasks for a topic:

```bash
tick list --parent <topic-tick-id>
```

This returns all descendants (phases and tasks) with summary-level data: id, title, status, priority, and parent. Results are sorted by priority (ascending), then creation date.

To list tasks within a specific phase:

```bash
tick list --parent <phase-tick-id>
```

Additional filtering:

```bash
tick list --parent <topic-tick-id> --status open       # only open tasks
tick list --parent <topic-tick-id> --ready              # ready tasks only
tick list --parent <topic-tick-id> --blocked            # blocked tasks only
tick list --parent <topic-tick-id> --priority 0         # critical tasks only
tick list --parent <topic-tick-id> --count 5            # limit to 5 results
```

## Extracting a Task

To read full task detail including description, blockers, and children:

```bash
tick show <tick-id>
```

Returns: id, title, status, priority, created/updated timestamps, parent, blocked_by list, children list, and full description.

## Next Available Task

To find the next task to implement:

```bash
tick ready --parent <phase-tick-id> --count 1
```

This returns the single next task that is:

1. Status is `open` (not started, not done, not cancelled)
2. No unresolved blockers (all `blocked_by` tasks are `done`)
3. No open children (leaf tasks, or parent tasks whose children are all complete)
4. Within the specified phase (scoped by `--parent`)

Results are sorted by priority (lower number = higher priority), then creation date. `--count 1` limits output to the first result.

To find the next task across all phases of a topic:

```bash
tick ready --parent <topic-tick-id> --count 1
```

If `tick ready` returns no results, either all tasks are complete or remaining tasks are blocked.

**Natural ordering convention**: `tick ready` always returns results in the correct execution order — by priority, then creation date. Consumers should take the first result as the next task. Because creation date preserves authoring order, sequential intra-phase tasks execute in natural order without needing explicit dependencies. Only add dependencies when the correct order differs from the natural order.
