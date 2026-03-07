# PR 7: Work Unit Lifecycle

*Part of the [Implementation Index](IMPLEMENTATION-INDEX.md).*

## Summary

Add lifecycle states for work units: active, cancelled, done. Currently work units have no explicit lifecycle status — they're implicitly active if they exist. This PR adds manifest-level status tracking and the UX for managing it.

## Changes

- **Manifest `status` field**: Each work unit gets `status: active | cancelled | done` in its manifest. Default is `active` on creation.
- **Cancel a work unit**: User can cancel a work unit mid-pipeline. Status becomes `cancelled`. Artifacts stay on disk. The work unit disappears from active lists.
- **Reactivate a cancelled work unit**: Status goes back to `active`, resuming from wherever it was. Pipeline state is preserved.
- **Done state**: When the final phase completes (review, or implementation if review is skipped per PR 8), status becomes `done`.
- **Continue skills filter**: Continue-feature, continue-bugfix, continue-epic only show work units with `status: active`.
- **Workflow-start display**: Cancelled and done work units appear in a summary section below active work (e.g., "Completed: 2 features, 1 bugfix. Cancelled: 1 epic."). A "View completed" or "View cancelled" menu option opens a sub-view for browsing.

## Dependencies

- Depends on: PR 4 (start/continue split — continue skills need to filter by status)
- Optional: PR 8 (skip review — affects when `done` is set)
