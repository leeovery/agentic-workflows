# Fixture — implementation-finds-no-project-skills

The `pay` feature is fully planned and untouched by implementation: a
single-phase plan holding two pending tasks, with approvals recorded
and the planning item completed.

This is a first implementation for the project as far as discovery
state goes: no `project.defaults.project_skills` and no
`project.defaults.linters` exist, so Steps 3 and 4 both fall through
to their discovery sections. `.claude/skills/` holds the installed
workflow system and nothing else — the state every real install is in
— so the project-skills scan must find no candidates.

`.workflows/.state/environment-setup.md` exists stating
`No special setup required.`, keeping the environment step silent.

No implementation item exists in the manifest; no source or test
files exist yet.
