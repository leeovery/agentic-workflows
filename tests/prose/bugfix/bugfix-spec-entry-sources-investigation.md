## case: bugfix-spec-entry-sources-investigation
- world: bugfix-investigated
- origin: bugfix mainline — the spec's source is the investigation, not a discussion
- files:
  - skills/workflow-specification-entry/SKILL.md
  - skills/workflow-specification-entry/references/validate-source.md
  - skills/workflow-specification-entry/references/invoke-skill.md

### walk

Execute skills/workflow-specification-entry/SKILL.md with arguments
$0=bugfix, $1=crash-fix. Follow it up to the point where the handoff to
the processing skill is constructed — record the handoff arguments
block — and stop there. Do not execute the processing skill's
instructions.

### expect

- routing: the source-material entry gate passes (empty render) — the completed investigation satisfies it for a bugfix
- routing: with no specification item in the manifest, the verb is Creating
- routing: the handoff names the investigation file .workflows/crash-fix/investigation/crash-fix.md as source material — no discussion file is named
- state: manifest absent crash-fix.specification.crash-fix status
