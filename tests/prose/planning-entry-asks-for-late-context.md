## case: planning-entry-asks-for-late-context
- origin: feature mainline — planning offers a last chance to add context
- files:
  - skills/workflow-planning-entry/SKILL.md
  - skills/workflow-planning-entry/references/validate-spec.md
  - skills/workflow-planning-entry/references/validate-phase.md
  - skills/workflow-planning-entry/references/cross-cutting-context.md

### given

world_before: feature-specified

### when

Execute skills/workflow-planning-entry/SKILL.md with arguments
$0=feature, $1=pay. Follow it to the point where the handoff to the
processing skill is constructed; record the handoff block and stop. Do
not execute the processing skill's instructions.

answers:
1. continue — nothing has changed since the specification

### then

world_after: unchanged

trace:
1. the specification gate renders empty — the spec is complete and the
   topic is clear to plan
2. no plan exists, so the fresh-start arm asks whether anything has
   changed since the specification, and waits
3. on continue, the source is fresh and carries no additional context
4. cross-cutting context is gathered regardless of work type: it finds
   no cross-cutting work units, then queries the knowledge base for
   completed cross-cutting specs
5. hands off to the planning processing skill for pay

notes:
- the knowledge base is queried, never written to, by an entry skill
