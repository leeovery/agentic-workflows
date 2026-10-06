# Handoff: Create With Incorporation

*Reference for **[confirm-create.md](../confirm-create.md)***

---

This skill's purpose is now fulfilled.

A proposed grouping is never an "existing specification to incorporate" — it has no file; absorbing it is a delete handled by reconcile, not a supersede.

Invoke the **workflow-specification-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Specification session for: {Title Case Name}

Source discussions:
- .workflows/{work_unit}/discussion/{discussion-name}.md
- .workflows/{work_unit}/discussion/{discussion-name}.md

Existing specifications to incorporate:
- .workflows/{work_unit}/specification/{source-topic}/specification.md (covers: {discussion-name} discussion)

Output: .workflows/{work_unit}/specification/{topic}/specification.md

Context: This consolidates multiple sources. The existing specification should be incorporated - extract and adapt its content alongside the discussion material. The result should be a unified specification, not a simple merge.

After the specification is complete, mark the incorporated specs as superseded via the engine — only specs whose status is not `proposed`:

    node .claude/skills/workflow-engine/scripts/engine.cjs topic supersede {work_unit} specification {source-topic} --by {topic}
```
