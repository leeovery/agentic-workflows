## case: discussion-entry-seeds-from-carrier
- origin: feature mainline — single-phase work seeds from its durable carrier
- files:
  - skills/workflow-discussion-entry/SKILL.md
  - skills/workflow-shared/references/ensure-discovery-item.md

### given

world_before: feature-created

### when

Execute skills/workflow-discussion-entry/SKILL.md with arguments
$0=feature, $1=pay. Follow it to the point where the handoff to the
processing skill is constructed; record the handoff block and stop. Do
not execute the processing skill's instructions.

### then

world_after: unchanged

trace:
1. resolves the topic to the work unit, since only an epic is given one
   explicitly
2. reads the discussion status, finds nothing, and takes the new-entry
   arm — phase validation is for entries that already exist
3. ensuring a discovery item returns immediately: the map is epic-only,
   and this is a feature
4. seeds the context from the manifest description and the session log's
   exploration, asking the user nothing
5. hands off to the discussion processing skill for pay

notes:
- the entry skill records nothing: the discussion item is created by the
  processing skill, not by the walk to it
