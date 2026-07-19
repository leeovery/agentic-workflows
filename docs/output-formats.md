# Output Formats

Plans describe tasks; a task backend stores them. The output format layer is the adapter between the two, chosen once per plan (with a [project default](configuration.md) as the suggestion) and recorded in the manifest's `format` field. Everything downstream, implementation reading the next task, review verifying completion, restart cleaning up, works through the adapter and never assumes a backend.

## The available formats

| Format | Storage | Best for |
|---|---|---|
| **Tick** | `tick` CLI: append-only JSONL in-repo, SQLite cache | AI-driven workflows needing structured tracking. Native dependency graph with cycle detection, `tick ready` returns the next unblocked task in one command, token-efficient TOON output. Requires the Tick CLI. |
| **Local Markdown** | task files in the plan's own directory | Simple features, small plans, quick iterations. No external tools, human-readable, works offline. |
| **Linear** | Linear issues in a Linear project | Teams already using Linear. Requires a Linear account and MCP server. |

Quick-fix [scoping](work-types.md#quick-fix) selects a format the same way; its one or two tasks flow through the same adapters.

## The adapter contract

Each format is a directory under `skills/workflow-planning-process/references/output-formats/{format}/` with exactly five files, one per concern:

```
about.md      # benefits, setup, where output lands
authoring.md  # how to store tasks, flag them, clean them up
reading.md    # how to extract tasks and find the next available one
updating.md   # how to mark complete or skipped
graph.md      # how to record dependencies and priority
```

Consumers load only the concern they need: [planning](planning.md) loads `authoring.md` and `graph.md`, [implementation](implementation.md) loads `reading.md` and `updating.md`, restart flows load `authoring.md` for its cleanup instructions. The plan's `task_map` bridges naming: internal IDs (`p2-t3`) on the plan side, whatever the backend uses (`external_id`) on the other, resolvable in both directions via the manifest.

One consequence worth knowing: a format's task storage can live outside the work unit's directory (Tick's store, Linear's cloud). Flows that touch it commit with raw git, staging the extra paths explicitly, because the engine's scoped commit helper only covers `.workflows/{work_unit}`.

## Adding a format

`/create-output-format` scaffolds a new adapter directory from templates that encode the five-file contract. Write the five concerns for your backend and the rest of the pipeline picks it up; no phase skill needs editing, because nothing outside this directory (and the selection menu) is allowed to name formats.

---

*Next: how tasks get executed against these backends in [implementation](implementation.md).*
