The prose should have taken this path:

1. the plan gate renders empty and no implementation item exists, so
   this is a new entry; dependency validation returns immediately —
   external dependencies are an epic concern
2. the entry hands off into the processing skill
3. resume detection initialises tracking and reports the created mode,
   which commits the start of implementation through the engine's
   scoped commit
4. environment setup finds the existing document stating no setup is
   required and returns without asking anything
5. the plan adapter is loaded for the manifest's format
6. project skills discovery reads an unpopulated topic value and finds
   no project default exists, so it proceeds to discovery; the scan
   reports no project skills — the workflow system's own skills are
   never candidates — with no menu and no question, and both the topic
   and project levels record the empty array
7. linter discovery reads an unpopulated topic value and no project
   default, so it proceeds to discovery; findings are presented and
   the approval menu offered; the scripted answer skips, and both
   levels record the empty array
8. the walk stops as the skill turns to its next concern — the
   knowledge guidance is never loaded and the task loop is never
   entered

Further claims:

- the project-skills scan never presented the workflow system's own
  skills as candidates and never asked which skills to use
- no individual skill paths were pushed to the manifest (the
  found-skills mechanism)
- the implementation item exists with gated gate modes; the project
  defaults now record empty arrays for both project_skills and linters
