# Fixture — implementation-parks-on-a-named-horizon

The `pay` feature is fully planned and untouched by implementation: a
single-phase local-markdown plan holding two pending tasks — `pay-1-1`
(Create Payment Intent, first by task order) and `pay-1-2` (Handle
Capture Webhooks) — with structure and task approvals recorded and the
planning item completed.

The project has been through an implementation before, in work since
cleaned away, and carries what that pass left behind:

- `.workflows/.state/environment-setup.md` states
  `No special setup required.`
- `project.defaults.project_skills` is `[]`, routing project-skills
  discovery to its skip-again gate.
- `project.defaults.linters` is `[]`, likewise.

The project has no roadmap: no horizons, no items, no roadmap node on
the project manifest. Nothing has ever been parked here.

No implementation item exists in the manifest; `task init` has never
run. No source or test files exist yet.
