# Promote to Cross-Cutting Work Unit

*Reference for **[workflow-specification-process](../SKILL.md)***

---

Promote an epic specification assessed as cross-cutting to its own cross-cutting work unit.

Derive the new work unit name: `cc_work_unit = {topic}`. The original `{topic}` is only used when referencing the item within the epic's phases.

## A. Collision Check

Check if a work unit with this name already exists:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {cc_work_unit}
```

#### If `true`

Choose a descriptive alternative name that captures the cross-cutting concern (e.g., append a qualifier like `{topic}-policy`, `{topic}-patterns`, or use a more specific name derived from the specification content). Set `cc_work_unit` to the new name.

→ Return to **A. Collision Check**.

#### If `false`

→ Proceed to **B. Promote**.

## B. Promote

One engine transaction owns the promotion: it creates the cross-cutting work unit (no session log — this creation is a promotion, not a discovery entry; already completed, since the pipeline is terminal after spec and the spec is complete; origin provenance recorded), moves the specification to `specification/{cc_work_unit}/`, moves each spec source whose discussion file exists into the new unit's `discussion/`, marks the epic's spec item `promoted` with `promoted_to`, re-homes the knowledge-base chunks, and commits both work units plus the project manifest:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit promote {work_unit} {topic} --to {cc_work_unit} --description "{one-line summary from spec}"
```

→ Proceed to **C. Display**.

## C. Display

Emit the response's `DISPLAY: kb warning` section when present, then its `DISPLAY: confirmation` section — each verbatim per its marker.

Invoke the bridge for the EPIC (not the cc work unit — the epic continues its pipeline):

Invoke `/workflow-bridge {work_unit} specification`.
