# Fixture — implementation-executes-the-loop

The `pay` feature is fully planned and untouched by implementation: a
single-phase local-markdown plan holding two pending tasks — `pay-1-1`
(Create Payment Intent, first by task order) and `pay-1-2` (Handle
Capture Webhooks) — with structure and task approvals recorded and the
planning item completed.

The project has been through an implementation before, in work since
cleaned away, and carries what that pass left behind:

- `.workflows/.state/environment-setup.md` states
  `No special setup required.` — the environment step's own record,
  written to stop the setup question repeating.
- `project.defaults.project_skills` is `[]` — the empty array both
  levels record when a previous discovery ended with no project
  skills, which routes Step 3 to its skip-again gate.
- `project.defaults.linters` is `[]` — likewise, routing Step 4 to
  its skip-again gate.

No implementation item exists in the manifest; `task init` has never
run. No source or test files exist yet.
