## case: spec-entry-from-discussion
- origin: feature mainline — a feature's spec draws on its discussion
- files:
  - skills/workflow-specification-entry/SKILL.md
  - skills/workflow-specification-entry/references/validate-source.md
  - skills/workflow-specification-entry/references/validate-phase.md
  - skills/workflow-specification-entry/references/invoke-skill.md

### given

world_before: feature-discussed

### when

Execute skills/workflow-specification-entry/SKILL.md with arguments
$0=feature, $1=pay. Follow it to the point where the handoff to the
processing skill is constructed; record the handoff block and stop. Do
not execute the processing skill's instructions.

### then

world_after: unchanged

trace:
1. resolves the topic to the work unit and goes straight to validating
   source material — the scoped path is for an epic with no topic
2. the source-material gate renders empty: the completed discussion
   satisfies the prerequisite
3. no specification item exists, so the verb is Creating — no resume
   note is rendered and nothing is reopened
4. hands off naming `.workflows/pay/discussion/pay.md` as the source

notes:
- an entry that only validates writes nothing
