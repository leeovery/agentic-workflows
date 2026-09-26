---
topic: migration
status: concluded
type: feature
work_type: greenfield
date: 2026-01-25
sources:
  - name: migration-subcommand
    status: incorporated
---

# Specification: Migration

## Specification

### Overview

The `tick migrate` command imports task data from other tools. Users migrating to tick can preserve their existing work without manually recreating tasks.

**Primary use case**: Active project migration - preserving invested work when switching from another task management tool to tick.

**Design principles**:
1. **One-time import** - Not a sync tool; run once, delete the old system
2. **Append-only** - Adds to existing tick data, never modifies or deletes
3. **User responsibility** - Duplicates from re-running are the user's problem, not ours
4. **Plugin architecture** - Providers are self-contained; tick core doesn't manage credentials or source-specific logic

### Command Interface

```
tick migrate --from <provider> [--dry-run] [--pending-only]
```

**Flags**:

| Flag | Required | Description |
|------|----------|-------------|
| `--from <provider>` | Yes | Source provider to import from (e.g., `beads`) |
| `--dry-run` | No | Preview what would be imported without writing |
| `--pending-only` | No | Import only non-completed tasks (default: import all) |

**Examples**:
```bash
tick migrate --from beads              # Import all tasks from beads
tick migrate --from beads --dry-run    # Preview import
tick migrate --from beads --pending-only  # Import only active work
```

### Architecture

Migration uses a plugin/strategy pattern:

```
Provider → Normalize → Insert
   ↓           ↓          ↓
 (beads,    (contract)   (tick
  JIRA,                   data)
  Linear)
```

**Provider responsibilities**:
1. Connect to source system (if applicable)
2. Fetch data from source
3. Map source data to normalized format

**Core responsibilities**:
1. Receive normalized data from provider
2. Validate against contract
3. Insert into tick data store

The inserter is provider-agnostic - it receives normalized data and creates tick entries. This separation allows new providers to be added without modifying core logic.

**Authentication**: Delegated entirely to the provider. Each provider handles its own credential needs (env vars, prompts, config files). Tick core doesn't manage credentials. For file-based providers like beads, authentication isn't relevant.

**Normalized format**: The contract mirrors tick's task schema as defined in the tick-core specification. Providers map source data to this format; the core inserter validates and persists it.

### Data Mapping

**Required fields**: Title only (bare minimum for a valid task)

**Mapping approach**:
- Map all available fields from source to tick equivalents
- Missing data uses sensible defaults or is left empty
- Extra source fields with no tick equivalent are discarded

Most project management tools have more data than tick needs, so mapping is typically straightforward - the challenge is what to omit, not what to invent.

### Error Handling

**Strategy**: Continue on error, report failures at end.

When a task fails to import:
1. Log the failure with reason
2. Continue processing remaining tasks
3. Report summary at end

No rollback - successfully imported tasks remain even if others fail.

**Unknown provider**: If `--from` specifies an unrecognized provider, exit immediately with an error listing available providers:
```
Error: Unknown provider "xyz"

Available providers:
  - beads
```

### Output Format

Print each task as imported, then summary at end. No verbose flag needed - show everything by default.

```
Importing from beads...
  ✓ Task: Implement login flow
  ✓ Task: Fix database connection
  ✓ Task: Add unit tests
  ✗ Task: Broken entry (skipped: missing title)

Done: 3 imported, 1 failed
```

**Failure detail** (shown after summary if any failures):
```
Failures:
- Task "foo": Missing required field
- Task "bar": Invalid date format
```

### Initial Provider: Beads

The first supported provider is **beads** - a task format used in claude-technical-workflows.

**Characteristics**:
- File-based (local filesystem)
- No authentication required
- Source of the primary migration use case

Future providers (JIRA, Linear, etc.) can be added following the same plugin contract.

---

## Dependencies

Prerequisites that must exist before implementation can begin:

### Required

| Dependency | Why Blocked | What's Unblocked When It Exists |
|------------|-------------|--------------------------------|
| **tick-core** | Migration inserts tasks into tick's data store. Cannot create tasks without the data layer, schema, and write operations. | All migration functionality - provider plugins, normalization, and insertion. |

### Notes

- The plugin architecture itself can be designed in parallel with tick-core
- Beads provider implementation requires understanding the beads format (separate from tick dependencies)
