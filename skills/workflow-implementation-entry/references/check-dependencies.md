# Check Dependencies

*Reference for **[workflow-implementation-entry](../SKILL.md)***

---

#### If work_type is not `epic`

→ Return to **[the skill](../SKILL.md)**.

#### If work_type is `epic`

Query the planning manifest entry for external dependencies:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} external_dependencies
```

#### If no external dependencies (empty or not found)

> *Output the next fenced block as a code block:*

```
External dependencies satisfied.
```

→ Return to **[the skill](../SKILL.md)**.

#### If external dependencies exist

For each dependency, check its state:

- **`unresolved`** → blocking
- **`resolved`** → query the dependency topic's completed tasks:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{dep_topic} completed_tasks
```

Check if `internal_id` appears in the completed tasks list. If yes → pass. If no (or implementation entry doesn't exist) → blocking.

- **`satisfied_externally`** → pass

**If all satisfied:**

> *Output the next fenced block as a code block:*

```
External dependencies satisfied.
```

→ Return to **[the skill](../SKILL.md)**.

**If any blocking:**

> *Output the next fenced block as a code block:*

```
Missing Dependencies

Unresolved (not yet planned):
  • {dep_topic}: {description}
    No plan exists. Mark as satisfied externally or plan it first.

Incomplete (planned but not implemented):
  • {dep_topic}: {topic}:{internal_id} not yet completed
    This task must be completed first.
```

Show only the sections that have entries. Use colon notation (`{topic}:{internal_id}`) for resolved deps.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`i`/`implement`** — Implement the blocking dependencies first
- **`s`/`satisfied`** — Mark a dependency as satisfied externally
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

---

## Escape Hatch

If the user says a dependency has been implemented outside the workflow:

1. Ask which dependency to mark as satisfied
2. Update the dependency's `state` to `satisfied_externally` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.state satisfied_externally
```

3. Commit the change
4. Re-check dependencies from the top of this reference

→ Return to **[the skill](../SKILL.md)**.
