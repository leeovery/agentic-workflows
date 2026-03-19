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

## Dot-Path Syntax

Every command follows: `command path [field] [value]`

The path joins work unit, phase, and topic with dots. The field is always a separate argument. Segment count in the path determines the access level:

| Segments | Level | Path | Field | Resolves to |
|----------|-------|------|-------|-------------|
| 1 | Work unit | `my-epic` | `work_type` | `work_type` |
| 2 | Phase | `my-epic.planning` | `format` | `phases.planning.format` |
| 3 | Topic | `my-epic.discussion.auth-flow` | `status` | `phases.discussion.items.auth-flow.status` |

```bash
MANIFEST="node .claude/skills/workflow-manifest/scripts/manifest.js"

# Work-unit level (1 segment):
$MANIFEST get {work_unit} [field]
$MANIFEST set {work_unit} field value
$MANIFEST delete {work_unit} field.path
$MANIFEST exists {work_unit} [field.path]

# Phase level (2 segments):
$MANIFEST get {work_unit}.{phase} [field]
$MANIFEST set {work_unit}.{phase} field value
$MANIFEST delete {work_unit}.{phase} field.path

# Topic level (3 segments):
$MANIFEST get {work_unit}.{phase}.{topic} [field.path]
$MANIFEST set {work_unit}.{phase}.{topic} field.path value
$MANIFEST delete {work_unit}.{phase}.{topic} field.path
$MANIFEST init-phase {work_unit}.{phase}.{topic}

# Wildcard (3 segments, * as topic):
$MANIFEST get {work_unit}.{phase}.* [field.path]
$MANIFEST exists {work_unit}.{phase}.* [field.path]

# Existence checks (always exit 0, outputs true/false):
$MANIFEST exists {work_unit}
$MANIFEST exists {work_unit} [field.path]
$MANIFEST exists {work_unit}.{phase} [field.path]
$MANIFEST exists {work_unit}.{phase}.{topic} [field.path]

# Management (unchanged):
$MANIFEST init name --work-type type --description "..."
$MANIFEST list [--status s] [--work-type t]
```

**Phase-level access** (2-segment path) — accesses fields directly on the phase object (`phases.{phase}.{field}`). Useful for phase-wide metadata like `format`, `analysis_cache`, etc.

**Topic-level access** (3-segment path) — routes through items: `phases.{phase}.items.{topic}.{field}`. Used for per-topic state like `status`, gate modes, etc.

**Wildcard topic** (`*` as third segment) — collects values from all topics in a phase. Supported by `get` and `exists` only. For epic: iterates all items. For feature/bugfix: returns the single item.

**Internal routing (CLI handles, skills don't know):**
- `my-epic.discussion.auth-flow status` → `phases.discussion.items.auth-flow.status`

### Naming Constraints

- **Work unit names must not contain dots** — dots are the path separator
- **Work unit names must not match phase names** (`research`, `discussion`, `investigation`, `specification`, `planning`, `implementation`, `review`)

## Commands

### `init`

Create a new work unit manifest.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init <name> --work-type <epic|feature|bugfix> --description "..."
```

Creates `.workflows/<name>/manifest.json` with identity fields and empty phases. Errors if manifest already exists. Rejects names containing dots or matching phase names.

### `get`

Read a value or subtree. Three levels:

**Work-unit level** (1 segment):
```bash
# Full manifest
node .claude/skills/workflow-manifest/scripts/manifest.js get <name>

# Scalar value — output raw (no quotes)
node .claude/skills/workflow-manifest/scripts/manifest.js get <name> status

# Subtree — output as formatted JSON
node .claude/skills/workflow-manifest/scripts/manifest.js get <name> phases
```

**Phase level** (2 segments):
```bash
# Whole phase object
node .claude/skills/workflow-manifest/scripts/manifest.js get <name>.discussion

# Specific field within phase
node .claude/skills/workflow-manifest/scripts/manifest.js get <name>.planning format
```

**Topic level** (3 segments):
```bash
# Specific field within topic
node .claude/skills/workflow-manifest/scripts/manifest.js get <name>.discussion.auth-flow status

# Nested field path
node .claude/skills/workflow-manifest/scripts/manifest.js get <name>.specification.auth-flow sources.auth-api.status
```

**Wildcard topic** (3 segments, `*` as topic):
```bash
# Collect status from all topics in a phase
node .claude/skills/workflow-manifest/scripts/manifest.js get '<name>.discussion.*' status
```

Output is a JSON array of `{topic, value}` objects:
```json
[
  { "topic": "auth-flow", "value": "completed" },
  { "topic": "data-model", "value": "in-progress" }
]
```

For feature/bugfix, returns a single-element array (topic matches work unit name). Errors if the phase has no items.

Errors to stderr with non-zero exit if the path does not exist.

### `set`

Write a value. Three levels:

**Work-unit level** (1 segment):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set <name> description "Updated description"
node .claude/skills/workflow-manifest/scripts/manifest.js set <name> status completed
```

**Phase level** (2 segments):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set <name>.planning format local-markdown
node .claude/skills/workflow-manifest/scripts/manifest.js set <name>.research analysis_cache '{"checksum":"..."}'
```

**Topic level** (3 segments):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set <name>.discussion.auth-flow status completed
node .claude/skills/workflow-manifest/scripts/manifest.js set <name>.planning.auth-flow task_list_gate_mode auto
```

Values are parsed as JSON first (for arrays, objects, numbers, booleans), falling back to string. Validates structural fields:

- **work_type**: `epic`, `feature`, `bugfix`
- **phase names**: `research`, `discussion`, `investigation`, `specification`, `planning`, `implementation`, `review`
- **phase statuses**: per-phase valid values (see Validation section)
- **gate modes**: `gated`, `auto`
- **work unit status**: `in-progress`, `completed`, `cancelled`

### `delete`

Remove a key from the manifest. Three levels:

**Work-unit level** (1 segment):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js delete <name> <field.path>
```

**Phase level** (2 segments):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js delete <name>.research analysis_cache
```

**Topic level** (3 segments):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js delete <name>.implementation.auth completed_tasks
```

Errors if the path does not exist. Deletes the key entirely (not just setting to null). Parent keys are preserved.

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

Register a topic within a phase. Creates `phases.<phase>.items.<topic>` with `{ "status": "in-progress" }`. Requires a 3-segment path.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init-phase <name>.discussion.<topic>
```

Errors if item/phase already exists.

### `push`

Append a value to an array field. Creates the array if it doesn't exist. Errors if the field exists but is not an array. Three levels:

**Work-unit level** (1 segment):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js push <name> tags "v1"
```

**Phase level** (2 segments):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js push <name>.research analysis_cache.files "a.md"
```

**Topic level** (3 segments):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js push <name>.implementation.{topic} completed_tasks "{topic}-1-1"
node .claude/skills/workflow-manifest/scripts/manifest.js push <name>.implementation.{topic} completed_phases 1
node .claude/skills/workflow-manifest/scripts/manifest.js push <name>.review.{topic} reviewed_tasks "{topic}-1-1"
```

### `key-of`

Find the key in an object whose value matches. Useful for reverse lookups — e.g., finding an internal ID from an external ID in `task_map`.

```bash
# Find internal ID from external ID
node .claude/skills/workflow-manifest/scripts/manifest.js key-of <name>.planning.<topic> task_map {external_id}
```

Output: the matching key to stdout (e.g., `portal-1-1`). Errors if the value is not found or the path is not an object.

### `exists`

Check whether a work unit, field, or phase entry exists. Always exits 0 — both `true` and `false` are valid results. Outputs `true` or `false` to stdout, nothing to stderr.

```bash
# Does the work unit exist?
node .claude/skills/workflow-manifest/scripts/manifest.js exists <name>

# Does a field path exist? (work-unit level)
node .claude/skills/workflow-manifest/scripts/manifest.js exists <name> work_type

# Does a phase-level field exist?
node .claude/skills/workflow-manifest/scripts/manifest.js exists <name>.discussion

# Does a topic entry exist?
node .claude/skills/workflow-manifest/scripts/manifest.js exists <name>.discussion.auth-flow
node .claude/skills/workflow-manifest/scripts/manifest.js exists <name>.discussion.auth-flow status

# Wildcard: does any topic in the phase have this field?
node .claude/skills/workflow-manifest/scripts/manifest.js exists '<name>.discussion.*'
node .claude/skills/workflow-manifest/scripts/manifest.js exists '<name>.discussion.*' status
```

If the work unit doesn't exist and a deeper path is requested, outputs `false` (no error). Actual usage errors (missing args, invalid phase name) still use `die()`.

**Wildcard topic** (`*` as third segment) — outputs `true` if any topic in the phase matches (has the field, or exists at all if no field specified), `false` otherwise. Always exits 0.

## Validation

The CLI validates structural values to prevent invalid state:

| Field                          | Valid Values                             |
|--------------------------------|------------------------------------------|
| `work_type`                    | `epic`, `feature`, `bugfix`              |
| `status` (work unit)           | `in-progress`, `completed`, `cancelled`  |
| Item `status` (research)       | `in-progress`, `completed`               |
| Item `status` (discussion)     | `in-progress`, `completed`               |
| Item `status` (investigation)  | `in-progress`, `completed`               |
| Item `status` (specification)  | `in-progress`, `completed`, `superseded` |
| Item `status` (planning)       | `in-progress`, `completed`               |
| Item `status` (implementation) | `in-progress`, `completed`               |
| Item `status` (review)         | `in-progress`, `completed`               |
| Gate modes (`*_gate_mode`)     | `gated`, `auto`                          |

Status is always tracked at the item level (`phases.{phase}.items.{topic}.status`), never at the phase level.

## Output Conventions

- **Scalar values**: raw to stdout, no quotes (e.g., `in-progress`, `completed`)
- **Subtrees and lists**: formatted JSON to stdout
- **Errors**: message to stderr, non-zero exit code

## Notes

- **File locking**: `.lock` file next to manifest, exclusive create (`wx` flag), 30s stale detection. Prevents concurrent session conflicts.
- **Atomic writes**: write to `.tmp` then `fs.renameSync`. No partial writes.
- **Auto-creation**: `init` creates the work unit directory. Phase directories are created by skills when they enter that phase, not by the CLI.
- **Domain routing**: The dot-path syntax lets skills use logical coordinates. The CLI resolves to the correct internal JSON path — all work types use `items` structure.
