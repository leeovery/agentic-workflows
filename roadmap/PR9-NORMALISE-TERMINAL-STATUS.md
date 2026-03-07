# PR 9: Normalise Terminal Status

*Part of the [Implementation Index](IMPLEMENTATION-INDEX.md).*

## Summary

Normalise the terminal phase status to `concluded` across all phases. Currently implementation uses `completed` while every other phase uses `concluded`. This inconsistency forces special-case handling in discovery scripts, bridge routing, continuation logic, and validate-phase files.

## Changes

- **Implementation phase**: Change terminal status from `completed` to `concluded`
- **Discovery scripts**: Remove `completed` as a separate status check — all phases use `concluded`
- **Bridge/continuation logic**: Simplify `concluded || completed` checks to just `concluded`
- **Manifest CLI validation**: Remove `completed` from valid status values (or keep as alias during migration)
- **Migration script**: Update any existing manifests with `implementation.status: completed` → `concluded`
- **Processing skill (technical-implementation)**: Set `concluded` instead of `completed` when implementation finishes
- **Entry-point validate-phase files**: `start-implementation` and `start-review` currently check for `completed` — normalise to `concluded`

## Scope

Cross-cutting but mechanical. Touches discovery scripts, manifest validation, processing skill conclusion logic, entry-point validation, and bridge routing. Low risk with a migration script to handle existing data.

## Dependencies

- Independent — can land at any point after PR 4 (start/continue split, which introduced validate-phase.md files that reference the status)
