# PR 8: Skip Review

*Part of the [Implementation Index](IMPLEMENTATION-INDEX.md).*

## Summary

Allow users to skip the review phase and mark a work unit as done directly after implementation. Useful for small features or bugfixes where review would be low-value.

## Changes

- **Bridge after implementation**: When implementation completes and the bridge fires, offer a choice instead of automatically routing to review:
  - Start review
  - Mark as done (skip review)
- **Applies to**: Feature and bugfix pipelines. Epic topics can also skip review individually.
- **Manifest**: If skipped, the review phase is never created. The work unit status transitions directly to `done` (per PR 7).

## Dependencies

- Depends on: PR 7 (work unit lifecycle — needs `done` status)
- Depends on: PR 2 (bridge always fires — the bridge is where the skip option is offered)
