# PR 13: Manifest CLI — Wildcard Topic

## Summary

Add wildcard support to the manifest CLI's `--topic` flag, allowing queries across all topics in a phase without callers needing to know the internal manifest structure.

## Problem

For epics, checking whether *any* topic in a phase has a particular status requires fetching the entire phase object and parsing the JSON. This pushes structural knowledge into skill files (callers must know about `items`) and relies on non-deterministic "parse the JSON output" instructions.

Example from manage-work-unit (epic implementation check):

```bash
# Current: returns raw JSON, caller must parse
node .claude/skills/workflow-manifest/scripts/manifest.js get my-epic --phase implementation

# Desired: returns all topic statuses, CLI does the traversal
node .claude/skills/workflow-manifest/scripts/manifest.js get my-epic --phase implementation --topic "*" status
```

## Design Discussion

### Option 1: Wildcard `--topic "*"` (chosen for now)

Add `*` as a special topic value. When `resolvePhaseSegments` sees `*`, it iterates all items in the phase and collects the field value from each.

- Preserves the `--phase`/`--topic` abstraction layer
- Callers don't need to know about `items` vs flat structure
- For feature/bugfix (single implicit topic), `--topic "*"` would return the same as `--topic {name}`
- Return format: one value per line, or JSON array

### Option 2: Dot-path syntax with wildcard

Replace `--phase`/`--topic` flags entirely with a dot-path convention:

```bash
# Instead of --phase impl --topic auth-flow status:
get my-epic implementation.auth-flow.status

# Wildcard:
get my-epic implementation.*.status
```

The CLI would recognise phase names as the first segment and route through the same `resolvePhaseSegments` logic — callers never see `phases.implementation.items`, just `implementation.topic.field`.

**Pros:** Single syntax instead of two. Wildcards work naturally in the dot-path.

**Cons:** Bigger refactor — every skill using `--phase`/`--topic` needs updating. Would need to coexist with flags during migration or be done as a breaking change.

### Decision

Use Option 1 (`--topic "*"`) for PR7 as the minimal change. Option 2 is a potential future simplification of the entire CLI API surface — worth revisiting if the flags feel redundant or if more wildcard use cases emerge.

## Scope

- `get` command: `--topic "*"` returns collected values from all topics
- `exists` command: `--topic "*"` returns `true` if any topic has the specified field/value
- Validation: `*` bypasses topic name validation but still validates phase
- Feature/bugfix: `*` is a no-op (single implicit topic), returns same as without topic

## Touch Points

- `skills/workflow-manifest/scripts/manifest.js` — `resolvePhaseSegments`, `cmdGet`, `cmdExists`
- `skills/workflow-manifest/SKILL.md` — document wildcard topic
- `skills/workflow-start/references/manage-work-unit.md` — simplify epic implementation check
- `tests/scripts/test-workflow-manifest.sh` — wildcard topic tests
- `CLAUDE.md` — update CLI grammar examples
