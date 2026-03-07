# PR 4: Start/Continue Split

*Part of the [Implementation Index](../IMPLEMENTATION-INDEX.md). Design context in [WORK-TYPE-ARCHITECTURE-DISCUSSION.md](WORK-TYPE-ARCHITECTURE-DISCUSSION.md) (lines 604-631).*

## Summary

Split each work-type entry point into separate start and continue skills. Six new skills replace three overloaded ones.

## New Skills

- `/start-epic`, `/start-feature`, `/start-bugfix` — create new work units
- `/continue-epic`, `/continue-feature`, `/continue-bugfix` — resume existing work units

## Start Skills — Focused Responsibility

- Gather context from scratch (interview questions, bug description)
- Suggest and confirm a name (shown as "epic name", "feature name", "bugfix name" — not "work unit")
- Set `work_unit` = confirmed name (and `topic` = `work_unit` for feature/bugfix)
- Create manifest via CLI
- Invoke the first phase skill (discussion for feature/epic, investigation for bugfix)
- **No resume logic** — if a name conflict is detected, reject outright: "That name already exists. Run `/continue-{type}` to resume, or choose a different name."

## Continue Skills — Focused Responsibility

- List active work units of that type via manifest CLI
- User picks one (or auto-select if only one)
- Read manifest to determine current phase via `computeNextPhase`
- Route to the correct phase skill with work_type + work_unit + topic
- For feature/bugfix (linear): drops into the right phase automatically
- For epic (freeform): presents state and lets the user choose

## Cross-Routing

If a user calls `/start-feature` but existing active features are found, offer: "Did you mean to continue one of these?" and hand off to `/continue-feature`. No duplication, just a redirect.

## What This Resolves

- **Resume-in-start awkwardness** — start skills currently handle both "create new" and "resume existing" with branching logic. The split gives each a single responsibility.
- **Conflict check simplification** — start never resumes, so a name clash is always "pick a different name."
- **Flat cross-work-unit display** — continue skills pick the work unit first, then show topics within it. No more flat lists across all work units.
- **Topic/work_unit conflation in displays** — with work unit already selected, displays only show topics. Clear separation.

## Dependencies

- Depends on: PR 1 (manifest CLI, work-unit-first directories)
- Enables: PR 5 (phase skills can go internal once start/continue own all entry logic)
