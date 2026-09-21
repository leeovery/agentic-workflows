# Tick: Reading

## Identifiers

`<topic-tick-id>` is the plan's `external_id` in the manifest; phase and task tick IDs are recorded in `task_map` (internal ID → tick ID):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_id
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} task_map
```

`tick list` output does not include refs — correlate internal IDs through `task_map`, or use `tick show <tick-id>` to see a single task's refs.

## Display Identifier

The identifier shown beside the internal id in user-facing task displays is the task's tick id — the plan's `task_map` entry for the internal id:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} task_map.{internal_id}
```

## Listing Tasks

To retrieve all tasks for a topic:

```bash
tick list --parent <topic-tick-id>
```

This returns all descendants (phases and tasks) with summary-level data: id, title, status, priority, and type. Results are sorted by priority (ascending), then creation date.

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

Returns: id, title, status, priority, created/updated timestamps, parent, blocked_by list, children list, tags, refs, notes, and the description.

**Reading a value**: `tick show <tick-id> --field description` prints the description's own bytes. That is the read whenever a value is being consumed rather than displayed, an amendment's read of the current description above all (see [updating.md](updating.md)).

Never read or write `.tick/tasks.jsonl` directly — the CLI is the only interface to the store.

## Next Available Task

To find the next task to implement:

```bash
tick ready --parent <phase-tick-id> --count 1
```

This returns the single next task — an `in_progress` one first, then `open` tasks by priority, then creation date. A task is ready when:

1. Status is `open` or `in_progress` (not done, not cancelled)
2. No unresolved blockers (all `blocked_by` tasks are `done`)
3. No open children
4. No dependency-blocked ancestor
5. Within the specified phase (scoped by `--parent`)

Read the result's `status` column: an `in_progress` task is being resumed, so skip the format's mark-in-progress transition — the engine `task start` still runs (its task record and gate bookkeeping are separate from tick status).

To find the next task across all phases of a topic, run the same command with `--parent <topic-tick-id>`.

If nothing is returned, either all tasks are complete or remaining tasks are blocked.

**Natural ordering convention**: `tick ready` always returns results in the correct execution order — in-progress first, then by priority, then creation date. Consumers should take the first result as the next task. Because creation date preserves authoring order, sequential intra-phase tasks execute in natural order without needing explicit dependencies. Only add dependencies when the correct order differs from the natural order.
