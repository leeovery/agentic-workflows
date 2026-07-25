## case: bugfix-investigation-entry-seeds
- world: bugfix-created
- origin: bugfix mainline — investigation entry seeds from the carrier, never re-asks
- files:
  - skills/workflow-investigation-entry/SKILL.md
  - skills/workflow-investigation-entry/references/invoke-skill.md

### walk

Execute skills/workflow-investigation-entry/SKILL.md with arguments
$0=bugfix, $1=crash-fix. Follow it up to the point where the handoff to
the processing skill is constructed — record the handoff arguments
block — and stop there. Do not execute the processing skill's
instructions.

### expect

- routing: with no investigation item in the manifest, source is new — the phase-validation path is not taken
- routing: because a discovery session log exists, the bug context is seeded from the manifest description and that log — the gather-context questioning path is not taken, and the walk asks the user nothing
- routing: a phase note is rendered by the engine for the investigation phase, with the verb Starting
- routing: the handoff invokes workflow-investigation-process for crash-fix
- state: manifest absent crash-fix.investigation.crash-fix status
