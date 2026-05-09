# Phase 4 — Wire `start-epic` to Inception

**Status:** Not started · **Depends on:** Phase 3

## Purpose

Third and final slice of the original "Inception MVP" — the user-visible flip. Replaces `start-epic`'s research/discussion menu with a single route into the inception phase. After this phase, **new epics go through inception when started**.

The discovery map isn't yet visualised in `continue-epic` (Phase 5 — display lands after the data is being written). Inception items are written to the manifest by Phase 3's process skill; Phase 4 just turns the new flow on for real users.

## Reference

- [Design](design.md):
  - **Inception Phase — Behaviour → Initial session** (lines 184-195) — confirms the user-visible entry shape.
  - **Imports — Import flow — epics** (lines 614-624) — `i`/`import` route preservation.
- `skills/start-epic/SKILL.md` — the file being modified.
- `skills/start-epic/references/route-first-phase.md` — the menu being collapsed.
- `skills/start-epic/references/collect-import.md` — destination change for imported files.

## What ships

- `start-epic` Step 3 (Route to First Phase) collapses to "always invoke inception-entry" for new epics.
- `start-epic`'s `i`/`import` route is preserved but routes through inception (full imports machinery — KB indexing, feature-import behaviour change — comes in Phase 8).
- End-to-end smoke test: `/start-epic` → describe → name → inception session → bridge → `/continue-epic` works for real.

## Files

**Modified:**

- `skills/start-epic/SKILL.md`:
  - Step 3 (Route to First Phase) is no longer a multi-option menu. Either route to inception directly, or via the `i`/`import` side-path.
  - Step 4 invocation table reduces to one row: `inception → /workflow-inception-entry epic {work_unit}`.
- `skills/start-epic/references/route-first-phase.md`:
  - Keep the file (Phase 12 removes it). Update to reflect the new shape — menu offers either continue-to-inception (default) or `i`/`import`.
  - On `i`/`import`: load `collect-import.md`, copy files to `imports/`, record in `imports[]`, then continue into inception.
- `skills/start-epic/references/collect-import.md`:
  - Switch destination from `research/exploration.md` to `imports/`.
  - Use `manifest push {wu} imports '{"path":"imports/...","imported_at":"<iso>"}'` per file.

## Out of scope

- Discovery-map render in `continue-epic` (Phase 5).
- KB indexing of imports (Phase 8).
- Behaviour change for features (still uses old import path until Phase 8).
- Removing the `route-first-phase.md` menu entirely (Phase 12).

## Verification

End-to-end smoke (the real one — first time the user-visible flip is reachable):

1. Fresh epic in temp dir:
   ```bash
   cd "$(mktemp -d)"
   /start-epic
   ```
   - Provide a description.
   - Confirm name.
   - Observe: routing collapses; lands directly in inception (or import sub-flow).
2. Walk a short conversation surfacing 2-3 topics with mixed routing.
3. Confirm-and-persist:
   - `phases.inception.items.{topic}` written.
   - `inception/session-001.md` matches template.
   - Single commit.
4. Bridge fires; user lands at `/continue-epic {wu}`.
5. `/continue-epic` does not error (display still transitional — full map render is Phase 5).
6. **Import path:**
   ```bash
   echo "Some seed thoughts" > /tmp/seed.md
   cd "$(mktemp -d)"
   /start-epic
   # Pick i/import; provide /tmp/seed.md
   ```
   - `imports/seed.md` copied.
   - `manifest.imports[]` has one entry.
   - Inception session opens with import content reflected.

## Notes for the implementer

- **The `i`/`import` flow is the only branch left in `route-first-phase.md`.** If the user doesn't pick import, just continue into inception — no menu rendered. Only show the menu when an inbox file is being processed or when there's a reason for the user to choose import explicitly. Final wording finalised during implementation.
- **Inbox-file path** (when `/start-epic` is invoked with a positional argument pointing at a `.workflows/.inbox/ideas/*.md` file) bypasses the gather-context prompt — see existing `start-epic/SKILL.md` Step 1. That logic stays as-is; only the *next-step* phase routing changes.
- **Don't break the existing import-from-feature flow.** Features still use the old import path until Phase 8 ships the behaviour change. Phase 4 only changes the **epic** import flow.
- **Testing:** because Phase 4 is the first end-to-end-reachable stage, this is the right phase to verify the manifest item shape matches the design (`name`, `summary`, `routing`, `source`). Phases 2 and 3 should have produced the right shape, but Phase 4 is when a *real user* exercises it.
