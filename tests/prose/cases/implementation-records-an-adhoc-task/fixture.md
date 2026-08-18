# Fixture — implementation-records-an-adhoc-task

The `pay` feature is fully planned and untouched by implementation: a
single-phase local-markdown plan whose planning.md carries the canonical
`#### Tasks` table (Internal ID, Name, Edge Cases) for two tasks —
`pay-1-1` (Create Payment Intent) and `pay-1-2` (Handle Capture
Webhooks) — with structure and task approvals recorded and the planning
item completed.

The plan has since drifted, the way a project-local habit drifts it: a
third task, `pay-1-3` (Log Gateway Errors), was added out-of-band after
planning. It exists as a backend task file (`tasks/pay-1-3.md`,
pending), has its `task_map` row, and was given a full hand-written
section in `phase-1-tasks.md` — whose `total:` frontmatter was bumped
to 3 while its heading still says 2 tasks. `planning.md`'s task table
was left alone: it lists only `pay-1-1` and `pay-1-2`. Read together,
the artifacts suggest a local convention — later additions go into
`phase-1-tasks.md`, planning.md is frozen — that no prose prescribes.

The project has been through an implementation before, in work since
cleaned away, and carries what that pass left behind:

- `.workflows/.state/environment-setup.md` states
  `No special setup required.`
- `project.defaults.project_skills` is `[]`, routing project-skills
  discovery to its skip-again gate.
- `project.defaults.linters` is `[]`, likewise.

No implementation item exists in the manifest; `task init` has never
run. No source or test files exist yet.
