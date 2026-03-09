---
name: workflow-manifest
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
---

# Workflow Manifest

CLI tool for reading and writing work unit manifest files. Single source of truth for all workflow state.

**`{work_unit}`** is the top-level directory name under `.workflows/` (e.g., `dark-mode`, `payments-overhaul`). **`{topic}`** is the item within a phase (e.g., discussion name, spec name, plan name). For feature/bugfix they share the same value; for epic they're distinct.

## Invocation

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js <command> [args]
```

## Domain-Aware Flag Syntax

Skills provide logical coordinates via `--phase` and `--topic` flags. The CLI routes to the correct JSON path internally based on work_type. Skills never know or care about the manifest's internal structure (flat for feature/bugfix, items for epic).

```bash
MANIFEST="node .claude/skills/workflow-manifest/scripts/manifest.js"

# Phase operations (--phase and --topic flags):
$MANIFEST get {work_unit} --phase discussion --topic {topic} [field.path]
$MANIFEST set {work_unit} --phase discussion --topic {topic} field.path value
$MANIFEST init-phase {work_unit} --phase discussion --topic {topic}

# Work-unit operations (no flags):
$MANIFEST get {work_unit} [field]
$MANIFEST set {work_unit} field value

# Existence checks (always exit 0, outputs true/false):
$MANIFEST exists {work_unit}
$MANIFEST exists {work_unit} [field.path]
$MANIFEST exists {work_unit} --phase <phase> [--topic <topic>] [field.path]

# Management (unchanged):
$MANIFEST init name --work-type type --description "..."
$MANIFEST list [--status s] [--work-type t]
```

**`--topic` is optional for get** — if omitted, returns the whole phase object. Discovery scripts use this to iterate items:
```bash
$MANIFEST get {work_unit} --phase discussion              # whole phase (for iteration)
$MANIFEST get {work_unit} --phase discussion --topic {topic} status  # specific item field
```

**Internal routing (CLI handles, skills don't know):**
- Feature/bugfix: `--phase discussion --topic auth-flow status` → `phases.discussion.status`
- Epic: `--phase discussion --topic payment-processing status` → `phases.discussion.items.payment-processing.status`

## Commands

### `init`

Create a new work unit manifest.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init <name> --work-type <epic|feature|bugfix> --description "..."
```

Creates `.workflows/<name>/manifest.json` with identity fields and empty phases. Errors if manifest already exists.

### `get`

Read a value or subtree. Two modes:

**Work-unit level** (no flags):
```bash
# Full manifest
node .claude/skills/workflow-manifest/scripts/manifest.js get <name>

# Scalar value — output raw (no quotes)
node .claude/skills/workflow-manifest/scripts/manifest.js get <name> status

# Subtree — output as formatted JSON
node .claude/skills/workflow-manifest/scripts/manifest.js get <name> phases
```

**Phase level** (with flags):
```bash
# Whole phase object
node .claude/skills/workflow-manifest/scripts/manifest.js get <name> --phase discussion

# Specific field within phase+topic context
node .claude/skills/workflow-manifest/scripts/manifest.js get <name> --phase discussion --topic auth-flow status

# Nested field path
node .claude/skills/workflow-manifest/scripts/manifest.js get <name> --phase specification --topic auth-flow sources.auth-api.status
```

Errors to stderr with non-zero exit if the path does not exist.

### `set`

Write a value. Two modes:

**Work-unit level** (no flags):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set <name> description "Updated description"
node .claude/skills/workflow-manifest/scripts/manifest.js set <name> status concluded
```

**Phase level** (with flags):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set <name> --phase discussion --topic auth-flow status concluded
node .claude/skills/workflow-manifest/scripts/manifest.js set <name> --phase planning --topic auth-flow task_list_gate_mode auto
```

Values are parsed as JSON first (for arrays, objects, numbers, booleans), falling back to string. Validates structural fields:

- **work_type**: `epic`, `feature`, `bugfix`
- **phase names**: `research`, `discussion`, `investigation`, `specification`, `planning`, `implementation`, `review`
- **phase statuses**: per-phase valid values (see Validation section)
- **gate modes**: `gated`, `auto`
- **work unit status**: `in-progress`, `concluded`, `cancelled`

### `list`

Enumerate work units by scanning `.workflows/` for `manifest.json` files. Skips dot-prefixed directories (`.archive`, `.state`, `.cache`).

```bash
# All work units
node .claude/skills/workflow-manifest/scripts/manifest.js list

# Filter by status
node .claude/skills/workflow-manifest/scripts/manifest.js list --status in-progress

# Filter by work type
node .claude/skills/workflow-manifest/scripts/manifest.js list --work-type epic

# Combined filters
node .claude/skills/workflow-manifest/scripts/manifest.js list --status in-progress --work-type feature
```

Output: JSON array of manifest objects.

### `init-phase`

Register a topic within a phase. Behavior varies by work type:

- **Epic**: creates `phases.<phase>.items.<topic>` with `{ "status": "in-progress" }`
- **Feature/bugfix**: creates `phases.<phase>` with `{ "status": "in-progress" }` (flat — topic is implicit)

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init-phase <name> --phase discussion --topic <topic>
```

Errors if item/phase already exists.

### `push`

Append a value to an array field. Creates the array if it doesn't exist. Errors if the field exists but is not an array. Two modes:

**Work-unit level** (no flags):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js push <name> tags "v1"
```

**Phase level** (with flags):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js push <name> --phase implementation --topic <topic> completed_tasks "task-1"
node .claude/skills/workflow-manifest/scripts/manifest.js push <name> --phase implementation --topic <topic> completed_phases 1
```

### `exists`

Check whether a work unit, field, or phase entry exists. Always exits 0 — both `true` and `false` are valid results. Outputs `true` or `false` to stdout, nothing to stderr.

```bash
# Does the work unit exist?
node .claude/skills/workflow-manifest/scripts/manifest.js exists <name>

# Does a field path exist?
node .claude/skills/workflow-manifest/scripts/manifest.js exists <name> phases.discussion

# Does a phase/topic entry exist?
node .claude/skills/workflow-manifest/scripts/manifest.js exists <name> --phase discussion --topic auth-flow
node .claude/skills/workflow-manifest/scripts/manifest.js exists <name> --phase discussion --topic auth-flow status
```

If the work unit doesn't exist and a deeper path is requested, outputs `false` (no error). Actual usage errors (missing args, invalid phase name) still use `die()`.

## Validation

The CLI validates structural values to prevent invalid state:

| Field                          | Valid Values                             |
|--------------------------------|------------------------------------------|
| `work_type`                    | `epic`, `feature`, `bugfix`              |
| `status` (work unit)           | `in-progress`, `concluded`, `cancelled`  |
| `phases.research.status`       | `in-progress`, `concluded`               |
| `phases.discussion.status`     | `in-progress`, `concluded`               |
| `phases.investigation.status`  | `in-progress`, `concluded`               |
| `phases.specification.status`  | `in-progress`, `concluded`, `superseded` |
| `phases.planning.status`       | `in-progress`, `concluded`               |
| `phases.implementation.status` | `in-progress`, `completed`               |
| `phases.review.status`         | `in-progress`, `completed`               |
| Gate modes (`*_gate_mode`)     | `gated`, `auto`                          |

Item-level statuses within epic phases follow the same phase-level rules.

## Output Conventions

- **Scalar values**: raw to stdout, no quotes (e.g., `in-progress`, `concluded`)
- **Subtrees and lists**: formatted JSON to stdout
- **Errors**: message to stderr, non-zero exit code

## Notes

- **File locking**: `.lock` file next to manifest, exclusive create (`wx` flag), 30s stale detection. Prevents concurrent session conflicts.
- **Atomic writes**: write to `.tmp` then `fs.renameSync`. No partial writes.
- **Auto-creation**: `init` creates the work unit directory. Phase directories are created by skills when they enter that phase, not by the CLI.
- **Domain routing**: `--phase` and `--topic` flags let skills use logical coordinates. The CLI resolves to the correct internal JSON path based on work_type (flat for feature/bugfix, items for epic).
