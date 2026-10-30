# Conclude Scoping

*Reference for **[leeway-scoping-process](../SKILL.md)***

---

Render the completion display — the artifact paths derive from the work unit — and emit its section verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render phase-completed {work_unit} --phase scoping --paths
```

> *Output the next fenced block as markdown (not a code block):*

```
> Scoping complete. The implementation phase will execute these tasks using the verification workflow.
```

**Pipeline continuation** — Invoke `/leeway-bridge {work_unit} scoping`.

**STOP.** Do not proceed — terminal condition.
