# Conclude Scoping

*Reference for **[workflow-scoping-process](../SKILL.md)***

---

Render the completion display — the artifact paths derive from the work unit — and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-completed {work_unit} --phase scoping --paths
```

> *Output the next fenced block as markdown (not a code block):*

```
> Scoping complete. The implementation phase will execute
> these tasks using the verification workflow.
```

**Pipeline continuation** — invoke the **workflow-bridge** skill (Skill tool) — the next fenced block is its arguments:

```
Pipeline bridge for: {work_unit}
Completed phase: scoping
```

**STOP.** Do not proceed — terminal condition.
