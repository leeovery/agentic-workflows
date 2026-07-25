## case: investigation-entry-seeds-from-carrier
- origin: bugfix mainline — a bug shaped in discovery is never re-interrogated
- files:
  - skills/workflow-investigation-entry/SKILL.md
  - skills/workflow-investigation-entry/references/invoke-skill.md

### given

world_before: bugfix-created

### when

Execute skills/workflow-investigation-entry/SKILL.md with arguments
$0=bugfix, $1=crash-fix. Follow it to the point where the handoff to the
processing skill is constructed; record the handoff block and stop. Do
not execute the processing skill's instructions.

### then

world_after: unchanged

trace:
1. resolves the topic to the work unit, investigation being bugfix work
2. reads the investigation status, finds nothing, sets the source to new
   and skips phase validation entirely
3. finds a discovery session log, so seeds the bug context from the
   manifest description and that log — the context-gathering questions
   are not asked
4. renders the phase note for the investigation phase with the verb
   Starting, and emits it as produced
5. hands off to the investigation processing skill for crash-fix

notes:
- the investigation file is created by the processing skill, not here
