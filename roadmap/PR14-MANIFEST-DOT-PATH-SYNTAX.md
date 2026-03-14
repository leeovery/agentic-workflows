# PR 14: Manifest CLI — Dot-Path Syntax

## Summary

Replace `--phase`/`--topic` flags and raw work-unit-level phase paths with a unified dot-path convention. The work unit, phase, and topic are joined into a single path argument. The field is always a separate argument. Segment count determines the access level — no disambiguation or manifest lookup needed.

## Background

This was originally documented as Option 2 in [PR13](PR13-MANIFEST-WILDCARD-TOPIC.md) but deferred in favour of the minimal `--topic "*"` change. Now that PR 13 is complete and wildcard support is proven, this PR delivers the full syntax simplification.

## Problem

The current CLI has two inconsistent access modes:

1. **Flag syntax** (`--phase`/`--topic`) — domain-aware, abstracts internals, but verbose
2. **Raw dot paths** — used for phase-level fields like `phases.research.analysis_cache`, bypasses the abstraction entirely and exposes internal JSON structure

This creates two mental models and leaks implementation details in the raw path case.

```bash
# Flag syntax — verbose but abstracted
$MANIFEST get my-epic --phase discussion --topic auth-flow status
$MANIFEST set my-epic --phase discussion --topic auth-flow status completed
$MANIFEST init-phase my-epic --phase discussion --topic auth-flow
$MANIFEST get my-epic --phase discussion --topic "*" status

# Raw paths — concise but exposes internals
$MANIFEST set my-epic phases.research.analysis_cache '{"checksum":"..."}'
$MANIFEST delete my-epic phases.research.analysis_cache
```

## Design

### Unified Path + Field Syntax

Every command follows: `command path [field] [value]`

The path joins work unit, phase, and topic with dots. The field is always a separate argument. Segment count in the path determines the access level:

| Segments | Level | Path | Field | Resolves to |
|----------|-------|------|-------|-------------|
| 1 | Work unit | `my-epic` | `work_type` | `work_type` |
| 2 | Phase | `my-epic.planning` | `format` | `phases.planning.format` |
| 3 | Topic | `my-epic.discussion.auth-flow` | `status` | `phases.discussion.items.auth-flow.status` |

```bash
# Work-unit level (1 segment)
$MANIFEST get my-epic work_type
$MANIFEST set my-epic status completed
$MANIFEST exists my-epic

# Phase level (2 segments)
$MANIFEST get my-epic.planning format
$MANIFEST set my-epic.research analysis_cache '{"checksum":"..."}'
$MANIFEST delete my-epic.research analysis_cache

# Topic level (3 segments)
$MANIFEST get my-epic.discussion.auth-flow status
$MANIFEST set my-epic.discussion.auth-flow status completed
$MANIFEST set my-epic.planning.auth-flow external_dependencies.billing.state resolved

# Wildcard (3 segments, * as topic)
$MANIFEST get my-epic.discussion.* status

# Topic init (3 segments, no field)
$MANIFEST init-phase my-epic.discussion.auth-flow

# Push to array
$MANIFEST push my-epic.implementation.auth-flow completed_tasks "auth-1-1"

# Work-unit creation and enumeration (unchanged)
$MANIFEST init my-epic --work-type feature --description "..."
$MANIFEST list
$MANIFEST list --status in-progress --work-type epic
```

### Resolution Rules

1. Split the path argument by `.`
2. Count segments:
   - **1 segment** → work-unit level. Field argument accesses top-level manifest fields.
   - **2 segments** → phase level. Second segment is the phase name. Field argument accesses `phases.{phase}.{field}`.
   - **3 segments** → topic level. Second segment is the phase, third is the topic (or `*` for wildcard). Field argument accesses `phases.{phase}.items.{topic}.{field}`.
3. No field argument → return the whole object at that level (`get`) or check existence (`exists`).

No manifest lookup, no disambiguation heuristics. The position tells you everything.

### Validation

- **Work unit names** must not contain dots (enforced in `init`). Already satisfied by kebab-case convention.
- **Work unit names** must not match phase names (`research`, `discussion`, etc.) — prevents confusion even though the CLI would technically handle it.
- **Phase names** are validated against the known set (existing behaviour, unchanged).

### Migration

- Clean break — `--phase` and `--topic` flags removed entirely (no deprecation period)
- All skill files updated to unified path + field syntax
- Raw `phases.x.y` paths in skill files normalised (e.g., `phases.research.analysis_cache` → field `analysis_cache` on path `{wu}.research`)
- CLAUDE.md grammar examples updated
- Migration scripts left as-is (point-in-time snapshots per existing convention)

## Touch Points

- `skills/workflow-manifest/scripts/manifest.js` — path parsing by segment count, remove flag parsing, add work-unit name validation
- `skills/workflow-manifest/SKILL.md` — full API docs update
- All skill files using `--phase`/`--topic` (~221 invocations) — syntax migration
- All skill files using raw `phases.x.y` paths (~30 invocations) — normalise to path + field
- All agent files using manifest CLI — syntax migration
- `tests/scripts/test-workflow-manifest.sh` — path-based tests (all three levels, wildcards, nested fields, edge cases)
- `CLAUDE.md` — update CLI grammar section
