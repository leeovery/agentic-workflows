# Handoff: Unify With Incorporation

*Reference for **[confirm-unify.md](../confirm-unify.md)***

---

This skill's purpose is now fulfilled.

Invoke the **workflow-specification-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Specification session for: Unified

Source discussions:
- .workflows/{work_unit}/discussion/{discussion-name}.md
- .workflows/{work_unit}/discussion/{discussion-name}.md
...

Existing specifications to incorporate:
- .workflows/{work_unit}/specification/{topic}/specification.md
- .workflows/{work_unit}/specification/{topic}/specification.md

Output: .workflows/{work_unit}/specification/unified/specification.md

Context: This consolidates all discussions into a single unified specification. The existing specifications should be incorporated - extract and adapt their content alongside the discussion material.

After the unified specification is complete, mark the incorporated specs as superseded via the engine — only specs whose status is not `proposed`:

    node .claude/skills/workflow-engine/scripts/engine.cjs topic supersede {work_unit} specification {source-topic} --by unified
```

A proposed grouping is never an "existing specification to incorporate" — it has no file; reconcile already removed the other proposed items as deletes when the unified item was created.
