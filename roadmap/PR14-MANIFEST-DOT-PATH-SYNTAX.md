# PR 14: Manifest CLI — Dot-Path Syntax

## Summary

Replace `--phase`/`--topic` flags and raw work-unit-level phase paths with a unified dot-path convention. The CLI recognises phase names as the first segment and routes through domain-aware resolution — callers never see `phases`, `items`, or internal structure, regardless of access level.

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

### Three Access Levels, One Syntax

All manifest access normalises into dot paths with smart routing:

| Level | Syntax | Resolves to |
|-------|--------|-------------|
| Work unit | `work_type`, `status` | Top-level manifest field |
| Phase | `research.analysis_cache` | `phases.research.analysis_cache` |
| Topic | `discussion.auth-flow.status` | `phases.discussion.items.auth-flow.status` |

```bash
# Work-unit level — no phase prefix
$MANIFEST get my-epic work_type
$MANIFEST set my-epic status completed
$MANIFEST exists my-epic

# Phase level — phase prefix, no topic
$MANIFEST get my-epic research.analysis_cache
$MANIFEST set my-epic research.analysis_cache '{"checksum":"..."}'
$MANIFEST delete my-epic research.analysis_cache

# Topic level — phase.topic.field
$MANIFEST get my-epic discussion.auth-flow.status
$MANIFEST set my-epic discussion.auth-flow.status completed
$MANIFEST init-phase my-epic discussion.auth-flow

# Wildcard — phase.*.field
$MANIFEST get my-epic discussion.*.status

# Push to array
$MANIFEST push my-epic implementation.auth-flow.completed_tasks "auth-1-1"

# Enumerate
$MANIFEST list
```

### Resolution Rules

1. Split the path by `.`
2. If the first segment is a known phase name (`research`, `discussion`, `investigation`, `specification`, `planning`, `implementation`, `review`):
   - Route into `phases.{phase}`
   - If the second segment matches a key in `phases.{phase}.items` → **topic-level**: route through `resolvePhaseSegments` (inserts `items`)
   - If the second segment is `*` → **wildcard**: iterate all items
   - Otherwise → **phase-level**: append remaining segments directly under `phases.{phase}`
3. If the first segment is NOT a known phase name → **work-unit-level**: standard dot-path traversal from manifest root

### Disambiguation: Phase-Level vs Topic-Level

The second segment after a phase name could be either a phase-level field (`analysis_cache`) or a topic name (`auth-flow`). The CLI disambiguates by checking the manifest:

- If `phases.{phase}.items.{second_segment}` exists → topic route
- Otherwise → phase-level field route

**Safety net — reserved field names**: Topic name validation rejects names that collide with known phase-level field names (e.g., `analysis_cache`, `items`). This is a small addition to the existing validation that already checks topic names. Prevents a future topic from accidentally shadowing a structural field.

### Migration

- Clean break — `--phase` and `--topic` flags removed entirely (no deprecation period)
- All skill files updated to dot-path syntax
- Raw `phases.x.y` paths in skill files updated to normalised `x.y` paths
- CLAUDE.md grammar examples updated
- Migration scripts left as-is (point-in-time snapshots per existing convention)

## Touch Points

- `skills/workflow-manifest/scripts/manifest.js` — dot-path parsing, phase detection, manifest lookup disambiguation, remove flag parsing
- `skills/workflow-manifest/SKILL.md` — full API docs update
- All skill files using `--phase`/`--topic` (~221 invocations) — syntax migration
- All skill files using raw `phases.x.y` paths (~30 invocations) — normalise to `x.y`
- All agent files using manifest CLI — syntax migration
- `tests/scripts/test-workflow-manifest.sh` — dot-path tests, disambiguation tests
- `CLAUDE.md` — update CLI grammar section
