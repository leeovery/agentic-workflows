# Fixture — implementation-bounds-auto-to-the-phase

The `pay` feature is mid-implementation under a two-phase local-markdown
plan. Phase 1 (Payment core) holds `pay-1-1` (Create Payment Intent) and
`pay-1-2` (Handle Capture Webhooks); Phase 2 (Settlement) holds
`pay-2-1` (Reconcile Settlement Reports). Structure and both phases'
task approvals are recorded, the authoring cursor sits past the last
phase, and the planning item is completed.

`pay-1-1` is completed by a previous session — its source, test, and
completed task file all exist, its `impl(pay): Tpay-1-1` commit is in
the git history, and the manifest records it in `completed_tasks` with
`current_task` handed to `pay-1-2`. `pay-1-2` and `pay-2-1` are
pending; neither carries a dependency or a priority.

The implementation item exists from that previous session: `task init`
has run (gates all `gated`, counters zeroed, `current_phase` 1), so
this session's entry resumes rather than creates. `completed_phases`,
`consolidated_phases`, and `bank` are absent — no phase has closed and
nothing has been banked.

As in the sibling loop cases, the previous pass also left:

- `.workflows/.state/environment-setup.md` stating
  `No special setup required.`
- `project.defaults.project_skills` and `project.defaults.linters`
  both `[]`, routing Steps 3 and 4 to their skip-again gates.
