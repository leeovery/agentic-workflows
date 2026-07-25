## case: feature-spec-entry-handoff
- world: feature-discussed
- origin: feature mainline — specification entry validates and hands off the discussion
- files:
  - skills/workflow-specification-entry/SKILL.md
  - skills/workflow-specification-entry/references/validate-source.md
  - skills/workflow-specification-entry/references/validate-phase.md
  - skills/workflow-specification-entry/references/invoke-skill.md

### walk

Execute skills/workflow-specification-entry/SKILL.md with arguments
$0=feature, $1=pay. Follow it up to the point where the handoff to the
processing skill is constructed — record the handoff arguments block —
and stop there. Do not execute the processing skill's instructions.

### expect

- routing: the source-material entry gate passes (empty render) — the discussion is complete
- routing: with no specification item in the manifest, the verb is Creating — no resume note, no reopen
- routing: the handoff names the discussion file .workflows/pay/discussion/pay.md as source material
- state: manifest absent pay.specification.pay status
