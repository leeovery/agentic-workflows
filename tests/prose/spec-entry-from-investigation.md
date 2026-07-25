## case: spec-entry-from-investigation
- origin: bugfix mainline — the same entry skill, sourced from an investigation
- files:
  - skills/workflow-specification-entry/SKILL.md
  - skills/workflow-specification-entry/references/validate-source.md
  - skills/workflow-specification-entry/references/invoke-skill.md

### given

world_before: bugfix-investigated

### when

Execute skills/workflow-specification-entry/SKILL.md with arguments
$0=bugfix, $1=crash-fix. Follow it to the point where the handoff to the
processing skill is constructed; record the handoff block and stop. Do
not execute the processing skill's instructions.

### then

world_after: unchanged

trace:
1. resolves the topic to the work unit and goes to validating source
   material
2. the source-material gate renders empty: for a bugfix the completed
   investigation is what satisfies it, in place of a discussion
3. no specification item exists, so the verb is Creating
4. hands off naming `.workflows/crash-fix/investigation/crash-fix.md` as
   the source material — no discussion file is named

notes:
- the same prose serves both work types; only the source arm differs
