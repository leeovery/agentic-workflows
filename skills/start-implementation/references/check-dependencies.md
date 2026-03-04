# Check Dependencies

*Reference for **[start-implementation](../SKILL.md)***

---

**This step is a confirmation gate.** Dependencies have been pre-analyzed by the discovery script.

After the plan is selected:

1. **Check the plan's `deps_satisfied` and `deps_blocking`** from the discovery output

#### If all deps satisfied (or no deps)

> *Output the next fenced block as a code block:*

```
External dependencies satisfied.
```

→ Return to **[the skill](../SKILL.md)**.

#### If any deps are blocking

This should not normally happen for plans classified as "Implementable" in display-plans.md. However, as an escape hatch:

> *Output the next fenced block as a code block:*

```
Missing Dependencies

Unresolved (not yet planned):
  • {topic}: {description}
    No plan exists. Create with /start-planning or mark as
    satisfied externally.

Incomplete (planned but not implemented):
  • {topic}: {plan}:{task-id} not yet completed
    This task must be completed first.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`i`/`implement`** — Implement the blocking dependencies first
- **`l`/`link`** — Run /link-dependencies to wire up recently completed plans
- **`s`/`satisfied`** — Mark a dependency as satisfied externally
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

---

## Escape Hatch

If the user says a dependency has been implemented outside the workflow:

1. Ask which dependency to mark as satisfied
2. Update the dependency's `state` to `satisfied_externally` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase planning --topic {topic} external_dependencies.{dep-topic}.state satisfied_externally`)
3. Commit the change
4. Re-check dependencies

→ Return to **[the skill](../SKILL.md)**.
