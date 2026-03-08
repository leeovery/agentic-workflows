# Check Dependencies

*Reference for **[workflow-implementation-entry](../SKILL.md)***

---

Query the planning manifest entry for external dependencies:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} external_dependencies
```

#### If no external dependencies (empty or not found)

> *Output the next fenced block as a code block:*

```
External dependencies satisfied.
```

→ Return to **[the skill](../SKILL.md)**.

#### If external dependencies exist

For each dependency, check its state. If the dependency has a `task_id`, check whether that task is completed by querying the dependency's plan:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {dep_topic} status
```

**If all dependencies are satisfied** (state is `satisfied` or `satisfied_externally`, and any referenced tasks are completed):

> *Output the next fenced block as a code block:*

```
External dependencies satisfied.
```

→ Return to **[the skill](../SKILL.md)**.

**If any dependencies are blocking:**

> *Output the next fenced block as a code block:*

```
Missing Dependencies

Unresolved (not yet planned):
  • {topic}: {description}
    No plan exists. Mark as satisfied externally or plan it first.

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
