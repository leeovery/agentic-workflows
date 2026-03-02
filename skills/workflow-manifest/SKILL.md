---
name: workflow-manifest
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
---

# Workflow Manifest

CLI tool for reading and writing work unit manifest files. Single source of truth for all workflow state.

## Invocation

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js <command> [args]
```

## Commands

### `init`

Create a new work unit manifest.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init <name> --work-type <epic|feature|bugfix> --description "..."
```

Creates `.workflows/<name>/manifest.json` with identity fields and empty phases. Errors if manifest already exists.

### `get`

Read a value or subtree by dot path. First segment is the work unit name (directory), remaining segments are the JSON path.

```bash
# Full manifest
node .claude/skills/workflow-manifest/scripts/manifest.js get <name>

# Scalar value — output raw (no quotes)
node .claude/skills/workflow-manifest/scripts/manifest.js get <name>.status

# Subtree — output as formatted JSON
node .claude/skills/workflow-manifest/scripts/manifest.js get <name>.phases.discussion
```

Errors to stderr with non-zero exit if the path does not exist.

### `set`

Write a value by dot path. Auto-creates intermediate keys.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set <name>.phases.discussion.status concluded
```

Values are parsed as JSON first (for arrays, objects, numbers, booleans), falling back to string. Validates structural fields:

- **work_type**: `epic`, `feature`, `bugfix`
- **phase names**: `research`, `discussion`, `investigation`, `specification`, `planning`, `implementation`, `review`
- **phase statuses**: per-phase valid values (see Validation section)
- **gate modes**: `gated`, `auto`
- **work unit status**: `active`, `archived`

### `list`

Enumerate work units by scanning `.workflows/` for `manifest.json` files. Skips dot-prefixed directories (`.archive`, `.state`, `.cache`).

```bash
# All work units
node .claude/skills/workflow-manifest/scripts/manifest.js list

# Filter by status
node .claude/skills/workflow-manifest/scripts/manifest.js list --status active

# Filter by work type
node .claude/skills/workflow-manifest/scripts/manifest.js list --work-type epic

# Combined filters
node .claude/skills/workflow-manifest/scripts/manifest.js list --status active --work-type feature
```

Output: JSON array of manifest objects.

### `add-item`

Register an item within an epic's phase. Convenience for creating an item with `status: in-progress`.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js add-item <name> <phase> <item-name>
```

Creates `phases.<phase>.items.<item-name>` with `{ "status": "in-progress" }`. Errors if item already exists.

### `archive`

Move a work unit to `.workflows/.archive/<name>/` and set status to `archived`.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js archive <name>
```

Errors if work unit does not exist.

## Validation

The CLI validates structural values to prevent invalid state:

| Field | Valid Values |
|-------|-------------|
| `work_type` | `epic`, `feature`, `bugfix` |
| `status` (work unit) | `active`, `archived` |
| `phases.research.status` | `in-progress`, `concluded` |
| `phases.discussion.status` | `in-progress`, `concluded` |
| `phases.investigation.status` | `in-progress`, `concluded` |
| `phases.specification.status` | `in-progress`, `concluded` |
| `phases.planning.status` | `in-progress`, `concluded` |
| `phases.implementation.status` | `in-progress`, `completed` |
| `phases.review.status` | `in-progress`, `completed` |
| Gate modes (`*_gate_mode`) | `gated`, `auto` |

Item-level statuses within epic phases follow the same phase-level rules.

## Output Conventions

- **Scalar values**: raw to stdout, no quotes (e.g., `active`, `concluded`)
- **Subtrees and lists**: formatted JSON to stdout
- **Errors**: message to stderr, non-zero exit code

## Notes

- **File locking**: `.lock` file next to manifest, exclusive create (`wx` flag), 30s stale detection. Prevents concurrent session conflicts.
- **Atomic writes**: write to `.tmp` then `fs.renameSync`. No partial writes.
- **Auto-creation**: `init` creates the work unit directory. Phase directories are created by skills when they enter that phase, not by the CLI.
- **Dot path convention**: `<work-unit>.<json.path>` — first segment resolves to `.workflows/<work-unit>/manifest.json`, remaining segments navigate the JSON structure.
